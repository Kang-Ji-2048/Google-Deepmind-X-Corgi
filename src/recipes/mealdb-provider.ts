import type {
  RecipeProvider,
  RecipeProviderAttribution,
  RecipeProviderQuery,
  RecipeSourceDocument
} from "./types.ts";

type Fetch = typeof fetch;
type JsonObject = Record<string, unknown>;

export interface MealDbRecipeProviderOptions {
  /** TheMealDB documents `1` as its free development/educational key. */
  apiKey?: string;
  timeoutMs?: number;
  operationTimeoutMs?: number;
  maxResponseBytes?: number;
  maxIngredientQueries?: number;
  maxRecipes?: number;
  fetch?: Fetch;
  signal?: AbortSignal;
}

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function meals(payload: unknown): JsonObject[] {
  const value = object(payload)?.meals;
  if (!Array.isArray(value)) return [];
  const result: JsonObject[] = [];
  for (const item of value) {
    const meal = object(item);
    if (meal) result.push(meal);
  }
  return result;
}

function safeSourceUrl(value: unknown): string | undefined {
  const source = text(value);
  if (!source) return undefined;
  try {
    const url = new URL(source);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

async function readJson(response: Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > maxBytes) throw new Error("TheMealDB response exceeds the byte limit");
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    signal.throwIfAborted();
    const result = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      reader.read().then(
        (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
        (error) => { signal.removeEventListener("abort", onAbort); reject(error); }
      );
    });
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("TheMealDB response exceeds the byte limit");
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("TheMealDB returned invalid JSON"); }
}

function queryValue(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function mealDocument(meal: JsonObject): RecipeSourceDocument | undefined {
  const sourceUrl = safeSourceUrl(meal.strSource);
  const name = text(meal.strMeal);
  if (!sourceUrl || !name) return undefined;
  const ingredientLines: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = text(meal[`strIngredient${index}`]);
    if (!ingredient) continue;
    const measure = text(meal[`strMeasure${index}`]);
    ingredientLines.push([measure, ingredient].filter(Boolean).join(" "));
  }
  if (ingredientLines.length === 0) return undefined;
  const image = safeSourceUrl(meal.strMealThumb);
  const cuisine = text(meal.strArea);
  return {
    sourceUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name,
      url: sourceUrl,
      ...(image ? { image } : {}),
      ...(cuisine ? { recipeCuisine: cuisine } : {}),
      recipeIngredient: ingredientLines
    }
  };
}

export class MealDbRecipeProvider implements RecipeProvider {
  readonly name = "themealdb-free";
  private readonly options: Required<Pick<MealDbRecipeProviderOptions,
    "apiKey" | "timeoutMs" | "operationTimeoutMs" | "maxResponseBytes" | "maxIngredientQueries" | "maxRecipes">> &
    MealDbRecipeProviderOptions;
  private attribution?: RecipeProviderAttribution;

  constructor(options: MealDbRecipeProviderOptions = {}) {
    const apiKey = options.apiKey ?? "1";
    if (!/^[a-z0-9]{1,64}$/i.test(apiKey)) throw new Error("Invalid TheMealDB API key");
    this.options = {
      ...options,
      apiKey,
      timeoutMs: options.timeoutMs ?? 10_000,
      operationTimeoutMs: options.operationTimeoutMs ?? 45_000,
      maxResponseBytes: options.maxResponseBytes ?? 1_048_576,
      maxIngredientQueries: Math.min(Math.max(options.maxIngredientQueries ?? 4, 1), 8),
      maxRecipes: Math.min(Math.max(options.maxRecipes ?? 10, 1), 20)
    };
  }

  getAttribution(): RecipeProviderAttribution | undefined {
    return this.attribution ? structuredClone(this.attribution) : undefined;
  }

  private async request(path: string, params: Record<string, string>, operationSignal: AbortSignal): Promise<unknown> {
    const url = new URL(`https://www.themealdb.com/api/json/v1/${this.options.apiKey}/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const signal = AbortSignal.any([operationSignal, AbortSignal.timeout(this.options.timeoutMs)]);
    const response = await (this.options.fetch ?? fetch)(url, {
      signal,
      headers: { Accept: "application/json", "User-Agent": "WhatCanICookRecipeSearch/1.0" }
    });
    if (!response.ok) throw new Error(`TheMealDB request failed with HTTP ${response.status}`);
    return readJson(response, this.options.maxResponseBytes, signal);
  }

  async search(query: RecipeProviderQuery): Promise<readonly RecipeSourceDocument[]> {
    this.attribution = undefined;
    const operationSignal = AbortSignal.any([
      AbortSignal.timeout(this.options.operationTimeoutMs),
      ...(this.options.signal ? [this.options.signal] : [])
    ]);
    const ingredientScores = new Map<string, number>();
    const cuisineIds = new Set<string>();
    const ingredientQueries = query.ingredients.map(queryValue).filter(Boolean).slice(0, this.options.maxIngredientQueries);
    const cuisineQueries = (query.constraints.cuisines ?? []).map(queryValue).filter(Boolean).slice(0, 3);
    const searches = [
      ...cuisineQueries.map(async (cuisine) => ({
        kind: "cuisine" as const,
        payload: await this.request("filter.php", { a: cuisine }, operationSignal)
      })),
      ...ingredientQueries.map(async (ingredient) => ({
        kind: "ingredient" as const,
        payload: await this.request("filter.php", { i: ingredient.replaceAll(" ", "_") }, operationSignal)
      }))
    ];
    for (const result of await Promise.all(searches)) {
      for (const meal of meals(result.payload)) {
        const id = text(meal.idMeal);
        if (!id) continue;
        if (result.kind === "cuisine") cuisineIds.add(id);
        else ingredientScores.set(id, (ingredientScores.get(id) ?? 0) + 1);
      }
    }
    const candidates = ingredientQueries.length > 0
      ? [...ingredientScores.entries()]
      : [...cuisineIds].map((id) => [id, 0] as [string, number]);
    const ids = candidates.sort((left, right) =>
      (Number(cuisineIds.has(right[0])) - Number(cuisineIds.has(left[0]))) || right[1] - left[1]
    )
      .slice(0, Math.min(query.limit ?? this.options.maxRecipes, this.options.maxRecipes))
      .map(([id]) => id);
    const details = await Promise.all(ids.map((id) => this.request("lookup.php", { i: id }, operationSignal)));
    const documents = details.flatMap((payload) => meals(payload).flatMap((meal) => mealDocument(meal) ?? []))
      .filter((document, index, all) => all.findIndex((candidate) => candidate.sourceUrl === document.sourceUrl) === index);
    this.attribution = {
      sources: documents.map((document) => ({
        url: document.sourceUrl,
        title: text(object(document.jsonLd)?.name)
      })),
      queries: [
        ...cuisineQueries.map((value) => `cuisine:${value}`),
        ...ingredientQueries.map((value) => `ingredient:${value}`)
      ]
    };
    return documents;
  }
}

import { normalizeRecipeDocument } from "./normalize.ts";
import { safeFetchPublisherHtml, type HostResolver, type PinnedRequest } from "./safe-web.ts";
import type {
  RecipeProvider,
  RecipeProviderAttribution,
  RecipeProviderQuery,
  RecipeSourceDocument
} from "./types.ts";

type Fetch = typeof fetch;

export interface GeminiGroundedRecipeProviderOptions {
  apiKey: string;
  apiBaseUrl?: string;
  model?: string;
  timeoutMs?: number;
  operationTimeoutMs?: number;
  maxResponseBytes?: number;
  maxPages?: number;
  maxRedirects?: number;
  concurrency?: number;
  fetch?: Fetch;
  resolveHost?: HostResolver;
  publisherRequest?: PinnedRequest;
  signal?: AbortSignal;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function groundedHttpsUrl(value: unknown): string | undefined {
  const text = safeText(value);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function buildDiscoveryPrompt(query: RecipeProviderQuery): string {
  const clean = (value: string) => value.replace(/[\r\n"`]/g, " ").replace(/\s+/g, " ").trim();
  const cuisines = (query.constraints.cuisines ?? []).map(clean).filter(Boolean);
  const ingredients = query.ingredients.map(clean).filter(Boolean);
  const diets = (query.constraints.dietaryRestrictions ?? []).map(clean).filter(Boolean);
  const allergies = (query.constraints.allergies ?? []).map(clean).filter(Boolean);
  return [
    "Use Google Search to find individual recipe pages on their original publisher websites.",
    cuisines.length ? `Cuisine preference (prioritize first): ${cuisines.join(", ")}.` : "",
    `Confirmed ingredients: ${ingredients.join(", ")}.`,
    diets.length ? `Dietary requirements: ${diets.join(", ")}.` : "",
    allergies.length ? `Allergies to avoid: ${allergies.join(", ")}.` : "",
    "Return grounded sources from recipe publisher pages, not category pages, search pages, or invented recipes."
  ].filter(Boolean).join(" ").slice(0, 2_000);
}

async function readBoundedResponse(response: Response, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > maxBytes) throw new Error("Google grounding response exceeds the byte limit");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    signal.throwIfAborted();
    const { value, done } = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      reader.read().then(
        (result) => {
          signal.removeEventListener("abort", onAbort);
          resolve(result);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      );
    });
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Google grounding response exceeds the byte limit");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function extractRecipeJsonLd(html: string, sourceUrl: string): RecipeSourceDocument | undefined {
  const values: unknown[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    if (!/\btype\s*=\s*["']application\/ld\+json(?:;[^"']*)?["']/i.test(match[1])) continue;
    try {
      values.push(JSON.parse(match[2].trim()));
    } catch {
      // Publishers often include unrelated malformed JSON-LD. Ignore only that block.
    }
  }
  if (values.length === 0) return undefined;
  const document = { sourceUrl, jsonLd: values.length === 1 ? values[0] : values };
  return normalizeRecipeDocument(document).length > 0 ? document : undefined;
}

export class GeminiGroundedRecipeProvider implements RecipeProvider {
  readonly name = "google-grounded-web";
  private readonly options: Required<Pick<GeminiGroundedRecipeProviderOptions,
    "apiBaseUrl" | "model" | "timeoutMs" | "operationTimeoutMs" | "maxResponseBytes" | "maxPages" | "maxRedirects" | "concurrency">> &
    GeminiGroundedRecipeProviderOptions;
  private attribution?: RecipeProviderAttribution;

  constructor(options: GeminiGroundedRecipeProviderOptions) {
    if (!options.apiKey.trim()) throw new Error("A Gemini API key is required for grounded recipe search");
    const apiBaseUrl = new URL(options.apiBaseUrl ?? "https://generativelanguage.googleapis.com/v1beta");
    if (apiBaseUrl.protocol !== "https:" || apiBaseUrl.hostname !== "generativelanguage.googleapis.com") {
      throw new Error("Gemini API base URL must be the official generativelanguage.googleapis.com HTTPS endpoint");
    }
    const model = options.model ?? "gemini-3.6-flash";
    if (!/^[a-z0-9][a-z0-9._-]{1,80}$/i.test(model)) throw new Error("Invalid Gemini model name");
    this.options = {
      ...options,
      apiBaseUrl: apiBaseUrl.href.replace(/\/$/, ""),
      model,
      timeoutMs: options.timeoutMs ?? 10_000,
      operationTimeoutMs: options.operationTimeoutMs ?? 45_000,
      maxResponseBytes: options.maxResponseBytes ?? 1_048_576,
      maxPages: Math.min(Math.max(options.maxPages ?? 10, 1), 10),
      maxRedirects: Math.min(Math.max(options.maxRedirects ?? 3, 0), 5),
      concurrency: Math.min(Math.max(options.concurrency ?? 3, 1), 5)
    };
  }

  getAttribution(): RecipeProviderAttribution | undefined {
    return this.attribution ? structuredClone(this.attribution) : undefined;
  }

  async search(query: RecipeProviderQuery): Promise<readonly RecipeSourceDocument[]> {
    this.attribution = undefined;
    const operationSignal = AbortSignal.any([
      AbortSignal.timeout(this.options.operationTimeoutMs),
      ...(this.options.signal ? [this.options.signal] : [])
    ]);
    operationSignal.throwIfAborted();
    const googleSignal = AbortSignal.any([operationSignal, AbortSignal.timeout(this.options.timeoutMs)]);
    const response = await (this.options.fetch ?? fetch)(
        `${this.options.apiBaseUrl}/models/${encodeURIComponent(this.options.model)}:generateContent`,
        {
          method: "POST",
          signal: googleSignal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.options.apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildDiscoveryPrompt(query) }] }],
            tools: [{ google_search: {} }]
          })
        }
      );
    const bytes = await readBoundedResponse(response, this.options.maxResponseBytes, googleSignal);
    const body = new TextDecoder().decode(bytes);
    if (!response.ok) throw new Error(`Gemini grounding request failed with HTTP ${response.status}`);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error("Gemini grounding returned invalid JSON");
    }

    const candidate = object(array(object(payload)?.candidates)[0]);
    const metadata = object(candidate?.groundingMetadata);
    const chunks = array(metadata?.groundingChunks);
    const sources = chunks.flatMap((chunk) => {
      const web = object(object(chunk)?.web);
      const url = groundedHttpsUrl(web?.uri);
      if (!url) return [];
      return [{ url, ...(safeText(web?.title) ? { title: safeText(web?.title) } : {}) }];
    }).filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index);
    this.attribution = {
      sources,
      queries: array(metadata?.webSearchQueries).flatMap((value) => safeText(value) ?? []),
      ...(safeText(object(metadata?.searchEntryPoint)?.renderedContent)
        ? { searchEntryPointHtml: safeText(object(metadata?.searchEntryPoint)?.renderedContent) }
        : {})
    };

    const selected = sources.slice(0, Math.min(this.options.maxPages, Math.max(query.limit ?? 6, 1) * 2));
    const documents: Array<RecipeSourceDocument | undefined> = new Array(selected.length);
    let cursor = 0;
    let retrievalErrors = 0;
    const worker = async () => {
      while (cursor < selected.length) {
        operationSignal.throwIfAborted();
        const index = cursor++;
        try {
          const page = await safeFetchPublisherHtml(selected[index].url, {
            timeoutMs: this.options.timeoutMs,
            maxResponseBytes: this.options.maxResponseBytes,
            maxRedirects: this.options.maxRedirects,
            signal: operationSignal,
            ...(this.options.resolveHost ? { resolveHost: this.options.resolveHost } : {}),
            ...(this.options.publisherRequest ? { request: this.options.publisherRequest } : {})
          });
          documents[index] = extractRecipeJsonLd(page.html, page.finalUrl);
        } catch (error) {
          if (operationSignal.aborted) throw error;
          retrievalErrors += 1;
          documents[index] = undefined;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.options.concurrency, selected.length) }, worker));
    if (selected.length > 0 && retrievalErrors === selected.length) {
      throw new Error("No grounded publisher pages could be retrieved safely");
    }
    return documents.filter((document): document is RecipeSourceDocument => document !== undefined)
      .filter((document, index, all) => all.findIndex((candidate) => candidate.sourceUrl === document.sourceUrl) === index);
  }
}

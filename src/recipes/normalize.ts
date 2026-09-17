import type { NormalizedRecipe, RecipeSourceDocument } from "./types.ts";

type JsonObject = Record<string, unknown>;

const UNIT_WORDS = new Set([
  "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp",
  "gram", "grams", "g", "kilogram", "kilograms", "kg", "ounce", "ounces", "oz",
  "pound", "pounds", "lb", "lbs", "ml", "milliliter", "milliliters", "liter", "liters",
  "clove", "cloves", "slice", "slices", "piece", "pieces", "can", "cans", "pinch",
  "bunch", "bunches", "package", "packages", "large", "medium", "small"
]);

const PREPARATION_WORDS = new Set([
  "fresh", "chopped", "diced", "minced", "sliced", "crushed", "grated", "shredded",
  "peeled", "divided", "optional", "ripe", "roughly", "finely", "thinly", "to", "taste"
]);

const CANONICAL: Record<string, string> = {
  "scallions": "green onion",
  "spring onions": "green onion",
  "garbanzo beans": "chickpea",
  "chickpeas": "chickpea",
  "tomatoes": "tomato",
  "potatoes": "potato",
  "eggs": "egg",
  "bell peppers": "bell pepper",
  "peppers": "pepper",
  "courgette": "zucchini",
  "aubergine": "eggplant"
};

export function normalizeIngredientName(value: string): string {
  const simple = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(",", 1)[0]
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞\d./-]+/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !UNIT_WORDS.has(word) && !PREPARATION_WORDS.has(word))
    .join(" ")
    .trim();

  if (CANONICAL[simple]) return CANONICAL[simple];
  if (simple.endsWith("ies") && simple.length > 4) return `${simple.slice(0, -3)}y`;
  if (simple.endsWith("s") && !simple.endsWith("ss") && simple.length > 3) {
    return simple.slice(0, -1);
  }
  return simple;
}

export function parseDurationMinutes(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== "string") return undefined;
  const iso = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (iso) {
    return Number(iso[1] ?? 0) * 1440 + Number(iso[2] ?? 0) * 60 +
      Number(iso[3] ?? 0) + Math.ceil(Number(iso[4] ?? 0) / 60);
  }
  const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const minutes = value.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  const total = Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
  return total > 0 ? total : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (isObject(value) && typeof value.name === "string") return [value.name];
  return [];
}

function recipeNodes(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(recipeNodes);
  if (!isObject(value)) return [];
  const ownTypes = strings(value["@type"]).map((item) => item.toLowerCase());
  const own = ownTypes.includes("recipe") ? [value] : [];
  return [...own, ...recipeNodes(value["@graph"]), ...recipeNodes(value.mainEntity)];
}

function imageUrl(value: unknown): string | undefined {
  if (typeof value === "string") return validUrl(value);
  if (Array.isArray(value)) return value.map(imageUrl).find(Boolean);
  if (isObject(value)) return validUrl(String(value.url ?? value.contentUrl ?? ""));
  return undefined;
}

function validUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function canonicalSourceUrl(node: JsonObject, fallback: string): string | undefined {
  const mainEntity = isObject(node.mainEntityOfPage) ? node.mainEntityOfPage["@id"] : undefined;
  const fallbackUrl = validUrl(fallback);
  if (!fallbackUrl) return undefined;
  const candidate = validUrl(strings(node.url)[0] ?? strings(mainEntity)[0] ?? "");
  if (!candidate) return fallbackUrl;
  return new URL(candidate).hostname === new URL(fallbackUrl).hostname ? candidate : fallbackUrl;
}

export function normalizeRecipeDocument(document: RecipeSourceDocument): NormalizedRecipe[] {
  return recipeNodes(document.jsonLd).flatMap((node, index) => {
    const name = strings(node.name)[0]?.trim();
    const sourceUrl = canonicalSourceUrl(node, document.sourceUrl);
    const ingredientLines = strings(node.recipeIngredient ?? node.ingredients)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!name || !sourceUrl || ingredientLines.length === 0) return [];

    const aggregate = isObject(node.aggregateRating) ? node.aggregateRating : undefined;
    const ratingValue = Number(aggregate?.ratingValue);
    const bestRating = Number(aggregate?.bestRating ?? 5);
    const ratingCount = Number(aggregate?.ratingCount ?? aggregate?.reviewCount ?? 0);
    const hasRating = Number.isFinite(ratingValue) && ratingValue >= 0 &&
      Number.isFinite(bestRating) && bestRating > 0;
    const equipmentValue = node.tool ?? node.equipment;
    const equipment = strings(equipmentValue).map(normalizeIngredientName).filter(Boolean);
    const publisher = strings(node.publisher ?? node.author)[0];

    return [{
      id: `${sourceUrl}#${index}`,
      name,
      sourceUrl,
      ...(publisher ? { publisher } : {}),
      ...(imageUrl(node.image) ? { imageUrl: imageUrl(node.image) } : {}),
      ingredientLines,
      ingredientNames: ingredientLines.map(normalizeIngredientName).filter(Boolean),
      ...(parseDurationMinutes(node.totalTime ?? node.cookTime) !== undefined
        ? { totalTimeMinutes: parseDurationMinutes(node.totalTime ?? node.cookTime) }
        : {}),
      equipment,
      equipmentKnown: equipmentValue !== undefined,
      cuisines: strings(node.recipeCuisine).map((cuisine) => cuisine.trim()).filter(Boolean),
      suitableForDiet: strings(node.suitableForDiet).map((diet) => diet.toLowerCase()),
      ...(hasRating ? {
        rating: {
          value: Math.min(ratingValue, bestRating),
          best: bestRating,
          count: Number.isFinite(ratingCount) && ratingCount > 0 ? Math.floor(ratingCount) : 0
        }
      } : {})
    } satisfies NormalizedRecipe];
  });
}

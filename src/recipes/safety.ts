import { normalizeIngredientName } from "./normalize.ts";
import type { NormalizedRecipe, RecipeConstraints } from "./types.ts";

const GROUPS: Record<string, readonly string[]> = {
  dairy: ["milk", "cream", "butter", "cheese", "yogurt", "whey", "casein", "ghee"],
  egg: ["egg", "mayonnaise", "meringue"],
  gluten: ["wheat", "barley", "rye", "flour", "bread", "pasta", "couscous", "soy sauce"],
  peanut: ["peanut", "groundnut"],
  "tree nut": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "mussel", "clam", "oyster", "scallop"],
  fish: ["fish", "salmon", "tuna", "cod", "anchovy", "sardine", "trout"],
  soy: ["soy", "tofu", "tempeh", "miso", "edamame"],
  sesame: ["sesame", "tahini"],
  mustard: ["mustard"]
};

const DIET_FORBIDDEN: Record<string, readonly string[]> = {
  vegan: [...GROUPS.dairy, ...GROUPS.egg, ...GROUPS.fish, ...GROUPS.shellfish, "meat", "beef", "pork", "chicken", "turkey", "lamb", "honey", "gelatin"],
  vegetarian: [...GROUPS.fish, ...GROUPS.shellfish, "meat", "beef", "pork", "chicken", "turkey", "lamb", "gelatin"],
  pescatarian: ["meat", "beef", "pork", "chicken", "turkey", "lamb", "gelatin"],
  "gluten-free": GROUPS.gluten,
  "dairy-free": GROUPS.dairy,
  halal: ["pork", "bacon", "ham", "lard", "alcohol", "wine", "beer"],
  kosher: ["pork", "bacon", "ham", ...GROUPS.shellfish]
};

function mentions(value: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(value);
}

function explicitlyFreeOf(line: string, term: string): boolean {
  const compact = line.toLowerCase();
  if (term === "gluten" || GROUPS.gluten.includes(term)) return compact.includes("gluten-free");
  if (term === "dairy" || GROUPS.dairy.includes(term)) {
    if (compact.includes("dairy-free") || compact.includes("non-dairy") || compact.includes("vegan")) return true;
    if (term === "milk" && /\b(?:almond|oat|soy|coconut|rice|hemp|pea) milk\b/.test(compact)) return true;
    if (term === "cream" && /\b(?:coconut|oat|soy|cashew) cream\b/.test(compact)) return true;
    if (term === "butter" && /\b(?:peanut|almond|cashew|sunflower|apple) butter\b/.test(compact)) return true;
  }
  return compact.includes(`${term}-free`) || compact.includes(`${term} free`);
}

function aliases(restriction: string): readonly string[] {
  const normalized = normalizeIngredientName(restriction);
  if (GROUPS[normalized]) return GROUPS[normalized];
  if (normalized === "nuts" || normalized === "nut") return [...GROUPS.peanut, ...GROUPS["tree nut"]];
  return [normalized];
}

function matchingLines(recipe: NormalizedRecipe, forbidden: readonly string[]): string[] {
  return recipe.ingredientLines.filter((line, index) => {
    const normalized = recipe.ingredientNames[index] ?? normalizeIngredientName(line);
    return forbidden.some((term) => mentions(normalized, normalizeIngredientName(term)) && !explicitlyFreeOf(line, term));
  });
}

export function safetyRejectionReasons(recipe: NormalizedRecipe, constraints: RecipeConstraints): string[] {
  const reasons: string[] = [];
  for (const allergy of constraints.allergies ?? []) {
    const matches = matchingLines(recipe, aliases(allergy));
    if (matches.length > 0) reasons.push(`allergy:${normalizeIngredientName(allergy)}`);
  }
  for (const dietValue of constraints.dietaryRestrictions ?? []) {
    const diet = dietValue.toLowerCase().trim().replaceAll("_", "-");
    const forbidden = DIET_FORBIDDEN[diet];
    if (!forbidden) {
      // Never silently claim compliance with a rule set this module cannot evaluate.
      reasons.push(`diet:unsupported:${diet}`);
    } else if (matchingLines(recipe, forbidden).length > 0) {
      reasons.push(`diet:${diet}`);
    }
  }
  return [...new Set(reasons)];
}

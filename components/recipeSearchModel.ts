import type { ConfirmedIngredient, RankedRecipe, RecipeProviderAttribution } from "@/src/recipes/types";

export interface EditableIngredient {
  id: string;
  name: string;
  quantity: string;
  useSoon: boolean;
}

export interface RecipeFilterState {
  cuisines: string[];
  maxTotalTimeMinutes?: number;
  maxMissingIngredients?: number;
  dietaryRestrictions: string[];
  allergies: string;
  pantryStaples: string;
  availableEquipment: string;
}

export interface RecipeSearchRequest {
  ingredients: ConfirmedIngredient[];
  constraints: {
    cuisines: string[];
    maxTotalTimeMinutes?: number;
    maxMissingIngredients?: number;
    enforceTimeLimit?: boolean;
    enforceEquipment?: boolean;
    dietaryRestrictions?: string[];
    allergies?: string[];
    pantryStaples?: string[];
    availableEquipment?: string[];
  };
}

export interface RecipeSearchResponse {
  recipes: RankedRecipe[];
  rejected: Array<{ sourceUrl: string; name?: string; reasons: string[] }>;
  provider: string;
  attribution?: RecipeProviderAttribution;
}

export function splitList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildRecipeSearchRequest(
  ingredients: EditableIngredient[],
  filters: RecipeFilterState
): RecipeSearchRequest {
  const confirmed = ingredients.flatMap(({ name, quantity, useSoon }) => {
    const cleanName = name.trim();
    if (!cleanName) return [];
    return [{
      name: cleanName,
      ...(quantity.trim() ? { quantity: quantity.trim() } : {}),
      ...(useSoon ? { useSoon: true } : {})
    }];
  });
  const allergies = splitList(filters.allergies);
  const pantryStaples = splitList(filters.pantryStaples);
  const availableEquipment = splitList(filters.availableEquipment);

  return {
    ingredients: confirmed,
    constraints: {
      cuisines: filters.cuisines,
      ...(filters.maxTotalTimeMinutes ? { maxTotalTimeMinutes: filters.maxTotalTimeMinutes } : {}),
      ...(filters.maxTotalTimeMinutes ? { enforceTimeLimit: true } : {}),
      ...(filters.maxMissingIngredients !== undefined
        ? { maxMissingIngredients: filters.maxMissingIngredients }
        : {}),
      ...(filters.dietaryRestrictions.length
        ? { dietaryRestrictions: filters.dietaryRestrictions }
        : {}),
      ...(allergies.length ? { allergies } : {}),
      ...(pantryStaples.length ? { pantryStaples } : {}),
      ...(availableEquipment.length ? { availableEquipment } : {}),
      ...(availableEquipment.length ? { enforceEquipment: true } : {})
    }
  };
}

export function isRecipeSearchResponse(value: unknown): value is RecipeSearchResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecipeSearchResponse>;
  return Array.isArray(candidate.recipes)
    && Array.isArray(candidate.rejected)
    && typeof candidate.provider === "string";
}

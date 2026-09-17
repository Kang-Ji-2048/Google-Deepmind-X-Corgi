import type { RecipeSearchInput } from "./recipes/types.ts";

export class SearchInputError extends Error {}
const fail = (message: string): never => { throw new SearchInputError(message); };
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 100): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) fail(`${label} must be 1-${max} characters.`);
  return (value as string).trim();
}
function strings(value: unknown, label: string, max = 20): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be a list of up to ${max} items.`);
  return [...new Set((value as unknown[]).map((item) => text(item, label)))];
}
function integer(value: unknown, label: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return value as number;
}

/** Runtime boundary: client JSON cannot select upstream endpoints or send unbounded prompts. */
export function parseSearchInput(value: unknown): RecipeSearchInput {
  const input = record(value, "Search request");
  if (!Array.isArray(input.ingredients) || input.ingredients.length < 1 || input.ingredients.length > 50) fail("Add 1-50 confirmed ingredients.");
  const ingredients = (input.ingredients as unknown[]).map((item) => {
    const ingredient = record(item, "Ingredient");
    if (ingredient.useSoon !== undefined && typeof ingredient.useSoon !== "boolean") fail("Use-soon must be true or false.");
    return {
      name: text(ingredient.name, "Ingredient name"),
      ...(ingredient.quantity === undefined ? {} : { quantity: text(ingredient.quantity, "Quantity") }),
      ...(ingredient.useSoon === undefined ? {} : { useSoon: ingredient.useSoon as boolean }),
    };
  });
  const source = input.constraints === undefined ? {} : record(input.constraints, "Preferences");
  const constraints = {
    cuisines: strings(source.cuisines, "Cuisine", 10),
    allergies: strings(source.allergies, "Allergies"),
    dietaryRestrictions: strings(source.dietaryRestrictions, "Diet", 10),
    pantryStaples: strings(source.pantryStaples, "Pantry staples", 30),
    availableEquipment: strings(source.availableEquipment, "Equipment", 20),
    maxTotalTimeMinutes: integer(source.maxTotalTimeMinutes, "Cooking time", 5, 480),
    maxMissingIngredients: integer(source.maxMissingIngredients, "Missing ingredients", 0, 30),
    enforceTimeLimit: source.maxTotalTimeMinutes !== undefined,
    enforceEquipment: Array.isArray(source.availableEquipment) && source.availableEquipment.length > 0,
  };
  return {
    ingredients,
    constraints,
    ...(input.locale === undefined ? {} : { locale: text(input.locale, "Locale", 35) }),
  };
}

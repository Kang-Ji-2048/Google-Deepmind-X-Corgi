import { normalizeIngredientName } from "./normalize.ts";
import type {
  ConfirmedIngredient,
  NormalizedRecipe,
  RankedRecipe,
  RecipeConstraints,
  RecommendationBadge
} from "./types.ts";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function matches(recipeIngredient: string, availableIngredient: string): boolean {
  const recipe = ` ${normalizeIngredientName(recipeIngredient)} `;
  const available = ` ${normalizeIngredientName(availableIngredient)} `;
  return recipe.includes(available) || available.includes(recipe);
}

function isAvailable(recipeIngredient: string, names: readonly string[]): boolean {
  return names.some((name) => matches(recipeIngredient, name));
}

function ratingConfidence(recipe: NormalizedRecipe): number {
  if (!recipe.rating) return 0;
  const quality = clamp(recipe.rating.value / recipe.rating.best);
  const reviewConfidence = 1 - Math.exp(-recipe.rating.count / 50);
  return quality * (0.35 + 0.65 * reviewConfidence);
}

function timeAndEquipmentFit(recipe: NormalizedRecipe, constraints: RecipeConstraints): number {
  let timeFit = 1;
  if (constraints.maxTotalTimeMinutes) {
    timeFit = recipe.totalTimeMinutes === undefined
      ? 0.5
      : recipe.totalTimeMinutes <= constraints.maxTotalTimeMinutes
        ? 1
        : clamp(constraints.maxTotalTimeMinutes / recipe.totalTimeMinutes);
  }
  const availableEquipment = (constraints.availableEquipment ?? []).map(normalizeIngredientName);
  const equipmentFit = constraints.availableEquipment === undefined
    ? 1
    : !recipe.equipmentKnown
      ? 0.5
      : recipe.equipment.length === 0
        ? 1
        : recipe.equipment.filter((item) => isAvailable(item, availableEquipment)).length / recipe.equipment.length;
  return (timeFit + equipmentFit) / 2;
}

export function feasibilityRejectionReasons(
  recipe: RankedRecipe,
  constraints: RecipeConstraints
): string[] {
  const reasons: string[] = [];
  if (constraints.maxMissingIngredients !== undefined &&
      recipe.missingIngredients.length > constraints.maxMissingIngredients) {
    reasons.push("feasibility:missing-ingredients");
  }
  if (constraints.enforceTimeLimit && constraints.maxTotalTimeMinutes !== undefined) {
    if (recipe.totalTimeMinutes === undefined) reasons.push("feasibility:time-unknown");
    else if (recipe.totalTimeMinutes > constraints.maxTotalTimeMinutes) reasons.push("feasibility:time");
  }
  if (constraints.enforceEquipment) {
    if (!recipe.equipmentKnown || constraints.availableEquipment === undefined) {
      reasons.push("feasibility:equipment-unknown");
    } else {
      const available = constraints.availableEquipment.map(normalizeIngredientName);
      if (recipe.equipment.some((item) => !isAvailable(item, available))) {
        reasons.push("feasibility:equipment");
      }
    }
  }
  return reasons;
}

export function scoreRecipe(
  recipe: NormalizedRecipe,
  ingredients: readonly ConfirmedIngredient[],
  constraints: RecipeConstraints
): RankedRecipe {
  const confirmed = ingredients.map((item) => normalizeIngredientName(item.name)).filter(Boolean);
  const staples = (constraints.pantryStaples ?? []).map(normalizeIngredientName).filter(Boolean);
  const matchedIngredients = confirmed.filter((name) => recipe.ingredientNames.some((item) => matches(item, name)));
  const missingIngredients = recipe.ingredientNames.filter((name, index, all) =>
    all.indexOf(name) === index && !isAvailable(name, confirmed) && !isAvailable(name, staples)
  );
  const useSoon = ingredients.filter((item) => item.useSoon).map((item) => normalizeIngredientName(item.name));
  const ingredientCoverage = confirmed.length === 0 ? 0 : matchedIngredients.length / confirmed.length;
  const missingFit = recipe.ingredientNames.length === 0 ? 0 :
    1 - missingIngredients.length / new Set(recipe.ingredientNames).size;
  const useSoonCoverage = useSoon.length === 0 ? 1 :
    useSoon.filter((name) => recipe.ingredientNames.some((item) => matches(item, name))).length / useSoon.length;
  const breakdown = {
    ingredientCoverage: clamp(ingredientCoverage),
    ratingConfidence: ratingConfidence(recipe),
    missingIngredients: clamp(missingFit),
    timeAndEquipmentFit: timeAndEquipmentFit(recipe, constraints),
    useSoonCoverage: clamp(useSoonCoverage)
  };
  const score = breakdown.ingredientCoverage * 35 + breakdown.ratingConfidence * 25 +
    breakdown.missingIngredients * 20 + breakdown.timeAndEquipmentFit * 10 +
    breakdown.useSoonCoverage * 10;

  return {
    ...recipe,
    score: Math.round(score * 10) / 10,
    scoreBreakdown: breakdown,
    matchedIngredients,
    missingIngredients,
    badges: []
  };
}

function selectBest(recipes: RankedRecipe[], compare: (left: RankedRecipe, right: RankedRecipe) => number): RankedRecipe | undefined {
  return recipes.reduce<RankedRecipe | undefined>((best, item) => !best || compare(item, best) > 0 ? item : best, undefined);
}

export function assignRecommendationBadges(recipes: RankedRecipe[]): void {
  if (recipes.length === 0) return;
  const selections: Array<[RecommendationBadge, RankedRecipe | undefined]> = [
    ["Best overall", selectBest(recipes, (a, b) => a.score - b.score)],
    ["Fastest", selectBest(recipes.filter((item) => item.totalTimeMinutes !== undefined),
      (a, b) => b.totalTimeMinutes! - a.totalTimeMinutes!)],
    ["Uses most ingredients", selectBest(recipes, (a, b) => a.matchedIngredients.length - b.matchedIngredients.length)],
    ["Fewest missing ingredients", selectBest(recipes, (a, b) => b.missingIngredients.length - a.missingIngredients.length)],
    ["Highest rated", selectBest(recipes.filter((item) => item.rating !== undefined), (a, b) => {
      const ratingDifference = a.rating!.value / a.rating!.best - b.rating!.value / b.rating!.best;
      return ratingDifference || a.rating!.count - b.rating!.count;
    })]
  ];
  for (const [badge, recipe] of selections) recipe?.badges.push(badge);
}

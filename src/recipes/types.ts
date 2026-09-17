export type DietaryRestriction =
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "gluten-free"
  | "dairy-free"
  | "halal"
  | "kosher";

export interface ConfirmedIngredient {
  name: string;
  quantity?: string;
  useSoon?: boolean;
}

export interface RecipeConstraints {
  cuisines?: readonly string[];
  allergies?: readonly string[];
  dietaryRestrictions?: readonly (DietaryRestriction | string)[];
  maxTotalTimeMinutes?: number;
  maxMissingIngredients?: number;
  availableEquipment?: readonly string[];
  enforceTimeLimit?: boolean;
  enforceEquipment?: boolean;
  pantryStaples?: readonly string[];
}

export interface RecipeSearchInput {
  ingredients: readonly ConfirmedIngredient[];
  constraints?: RecipeConstraints;
  limit?: number;
  locale?: string;
}

/** A provider result containing schema.org JSON-LD and its canonical source page. */
export interface RecipeSourceDocument {
  sourceUrl: string;
  jsonLd: unknown;
}

export interface RecipeProviderQuery {
  ingredients: readonly string[];
  constraints: RecipeConstraints;
  limit?: number;
  locale?: string;
}

export interface RecipeProvider {
  readonly name: string;
  search(query: RecipeProviderQuery): Promise<readonly RecipeSourceDocument[]>;
  getAttribution?(): RecipeProviderAttribution | undefined;
}

export interface RecipeProviderAttribution {
  searchEntryPointHtml?: string;
  sources: Array<{ url: string; title?: string }>;
  queries: string[];
}

export interface NormalizedRecipe {
  id: string;
  name: string;
  sourceUrl: string;
  publisher?: string;
  imageUrl?: string;
  ingredientLines: string[];
  ingredientNames: string[];
  totalTimeMinutes?: number;
  equipment: string[];
  equipmentKnown: boolean;
  cuisines: string[];
  suitableForDiet: string[];
  rating?: {
    value: number;
    best: number;
    count: number;
  };
}

export type RecommendationBadge =
  | "Best overall"
  | "Fastest"
  | "Uses most ingredients"
  | "Fewest missing ingredients"
  | "Highest rated";

export interface RecipeScoreBreakdown {
  ingredientCoverage: number;
  ratingConfidence: number;
  missingIngredients: number;
  timeAndEquipmentFit: number;
  useSoonCoverage: number;
}

export interface RankedRecipe extends NormalizedRecipe {
  score: number;
  scoreBreakdown: RecipeScoreBreakdown;
  matchedIngredients: string[];
  missingIngredients: string[];
  badges: RecommendationBadge[];
}

export interface RecipeSearchResult {
  recipes: RankedRecipe[];
  rejected: Array<{
    sourceUrl: string;
    name?: string;
    reasons: string[];
  }>;
  provider: string;
  attribution?: RecipeProviderAttribution;
}

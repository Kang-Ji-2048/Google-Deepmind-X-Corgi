import { normalizeRecipeDocument } from "./normalize.ts";
import { assignRecommendationBadges, scoreRecipe } from "./rank.ts";
import { safetyRejectionReasons } from "./safety.ts";
import type { RecipeProvider, RecipeSearchInput, RecipeSearchResult } from "./types.ts";

export class RecipeSearchService {
  private readonly provider: RecipeProvider;

  constructor(provider: RecipeProvider) {
    this.provider = provider;
  }

  async search(input: RecipeSearchInput): Promise<RecipeSearchResult> {
    const constraints = input.constraints ?? {};
    const documents = await this.provider.search({
      ingredients: input.ingredients.map((item) => item.name),
      constraints,
      ...(input.limit ? { limit: input.limit } : {}),
      ...(input.locale ? { locale: input.locale } : {})
    });
    const normalized = documents.flatMap(normalizeRecipeDocument);
    const unique = normalized.filter((recipe, index, all) =>
      all.findIndex((candidate) => candidate.sourceUrl === recipe.sourceUrl) === index
    );
    const rejected: RecipeSearchResult["rejected"] = [];
    const accepted = unique.filter((recipe) => {
      const reasons = safetyRejectionReasons(recipe, constraints);
      if (reasons.length > 0) rejected.push({ sourceUrl: recipe.sourceUrl, name: recipe.name, reasons });
      return reasons.length === 0;
    });
    const ranked = accepted
      .map((recipe) => scoreRecipe(recipe, input.ingredients, constraints))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const recipes = input.limit ? ranked.slice(0, input.limit) : ranked;
    assignRecommendationBadges(recipes);
    return {
      recipes,
      rejected,
      provider: this.provider.name
    };
  }
}

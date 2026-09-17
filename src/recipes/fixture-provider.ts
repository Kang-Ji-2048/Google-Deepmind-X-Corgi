import type { RecipeProvider, RecipeProviderQuery, RecipeSourceDocument } from "./types.ts";

export const DEMO_RECIPE_DOCUMENTS: readonly RecipeSourceDocument[] = [
  {
    sourceUrl: "https://recipes.example/tomato-chickpea-pasta",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Tomato chickpea pasta",
      url: "https://recipes.example/tomato-chickpea-pasta",
      publisher: { "@type": "Organization", name: "Demo Kitchen" },
      recipeIngredient: ["200 g pasta", "1 can chickpeas", "3 tomatoes", "2 cloves garlic", "1 tbsp olive oil"],
      totalTime: "PT25M",
      tool: ["Saucepan"],
      suitableForDiet: ["https://schema.org/VeganDiet"],
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.8, ratingCount: 240, bestRating: 5 }
    }
  },
  {
    sourceUrl: "https://recipes.example/tomato-egg-skillet",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Quick tomato egg skillet",
      recipeIngredient: ["4 eggs", "3 tomatoes", "2 spring onions", "1 tbsp olive oil", "salt"],
      totalTime: "PT15M",
      tool: ["Skillet"],
      suitableForDiet: ["https://schema.org/VegetarianDiet"],
      aggregateRating: { ratingValue: "4.6", reviewCount: "78" }
    }
  },
  {
    sourceUrl: "https://recipes.example/creamy-tomato-soup",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [{
        "@type": ["Recipe"],
        name: "Creamy tomato soup",
        recipeIngredient: ["6 tomatoes", "1 onion", "1 cup milk", "2 tbsp butter", "salt"],
        totalTime: "PT35M",
        tool: ["Blender", "Saucepan"],
        aggregateRating: { ratingValue: 4.9, ratingCount: 19 }
      }]
    }
  },
  {
    sourceUrl: "https://recipes.example/chickpea-salad",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "No-cook chickpea salad",
      recipeIngredient: ["1 can garbanzo beans", "2 tomatoes", "1 cucumber", "1 lemon", "olive oil", "salt"],
      totalTime: "PT10M",
      aggregateRating: { ratingValue: 4.7, ratingCount: 410 }
    }
  }
] as const;

/** Deterministic, network-free provider for development and product demos. */
export class FixtureRecipeProvider implements RecipeProvider {
  readonly name = "fixture";
  private readonly documents: readonly RecipeSourceDocument[];

  constructor(documents: readonly RecipeSourceDocument[] = DEMO_RECIPE_DOCUMENTS) {
    this.documents = documents;
  }

  async search(_query: RecipeProviderQuery): Promise<readonly RecipeSourceDocument[]> {
    return structuredClone(this.documents);
  }
}

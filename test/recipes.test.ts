import assert from "node:assert/strict";
import test from "node:test";

import {
  FixtureRecipeProvider,
  normalizeIngredientName,
  normalizeRecipeDocument,
  parseDurationMinutes,
  RecipeSearchService,
  type RecipeProvider,
  type RecipeProviderQuery,
  type RecipeSourceDocument
} from "../src/recipes/index.ts";

test("normalizes schema.org graph recipes and ISO durations", () => {
  const [recipe] = normalizeRecipeDocument({
    sourceUrl: "https://publisher.example/fallback",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Page" },
        {
          "@type": ["Thing", "Recipe"],
          name: "Weeknight pasta",
          url: "https://publisher.example/weeknight-pasta",
          recipeIngredient: ["200 g Tomatoes, chopped", "1 tbsp olive oil"],
          totalTime: "PT1H5M",
          aggregateRating: { ratingValue: "4.5", reviewCount: "12", bestRating: "5" }
        }
      ]
    }
  });

  assert.equal(recipe.name, "Weeknight pasta");
  assert.equal(recipe.sourceUrl, "https://publisher.example/weeknight-pasta");
  assert.deepEqual(recipe.ingredientNames, ["tomato", "olive oil"]);
  assert.equal(recipe.totalTimeMinutes, 65);
  assert.deepEqual(recipe.rating, { value: 4.5, best: 5, count: 12 });
  assert.equal(parseDurationMinutes("1 hour 20 mins"), 80);
  assert.equal(normalizeIngredientName("2 cans Garbanzo beans, drained"), "chickpea");
});

test("hard-filters allergy and dietary conflicts before ranking", async () => {
  const service = new RecipeSearchService(new FixtureRecipeProvider());
  const result = await service.search({
    ingredients: [{ name: "tomatoes" }, { name: "chickpeas", useSoon: true }],
    constraints: {
      allergies: ["dairy"],
      dietaryRestrictions: ["vegan"],
      pantryStaples: ["olive oil", "salt"]
    }
  });

  assert.deepEqual(result.recipes.map((recipe) => recipe.name), [
    "No-cook chickpea salad",
    "Tomato chickpea pasta"
  ]);
  assert.deepEqual(result.rejected.map((recipe) => recipe.name).sort(), [
    "Creamy tomato soup",
    "Quick tomato egg skillet"
  ]);
  assert(result.rejected.find((recipe) => recipe.name === "Creamy tomato soup")?.reasons.includes("allergy:dairy"));
  assert(result.rejected.find((recipe) => recipe.name === "Quick tomato egg skillet")?.reasons.includes("diet:vegan"));
});

test("returns source links, score details, and exactly the supported recommendation badges", async () => {
  const result = await new RecipeSearchService(new FixtureRecipeProvider()).search({
    ingredients: [
      { name: "tomato" },
      { name: "chickpea", useSoon: true },
      { name: "garlic" },
      { name: "egg" }
    ],
    constraints: {
      maxTotalTimeMinutes: 30,
      availableEquipment: ["skillet", "saucepan"],
      pantryStaples: ["olive oil", "salt"]
    }
  });

  assert.equal(result.provider, "fixture");
  assert(result.recipes.every((recipe) => recipe.sourceUrl.startsWith("https://recipes.example/")));
  assert(result.recipes.every((recipe) => recipe.score >= 0 && recipe.score <= 100));
  const badges = new Set(result.recipes.flatMap((recipe) => recipe.badges));
  assert.deepEqual(badges, new Set([
    "Best overall",
    "Fastest",
    "Uses most ingredients",
    "Fewest missing ingredients",
    "Highest rated"
  ]));
  assert(!badges.has("Most creative" as never));
  assert.equal(result.recipes.find((recipe) => recipe.badges.includes("Fastest"))?.name, "No-cook chickpea salad");
  assert.equal(result.recipes.find((recipe) => recipe.badges.includes("Highest rated"))?.name, "Creamy tomato soup");
});

test("expands common allergen groups and respects explicitly allergen-free substitutes", async () => {
  const documents: RecipeSourceDocument[] = [
    {
      sourceUrl: "https://publisher.example/curry",
      jsonLd: {
        "@type": "Recipe",
        name: "Cashew curry",
        recipeIngredient: ["cashew", "tomato"]
      }
    },
    {
      sourceUrl: "https://publisher.example/soup",
      jsonLd: {
        "@type": "Recipe",
        name: "Dairy-free soup",
        recipeIngredient: ["dairy-free cream", "tomato"]
      }
    },
    {
      sourceUrl: "https://publisher.example/oats",
      jsonLd: {
        "@type": "Recipe",
        name: "Oat milk oats",
        recipeIngredient: ["oat milk", "rolled oats", "peanut butter"]
      }
    }
  ];
  const nutResult = await new RecipeSearchService(new FixtureRecipeProvider(documents)).search({
    ingredients: [{ name: "tomato" }],
    constraints: { allergies: ["nuts"] }
  });
  assert.deepEqual(nutResult.recipes.map((recipe) => recipe.name), ["Dairy-free soup"]);

  const dairyResult = await new RecipeSearchService(new FixtureRecipeProvider(documents)).search({
    ingredients: [{ name: "tomato" }],
    constraints: { allergies: ["dairy"] }
  });
  assert(dairyResult.recipes.some((recipe) => recipe.name === "Dairy-free soup"));
  assert(dairyResult.recipes.some((recipe) => recipe.name === "Oat milk oats"));
});

test("deduplicates provider results by canonical source URL", async () => {
  const duplicate: RecipeSourceDocument = {
    sourceUrl: "https://publisher.example/recipe",
    jsonLd: {
      "@type": "Recipe",
      name: "A recipe",
      recipeIngredient: ["tomato"]
    }
  };
  const result = await new RecipeSearchService(new FixtureRecipeProvider([duplicate, duplicate])).search({
    ingredients: [{ name: "tomato" }]
  });
  assert.equal(result.recipes.length, 1);
});

test("forwards only confirmed ingredient names and constraints to providers", async () => {
  let received: RecipeProviderQuery | undefined;
  const provider: RecipeProvider = {
    name: "spy",
    async search(query) {
      received = query;
      return [];
    }
  };
  const constraints = { allergies: ["sesame"], maxTotalTimeMinutes: 20 } as const;
  await new RecipeSearchService(provider).search({
    ingredients: [{ name: "tomato", quantity: "3", useSoon: true }],
    constraints,
    locale: "en-GB",
    limit: 5
  });
  assert.deepEqual(received, {
    ingredients: ["tomato"],
    constraints,
    locale: "en-GB",
    limit: 5
  });
});

test("applies limit before assigning badges", async () => {
  const result = await new RecipeSearchService(new FixtureRecipeProvider()).search({
    ingredients: [{ name: "tomato" }, { name: "egg" }],
    constraints: { pantryStaples: ["oil", "salt"] },
    limit: 1
  });
  assert.equal(result.recipes.length, 1);
  assert(result.recipes[0].badges.includes("Best overall"));
  assert(result.recipes[0].badges.includes("Fastest"));
  assert(result.recipes[0].badges.includes("Fewest missing ingredients"));
});

test("does not penalize equipment when the user has not constrained it", async () => {
  const document: RecipeSourceDocument = {
    sourceUrl: "https://publisher.example/toast",
    jsonLd: {
      "@type": "Recipe",
      name: "Toast",
      recipeIngredient: ["bread"],
      tool: ["Toaster"]
    }
  };
  const [recipe] = (await new RecipeSearchService(new FixtureRecipeProvider([document])).search({
    ingredients: [{ name: "bread" }]
  })).recipes;
  assert.equal(recipe.scoreBreakdown.timeAndEquipmentFit, 1);
});

test("fails closed for unsupported dietary rule sets", async () => {
  const result = await new RecipeSearchService(new FixtureRecipeProvider()).search({
    ingredients: [{ name: "tomato" }],
    constraints: { dietaryRestrictions: ["low-fodmap"] }
  });
  assert.equal(result.recipes.length, 0);
  assert(result.rejected.every((recipe) => recipe.reasons.includes("diet:unsupported:low-fodmap")));
});

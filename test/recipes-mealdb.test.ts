import assert from "node:assert/strict";
import test from "node:test";

import { MealDbRecipeProvider, RecipeSearchService } from "../src/recipes/index.ts";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("queries free cuisine and single-ingredient endpoints then maps real source records", async () => {
  const urls: URL[] = [];
  const fetchMock: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname.endsWith("filter.php") && url.searchParams.has("a")) {
      return json({ meals: [{ idMeal: "1" }, { idMeal: "2" }] });
    }
    if (url.pathname.endsWith("filter.php") && url.searchParams.get("i") === "tomato") {
      return json({ meals: [{ idMeal: "1" }] });
    }
    if (url.pathname.endsWith("filter.php")) return json({ meals: [{ idMeal: "2" }] });
    const id = url.searchParams.get("i");
    return json({ meals: [{
      idMeal: id,
      strMeal: id === "1" ? "Tomato pasta" : "Source-less meal",
      strArea: "Italian",
      strMealThumb: "https://images.example/meal.jpg",
      strSource: id === "1" ? "https://publisher.example/tomato-pasta" : null,
      strIngredient1: "Tomatoes",
      strMeasure1: "3",
      strIngredient2: "Pasta",
      strMeasure2: "200 g"
    }] });
  };
  const provider = new MealDbRecipeProvider({ fetch: fetchMock });
  const result = await new RecipeSearchService(provider).search({
    ingredients: [{ name: "tomato" }, { name: "egg" }],
    constraints: { cuisines: ["Italian"] }
  });

  assert(urls.every((url) => url.origin === "https://www.themealdb.com"));
  assert(urls.some((url) => url.searchParams.get("a") === "Italian"));
  assert(urls.some((url) => url.searchParams.get("i") === "tomato"));
  assert.equal(result.provider, "themealdb-free");
  assert.equal(result.recipes.length, 1);
  assert.equal(result.recipes[0].sourceUrl, "https://publisher.example/tomato-pasta");
  assert.deepEqual(result.recipes[0].cuisines, ["Italian"]);
  assert.equal(result.recipes[0].rating, undefined);
  assert.equal(result.recipes[0].totalTimeMinutes, undefined);
  assert.equal(result.recipes[0].equipmentKnown, false);
  assert.deepEqual(result.attribution?.queries, ["cuisine:Italian", "ingredient:tomato", "ingredient:egg"]);
});

test("fails honestly on TheMealDB HTTP errors", async () => {
  const provider = new MealDbRecipeProvider({ fetch: async () => json({ error: "limited" }, 429) });
  await assert.rejects(() => provider.search({ ingredients: ["tomato"], constraints: {} }),
    /TheMealDB request failed with HTTP 429/);
});

test("validates TheMealDB keys before placing them in request paths", () => {
  assert.throws(() => new MealDbRecipeProvider({ apiKey: "../secret" }), /Invalid TheMealDB API key/);
});

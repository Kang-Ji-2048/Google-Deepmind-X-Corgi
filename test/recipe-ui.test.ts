import assert from "node:assert/strict";
import test from "node:test";

import { buildRecipeSearchRequest, isRecipeSearchResponse, splitList } from "../components/recipeSearchModel.ts";

test("builds the documented cuisine-first recipe request and omits empty optional fields", () => {
  const request = buildRecipeSearchRequest([
    { id: "1", name: " Broccoli ", quantity: "1 head", useSoon: true },
    { id: "2", name: "", quantity: "", useSoon: false },
    { id: "3", name: "Eggs", quantity: "", useSoon: false }
  ], {
    cuisines: ["Italian", "Japanese"],
    maxTotalTimeMinutes: 30,
    maxMissingIngredients: 2,
    dietaryRestrictions: ["vegetarian"],
    allergies: "peanuts, Shellfish\npeanuts",
    pantryStaples: "salt, olive oil",
    availableEquipment: ""
  });

  assert.deepEqual(request, {
    ingredients: [
      { name: "Broccoli", quantity: "1 head", useSoon: true },
      { name: "Eggs" }
    ],
    constraints: {
      cuisines: ["Italian", "Japanese"],
      maxTotalTimeMinutes: 30,
      enforceTimeLimit: true,
      maxMissingIngredients: 2,
      dietaryRestrictions: ["vegetarian"],
      allergies: ["peanuts", "Shellfish"],
      pantryStaples: ["salt", "olive oil"]
    }
  });
});

test("splitList trims, deduplicates case-insensitively, and accepts commas or lines", () => {
  assert.deepEqual(splitList(" Oven, blender\nOVEN, skillet "), ["Oven", "blender", "skillet"]);
});

test("recognizes only the base recipe response envelope", () => {
  assert.equal(isRecipeSearchResponse({ recipes: [], rejected: [], provider: "google" }), true);
  assert.equal(isRecipeSearchResponse({ recipes: [], provider: "google" }), false);
  assert.equal(isRecipeSearchResponse({ recipes: {}, rejected: [], provider: "google" }), false);
});

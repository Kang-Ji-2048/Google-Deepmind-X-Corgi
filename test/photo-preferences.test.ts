import assert from "node:assert/strict";
import test from "node:test";
import { CUISINE_OPTIONS, COOKING_TIME_OPTIONS, initialPhotoPreferences, photoPreferencesReducer } from "../components/photoPreferencesModel.ts";

test("photo preferences include British and cooking-time choices", () => {
  assert.ok(CUISINE_OPTIONS.includes("British"));
  assert.deepEqual(COOKING_TIME_OPTIONS, ["Any time", "15 min", "30 min", "45 min", "60 min"]);
  assert.equal(initialPhotoPreferences.showRecipe, false);
});

test("selecting cuisine and time keeps the recipe hidden until Done", () => {
  let state = photoPreferencesReducer(initialPhotoPreferences, { type: "cuisine", value: "British" });
  state = photoPreferencesReducer(state, { type: "time", value: "45 min" });
  assert.deepEqual(state, { cuisine: "British", cookingTime: "45 min", showRecipe: false });
  state = photoPreferencesReducer(state, { type: "done" });
  assert.deepEqual(state, { cuisine: "British", cookingTime: "45 min", showRecipe: true });
});

test("editing preferences or changing photos requires Done again and retains choices", () => {
  const completed = { cuisine: "British", cookingTime: "30 min", showRecipe: true } as const;
  for (const type of ["edit", "photos-changed"] as const) {
    assert.deepEqual(photoPreferencesReducer(completed, { type }), { ...completed, showRecipe: false });
  }
});

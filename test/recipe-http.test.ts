import assert from "node:assert/strict";
import test from "node:test";
import { handleRecipeSearch } from "../src/recipe-http.ts";
import type { RecipeSearchInput } from "../src/recipes/types.ts";

function request(body: unknown, headers = {}) {
  return new Request("https://cook.example/api/recipes", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}
const valid = { ingredients: [{ name: "tomato" }], constraints: { cuisines: ["Italian"], maxTotalTimeMinutes: 30, maxMissingIngredients: 2 } };
test("HTTP boundary forwards cuisine and enables strict selected constraints", async () => {
  let received: RecipeSearchInput | undefined;
  const response = await handleRecipeSearch(request(valid), async (input) => { received = input; return { recipes: [], rejected: [], provider: "test-only" }; });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(received?.constraints?.cuisines, ["Italian"]);
  assert.equal(received?.constraints?.enforceTimeLimit, true);
  assert.equal(received?.constraints?.enforceEquipment, false);
});
test("HTTP boundary rejects invalid, oversized, and cross-origin requests before provider calls", async () => {
  const never = async () => { throw new Error("Must not call provider"); };
  assert.equal((await handleRecipeSearch(request({ ingredients: [] }), never)).status, 400);
  assert.equal((await handleRecipeSearch(request(valid, { Origin: "https://evil.example" }), never)).status, 403);
  assert.equal((await handleRecipeSearch(request(valid, { "Content-Type": "text/plain" }), never)).status, 415);
  assert.equal((await handleRecipeSearch(request({ large: "x".repeat(25_000) }), never)).status, 413);
});
test("HTTP failures never expose secrets or silently return fixtures", async () => {
  const notConfigured = await handleRecipeSearch(request(valid), async () => { throw new Error("SEARCH_NOT_CONFIGURED"); });
  assert.equal(notConfigured.status, 503);
  const quota = await handleRecipeSearch(request(valid), async () => { throw new Error("Gemini grounding request failed with HTTP 429"); });
  assert.equal((await quota.json()).error.code, "SEARCH_QUOTA_EXHAUSTED");
  const upstream = await handleRecipeSearch(request(valid), async () => { throw new Error("secret-key-should-not-leak"); });
  assert.equal(upstream.status, 502);
  assert.doesNotMatch(await upstream.text(), /secret-key/);
  const timeout = await handleRecipeSearch(request(valid), async () => { throw new DOMException("Timeout", "TimeoutError"); });
  assert.equal(timeout.status, 504);
});

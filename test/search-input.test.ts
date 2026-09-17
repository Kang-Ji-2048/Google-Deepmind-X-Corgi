import assert from "node:assert/strict";
import test from "node:test";
import { parseSearchInput, SearchInputError } from "../src/search-input.ts";

test("parses a confirmed inventory and cuisine-first preferences", () => {
  const result = parseSearchInput({ ingredients: [{ name: " tomato ", useSoon: true }], constraints: { cuisines: ["Italian", "Italian"], maxTotalTimeMinutes: 30, maxMissingIngredients: 0 } });
  assert.equal(result.ingredients[0].name, "tomato");
  assert.deepEqual((result.constraints as Record<string, unknown>).cuisines, ["Italian"]);
  assert.equal((result.constraints as Record<string, unknown>).maxMissingIngredients, 0);
});

test("rejects empty, malformed, huge, and non-finite requests", () => {
  for (const input of [null, [], {}, { ingredients: [] }, { ingredients: Array(51).fill({ name: "tomato" }) }, { ingredients: [{ name: "x".repeat(101) }] }, { ingredients: [{ name: "egg", useSoon: "yes" }] }, { ingredients: [{ name: "egg" }], constraints: { cuisines: "Italian" } }, { ingredients: [{ name: "egg" }], constraints: { maxTotalTimeMinutes: Infinity } }, { ingredients: [{ name: "egg" }], constraints: { maxMissingIngredients: -1 } }]) {
    assert.throws(() => parseSearchInput(input), SearchInputError);
  }
});

test("never forwards client-supplied upstream configuration or output limits", () => {
  const result = parseSearchInput({ ingredients: [{ name: "egg" }], endpoint: "http://localhost", apiKey: "bad", limit: 1 });
  assert.equal("endpoint" in result, false);
  assert.equal("apiKey" in result, false);
  assert.equal("limit" in result, false);
});

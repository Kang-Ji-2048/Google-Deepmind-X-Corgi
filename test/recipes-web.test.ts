import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingHttpHeaders } from "node:http";

import {
  extractRecipeJsonLd,
  FixtureRecipeProvider,
  GeminiGroundedRecipeProvider,
  isPublicIpAddress,
  normalizeRecipeDocument,
  RecipeSearchService,
  safeFetchPublisherHtml,
  type PinnedRequest,
  type RecipeSourceDocument
} from "../src/recipes/index.ts";

function raw(statusCode: number, headers: IncomingHttpHeaders, body = "") {
  return { statusCode, headers, body: Buffer.from(body) };
}

test("uses only Google grounding source URLs and publisher JSON-LD facts", async () => {
  let requestBody = "";
  let requestHeaders: HeadersInit | undefined;
  const apiFetch: typeof fetch = async (_input, init) => {
    requestBody = String(init?.body);
    requestHeaders = init?.headers;
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: "Invented rating: 5.0" }] },
        groundingMetadata: {
          webSearchQueries: ["Italian tomato recipe"],
          searchEntryPoint: { renderedContent: "<div>Google Search suggestions</div>" },
          groundingChunks: [
            { web: { uri: "https://vertexaisearch.cloud.google.com/grounding/one", title: "Publisher" } },
            { web: { uri: "javascript:alert(1)", title: "Invalid" } }
          ]
        }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const publisherRequest: PinnedRequest = async (url) => {
    if (url.hostname === "vertexaisearch.cloud.google.com") {
      return raw(302, { location: "https://publisher.example/recipe" });
    }
    return raw(200, { "content-type": "text/html" }, `
      <html><script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Publisher tomato pasta",
        url: "https://publisher.example/recipe",
        recipeCuisine: ["Italian"],
        recipeIngredient: ["3 tomatoes", "200 g pasta"],
        totalTime: "PT20M",
        aggregateRating: { ratingValue: 4.4, ratingCount: 81 }
      })}</script></html>
    `);
  };
  const provider = new GeminiGroundedRecipeProvider({
    apiKey: "server-secret",
    fetch: apiFetch,
    resolveHost: async () => [{ address: "8.8.8.8", family: 4 }],
    publisherRequest
  });
  const result = await new RecipeSearchService(provider).search({
    ingredients: [{ name: "tomato" }],
    constraints: { cuisines: ["Italian"] }
  });

  assert.match(requestBody, /Cuisine preference \(prioritize first\): Italian/);
  assert.equal(new Headers(requestHeaders).get("x-goog-api-key"), "server-secret");
  assert.deepEqual(JSON.parse(requestBody).tools, [{ google_search: {} }]);
  assert.equal(result.recipes[0].name, "Publisher tomato pasta");
  assert.deepEqual(result.recipes[0].rating, { value: 4.4, best: 5, count: 81 });
  assert.deepEqual(result.recipes[0].cuisines, ["Italian"]);
  assert.equal(result.attribution?.searchEntryPointHtml, "<div>Google Search suggestions</div>");
  assert.deepEqual(result.attribution?.queries, ["Italian tomato recipe"]);
  assert.equal(result.attribution?.sources.length, 1);
});

test("rejects missing Gemini credentials and non-Google API endpoints", () => {
  assert.throws(() => new GeminiGroundedRecipeProvider({ apiKey: "" }), /API key is required/);
  assert.throws(() => new GeminiGroundedRecipeProvider({
    apiKey: "secret",
    apiBaseUrl: "https://attacker.example/v1beta"
  }), /official generativelanguage/);
});

test("extracts valid Recipe JSON-LD while ignoring malformed blocks", () => {
  const document = extractRecipeJsonLd(`
    <script type="application/ld+json">not json</script>
    <script data-x="1" type='application/ld+json'>
      {"@type":"Recipe","name":"Soup","recipeIngredient":["tomato"]}
    </script>
  `, "https://publisher.example/soup");
  assert(document);
  assert.equal(document.sourceUrl, "https://publisher.example/soup");
});

test("publisher retrieval blocks private DNS answers and unsafe redirects", async () => {
  let called = false;
  await assert.rejects(() => safeFetchPublisherHtml("https://publisher.example/recipe", {
    resolveHost: async () => [{ address: "127.0.0.1", family: 4 }],
    request: async () => {
      called = true;
      return raw(200, { "content-type": "text/html" });
    }
  }), /public IP/);
  assert.equal(called, false);

  await assert.rejects(() => safeFetchPublisherHtml("https://publisher.example/recipe", {
    resolveHost: async () => [{ address: "8.8.8.8", family: 4 }],
    request: async () => raw(302, { location: "https://localhost/admin" })
  }), /host is not allowed/);
});

test("public IP classification rejects private and documentation networks", () => {
  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("203.0.113.4"), false);
  assert.equal(isPublicIpAddress("::1"), false);
  assert.equal(isPublicIpAddress("::ffff:127.0.0.1"), false);
});

test("strict feasibility filters missing items and honest time/equipment unknowns", async () => {
  const documents: RecipeSourceDocument[] = [
    {
      sourceUrl: "https://publisher.example/known",
      jsonLd: {
        "@type": "Recipe",
        name: "Known feasible recipe",
        recipeIngredient: ["tomato", "salt"],
        totalTime: "PT15M",
        tool: ["pan"]
      }
    },
    {
      sourceUrl: "https://publisher.example/unknown",
      jsonLd: {
        "@type": "Recipe",
        name: "Unknown feasibility recipe",
        recipeIngredient: ["tomato", "rare spice"]
      }
    }
  ];
  const result = await new RecipeSearchService(new FixtureRecipeProvider(documents)).search({
    ingredients: [{ name: "tomato" }],
    constraints: {
      pantryStaples: ["salt"],
      maxMissingIngredients: 0,
      maxTotalTimeMinutes: 20,
      availableEquipment: ["pan"],
      enforceTimeLimit: true,
      enforceEquipment: true
    }
  });
  assert.deepEqual(result.recipes.map((recipe) => recipe.name), ["Known feasible recipe"]);
  const rejected = result.rejected.find((recipe) => recipe.name === "Unknown feasibility recipe");
  assert(rejected?.reasons.includes("feasibility:missing-ingredients"));
  assert(rejected?.reasons.includes("feasibility:time-unknown"));
  assert(rejected?.reasons.includes("feasibility:equipment-unknown"));
});

test("does not trust cross-origin canonical URLs embedded in publisher JSON-LD", () => {
  const document = extractRecipeJsonLd(`
    <script type="application/ld+json">{
      "@type":"Recipe",
      "name":"Safe soup",
      "url":"http://127.0.0.1/admin",
      "recipeIngredient":["tomato"]
    }</script>
  `, "https://publisher.example/soup");
  assert(document);
  assert.equal(normalizeRecipeDocument(document)[0].sourceUrl, "https://publisher.example/soup");
});

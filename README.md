# What Can I Cook?

A responsive web app for Mac and phone that scans fridge or pantry photos, lets the user confirm ingredients, and finds highly rated online recipes they can actually make.

## Build status

Last updated: 2026-09-17

| Workstream | Owner | Status |
| --- | --- | --- |
| Responsive product shell and user flow | This repo | In progress |
| Visual system and screen specification | Parallel design track | In progress |
| Online recipe discovery and ranking | Recipe search module | Complete — integration-ready with deterministic demo data |
| Gemma image and ingredient extraction | External integration owner | External dependency |
| End-to-end integration and QA | This repo | Pending |

## MVP flow

1. Capture or upload 1-5 fridge or pantry images.
2. Send those images to the Gemma integration.
3. Review and correct the detected inventory.
4. Set dietary, allergy, time, equipment, and pantry-staple constraints.
5. Search for feasible online recipes.
6. Show every validated result returned by the search, with recommendations highlighted.
7. Open the original publisher's recipe page.

Recommendation labels:

- Best overall
- Fastest
- Uses most ingredients
- Fewest missing ingredients
- Highest rated

There is no "Most creative" category.

## Gemma integration contract

The Gemma integration is owned outside this workstream. The web app will treat it as a server-side dependency and will not implement model loading or inference here.

### What the Gemma integration owner needs to deliver

- A server-accessible function or HTTP endpoint that accepts 1-5 JPEG, PNG, HEIC, or WebP images.
- Support for multiple views of the same fridge or pantry in one request.
- Structured JSON output matching the response contract below.
- Confidence values between `0` and `1` for every detected ingredient.
- A source-frame index for each ingredient so the UI can show where it was detected.
- Conservative handling of uncertain products. Unreadable or ambiguous items must not be silently promoted to confirmed ingredients.
- Normalized ingredient names suitable for recipe matching, plus the original visible label when available.
- A useful error response for unsupported images, model timeout, invalid output, and provider unavailability.
- A documented local or hosted setup path and all required environment variables.
- Test fixtures covering clear produce, packaged products, duplicates across frames, occlusion, and an empty-fridge case.

### Expected request

The preferred boundary is a server-side function:

```ts
type AnalyzePantryInput = {
  images: Array<{
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic";
    dataBase64: string;
  }>;
  locale?: string;
};

analyzePantry(input: AnalyzePantryInput): Promise<PantryAnalysis>;
```

An HTTP implementation may expose the equivalent as `POST /api/analyze` using multipart uploads or JSON with base64 images.

### Expected response

```ts
type PantryAnalysis = {
  ingredients: Array<{
    id: string;
    name: string;
    originalLabel?: string;
    estimatedQuantity?: string;
    confidence: number;
    sourceFrame: number;
    needsConfirmation: boolean;
  }>;
  uncertainItems: Array<{
    id: string;
    description: string;
    sourceFrame: number;
  }>;
  warnings: string[];
};
```

### Integration acceptance criteria

- Response validates against the shared schema without repair in at least 9 of 10 fixture requests.
- Duplicate ingredients seen in multiple frames are merged.
- Dietary conclusions are not inferred from packaging unless the label is visible.
- Low-confidence items are marked `needsConfirmation: true`.
- No recipe generation is performed by this endpoint.
- The endpoint returns within a practical demo timeout and provides a retryable error when it cannot.
- Sensitive images are not logged by default.

### UI behavior while integration is pending

The frontend uses a deterministic mock response behind a development flag. Replacing the mock must require changing only the server adapter, not the screens or client state.

## Recipe search behavior

Recipe results are source-backed. The app links to the original publisher and does not republish full instructions.

Candidates are hard-filtered for allergies and dietary restrictions, then ranked using:

| Factor | Weight |
| --- | ---: |
| Ingredient coverage | 35% |
| Rating and review confidence | 25% |
| Missing required ingredients | 20% |
| Time and equipment fit | 10% |
| Use-soon ingredient coverage | 10% |

### Recipe search integration API

The public entry point is `src/recipes/index.ts`. The service accepts only the
ingredients a user has confirmed; image analysis and Gemma integration remain
outside this module.

```ts
import {
  FixtureRecipeProvider,
  RecipeSearchService,
  type RecipeProvider
} from "./src/recipes/index.ts";

const provider: RecipeProvider = new FixtureRecipeProvider();
const search = new RecipeSearchService(provider);

const result = await search.search({
  ingredients: [
    { name: "tomatoes", quantity: "4" },
    { name: "chickpeas", useSoon: true }
  ],
  constraints: {
    allergies: ["tree nut"],
    dietaryRestrictions: ["vegan"],
    maxTotalTimeMinutes: 30,
    availableEquipment: ["saucepan"],
    pantryStaples: ["olive oil", "salt"]
  },
  locale: "en-GB"
});
```

`result.recipes` is score-sorted and contains normalized recipe metadata,
the original `sourceUrl`, matched and missing ingredients, a score breakdown,
and recommendation badges. `result.rejected` contains safety-filtered candidates
and machine-readable reasons such as `allergy:dairy` or `diet:vegan`; rejected
recipes must never be rendered as recommendations.

To connect a live search source, implement `RecipeProvider.search(query)` and
return one `RecipeSourceDocument` per publisher page:

```ts
type RecipeSourceDocument = {
  sourceUrl: string; // original publisher URL, not an aggregator redirect
  jsonLd: unknown;   // schema.org Recipe JSON-LD from that source
};
```

The normalizer supports standalone Recipe JSON-LD, arrays, and `@graph` or
`mainEntity` wrappers. It accepts ISO 8601 durations, validates HTTP(S) source
links, normalizes aggregate ratings, and deduplicates canonical source URLs.
Providers should return complete ingredient lists, attribution-safe image URLs,
and the publisher's canonical page. The module intentionally does not copy full
recipe instructions.

### Filtering and ranking notes

- Allergy and dietary conflicts are hard-filtered before any scoring or badge
  assignment. Common group aliases such as dairy, gluten, nuts, fish, shellfish,
  soy, sesame, and mustard are expanded.
- Supported dietary rule sets are vegan, vegetarian, pescatarian, gluten-free,
  dairy-free, halal, and kosher. The provider's full ingredient list remains the
  source of truth; the UI should still show an allergy safety disclaimer because
  publisher data cannot establish cross-contamination or certification.
- Unknown dietary rule sets fail closed: all candidates are rejected with a
  `diet:unsupported:<value>` reason instead of being presented as compliant.
- Pantry staples do not count as missing ingredients. `useSoon` ingredients
  receive the documented 10% ranking contribution.
- Rating confidence combines the normalized star rating with review count so a
  single five-star review does not automatically outrank a strong, well-reviewed
  recipe.
- Multiple recommendation badges may apply to one recipe. The only badge values
  are Best overall, Fastest, Uses most ingredients, Fewest missing ingredients,
  and Highest rated.

### Recipe search handoff

- `FixtureRecipeProvider` uses deterministic, network-free schema.org fixtures
  under reserved `recipes.example` URLs, so it is safe for development and UI
  demos but must not be enabled in production.
- The future server adapter should keep provider credentials server-only. The
  deployment contract reserves `RECIPE_SEARCH_API_URL`,
  `RECIPE_SEARCH_API_KEY`, `RECIPE_SEARCH_TIMEOUT_MS`, and
  `RECIPE_SEARCH_USE_MOCK`; production should reject missing live credentials or
  a true mock flag.
- A real provider should document allowed image hosts, attribution requirements,
  quota behavior, retry semantics, and timeouts before production rollout.
- Search is deliberately independent of Gemma. Pass only the user's confirmed
  inventory from the inventory screen into `RecipeSearchService`.

## Planned routes

- `/` - scan or upload
- `/inventory` - confirm detected ingredients
- `/preferences` - set constraints
- `/recipes` - browse all feasible source recipes

## Local development

The recipe-search workstream is a dependency-light TypeScript module and requires
Node.js 22.6 or newer (Node.js 24 recommended). While the application scaffold is
still landing, its tests run directly with Node's built-in TypeScript support:

```bash
npm test
```

There are no install-time package dependencies for this module.

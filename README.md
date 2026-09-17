# What Can I Cook?

A responsive web app for Mac and phone that scans fridge or pantry photos, lets the user confirm ingredients, and finds highly rated online recipes they can actually make.

## Build status

Last updated: 2026-09-17

| Workstream | Owner | Status |
| --- | --- | --- |
| Responsive product shell and user flow | This repo | In progress |
| Visual system and screen specification | Parallel design track | In progress |
| Online recipe discovery and ranking | Parallel search track | In progress |
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

## Planned routes

- `/` - scan or upload
- `/inventory` - confirm detected ingredients
- `/preferences` - set constraints
- `/recipes` - browse all feasible source recipes

## Local development

Setup commands will be added as soon as the application scaffold lands.


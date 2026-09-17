# Gemma integration handoff

Last updated: 2026-09-17. Read alongside the [project README](../README.md).

## Goal and first milestone

We are building a cooking website: photograph a fridge or pantry, confirm ingredients, apply constraints, then browse real online recipes with original source links.

**Your first milestone is one callable Gemma image-analysis request that returns valid `PantryAnalysis` JSON.** The Next.js scaffold is on main; scan submission and server routes are not connected yet. This document specifies the interface to implement, not an existing endpoint.

Keep the response fields below stable. If your integration already uses another transport or provider format, send one working request/response example and document the mapping; our server adapter can translate it. There is no need to rebuild working inference solely to match an internal URL convention.

## Ownership

| Gemma collaborator | Our website team |
| --- | --- |
| Select/run Gemma; document exact model and hardware/runtime needs | Landing, capture/upload, inventory confirmation, preferences, results |
| Decode/preprocess images and run multimodal extraction | Browser compression and browser-to-Vercel size limits |
| Normalize output, combine repeated views, validate JSON | Same-origin `/api/analyze` proxy and validation of its upstream response |
| Callable service or adapter; auth, limits, errors, latency | Vercel credentials, loading, cancellation, retry, deployment |
| Fixtures, expected observations, example responses | Real recipe discovery, constraints/ranking, publisher links |

For an in-repository implementation, use `src/gemma/` for the server adapter, validation, prompts, and types. That path is reserved, not implemented. Supply fixture tests without private user photos or model weights. Our team owns `app/api/analyze/route.ts` and the UI connection unless we agree otherwise.

## Request contract

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

- Accept 1-5 images per analysis, possibly different views of the same shelf.
- `dataBase64` contains just encoded bytes, without a data URL prefix.
- Array order determines `sourceFrame`. It is **zero-based**: the first image is `0`.
- `locale` is optional, for example `en-GB`. Start with English ingredient names because our current recipe normalizer is English-focused.
- JPEG, PNG, and WebP are the initial baseline. The UI also accepts HEIC MIME types, but HEIC decoding is not implemented or verified. Deliver conversion support or explicitly reject it until our uploader converts it. MIME acceptance alone is not decoder support.
- Preserve ingredient identity: `oat milk` must not become `milk`; `peanut butter` must not become `butter`.

### Transport

Our planned browser request is `POST /api/analyze` using multipart `FormData`: repeat the `images` field per image and optionally send `locale`. Our route converts this to `AnalyzePantryInput`. The browser never receives provider credentials.

For a remote service, the proposed default is **POST JSON to the full URL in `GEMMA_API_URL`**, with `Authorization: Bearer <GEMMA_API_KEY>`. Success returns the `PantryAnalysis` object itself, not Markdown or a chat-provider envelope. If your service needs a different authentication scheme, route, or envelope, document it so our proxy can adapt. These defaults are not implemented yet.

Vercel serves the website and proxy, not model inference. A process on your laptop's `localhost` is not reachable from the deployed website. Provide a hosted URL reachable from Vercel or document the intended demo connectivity before deployment.

## Response contract

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

Field rules:

- IDs are nonempty and unique within the response. They need not persist between separate analyses.
- `name` is a concise ingredient name. `originalLabel` is optional visible packaging text; omit it when unreadable.
- `estimatedQuantity` is optional plain text such as `4 visible eggs`. Omit unknown quantities; do not infer exact grams from an opaque package.
- `confidence` is finite and in `[0, 1]`. It is a model estimate, not a calibrated probability or safety guarantee.
- `sourceFrame` is an integer in `[0, images.length - 1]`. For merged observations, choose the clearest supporting frame.
- Set `needsConfirmation` for uncertain identity, type, or quantity. Our UI will still ask the user to review every item.
- Merge repeated views without summing their quantities. Keep visibly different products such as oat milk and dairy milk separate.
- Unidentified containers belong in `uncertainItems`, not as invented ingredients.
- Use `warnings` for relevant coverage/image-quality limitations. Return all three top-level arrays even when empty.
- Do not infer freshness, expiry, allergy safety, or dietary certification from appearance. Recipes and ratings are outside this response.

Example output (illustrative fixture, not a real scan):

```json
{
  "ingredients": [
    {
      "id": "ingredient-1",
      "name": "egg",
      "estimatedQuantity": "4 visible eggs",
      "confidence": 0.92,
      "sourceFrame": 0,
      "needsConfirmation": false
    },
    {
      "id": "ingredient-2",
      "name": "oat milk",
      "originalLabel": "Oat drink",
      "confidence": 0.68,
      "sourceFrame": 1,
      "needsConfirmation": true
    }
  ],
  "uncertainItems": [
    {
      "id": "unknown-1",
      "description": "Closed white container; contents are not visible",
      "sourceFrame": 1
    }
  ],
  "warnings": ["The bottom shelf is partly obscured."]
}
```

An empty fridge is a successful response with empty arrays. A provider failure must remain an error, rather than being converted into an empty scan.

## Validation, failures, and configuration

Validate model output at runtime. A TypeScript interface or a prompt asking for JSON does not validate it. Reject malformed JSON, wrong types, duplicate IDs, impossible frame indices, and confidence outside the allowed range. A bounded repair/retry is acceptable within the timeout; return a useful failure when it does not succeed.

Proposed app-facing error envelope:

```json
{
  "error": {
    "code": "ANALYSIS_TIMEOUT",
    "message": "Analysis timed out. Please try again.",
    "retryable": true
  }
}
```

| Failure | Planned HTTP status | Retryable |
| --- | ---: | --- |
| Missing images, more than five, corrupt bytes | 400 | No, correct the input |
| Oversize upload | 413 | No, resize/select fewer images |
| Unsupported format, including unhandled HEIC | 415 | No, convert the image |
| Invalid model response after bounded repair | 502 | Yes |
| Inference unavailable | 503 | Yes |
| Inference timeout | 504 | Yes |

Our proxy owns the public response and maps provider-specific errors to this envelope. Do not expose raw provider responses, API keys, or encoded images in error text or logs.

Reserved server variables in [`.env.example`](../.env.example):

| Variable | Meaning |
| --- | --- |
| `GEMMA_API_URL` | Full remote analysis URL for the proposed HTTP adapter; currently a placeholder |
| `GEMMA_API_KEY` | Service credential, shared securely outside Git |
| `GEMMA_API_TIMEOUT_MS` | `45000` initial proxy timeout budget |
| `GEMMA_USE_MOCK` | Explicit development fixture mode; reserved but not implemented |

Document model-host variables separately. Do not put weights in this repository. The browser must not import inference libraries or read provider credentials.

Upload budget: the planned multipart body is below 4,000,000 bytes, leaving room beneath Vercel's 4.5 MB limit. The current UI checks the sum of file sizes only; compression and full-body validation are still needed. If sending browser-to-proxy JSON/base64 instead, raw images must fit a 3,000,000-byte budget for encoding overhead. The proxy is planned with a 60-second function limit and 45-second upstream abort. Report one-image and five-image latency; flag a timeout mismatch before switching to an asynchronous job protocol.

## Deliverables, in order

1. **Contract sample:** one request/response matching this schema, model identifier, runtime, supported formats, and current limitations. Our UI team can use this immediately.
2. **Working call:** one clear fridge photo produces validated ingredients through your callable adapter or hosted endpoint.
3. **Multiple images:** support 1-5 frames, preserve indices, and combine repeated observations correctly.
4. **Uncertainty and failures:** exercise occlusion, unreadable labels, empty scenes, corrupt inputs, timeout, and unavailable service.
5. **Deployment handoff:** endpoint/auth instructions, setup command, variables, measured latency, sample request/response, fixtures/tests, and commit SHA or service version. Share credentials separately.

No fine-tuning is required for the first milestone. Record the exact Gemma configuration that runs; do not silently substitute Gemini or another model while labelling it Gemma.

## Acceptance checks

- [ ] Real one-image and five-image requests return valid `PantryAnalysis`.
- [ ] Every success response validates at runtime; invalid model output becomes an explicit error.
- [ ] Clear produce, readable packaging, obscured labels, repeated views, opaque containers, and an empty fridge are exercised.
- [ ] Distinct products stay distinct; unknown quantities are omitted; repeated views do not inflate amounts.
- [ ] Frame indices always point to submitted images and uncertainty reaches the confirmation screen.
- [ ] Unsupported formats, corrupt files, provider failures, and timeouts produce predictable errors.
- [ ] Model identifier, latency, and known recognition failures are documented.
- [ ] Hosted access works from the deployment environment; local-only success is labelled as local.

These checks validate integration, not perfect recognition. The final app includes human inventory confirmation.

## After Gemma returns

Our UI preserves item IDs while users edit their inventory. Only approved items are mapped to the recipe service:

```ts
// confirmedItems is UI state after review, not the raw model response.
const ingredients = confirmedItems.map((item) => ({
  name: item.name,
  quantity: item.estimatedQuantity,
  useSoon: item.useSoon
}));
```

The user sets `useSoon`; it is not an inferred expiry date. Raw photos, uncertain entries, and unconfirmed guesses need not reach the recipe provider. Our team then owns real web discovery, eligibility checks, ranking, the complete results list, and publisher links.

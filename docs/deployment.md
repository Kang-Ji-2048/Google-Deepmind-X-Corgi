# Vercel deployment runbook

Last verified against Vercel documentation: 2026-09-17.

## Current status

The initial Next.js 16 App Router scaffold is integrated on main and its production build, TypeScript check, and 9 recipe-library tests have passed. A landing-only preview can now be deployed. Live recipe-search work is underway using Gemini API Google Search grounding, but the complete cooking workflow is not ready yet: analysis, recipe, and health server routes, product screens, and the live provider path still need to land and pass integration checks.

This worktree has no `.vercel/` project link and no Vercel CLI installation, so no linked project, deployment credentials, remote environment names, or deployed URL could be validated here. No secret values were inspected. Treat every Vercel setup item below as pending until the project owner links or imports the repository.

Use the [README](../README.md) for current implementation status and the [Gemma handoff](gemma-integration.md) for the external collaborator's responsibilities. The environment and route settings below are a target contract, not existing runtime behavior.

No `vercel.json` is committed at this stage. Vercel detects Next.js automatically, and route-level runtime settings belong beside the eventual route handlers. Add project configuration only when the scaffold or a verified deployment requires it.

## Project import and build settings

For the first deployment:

1. Push the repository to its Git provider and import it from the Vercel dashboard.
2. Select the intended Vercel team and use a clear project name such as `what-can-i-cook`.
3. Set **Framework Preset** to **Next.js**.
4. Set **Root Directory** to the repository root. Change this only if the app becomes a monorepo.
5. Use the committed npm lockfile and the package's `npm run build` script (currently `next build --webpack`). Keep the framework output default `.next`; do not point Vercel at a Vite `dist` directory.
6. Pin `package.json#engines.node` to `24.x` and select Node.js 24.x in Vercel. Node.js 24 is Vercel's current default; Next.js 16 requires Node.js 20.9 or later. If the scaffold owner chooses a different supported major, keep both settings identical and document why.
7. Set the production branch to `main` (or the repository's actual protected release branch if that changes).
8. Enable standard deployment protection for generated deployment and Preview URLs. Share a Vercel-authenticated or explicitly generated share link with judges/testers; do not make image-bearing previews casually public.

Every non-production branch should create a Preview deployment. A merge or explicit promotion from the production branch should create Production. Preview and Production must not share provider keys when separate sandbox credentials are available.

## Environment-variable contract

All variables below are server-only. None may use a `NEXT_PUBLIC_` prefix or be read by a Client Component.

| Variable | Required | Preview | Production | Purpose |
| --- | --- | --- | --- | --- |
| `GEMMA_API_URL` | When mock is false | Sandbox/staging URL | Production URL | Full analysis endpoint URL, including the route; see the Gemma handoff |
| `GEMMA_API_KEY` | When mock is false | Sandbox key | Production key | Authorization for Gemma; send only from the server adapter |
| `GEMMA_API_TIMEOUT_MS` | Yes | `45000` | `45000` initially | Adapter timeout; must be shorter than the route duration |
| `GEMMA_USE_MOCK` | Yes | `true` until sandbox is ready | `false` | Explicitly selects deterministic fixture data |
| `RECIPE_SEARCH_API_URL` | No | Omit or Gemini base | Omit or Gemini base | Optional base override; default is `https://generativelanguage.googleapis.com/v1beta` |
| `RECIPE_SEARCH_API_KEY` | When mock is false | Dedicated Preview key | Production key | Gemini API key, sent only as `x-goog-api-key` |
| `RECIPE_SEARCH_MODEL` | No | `gemini-2.5-flash` | `gemini-2.5-flash` | Optional stable model override; selected model must support Google Search grounding |
| `RECIPE_SEARCH_TIMEOUT_MS` | Yes | `10000` | `10000` initially | Per-outbound-request timeout for Gemini and publisher fetches |
| `RECIPE_SEARCH_USE_MOCK` | Yes | `true` until sandbox is ready | `false` | Explicitly selects deterministic recipe fixtures |

Once adapters are connected, validate this contract on the server with a small schema. Parse booleans and positive integer timeouts explicitly; the strings `"false"` and `"0"` are truthy in JavaScript. A landing-only preview does not need working model credentials. A release advertised as a functioning live cooking app must use live providers and must not silently fall back to fixtures when credentials are absent.

For Gemini live mode, fail configuration when `RECIPE_SEARCH_API_KEY` is absent. Omitting `RECIPE_SEARCH_API_URL` or `RECIPE_SEARCH_MODEL` should select the hard-coded official defaults; if the base URL is set in Production, validate it as HTTPS and restrict it to the expected Google host unless an intentional provider migration is underway. Validate the model as a conservative identifier, not a free-form URL/path. `RECIPE_SEARCH_USE_MOCK=true` may select deterministic fixtures only when `/api/recipes` explicitly requests mock mode. It must never activate because Gemini is unavailable, times out, returns `429`, or lacks a key.

Configure values in **Project Settings → Environment Variables** for Preview and Production separately. Environment changes apply only to subsequent deployments, so redeploy after every change. For local work, copy `.env.example` to the ignored `.env.local`, or link the project and pull Development values with `vercel env pull .env.local`.

## Function runtime, uploads, and timeouts

Use the Node.js runtime for the Gemma adapter route, not Edge. Node.js offers the most predictable support for multipart parsing, image metadata libraries, and longer provider calls. Once the route exists, start with:

```ts
export const runtime = "nodejs";
export const maxDuration = 60;
```

Sixty seconds is a portable initial ceiling, including older non-Fluid Hobby deployments; the adapter should abort Gemma at 45 seconds and return a retryable `504` response first. Verify the active plan and Fluid Compute setting before raising the route duration. Choose a single execution region close to the Gemma service only after its hosted region is known; otherwise retain Vercel's default placement.

Vercel Functions accept at most **4.5 MB for a request body and 4.5 MB for a response body**. Enforce one of these browser-to-route contracts before the upload begins:

- Preferred for the hackathon: resize/compress on-device, send multipart data, allow at most 5 images, and cap the complete multipart body below **4.0 MB**.
- If the browser sends JSON base64, cap the combined raw image bytes at **3.0 MB** because base64 adds roughly one third before JSON overhead.
- If acceptable recognition quality cannot fit those budgets, switch to direct client uploads to private, short-lived object storage and send only opaque object references through the function. Do not proxy large original files through a Vercel Function.

Reject unsupported MIME types, too many files, and oversize requests with a clear `400` or `413` before calling Gemma. Do not depend on filename extensions. HEIC decoding must be tested in the chosen Node.js image library or converted in the browser; do not assume platform support.

Keep the analysis response small and structured. Never relay raw provider debug output or image bytes to the client.

References: [Vercel Function limits](https://vercel.com/docs/functions/limitations) and [payload-too-large guidance](https://vercel.com/docs/errors/function_payload_too_large).

## Live recipe-search runtime

The selected discovery provider is the Gemini API with Google Search grounding. The provider calls `models/{model}:generateContent` with `tools: [{ google_search: {} }]`, consumes only `candidates[].groundingMetadata.groundingChunks[].web.uri` as discovery URLs, and then retrieves a bounded set of original publisher pages for schema.org Recipe data. Model prose must never supply recipe facts, ingredients, ratings, or source metadata. The provider uses Node networking modules for DNS and redirect validation, so `POST /api/recipes` must use the Node.js runtime; it is not Edge-compatible.

Start the route with:

```ts
export const runtime = "nodejs";
export const maxDuration = 60;
```

Apply an overall route deadline no longer than about 50 seconds so the route can return a controlled timeout before Vercel's 60-second ceiling. `RECIPE_SEARCH_TIMEOUT_MS=10000` applies to each outbound request, not the complete route. Fetch at most 10 publisher pages initially with a small bounded concurrency (for example 3), a 1 MiB decoded-body cap for the Gemini JSON response, a 1 MiB cap per publisher page, and at most 3 redirects. Abort and close responses once a cap or timeout is reached.

Do not retry inside the provider: automatic retries multiply route latency, Gemini token/grounding quota usage, and publisher traffic. The route may make one narrowly targeted retry only when the failure is explicitly transient and there is enough overall deadline remaining; for the hackathon default, return a retryable `429`, `502`, or `504` state and let the user retry. Preserve upstream retry guidance when available without exposing response bodies.

Every grounded publisher URL is untrusted input. Before each request and redirect hop, require HTTP(S) as intended by the provider policy, reject embedded credentials and nonstandard ports unless explicitly allowed, resolve DNS, and block loopback, private, link-local, multicast, unspecified, and cloud-metadata destinations for both IPv4 and IPv6. Revalidate the next URL after every redirect to prevent DNS/redirect-based SSRF. Never forward the Gemini key to publisher hosts.

Gemini setup is an external release prerequisite:

1. Create or select a Google AI Studio project, enable Gemini API access, and configure billing/quota appropriate for Production. There is no secretless live path.
2. Create distinct Preview and Production authorization keys when the project permits it, and label them accordingly. As of September 2026, Google documents that legacy standard API keys are being rejected; use the current authorization-key flow rather than a new unrestricted standard key.
3. Add the keys to the matching Vercel environments as `RECIPE_SEARCH_API_KEY`; do not paste them into `.env.example`, Git, screenshots, logs, or client code.
4. Confirm the selected model supports Search grounding and inspect the project's live RPM, token, and daily limits in AI Studio. Limits apply per project, not per key, and can change with model and usage tier.
5. Review current token and grounding prices immediately before launch. As verified on 2026-09-17, Google lists Gemini 2.5 Flash/Lite Search grounding allowances and paid overage separately from model tokens; provider terms are changeable and should not be hard-coded into the app.
6. Run one Preview search, verify grounded responses contain usable `groundingChunks[].web.uri` values, and confirm `401`, `403`, `404` model errors, `429 RESOURCE_EXHAUSTED`, and missing grounding metadata become intentional states.
7. Preserve `groundingMetadata.searchEntryPoint.renderedContent` through the server response when present and render the required Google Search entry point according to Google's usage requirements. Do not substitute model prose for source-backed recipe data.

Official references: [Google Search grounding](https://ai.google.dev/gemini-api/docs/generate-content/google-search), [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key), [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Image privacy and logging

Fridge photos can reveal names, addresses, medication, children, or the inside of a home. Treat every upload as sensitive user data.

- Process uploads ephemerally. The initial implementation must not persist images after the request finishes.
- Render local previews with browser object URLs and revoke them when replaced or on unmount.
- Do not send user uploads through `next/image`; optimized remote images can be cached by Vercel's image pipeline. `next/image` remains suitable for public recipe/publisher images only, with narrow `remotePatterns` allowlists.
- Set analysis responses to `Cache-Control: no-store` and avoid putting image data or signed object URLs in query strings.
- Never log request bodies, base64, buffers, image URLs, provider keys, authorization headers, original filenames, detected label text, or full provider responses.
- Do not log raw confirmed inventories, allergy/dietary preferences, Gemini prompts or model prose, generated Google search queries, grounding metadata, publisher page contents, or source fetch URLs with user-derived query parameters. These can reveal health or household information. Prefer an opaque request ID, result counts, coarse timing, status category, and a one-way query fingerprint only if deduplication metrics are necessary.
- Log only an opaque request ID, image count, coarse byte count, MIME types, dependency name, duration, outcome code, and sanitized error category.
- Sanitize thrown HTTP-client errors: many clients attach request headers and response bodies to error objects.
- Restrict Vercel project membership and log access. If a log drain is later enabled, apply the same redaction policy and review its retention separately.

Vercel exposes `console` output from Functions in runtime logs; anything written there must be assumed visible to project members. See [Vercel Function Logs](https://vercel.com/docs/functions/logs) and [Image Optimization behavior](https://vercel.com/docs/image-optimization).

## Health and smoke checks

Add `GET /api/health` with the scaffold. It should perform a fast liveness/configuration check without uploading an image or consuming provider quota.

Success response (`200`, `Cache-Control: no-store`):

```json
{
  "status": "ok",
  "environment": "preview",
  "commit": "short-sha",
  "integrations": {
    "gemma": "configured",
    "recipeSearch": "configured"
  }
}
```

Return `503` when required variables are absent or invalid. Expose only `configured`, `mock`, or `missing`; never expose URLs, key fragments, exception messages, or provider responses. Use Vercel's system environment values for the environment and commit SHA.

For `recipeSearch`, `configured` means live mode has a syntactically valid HTTPS base, valid model identifier, and a non-empty key; it does not require making a billable Gemini request. Keep live provider probes out of the public health endpoint. A release smoke test should call `/api/recipes` separately with a small non-sensitive fixture inventory.

The deploy smoke test is:

```sh
curl --fail --silent --show-error https://DEPLOYMENT_URL/api/health
curl --fail --silent --show-error https://DEPLOYMENT_URL/
```

For protected previews use `vercel curl /api/health --deployment DEPLOYMENT_URL` and the same command for `/`. Then complete one manual five-image analysis with safe test fixtures and one recipe search. A live dependency probe should remain a manual or authenticated test route; a public health endpoint must not create provider cost on every poll.

## Custom domain

Add the domain only after a Production deployment passes the checklist:

1. In **Project Settings → Domains**, add the apex domain and the intended `www` host.
2. Run `vercel domains inspect example.com` and configure the exact A, CNAME, or verification records it reports at the authoritative DNS provider. Do not copy generic record values without inspecting the domain.
3. Choose one canonical host and configure the other to redirect to it.
4. Wait for Vercel to report valid DNS and an issued TLS certificate.
5. Re-run `/`, `/api/health`, one upload, and one external recipe link on the canonical HTTPS host.
6. Confirm no old Preview or generated deployment URL is embedded as an application origin.

Vercel automatically provisions TLS after DNS verification. See [Vercel custom-domain setup](https://vercel.com/docs/domains/set-up-custom-domain).

## Predeploy checklist

### Before the first Preview

- [x] Next.js scaffold and lockfile are committed.
- [x] `package.json` contains `dev`, `build`, `start`, `test`, and `typecheck` scripts plus Node.js `24.x`. There is no lint script yet.
- [x] Clean install, tests, production build, and type-check passed for the initial integrated scaffold. Re-run for the release commit, with build and type-check sequential because Next.js regenerates types.
- [ ] Provider adapters are server-only and validate every upstream response against the shared schemas.
- [ ] `/api/recipes` explicitly exports the Node.js runtime and a 60-second maximum duration, with a shorter overall application deadline.
- [ ] Gemini API project, billing/quota, grounded-search-capable model, and current authorization keys are ready; Preview and Production keys are stored only in their matching Vercel environments.
- [ ] Live mode fails closed on a missing key and never falls back to fixtures after timeout, `429`, or provider failure.
- [ ] Only grounded `groundingChunks[].web.uri` values become discovery URLs; model prose never becomes recipe data.
- [ ] Google Search entry-point content is preserved and displayed when required by the grounding response/terms.
- [ ] Publisher retrieval enforces DNS/IP SSRF checks on every redirect, bounded concurrency, 1 MiB body caps, and a 3-redirect maximum.
- [ ] `.env.local` and `.vercel/` remain ignored; `git grep` finds no real secret.
- [ ] Preview variables are set with mock flags intentionally chosen.
- [ ] Upload count, MIME, multipart/body byte limits, provider aborts, and friendly `413`/timeout states are tested.
- [ ] `/api/health` returns `200` when configured and `503` when intentionally misconfigured.
- [ ] Function logs from a fixture request contain no image data, labels, filenames, keys, headers, or provider response body.

### Preview acceptance

- [ ] Desktop and phone routes load over HTTPS: `/`, `/inventory`, `/preferences`, and `/recipes`.
- [ ] Camera/upload permissions, selection of 1 and 5 images, removal, retry, and cancellation work on a real phone.
- [ ] A payload near the accepted limit succeeds; an oversize payload is rejected before Gemma is called.
- [ ] Mock mode is visibly identifiable to testers and deterministic.
- [ ] Live-mode Gemma timeout and unavailability return retryable UI states.
- [ ] Allergy and dietary filters survive recipe-provider errors without presenting unsafe results.
- [ ] Gemini timeout, `401`/`403`, `404` model errors, `429`, malformed JSON, missing grounding metadata, empty results, and partial publisher failures produce intentional UI states without leaking upstream bodies.
- [ ] A ten-result search completes inside the route deadline and does not exceed the configured publisher concurrency.
- [ ] Recipe links open the original publisher over HTTPS; no full instructions are republished.
- [ ] `vercel curl` checks `/` and `/api/health`; Vercel runtime/build logs have no unexplained errors.

### Production release

- [ ] Production uses distinct live credentials and both mock flags are `false`.
- [ ] Production provider quotas, rate limits, billing alerts, and allowed origins/IP policy are understood.
- [ ] Deployment protection and project membership are reviewed.
- [ ] The exact Preview commit has passed acceptance and is promoted/merged to the production branch.
- [ ] Production `/api/health`, one safe fixture upload, and one recipe search pass.
- [ ] Custom domain, canonical redirect, DNS, and TLS pass after attachment.
- [ ] A rollback target is known: the last healthy Vercel deployment can be promoted immediately.

## Known integration risks

- The external Gemma endpoint's region, authentication scheme, maximum request size, accepted HEIC behavior, timeout, concurrency, and whether it accepts object references are not yet known.
- Gemini Google Search grounding is selected, but a working Google AI project/key, billing/quota, Vercel environment configuration, grounding entry-point UI, publisher success rate, and production latency have not been validated in this task.
- Gemini grounding returns discovery URLs, not normalized Recipe records. Model prose is deliberately ignored; publisher HTML remains untrusted and inconsistent, and up to 10 page fetches can dominate latency even when `generateContent` is fast.
- The live provider's source-image hosts and any publisher-specific attribution requirements are not yet known, so `next/image` allowlists and final attribution UI cannot be finalized.
- Five camera originals will normally exceed Vercel's function body limit; client compression or direct private upload is mandatory, not an optimization.
- The landing build is verified; analysis, recipe, and health routes are still missing. A successful landing deployment alone does not demonstrate working Gemma analysis or live recipe discovery.

Framework references: [Next.js 16 runtime requirements](https://nextjs.org/docs/app/guides/upgrading/version-16) and [Vercel Node.js 24 availability](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions).

# Vercel deployment runbook

Last verified against Vercel documentation: 2026-09-17.

## Current status

The deployment contract is ready, but this worktree is not deployable yet: it does not contain the confirmed Next.js 16 App Router scaffold or `package.json`. Do not create a Vercel project until the scaffold's local production build succeeds. This avoids locking in guessed build overrides.

No `vercel.json` is committed at this stage. Vercel detects Next.js automatically, and route-level runtime settings belong beside the eventual route handlers. Add project configuration only when the scaffold or a verified deployment requires it.

## Project import and build settings

After the scaffold lands:

1. Push the repository to its Git provider and import it from the Vercel dashboard.
2. Select the intended Vercel team and use a clear project name such as `what-can-i-cook`.
3. Set **Framework Preset** to **Next.js**.
4. Set **Root Directory** to the repository root. Change this only if the app becomes a monorepo.
5. Leave **Install Command**, **Build Command**, and **Output Directory** on framework defaults. Expected commands are the package manager install and `next build`; expected output is `.next`.
6. Pin `package.json#engines.node` to `24.x` and select Node.js 24.x in Vercel. Node.js 24 is Vercel's current default; Next.js 16 requires Node.js 20.9 or later. If the scaffold owner chooses a different supported major, keep both settings identical and document why.
7. Set the production branch to `main` (or the repository's actual protected release branch if that changes).
8. Enable standard deployment protection for generated deployment and Preview URLs. Share a Vercel-authenticated or explicitly generated share link with judges/testers; do not make image-bearing previews casually public.

Every non-production branch should create a Preview deployment. A merge or explicit promotion from the production branch should create Production. Preview and Production must not share provider keys when separate sandbox credentials are available.

## Environment-variable contract

All variables below are server-only. None may use a `NEXT_PUBLIC_` prefix or be read by a Client Component.

| Variable | Required | Preview | Production | Purpose |
| --- | --- | --- | --- | --- |
| `GEMMA_API_URL` | When mock is false | Sandbox/staging URL | Production URL | Base URL for the externally owned image-analysis service |
| `GEMMA_API_KEY` | When mock is false | Sandbox key | Production key | Authorization for Gemma; send only from the server adapter |
| `GEMMA_API_TIMEOUT_MS` | Yes | `45000` | `45000` initially | Adapter timeout; must be shorter than the route duration |
| `GEMMA_USE_MOCK` | Yes | `true` until sandbox is ready | `false` | Explicitly selects deterministic fixture data |
| `RECIPE_SEARCH_API_URL` | When mock is false | Sandbox/staging URL | Production URL | Base URL for recipe discovery |
| `RECIPE_SEARCH_API_KEY` | When mock is false | Sandbox key | Production key | Authorization for recipe discovery |
| `RECIPE_SEARCH_TIMEOUT_MS` | Yes | `10000` | `10000` initially | Per-request search timeout |
| `RECIPE_SEARCH_USE_MOCK` | Yes | `true` until sandbox is ready | `false` | Explicitly selects deterministic recipe fixtures |

The application should validate this contract at server startup/build time with a small schema. Parse booleans and positive integer timeouts explicitly; the strings `"false"` and `"0"` are truthy in JavaScript. Fail a Production build when either mock flag is true or a required live credential is absent.

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

## Image privacy and logging

Fridge photos can reveal names, addresses, medication, children, or the inside of a home. Treat every upload as sensitive user data.

- Process uploads ephemerally. The initial implementation must not persist images after the request finishes.
- Render local previews with browser object URLs and revoke them when replaced or on unmount.
- Do not send user uploads through `next/image`; optimized remote images can be cached by Vercel's image pipeline. `next/image` remains suitable for public recipe/publisher images only, with narrow `remotePatterns` allowlists.
- Set analysis responses to `Cache-Control: no-store` and avoid putting image data or signed object URLs in query strings.
- Never log request bodies, base64, buffers, image URLs, provider keys, authorization headers, original filenames, detected label text, or full provider responses.
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

- [ ] Next.js scaffold and lockfile are committed.
- [ ] `package.json` contains the expected `build`, `lint`, and test/type-check scripts plus an explicit supported Node.js engine (`24.x` is the current recommendation).
- [ ] Clean install, lint, type-check, tests, and `npm run build` pass locally.
- [ ] Provider adapters are server-only and validate every upstream response against the shared schemas.
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
- The recipe-search provider and its quota, attribution requirements, result schema, image hosts, and sandbox support are not yet chosen.
- Five camera originals will normally exceed Vercel's function body limit; client compression or direct private upload is mandatory, not an optimization.
- `next/image` allowlists cannot be finalized until recipe image hosts are known.
- The current repository has no build, route, or health endpoint to validate. Deployment readiness must be rechecked immediately after the scaffold lands.

Framework references: [Next.js 16 runtime requirements](https://nextjs.org/docs/app/guides/upgrading/version-16) and [Vercel Node.js 24 availability](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions).

# What Can I Cook?

Turn fridge or pantry photos into an editable inventory, then find real, highly rated online recipes that fit the ingredients, dietary preferences, time, and equipment available.

**Platform:** one responsive website for Mac and phone, built with Next.js 16, React 19, TypeScript, and Tailwind v4. Vercel hosts the website. A separate collaborator owns the Gemma integration.

**Gemma owner: start with [the integration handoff](docs/gemma-integration.md).** It includes the deliverables, request/response contract, examples, ownership boundaries, and acceptance checks.

## Where we are now

Integration update: 2026-09-17. The initial scaffold, green/mint design, camera intake, cuisine-first recipe UI and Google-backed search implementation are integrated. Live Google compatibility checks are in progress; the key is stored only in ignored local configuration.

| Area | Implemented on main | Still needed |
| --- | --- | --- |
| Landing page | PeakPath green/mint design, responsive food photography, animated fridge logo, compact interactive walkthrough | Final cross-device QA |
| Photo selection | Open camera preview/capture or choose photos; add/remove 1-5 files, MIME/4 MB checks; capture JPEG resized to 1600px | Real-phone checks, uploaded-file compression/HEIC conversion, Gemma submit |
| Gemma | Documented `PantryAnalysis` contract and reserved environment names | External service/adapter, runtime response validation, live inference |
| Inventory and preferences | `/recipes` supports editable manual ingredients, cuisine first, time, diet, allergies, staples, missing items and advanced equipment | Gemma response confirmation and state handoff |
| Recipe matching | Google Search grounding provider, safe publisher retrieval, JSON-LD normalization, strict selected time/equipment/missing limits, ranking/badges, `/api/recipes`, full returned results UI | Live model/quota compatibility checks and relevance tuning |
| Hosting | Server env wiring for recipe search, Vercel runbook, Node 24 | Vercel secrets/import/deployment, health endpoint and device checks |

The **Scan my kitchen** button is explicitly disabled until Gemma is connected. Use **Enter ingredients and find recipes** to open `/recipes`. No `/api/analyze` or `/api/health` endpoint exists yet. `/inventory` and `/preferences` remain planned; preference controls already work on `/recipes`. Landing walkthrough/loading examples are labelled demonstrations, not inference.

`/api/recipes` calls Google Search grounding through a Gemini model for **discovery only**, then retrieves original publisher pages for recipe facts and ratings. It never trusts model prose for those facts and never falls back to `FixtureRecipeProvider`. Fixtures are development/test-only. Missing credentials produce a clear 503; upstream failures and timeouts are separate errors. Gemma remains the separate image-recognition integration, not replaced by Gemini.

Current verification: 27 automated tests, production build and typecheck pass. This does not yet verify real phone cameras, the external Gemma service, or a Vercel deployment.

## What we are building now

| Owner | Current responsibility | Next handoff |
| --- | --- | --- |
| Our visual task | Landing/redesign/logo delivered | Standalone Gemma inventory confirmation UI |
| Our main integration task | Camera, validated search route, Google credentials/smoke tests, contracts/README and Git integration | Verified live search, then external Gemma connection |
| Our recipe task | Google provider, ranking, SSRF defenses and shared 45s deadline delivered | Live-search compatibility/relevance support |
| Our cuisine/filter task | Cuisine-first manual inventory/preferences/results UI delivered | Mobile and interaction QA |
| Our hosting task | Vercel runbook delivered; available for deployment checks | Deployment once the app and services are wired |
| External Gemma collaborator | Model setup, preprocessing, ingredient extraction, structured response and fixtures | Callable service or adapter satisfying [the Gemma handoff](docs/gemma-integration.md) |

Our remaining build sequence:

1. Complete live Google search verification and integrate inventory confirmation.
2. Wire photo selection to a same-origin analysis route, including compression, progress, cancellation, and retry.
3. Tune recipe discovery relevance and retain every eligible candidate returned by the bounded search.
4. Connect confirmed Gemma ingredients to the existing cuisine/preferences and recipe result screens.
5. Validate the collaborator's real Gemma service against the agreed contract.
6. Test the complete journey on Mac and a real phone, then deploy on Vercel.

The visual and product work can progress while Gemma is being implemented. A future demo adapter must be explicitly labelled; fixture success must not be presented as real image recognition or live web search.

## Final MVP experience

1. Open the camera or upload photos on a phone or Mac. Capture 1-5 still views; continuous video analysis is outside the first release.
2. Gemma detects ingredients, reads visible labels, combines repeated views, and marks uncertain items.
3. The user confirms, edits, adds, or removes ingredients and optionally marks items to use soon. Only the confirmed inventory goes into recipe matching.
4. The user chooses cuisine first, then dietary preferences, allergies, maximum time, equipment, permitted pantry staples, and a missing-ingredient allowance.
5. The website searches real recipe sources, compares their required ingredients with the confirmed inventory, and shows all validated candidates found in that search. Recommendations are highlighted within the full list.
6. Each result shows the publisher, original link, source rating and review count when available, cooking time, ingredients available/missing, and why it fits. Clicking opens the original recipe.

Recommendation badges are **Best overall**, **Fastest**, **Uses most ingredients**, **Fewest missing ingredients**, and **Highest rated**. There is no "Most creative" category and no fixed three-recipe limit. "All" refers to candidates returned by the current search; pagination/load-more can expand that set.

Recipes, URLs, ratings, and review counts come from retrieved sources. Missing ratings stay unknown. Generated instructions, voice corrections, cooking mode, nutrition estimates, grocery ordering, accounts, and long-term pantry storage are outside the initial release.

## How the pieces connect

```text
Browser photos
  -> our POST /api/analyze (planned Next.js server route)
  -> collaborator's Gemma service or server adapter
  -> PantryAnalysis JSON
  -> our editable inventory + preferences
  -> our POST /api/recipes (implemented; manual input works today)
  -> Google Search grounding + safe publisher-page fetch (implemented)
  -> RecipeSearchService (implemented library)
  -> all eligible recipe cards + original publisher links
```

Gemma's first-release job is **image-to-ingredient understanding**. Web discovery and source ratings belong to the recipe provider; confirmation, constraints, ranking, and display belong to our app. Further Gemma-assisted query planning or substitutions can come later.

Vercel hosts the web UI and server routes, not the Gemma model weights. Inference must be reachable from Vercel for the deployed experience. This MVP needs internet access for recipe discovery; do not describe the entire product as offline or claim images never leave the device.

## Gemma integration: owner checklist

The detailed contract is in [docs/gemma-integration.md](docs/gemma-integration.md). The Gemma collaborator needs to provide:

- [ ] Exact Gemma model identifier, inference runtime/provider, and start/deploy instructions.
- [ ] A callable service or server adapter accepting 1-5 images and returning the agreed JSON.
- [ ] Deduplicated ingredient names, optional quantities, confidence, source frame, uncertain items, and warnings.
- [ ] Defined preprocessing and supported formats, including what happens to HEIC.
- [ ] Runtime validation and predictable failures for invalid input, timeout, and unavailable service.
- [ ] A tested endpoint URL and authentication instructions, or an importable adapter with setup steps. Share secrets separately from Git.
- [ ] Representative fixtures, expected outcomes, one request/response example, and measured latency.

Our team owns browser uploads, the Next.js proxy, inventory/preferences UI, recipe discovery and ranking, and Vercel deployment. The collaborator can work under `src/gemma/` if implementing inside this repository; that directory does not yet exist. Coordinate before editing our UI or route files.

## Recipe library and remaining work

Entry point: [src/recipes/index.ts](src/recipes/index.ts). Types: [src/recipes/types.ts](src/recipes/types.ts).

```ts
import { FixtureRecipeProvider, RecipeSearchService } from "./src/recipes/index.ts";

const service = new RecipeSearchService(new FixtureRecipeProvider());
const result = await service.search({
  ingredients: [
    { name: "tomato", quantity: "4" },
    { name: "chickpea", useSoon: true }
  ],
  constraints: {
    dietaryRestrictions: ["vegan"],
    allergies: ["tree nut"],
    maxTotalTimeMinutes: 30,
    availableEquipment: ["saucepan"],
    pantryStaples: ["olive oil", "salt"]
  }
});
```

`result.recipes` contains source metadata, `matchedIngredients`, `missingIngredients`, `score`, `scoreBreakdown`, and `badges`. Do not display `result.rejected` as recommendations. A live `RecipeProvider.search(query)` must return `{ sourceUrl, jsonLd }` documents from actual publisher pages. The module does not republish full instructions.

Current scoring weights: 35% pantry ingredient coverage, 25% source rating confidence, 20% missing-ingredient fit, 10% time/equipment fit, and 10% use-soon coverage.

**Current limitations before claiming a recipe is doable:** cuisine guides discovery and source cuisine labels can be unknown. Selecting time/equipment makes those strict (unknown metadata is excluded); the missing-ingredient cap is enforced. Search retrieves at most ten grounded candidate pages; there is no pagination or quantity sufficiency check. Basic keyword diet/allergy checks are incomplete and do not establish certification or cross-contamination safety. Users must check the publisher recipe and food labels. Matching is heuristic, not Gemma-powered.

## Files and development

| Path | Purpose |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx` | Landing page and Next.js shell |
| `components/PhotoInput.tsx`, `components/CameraCapture.tsx`, `src/camera.css` | Upload/camera capture; Gemma submit pending |
| `app/recipes/page.tsx`, `components/RecipeSearch.tsx`, `src/recipe-ui.css` | Manual inventory, cuisine/preferences and results |
| `app/api/recipes/route.ts`, `src/recipe-http.ts`, `src/search-input.ts` | Server-only live search, bounded JSON and input validation |
| `components/GroundingAttribution.tsx` | Sandboxed Google Search suggestions and source links |
| `components/StatusPanel.tsx`, `components/StateShowcase.tsx` | Reusable states and demo showcase |
| `src/styles.css`, `public/images/` | Visual system and generated landing assets |
| `src/recipes/`, `test/recipes.test.ts` | Matching/ranking library, fixtures, and tests |
| `.env.example` | Recipe configuration and reserved Gemma settings; never real secrets |
| `docs/gemma-integration.md` | Gemma collaborator's contract and checklist |
| `docs/deployment.md` | Vercel setup, upload limits, and release checks |

Use Node.js **24.x**:

```sh
git pull origin main
npm ci
npm run dev
```

Open `http://localhost:3000`. Run verification sequentially because the Next.js build regenerates types:

```sh
npm test
npm run build
npm run typecheck
```

Copy `.env.example` to `.env.local` when connecting services. Configure `RECIPE_SEARCH_API_KEY` with a Google AI Studio key and choose an available search-capable `RECIPE_SEARCH_MODEL`. Keep credentials server-only and never commit `.env.local`. Local secrets are not propagated to separate worktrees or Vercel; configure those securely and separately. Mock flags are reserved and do not switch `/api/recipes` to fixtures.

## Keeping collaborators in sync

- Pull the latest main before starting; work on a branch or isolated worktree.
- Message main at milestones, on blockers, and immediately when fields, environment names, or file ownership need to change. Notify affected peer tasks too.
- Update this README at meaningful milestones with what actually landed and what is still planned.
- Main owns integration and coordinates pushes to avoid competing remote states.
- Each completed task sends its commit SHA, files changed, verification result, and remaining limitations.
- The Gemma owner should provide a contract sample early so our UI connection can progress alongside inference.

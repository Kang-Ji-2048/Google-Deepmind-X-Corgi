# What Can I Cook?

Turn fridge or pantry photos into an editable inventory, then find real, highly rated online recipes that fit the ingredients, dietary preferences, time, and equipment available.

**Platform:** one responsive website for Mac and phone, built with Next.js 16, React 19, TypeScript, and Tailwind v4. Vercel hosts the website. A separate collaborator owns the Gemma integration.

**Gemma owner: start with [the integration handoff](docs/gemma-integration.md).** It includes the deliverables, request/response contract, examples, ownership boundaries, and acceptance checks.

## Where we are now

Integration update: 2026-09-17. The green/mint design, camera intake, standalone inventory confirmation, cuisine-first recipe UI and live recipe route are integrated. The route now defaults to TheMealDB's documented free development API and a live smoke test returned real recipes with original publisher links. Google Search grounding remains an optional upgrade; its key authenticated successfully but the project returned 429 `RESOURCE_EXHAUSTED`, so no billing was enabled and the app does not depend on it.

Public preview: https://what-can-i-cook-sigma.vercel.app was deployed from `50a6ae8`; the hosting task is preparing the new demo deployment. New code is not automatically redeployed because Vercel's GitHub access is not connected. Production/Vercel rejects TheMealDB's development key `1` or a missing key unless `MEALDB_ALLOW_DEMO_KEY=true` explicitly enables a labelled development/educational demo. Keep that opt-in false for a product release and configure a production supporter key. Local `npm run dev` may use key `1`. TheMealDB lacks cooking times, so **Any time** is the default; selecting a strict time filter excludes those unknown-time recipes. Missing-ingredient allowance defaults to **Any**, with missing items clearly shown. Source ratings are unknown, so this fallback does not yet meet the final highly-rated-recipe goal.

| Area | Implemented on main | Still needed |
| --- | --- | --- |
| Landing page | PeakPath green/mint design, responsive food photography, animated fridge logo, compact interactive walkthrough | Final cross-device QA |
| Photo selection | Open camera preview/capture or choose photos; add/remove 1-5 files, MIME/4 MB checks; capture JPEG resized to 1600px | Real-phone checks, uploaded-file compression/HEIC conversion, Gemma submit |
| Gemma | Documented `PantryAnalysis` contract and reserved environment names | External service/adapter, runtime response validation, live inference |
| Inventory and preferences | `/recipes` supports editable manual ingredients, cuisine first, time, diet, allergies, staples, missing items and advanced equipment | Gemma response confirmation and state handoff |
| Recipe matching | Free TheMealDB provider, optional Google grounding provider, source normalization, strict selected constraints, ranking/badges, `/api/recipes`, full results UI | Relevance tuning and a production provider key before a public release |
| Hosting | Server env wiring for recipe search, Vercel runbook, Node 24 | Vercel secrets/import/deployment, health endpoint and device checks |

**Immediate photo demo:** click **Choose photo** and attach any supported picture, or take a camera photo. A fixed Good Food Middle East **Roasted vegetables** card and original publisher **View recipe** link appear immediately, with no second search click. Per the requested visual preview, demo labels and unavailable-matching messages are omitted from the card. No image upload, model call, fake ingredient extraction, API key or quota is needed. The card remains while at least one photo is selected and disappears when all are removed. This is a hardcoded visual prototype, not personalized or checked against dietary requirements.

For actual ingredient-based search, use **Enter ingredients and find recipes** to open `/recipes`. Gemma analysis remains unwired: no `/api/analyze` or `/api/health` endpoint exists yet. `/inventory` and `/preferences` remain planned; preference controls already work on `/recipes`. Landing walkthrough/loading examples are labelled demonstrations, not inference.

`/api/recipes` defaults to TheMealDB's real free V1 data and returns only records carrying an original publisher source link. It does not invent ratings, time, or equipment metadata that TheMealDB does not supply. Set `RECIPE_SEARCH_PROVIDER=google` to use the optional Google-grounded provider when that project has quota. Fixtures remain test-only. Gemma is the separate image-recognition integration.

Current verification: 30 automated tests, production build and typecheck pass; a live TheMealDB smoke request returned source-backed recipes. This does not yet verify real phone cameras, the external Gemma service, or a Vercel deployment.

## What we are building now

| Owner | Current responsibility | Next handoff |
| --- | --- | --- |
| Our visual task | Landing/redesign/logo and standalone `InventoryConfirmation` delivered | Wire confirmation into the real Gemma parent flow and browser-test it |
| Our main integration task | Camera, validated search route, provider contracts and Git integration | External Gemma connection |
| Our recipe task | Free TheMealDB provider plus optional Google provider, ranking and safety boundaries delivered | Relevance and provider-production-key support |
| Our cuisine/filter task | Cuisine-first manual inventory/preferences/results UI delivered | Mobile and interaction QA |
| Our hosting task | Vercel runbook delivered; available for deployment checks | Deployment once the app and services are wired |
| External Gemma collaborator | Model setup, preprocessing, ingredient extraction, structured response and fixtures | Callable service or adapter satisfying [the Gemma handoff](docs/gemma-integration.md) |

Our remaining build sequence:

1. Integrate inventory confirmation with the photo-analysis flow.
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
  -> TheMealDB free API by default, or optional Google grounding (implemented)
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
import { MealDbRecipeProvider, RecipeSearchService } from "./src/recipes/index.ts";

const service = new RecipeSearchService(new MealDbRecipeProvider());
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

**Current limitations before claiming a recipe is doable:** TheMealDB's free V1 API supports one ingredient filter per request, so the adapter combines up to four searches and then ranks the returned records. It supplies no dependable ratings, total time, or equipment fields; those remain unknown, and strict time/equipment selections can exclude all such results. Records without an original publisher source are omitted. Cuisine labels can be unknown, there is no pagination or quantity sufficiency check, and keyword diet/allergy checks do not establish certification or cross-contamination safety. Users must check the publisher recipe and food labels.

## Files and development

| Path | Purpose |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx` | Landing page and Next.js shell |
| `components/PhotoInput.tsx`, `components/CameraCapture.tsx`, `src/camera.css` | Upload/camera capture; Gemma submit pending |
| `components/InventoryConfirmation.tsx`, `src/inventory-ui.css` | Standalone editable Gemma response review; not mounted on a live route yet |
| `app/recipes/page.tsx`, `components/RecipeSearch.tsx`, `src/recipe-ui.css` | Manual inventory, cuisine/preferences and results |
| `app/api/recipes/route.ts`, `src/recipe-http.ts`, `src/search-input.ts` | Server-only live search, bounded JSON and input validation |
| `components/GroundingAttribution.tsx` | Provider source links and optional sandboxed Google Search suggestions |
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

Copy `.env.example` to `.env.local` when connecting services. `RECIPE_SEARCH_PROVIDER=mealdb` uses TheMealDB's documented development key `1` without billing. A public production release should obtain its supporter key. To opt into Google instead, set the provider to `google`, configure its server-only key/model, and ensure the project has Search Grounding quota. Never commit `.env.local`.

## Keeping collaborators in sync

- Pull the latest main before starting; work on a branch or isolated worktree.
- Message main at milestones, on blockers, and immediately when fields, environment names, or file ownership need to change. Notify affected peer tasks too.
- Update this README at meaningful milestones with what actually landed and what is still planned.
- Main owns integration and coordinates pushes to avoid competing remote states.
- Each completed task sends its commit SHA, files changed, verification result, and remaining limitations.
- The Gemma owner should provide a contract sample early so our UI connection can progress alongside inference.

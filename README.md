# What Can I Cook?

Turn fridge or pantry photos into an editable inventory, then find real, highly rated online recipes that fit the ingredients, dietary preferences, time, and equipment available.

**Platform:** one responsive website for Mac and phone, built with Next.js 16, React 19, TypeScript, and Tailwind v4. Vercel hosts the website. A separate collaborator owns the Gemma integration.

**Gemma owner: start with [the integration handoff](docs/gemma-integration.md).** It includes the deliverables, request/response contract, examples, ownership boundaries, and acceptance checks.

## Where we are now

Status checked against GitHub main at `ce34aa2` on 2026-09-17. This is the initial scaffold, ready for collaborators to build against. Subsequent documentation commits clarify this baseline.

| Area | Implemented on main | Still needed |
| --- | --- | --- |
| Landing page | Responsive page, food photography, technical explainer, reusable loading/empty/error visuals | PeakPath redesign is underway in the visual task |
| Photo selection | Add/remove 1-5 files, drag-and-drop, MIME and combined file-size checks in `components/PhotoInput.tsx` | Phone capture refinements, compression/conversion, submit handler, actual API request |
| Gemma | Documented `PantryAnalysis` contract and reserved environment names | External service/adapter, runtime response validation, live inference |
| Inventory and preferences | Flow and data boundaries documented | Editable confirmation screen, constraints form, state shared between screens |
| Recipe matching | Schema.org normalization, source deduplication, ingredient matching, basic diet/allergy rules, weighted ranking, five badges; 9 tests pass | Real web discovery provider, strict feasibility filtering, results UI and server route |
| Hosting | Environment example, Git ignore rules, Vercel runbook; Node 24 pinned | Environment wiring, health endpoint, Vercel import/deployment and device checks |

The **Scan my kitchen** button currently has no submit handler. No `/api/analyze`, `/api/recipes`, or `/api/health` endpoint exists yet. `/inventory`, `/preferences`, and `/recipes` are planned routes, not shipped pages. The loading/error showcase is a UI demonstration, not a live analysis.

`FixtureRecipeProvider` returns invented development recipes, ratings, and `recipes.example` links. No live recipe search or Gemma mock adapter is currently connected to the UI. Reserved environment variables do not yet activate those integrations.

Verification completed for the scaffold: `npm ci`, `npm run build`, `npm run typecheck`, and all 9 recipe tests passed. This verifies the scaffold and library, not the finished scan-to-recipe journey.

## What we are building now

| Owner | Current responsibility | Next handoff |
| --- | --- | --- |
| Our visual task | Second visual pass using PeakPath dark green/mint colours and improved motion; original cobalt baseline preserved in Git | Separate visual commit for main to integrate |
| Our main integration task | Shared contract and README; product screens, server routes, and recipe library connections | Complete demo flow, then connection to the collaborator's Gemma endpoint |
| Our recipe task | Ranking library delivered; available for integration support | Live provider and remaining feasibility rules still need implementation on our side |
| Our hosting task | Vercel runbook delivered; available for deployment checks | Deployment once the app and services are wired |
| External Gemma collaborator | Model setup, preprocessing, ingredient extraction, structured response and fixtures | Callable service or adapter satisfying [the Gemma handoff](docs/gemma-integration.md) |

Our remaining build sequence:

1. Finish the visual pass and build inventory confirmation plus preferences.
2. Wire photo selection to a same-origin analysis route, including compression, progress, cancellation, and retry.
3. Connect a real recipe discovery provider; enforce feasibility rules and display every eligible candidate returned by that search.
4. Wire recipe results and original publisher links.
5. Replace explicitly labelled development analysis fixtures with the collaborator's Gemma service.
6. Test the complete journey on Mac and a real phone, then deploy on Vercel.

The visual and product work can progress while Gemma is being implemented. A future demo adapter must be explicitly labelled; fixture success must not be presented as real image recognition or live web search.

## Final MVP experience

1. On a phone, capture several fridge or pantry views. On a Mac, upload photos. Start with 1-5 still images; continuous video is outside the first release.
2. Gemma detects ingredients, reads visible labels, combines repeated views, and marks uncertain items.
3. The user confirms, edits, adds, or removes ingredients and optionally marks items to use soon. Only the confirmed inventory goes into recipe matching.
4. The user sets dietary preferences, allergies, maximum time, equipment, permitted pantry staples, and a missing-ingredient allowance.
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
  -> our POST /api/recipes (planned server route)
  -> live RecipeProvider (to implement)
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

**Current limitations before claiming a recipe is doable:** time/equipment affect ranking rather than strict exclusion; there is no maximum-missing-ingredient filter, pagination, or quantity sufficiency check. Basic keyword dietary/allergy filters are incomplete and do not establish certification or cross-contamination safety. Ingredient matching is heuristic, not model-powered. These gaps belong to our recipe integration work, not the Gemma image endpoint.

## Files and development

| Path | Purpose |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx` | Landing page and Next.js shell |
| `components/PhotoInput.tsx` | Photo selector; future submit connection |
| `components/StatusPanel.tsx`, `components/StateShowcase.tsx` | Reusable states and demo showcase |
| `src/styles.css`, `public/images/` | Visual system and generated landing assets |
| `src/recipes/`, `test/recipes.test.ts` | Matching/ranking library, fixtures, and tests |
| `.env.example` | Reserved server configuration; placeholders only |
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

Copy `.env.example` to `.env.local` when connecting services. Keep credentials server-only and never commit `.env.local`. The file contains placeholders and future mock flags, not working integrations.

## Keeping collaborators in sync

- Pull the latest main before starting; work on a branch or isolated worktree.
- Message main at milestones, on blockers, and immediately when fields, environment names, or file ownership need to change. Notify affected peer tasks too.
- Update this README at meaningful milestones with what actually landed and what is still planned.
- Main owns integration and coordinates pushes to avoid competing remote states.
- Each completed task sends its commit SHA, files changed, verification result, and remaining limitations.
- The Gemma owner should provide a contract sample early so our UI connection can progress alongside inference.

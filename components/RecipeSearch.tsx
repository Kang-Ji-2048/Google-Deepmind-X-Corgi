"use client";

import {
  ArrowSquareOut,
  BowlFood,
  Check,
  Clock,
  CookingPot,
  ForkKnife,
  Plus,
  SpinnerGap,
  Star,
  WarningCircle,
  X
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { GroundingAttribution } from "./GroundingAttribution";
import type { RecommendationBadge, RankedRecipe } from "@/src/recipes/types";
import {
  buildRecipeSearchRequest,
  isRecipeSearchResponse,
  type EditableIngredient,
  type RecipeFilterState,
  type RecipeSearchRequest,
  type RecipeSearchResponse
} from "./recipeSearchModel";

const CUISINES = ["Italian", "Mexican", "Indian", "Japanese", "Chinese", "Thai", "Mediterranean", "British"];
const DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Gluten-free", "Dairy-free", "Halal", "Kosher"];
const TIMES = [
  { label: "Any time", value: undefined },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 }
];
const BADGE_ICONS: Record<RecommendationBadge, typeof Star> = {
  "Best overall": Star,
  "Fastest": Clock,
  "Uses most ingredients": BowlFood,
  "Fewest missing ingredients": Check,
  "Highest rated": Star
};

const initialIngredients: EditableIngredient[] = [
  { id: "ingredient-1", name: "", quantity: "", useSoon: false },
  { id: "ingredient-2", name: "", quantity: "", useSoon: false },
  { id: "ingredient-3", name: "", quantity: "", useSoon: false }
];

const initialFilters: RecipeFilterState = {
  cuisines: [],
  maxTotalTimeMinutes: 30,
  maxMissingIngredients: 3,
  dietaryRestrictions: [],
  allergies: "",
  pantryStaples: "salt, black pepper, olive oil",
  availableEquipment: ""
};

type SearchState = "idle" | "loading" | "cancelled" | "error" | "success";

function formatTime(minutes?: number) {
  if (!minutes) return "Time unknown";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function RecipeCard({ recipe, rank }: { recipe: RankedRecipe; rank: number }) {
  return (
    <article className="recipe-card">
      <div className="recipe-rank" aria-hidden="true">{String(rank).padStart(2, "0")}</div>
      <div className="recipe-card-main">
        <div className="recipe-badges" aria-label="Recommendation highlights">
          {recipe.badges.map((badge) => {
            const Icon = BADGE_ICONS[badge];
            return <span key={badge}><Icon size={13} weight="fill" aria-hidden="true" />{badge}</span>;
          })}
        </div>
        <div className="recipe-title-row">
          <div>
            <p className="recipe-publisher">{recipe.publisher || "Original recipe source"}</p>
            <h3>{recipe.name}</h3>
          </div>
          <a className="recipe-source-link" href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            View recipe <ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </div>
        <div className="recipe-facts">
          <span><Clock size={17} aria-hidden="true" />{formatTime(recipe.totalTimeMinutes)}</span>
          <span>
            <Star size={17} weight={recipe.rating ? "fill" : "regular"} aria-hidden="true" />
            {recipe.rating
              ? `${recipe.rating.value}/${recipe.rating.best} · ${recipe.rating.count.toLocaleString()} ratings`
              : "Rating unknown"}
          </span>
          <span><ForkKnife size={17} aria-hidden="true" />{recipe.score}% match score</span>
          <span>{recipe.cuisines?.length ? recipe.cuisines.join(", ") : "Cuisine not listed by source"}</span>
        </div>
        <div className="recipe-ingredient-fit">
          <div>
            <strong>Already have</strong>
            <div className="ingredient-tags matched">
              {recipe.matchedIngredients.length
                ? recipe.matchedIngredients.map((item) => <span key={item}><Check size={12} weight="bold" />{item}</span>)
                : <span className="tag-empty">No confirmed matches</span>}
            </div>
          </div>
          <div>
            <strong>Still needed · {recipe.missingIngredients.length}</strong>
            <div className="ingredient-tags missing">
              {recipe.missingIngredients.length
                ? recipe.missingIngredients.map((item) => <span key={item}>{item}</span>)
                : <span className="tag-empty">Nothing extra</span>}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function RecipeSearch() {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [filters, setFilters] = useState(initialFilters);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [result, setResult] = useState<RecipeSearchResponse | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const ingredientCounter = useRef(initialIngredients.length);
  useEffect(() => () => {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
  }, []);

  function clearStaleResult() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setSearchState("idle");
    setResult(null);
    setError("");
  }

  function updateFilter<K extends keyof RecipeFilterState>(key: K, value: RecipeFilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    clearStaleResult();
  }

  function toggleFilter(key: "cuisines" | "dietaryRestrictions", value: string) {
    const current = filters[key];
    updateFilter(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function updateIngredient(id: string, patch: Partial<EditableIngredient>) {
    setIngredients((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    clearStaleResult();
  }

  function addIngredient() {
    ingredientCounter.current += 1;
    setIngredients((current) => [...current, {
      id: `ingredient-${ingredientCounter.current}`,
      name: "",
      quantity: "",
      useSoon: false
    }]);
    clearStaleResult();
  }

  function removeIngredient(id: string) {
    setIngredients((current) => current.filter((item) => item.id !== id));
    clearStaleResult();
  }

  async function runSearch(request?: RecipeSearchRequest) {
    if (abortRef.current) return;
    const payload = request ?? buildRecipeSearchRequest(ingredients, filters);
    if (!payload.ingredients.length) {
      setError("Add at least one confirmed ingredient before searching.");
      setSearchState("error");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSearchState("loading");
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data: unknown = await response.json().catch(() => null);
      if (abortRef.current !== controller || controller.signal.aborted) return;
      if (!response.ok) {
        const envelope = data as { error?: { message?: string } } | null;
        throw new Error(envelope?.error?.message || "Recipe search failed. Please try again.");
      }
      if (!isRecipeSearchResponse(data)) throw new Error("The recipe service returned an unexpected response.");
      setResult(data);
      setSearchState("success");
    } catch (caught) {
      if (abortRef.current !== controller) return;
      if (controller.signal.aborted) {
        setSearchState("cancelled");
        return;
      }
      setError(caught instanceof Error ? caught.message : "Recipe search failed. Please try again.");
      setSearchState("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function cancelSearch() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setSearchState("cancelled");
  }

  const currentRequest = buildRecipeSearchRequest(ingredients, filters);

  return (
    <div className="recipe-workspace">
      <aside className="recipe-filter-panel" aria-label="Recipe filters">
        <div className="filter-intro">
          <p className="recipe-step-label">01 · Set the direction</p>
          <h2>What sounds good?</h2>
          <p>Start with cuisine, then narrow the shortlist around your evening.</p>
        </div>

        <fieldset className="filter-group filter-cuisine">
          <legend>Cuisine preference <span>Choose any</span></legend>
          <div className="choice-grid cuisine-grid">
            {CUISINES.map((cuisine) => (
              <button
                key={cuisine}
                className={filters.cuisines.includes(cuisine) ? "is-selected" : ""}
                type="button"
                aria-pressed={filters.cuisines.includes(cuisine)}
                onClick={() => toggleFilter("cuisines", cuisine)}
              >
                {filters.cuisines.includes(cuisine) && <Check size={13} weight="bold" />}{cuisine}
              </button>
            ))}
          </div>
          <p className="manual-note">Cuisine prioritizes discovery; source cuisine labels may be missing. No selection searches all cuisines.</p>
        </fieldset>

        <fieldset className="filter-group">
          <legend>Cooking time</legend>
          <div className="choice-grid time-grid">
            {TIMES.map((time) => (
              <button
                key={time.label}
                className={filters.maxTotalTimeMinutes === time.value ? "is-selected" : ""}
                type="button"
                aria-pressed={filters.maxTotalTimeMinutes === time.value}
                onClick={() => updateFilter("maxTotalTimeMinutes", time.value)}
              >{time.label}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-group">
          <legend>Diet <span>Optional</span></legend>
          <div className="choice-grid diet-grid">
            {DIETS.map((diet) => (
              <button
                key={diet}
                className={filters.dietaryRestrictions.includes(diet.toLocaleLowerCase()) ? "is-selected" : ""}
                type="button"
                aria-pressed={filters.dietaryRestrictions.includes(diet.toLocaleLowerCase())}
                onClick={() => toggleFilter("dietaryRestrictions", diet.toLocaleLowerCase())}
              >{diet}</button>
            ))}
          </div>
        </fieldset>

        <div className="filter-group field-stack">
          <label htmlFor="allergies">Allergies <span>Safety limit</span></label>
          <input id="allergies" value={filters.allergies} onChange={(event) => updateFilter("allergies", event.target.value)} placeholder="e.g. peanuts, shellfish" />
          <p>Known ingredient conflicts are excluded. Always check the source and food labels: this is not an allergy-safety guarantee.</p>
        </div>

        <div className="filter-split">
          <div className="filter-group field-stack">
            <label htmlFor="pantry-staples">Pantry staples</label>
            <textarea id="pantry-staples" rows={2} value={filters.pantryStaples} onChange={(event) => updateFilter("pantryStaples", event.target.value)} />
          </div>
          <div className="filter-group field-stack">
            <label htmlFor="max-missing">Max missing</label>
            <select id="max-missing" value={filters.maxMissingIngredients ?? ""} onChange={(event) => updateFilter("maxMissingIngredients", event.target.value === "" ? undefined : Number(event.target.value))}>
              <option value="">Any</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option>
            </select>
          </div>
        </div>

        <details className="advanced-filter">
          <summary>Advanced · equipment</summary>
          <div className="field-stack">
            <label htmlFor="equipment">Available equipment</label>
            <input id="equipment" value={filters.availableEquipment} onChange={(event) => updateFilter("availableEquipment", event.target.value)} placeholder="e.g. oven, blender" />
            <p>Optional because many source recipes do not list equipment reliably.</p>
          </div>
        </details>
      </aside>

      <main className="recipe-search-main" id="recipe-search-main">
        <div className="ingredient-entry">
          <div className="ingredient-entry-heading">
            <div>
              <p className="recipe-step-label">02 · Confirm ingredients</p>
              <h1>Cook with what you have.</h1>
              <p className="manual-note">Manual ingredient entry · Gemma photo recognition is not connected on this screen yet.</p>
            </div>
            <CookingPot size={34} weight="light" aria-hidden="true" />
          </div>

          <div className="ingredient-table" role="group" aria-label="Confirmed ingredients">
            <div className="ingredient-table-header" aria-hidden="true"><span>Ingredient</span><span>Quantity</span><span>Use soon</span><span /></div>
            {ingredients.map((ingredient, index) => (
              <div className="ingredient-row" key={ingredient.id}>
                <label className="visually-hidden" htmlFor={`${ingredient.id}-name`}>Ingredient {index + 1}</label>
                <input id={`${ingredient.id}-name`} value={ingredient.name} onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value })} placeholder={index === 0 ? "e.g. broccoli" : "Add ingredient"} />
                <label className="visually-hidden" htmlFor={`${ingredient.id}-quantity`}>Quantity for ingredient {index + 1}</label>
                <input id={`${ingredient.id}-quantity`} value={ingredient.quantity} onChange={(event) => updateIngredient(ingredient.id, { quantity: event.target.value })} placeholder="Optional" />
                <label className="use-soon-check">
                  <input type="checkbox" checked={ingredient.useSoon} onChange={(event) => updateIngredient(ingredient.id, { useSoon: event.target.checked })} />
                  <span><Check size={12} weight="bold" /></span><em>Use soon</em>
                </label>
                <button type="button" className="remove-ingredient" onClick={() => removeIngredient(ingredient.id)} aria-label={`Remove ingredient ${index + 1}`} disabled={ingredients.length === 1}><X size={16} /></button>
              </div>
            ))}
          </div>
          <button className="add-ingredient" type="button" onClick={addIngredient} disabled={ingredients.length >= 50}><Plus size={16} weight="bold" />Add another ingredient</button>

          <div className="search-action-row">
            <div><strong>{currentRequest.ingredients.length}</strong><span> confirmed ingredient{currentRequest.ingredients.length === 1 ? "" : "s"}</span></div>
            {searchState === "loading" ? (
              <button className="cancel-search" type="button" onClick={cancelSearch}><X size={17} weight="bold" />Cancel search</button>
            ) : (
              <button className="run-search" type="button" onClick={() => void runSearch()} disabled={!currentRequest.ingredients.length}>
                Find recipes <span><ForkKnife size={18} weight="bold" /></span>
              </button>
            )}
          </div>
        </div>

        <section className="recipe-results" aria-labelledby="results-heading" aria-live="polite" aria-busy={searchState === "loading"}>
          {searchState === "idle" && (
            <div className="results-placeholder">
              <BowlFood size={36} weight="light" aria-hidden="true" />
              <h2 id="results-heading">Your shortlist will appear here.</h2>
              <p>Add your confirmed ingredients, choose any limits, and start a live source-backed search.</p>
            </div>
          )}
          {searchState === "loading" && (
            <div className="results-loading">
              <SpinnerGap size={30} className="spin" aria-hidden="true" />
              <h2 id="results-heading">Searching original recipe sources…</h2>
              <p>Checking ingredient matches, dietary conflicts, time, and missing items.</p>
              <div className="recipe-skeletons" aria-hidden="true"><span /><span /><span /></div>
            </div>
          )}
          {searchState === "cancelled" && (
            <div className="results-message">
              <X size={30} aria-hidden="true" /><h2 id="results-heading">Search cancelled.</h2>
              <p>Your ingredients and filters are still here when you are ready.</p>
              <button type="button" onClick={() => void runSearch()}>Search again</button>
            </div>
          )}
          {searchState === "error" && (
            <div className="results-message is-error" role="alert">
              <WarningCircle size={30} aria-hidden="true" /><h2 id="results-heading">We could not finish that search.</h2>
              <p>{error}</p>
              <button type="button" onClick={() => void runSearch()}>Retry</button>
            </div>
          )}
          {searchState === "success" && result && result.recipes.length === 0 && (
            <div className="results-message">
              <BowlFood size={30} aria-hidden="true" /><h2 id="results-heading">No validated recipes found.</h2>
              <p>Try another cuisine, allow a little more time, or increase the missing-ingredient limit. Allergy and diet limits remain strict.</p>
            </div>
          )}
          {searchState === "success" && result && result.recipes.length > 0 && (
            <>
              <div className="results-heading-row">
                <div><p className="recipe-step-label">03 · Live results</p><h2 id="results-heading">{result.recipes.length} validated recipe{result.recipes.length === 1 ? "" : "s"} found.</h2></div>
                <p>Source: <strong>{result.provider}</strong></p>
              </div>
              {result.rejected.length > 0 && <p className="safety-summary"><WarningCircle size={16} />{result.rejected.length} result{result.rejected.length === 1 ? " was" : "s were"} excluded by your filters.</p>}
              <div className="recipe-card-list">{result.recipes.map((recipe, index) => <RecipeCard key={recipe.id || recipe.sourceUrl} recipe={recipe} rank={index + 1} />)}</div>
            </>
          )}
          {searchState === "success" && result && <>
            <p className="manual-note">Check quantities, equipment, allergens, and the full recipe on the publisher’s page before cooking. Matches are ingredient-name estimates.</p>
            <GroundingAttribution attribution={result.attribution} />
          </>}
        </section>
      </main>
    </div>
  );
}

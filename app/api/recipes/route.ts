import { GeminiGroundedRecipeProvider } from "@/src/recipes/google-grounded-provider";
import { MealDbRecipeProvider } from "@/src/recipes/mealdb-provider";
import { RecipeSearchService } from "@/src/recipes/search";
import { handleRecipeSearch } from "@/src/recipe-http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRecipeSearch(request, async (input) => {
    const configuredTimeout = Number(process.env.RECIPE_SEARCH_TIMEOUT_MS ?? 10_000);
    const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(15_000, Math.max(1_000, configuredTimeout)) : 10_000;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
    const providerName = (process.env.RECIPE_SEARCH_PROVIDER ?? "mealdb").trim().toLowerCase();
    if (providerName === "mealdb") {
      const provider = new MealDbRecipeProvider({
        apiKey: process.env.MEALDB_API_KEY?.trim() || "1",
        signal,
        timeoutMs
      });
      return new RecipeSearchService(provider).search(input);
    }
    if (providerName !== "google") throw new Error("SEARCH_NOT_CONFIGURED");
    const apiKey = process.env.RECIPE_SEARCH_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith("replace-")) throw new Error("SEARCH_NOT_CONFIGURED");
    const provider = new GeminiGroundedRecipeProvider({
      apiKey,
      signal,
      apiBaseUrl: process.env.RECIPE_SEARCH_API_URL || undefined,
      model: process.env.RECIPE_SEARCH_MODEL || undefined,
      timeoutMs,
    });
    // A fresh provider keeps per-search attribution isolated between users.
    return new RecipeSearchService(provider).search(input);
  });
}

import { GeminiGroundedRecipeProvider } from "@/src/recipes/google-grounded-provider";
import { RecipeSearchService } from "@/src/recipes/search";
import { handleRecipeSearch } from "@/src/recipe-http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRecipeSearch(request, async (input) => {
    const apiKey = process.env.RECIPE_SEARCH_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith("replace-")) throw new Error("SEARCH_NOT_CONFIGURED");
    const configuredTimeout = Number(process.env.RECIPE_SEARCH_TIMEOUT_MS ?? 10_000);
    const provider = new GeminiGroundedRecipeProvider({
      apiKey,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
      apiBaseUrl: process.env.RECIPE_SEARCH_API_URL || undefined,
      model: process.env.RECIPE_SEARCH_MODEL || undefined,
      timeoutMs: Number.isFinite(configuredTimeout) ? Math.min(15_000, Math.max(1_000, configuredTimeout)) : 10_000,
    });
    // A fresh provider keeps per-search attribution isolated between users.
    return new RecipeSearchService(provider).search(input);
  });
}

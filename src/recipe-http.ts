import { parseSearchInput, SearchInputError } from "./search-input.ts";
import type { RecipeSearchInput, RecipeSearchResult } from "./recipes/types.ts";

const MAX_BODY_BYTES = 24_000;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function searchError(code: string, message: string, status: number, retryable = false) {
  return Response.json({ error: { code, message, retryable } }, { status, headers });
}

async function boundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new SearchInputError("Send a JSON search request.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Search request is too large.");
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
  body += decoder.decode();
  try { return JSON.parse(body); }
  catch { throw new SearchInputError("Search request must be valid JSON."); }
}

export async function handleRecipeSearch(request: Request, search: (input: RecipeSearchInput) => Promise<RecipeSearchResult>) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return searchError("CROSS_ORIGIN", "Search from this website, not another origin.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return searchError("UNSUPPORTED_MEDIA_TYPE", "Send an application/json request.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return searchError("REQUEST_TOO_LARGE", "Search request is too large.", 413);
  let input: RecipeSearchInput;
  try { input = parseSearchInput(await boundedJson(request)); }
  catch (cause) {
    if (cause instanceof RangeError) return searchError("REQUEST_TOO_LARGE", cause.message, 413);
    return searchError("INVALID_SEARCH", cause instanceof SearchInputError ? cause.message : "Could not read the search request.", 400);
  }
  try {
    return Response.json(await search(input), { headers });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "SEARCH_NOT_CONFIGURED") return searchError("SEARCH_NOT_CONFIGURED", "Google recipe search is not configured yet. Add the server API key and try again.", 503);
    if (cause instanceof Error && cause.message === "Gemini grounding request failed with HTTP 429") return searchError("SEARCH_QUOTA_EXHAUSTED", "Google's search quota is unavailable or exhausted for this project. Check the project's API quota before trying again.", 503);
    if (cause instanceof Error && cause.message === "Gemini grounding request failed with HTTP 404") return searchError("SEARCH_MODEL_UNAVAILABLE", "The configured Google search model is not available to this project. Update the server's search model setting.", 503);
    if (cause instanceof Error && ["AbortError", "TimeoutError"].includes(cause.name)) return searchError("SEARCH_TIMEOUT", "Search took too long. Please try again.", 504, true);
    return searchError("SEARCH_UNAVAILABLE", "Google recipe search or its recipe sources are temporarily unavailable. Please try again.", 502, true);
  }
}

import type { RecipeProviderAttribution } from "@/src/recipes/types";

export function GroundingAttribution({ attribution }: { attribution?: RecipeProviderAttribution }) {
  if (!attribution) return null;
  return (
    <section aria-label="Google Search attribution" className="grounding-attribution">
      {attribution.searchEntryPointHtml && <iframe
        title="Google Search suggestions"
        srcDoc={attribution.searchEntryPointHtml}
        sandbox="allow-popups"
        referrerPolicy="no-referrer"
        style={{ width: "100%", minHeight: 150, border: 0, background: "white", borderRadius: 8 }}
      />}
      {attribution.sources.length > 0 && <details>
        <summary>Google search sources ({attribution.sources.length})</summary>
        <ul>{attribution.sources.filter((source) => {
          try { const url = new URL(source.url); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
        }).map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || new URL(source.url).hostname}</a></li>)}</ul>
      </details>}
    </section>
  );
}

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/BrandMark";
import { RecipeSearch } from "@/components/RecipeSearch";
import "@/src/recipe-ui.css";

export const metadata = {
  title: "Find recipes · What Can I Cook?",
  description: "Search source-backed recipes around your ingredients, cuisine, time, diet, and safety limits."
};

export default function RecipesPage() {
  return (
    <div className="recipes-page">
      <a className="skip-link" href="#recipe-search-main">Skip to ingredient entry</a>
      <header className="recipes-header">
        <BrandMark />
        <Link href="/" className="recipes-back"><ArrowLeft size={16} weight="bold" />Back home</Link>
      </header>
      <RecipeSearch />
    </div>
  );
}

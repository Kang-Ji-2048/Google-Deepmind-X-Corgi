import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ForkKnife,
  ListChecks,
  Scan,
} from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/BrandMark";
import { PhotoInput } from "@/components/PhotoInput";
import { StateShowcase } from "@/components/StateShowcase";
import fridgeImage from "@/public/images/open-fridge.png";
import mealImage from "@/public/images/weeknight-bowl.png";

const steps = [
  { icon: Scan, title: "Photograph the shelves", body: "Add a few clear views of your fridge or pantry." },
  { icon: ListChecks, title: "Confirm what is there", body: "Keep, edit, or remove anything we spot before searching." },
  { icon: ForkKnife, title: "Pick tonight's recipe", body: "Compare practical recipes from their original publishers." },
];

const technicalSteps = [
  ["01", "Private photo intake", "The browser validates 1-5 images and keeps the request below Vercel's upload limit."],
  ["02", "Structured vision", "A server adapter sends photos to Gemma and receives ingredients with confidence and source-frame data."],
  ["03", "Human confirmation", "You approve the inventory before allergies, time, equipment, and dietary needs are applied."],
  ["04", "Source-backed search", "A ranking service returns feasible recipes with matched ingredients and links to original publishers."],
];

export default function Home() {
  return (
    <div className="app-shell" id="top">
      <header className="site-header">
        <div className="nav-inner">
          <BrandMark />
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a className="nav-cta" href="#scan">Scan your kitchen</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero section" id="scan">
          <div className="hero-copy">
            <span className="eyebrow">Dinner starts with what you have</span>
            <h1>Your fridge has a plan.</h1>
            <p>Photograph your ingredients. Find practical recipes that use them well.</p>
            <PhotoInput />
          </div>
          <figure className="hero-media">
            <Image
              src={fridgeImage}
              alt="An open refrigerator stocked with fresh vegetables, eggs, herbs, and everyday ingredients"
              priority
              sizes="(max-width: 900px) 100vw, 54vw"
            />
            <figcaption>
              <span>From fridge photo</span>
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
              <span>to a useful shortlist</span>
            </figcaption>
          </figure>
        </section>

        <section className="ingredient-ribbon" aria-label="Example ingredients">
          <div className="ribbon-track">
            <span>Broccoli</span><span>Eggs</span><span>Carrots</span><span>Yogurt</span><span>Fresh herbs</span><span>Lemons</span>
          </div>
        </section>

        <section className="section process" id="how-it-works">
          <div className="process-heading">
            <h2>Three moves between “no idea” and dinner.</h2>
            <a href="#scan">Start with a photo <ArrowDown size={18} weight="bold" /></a>
          </div>
          <ol className="process-list">
            {steps.map(({ icon: Icon, title, body }, index) => (
              <li key={title}>
                <span className="process-number">0{index + 1}</span>
                <Icon size={30} weight="light" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section meal-story">
          <div className="meal-image-wrap">
            <Image
              src={mealImage}
              alt="A colorful grain bowl with roasted vegetables, greens, avocado, and eggs on a cobalt plate"
              sizes="(max-width: 900px) 100vw, 59vw"
            />
          </div>
          <div className="meal-copy">
            <span className="meal-index">Use what needs using</span>
            <h2>Good food, fewer forgotten ingredients.</h2>
            <p>Recipes are ranked by what you already own, what needs using soon, and the constraints that matter tonight.</p>
            <ul>
              <li><Check size={18} weight="bold" /> Original recipe sources</li>
              <li><Check size={18} weight="bold" /> Dietary and allergy filters</li>
              <li><Check size={18} weight="bold" /> Time and equipment fit</li>
            </ul>
          </div>
        </section>

        <StateShowcase />

        <section className="section technical-section" id="technical">
          <div className="technical-heading">
            <span className="technical-label">Under the hood</span>
            <h2>A short, inspectable path from photo to recipe.</h2>
            <p>Each handoff is typed, replaceable, and designed to keep private images on the shortest possible route.</p>
          </div>
          <ol className="technical-flow">
            {technicalSteps.map(([number, title, body]) => (
              <li key={number}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="technical-contract">
            <code>photos</code><ArrowRight size={16} weight="bold" aria-hidden="true" />
            <code>PantryAnalysis</code><ArrowRight size={16} weight="bold" aria-hidden="true" />
            <code>confirmed inventory</code><ArrowRight size={16} weight="bold" aria-hidden="true" />
            <code>ranked recipes</code>
          </div>
        </section>

        <section className="section closing-cta">
          <div>
            <h2>Take a look inside.</h2>
            <p>One photo can turn the question into a shortlist.</p>
          </div>
          <a className="button button-light" href="#scan">
            Scan your kitchen
            <span className="button-icon"><ArrowRight size={18} weight="bold" /></span>
          </a>
        </section>
      </main>

      <footer>
        <BrandMark />
        <p>Practical recipes from ingredients already at home.</p>
      </footer>
    </div>
  );
}

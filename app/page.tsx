import Image from "next/image";
import { ArrowRight, Check, Eye, ForkKnife, ListChecks, LockKey, Scan, SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/BrandMark";
import { MotionDirector } from "@/components/MotionDirector";
import { PhotoInput } from "@/components/PhotoInput";
import { StateShowcase } from "@/components/StateShowcase";
import fridgeImage from "@/public/images/open-fridge.png";
import mealImage from "@/public/images/weeknight-bowl.png";

const steps = [
  { icon: Scan, title: "Photograph what you have", body: "Add up to five clear views. More angles help separate duplicates from genuinely different ingredients." },
  { icon: ListChecks, title: "Make the inventory yours", body: "Confirm, rename, or remove every item before it can shape a recommendation." },
  { icon: ForkKnife, title: "Choose from real recipes", body: "Compare feasible dishes, then continue to the original publisher for the full recipe." },
];

const technicalSteps = [
  { icon: LockKey, title: "Private photo intake", body: "The browser validates 1-5 images and keeps the multipart request below 4 MB." },
  { icon: Eye, title: "Structured vision", body: "A server adapter sends photos to Gemma and receives ingredients, confidence, and source frames." },
  { icon: SlidersHorizontal, title: "Human confirmation", body: "You approve the inventory before dietary, allergy, equipment, and time constraints apply." },
  { icon: ForkKnife, title: "Source-backed ranking", body: "The search service scores feasible recipes and links to their original publishers." },
];

export default function Home() {
  return (
    <div className="app-shell" id="top">
      <MotionDirector />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="nav-inner">
          <BrandMark />
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#technical">Technical</a>
            <a className="nav-cta" href="#scan">Scan your kitchen</a>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="scan">
          <div className="ambient ambient-one" aria-hidden="true" />
          <div className="ambient ambient-two" aria-hidden="true" />
          <figure className="hero-media" data-hero-media>
            <Image src={fridgeImage} alt="An open refrigerator stocked with fresh vegetables, eggs, herbs, and everyday ingredients" priority sizes="(max-width: 760px) 100vw, 48vw" />
          </figure>
          <div className="hero-copy" data-hero-copy>
            <span className="eyebrow">Dinner starts with what is already there</span>
            <h1>Your fridge <span className="headline-image" aria-hidden="true"><Image src={mealImage} alt="" sizes="120px" /></span> has dinner.</h1>
            <p>Turn a few kitchen photos into a practical shortlist of source-backed recipes.</p>
          </div>
          <div className="hero-input" data-hero-input><PhotoInput /></div>
          <div className="hero-caption" aria-hidden="true">
            <span>Photo</span><ArrowRight size={14} weight="bold" /><span>Inventory</span><ArrowRight size={14} weight="bold" /><span>Recipe</span>
          </div>
        </section>

        <section className="ingredient-ribbon" aria-label="Example ingredients">
          <div className="ribbon-track">
            <span>Broccoli</span><span>Eggs</span><span>Carrots</span><span>Yogurt</span><span>Fresh herbs</span><span>Lemons</span><span>Broccoli</span><span>Eggs</span>
          </div>
        </section>

        <section className="section interest-section" data-reveal>
          <div className="interest-heading">
            <h2>Less waste. Better answers at six o’clock.</h2>
            <p>The app works from evidence, not imagined ingredients or generated recipes.</p>
          </div>
          <div className="bento-grid">
            <article className="bento-cell bento-inventory">
              <div><span className="cell-label">You stay in control</span><h3>A visible inventory before any search.</h3></div>
              <div className="ingredient-cloud" aria-label="Example confirmed ingredients">
                <span>broccoli</span><span>eggs</span><span>carrots</span><span>lemon</span><span>parsley</span>
              </div>
            </article>
            <article className="bento-cell bento-photo" data-image-scale>
              <Image src={mealImage} alt="A colorful grain bowl made from everyday vegetables and eggs" sizes="(max-width: 760px) 100vw, 42vw" />
            </article>
            <article className="bento-cell bento-constraint">
              <SlidersHorizontal size={30} weight="light" aria-hidden="true" /><h3>Fit the night you actually have.</h3>
              <p>Allergies, diet, equipment, pantry staples, and available time become hard constraints.</p>
            </article>
            <article className="bento-cell bento-source">
              <div className="source-orbit" aria-hidden="true"><span>Publisher</span><span>Rating</span><span>Coverage</span></div>
              <div><h3>Every result earns its place.</h3><p>Recommendations balance ingredient coverage, missing items, reviews, time, and use-soon food.</p></div>
            </article>
          </div>
        </section>

        <section className="section story-section" id="how-it-works">
          <div className="story-heading" data-reveal><h2>From open door to dinner.</h2><p>Three deliberate handoffs keep the process useful, legible, and yours.</p></div>
          <ol className="story-list">
            {steps.map(({ icon: Icon, title, body }, index) => (
              <li className="story-card" key={title} style={{ "--stack-index": index } as React.CSSProperties}>
                <div className="story-card-index">0{index + 1}</div><Icon size={42} weight="light" aria-hidden="true" />
                <div><h3>{title}</h3><p>{body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="meal-story" data-image-scale>
          <Image src={mealImage} alt="A colorful grain bowl with roasted vegetables, greens, avocado, and eggs on a cobalt plate" sizes="100vw" />
          <div className="meal-scrim" />
          <div className="meal-copy" data-reveal>
            <h2>Good food, fewer forgotten ingredients.</h2>
            <p>Use what needs using, without compromising on the recipe you actually want to eat.</p>
            <ul>
              <li><Check size={18} weight="bold" /> Original recipe sources</li>
              <li><Check size={18} weight="bold" /> Dietary and allergy filters</li>
              <li><Check size={18} weight="bold" /> Time and equipment fit</li>
            </ul>
          </div>
        </section>

        <StateShowcase />

        <section className="section technical-section" id="technical" data-reveal>
          <div className="technical-heading"><h2>A short, inspectable path from photo to recipe.</h2><p>Every handoff is typed and replaceable. Private images take the shortest practical route.</p></div>
          <div className="technical-grid">
            {technicalSteps.map(({ icon: Icon, title, body }) => (
              <article key={title}><Icon size={25} weight="light" aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>
            ))}
          </div>
          <div className="technical-contract" aria-label="Data flow">
            <code>photos</code><ArrowRight size={16} weight="bold" aria-hidden="true" /><code>PantryAnalysis</code><ArrowRight size={16} weight="bold" aria-hidden="true" /><code>confirmed inventory</code><ArrowRight size={16} weight="bold" aria-hidden="true" /><code>ranked recipes</code>
          </div>
        </section>

        <section className="section closing-cta" data-reveal>
          <div><h2>Open the fridge. We will take it from there.</h2><p>One clear photo can turn the question into a shortlist.</p></div>
          <a className="button button-light" href="#scan">Scan your kitchen<span className="button-icon"><ArrowRight size={18} weight="bold" /></span></a>
        </section>
      </main>

      <footer>
        <BrandMark /><p>Practical recipes from ingredients already at home.</p>
        <div className="footer-links"><a href="#technical">How it works</a><a href="#top">Back to top</a></div>
      </footer>
    </div>
  );
}

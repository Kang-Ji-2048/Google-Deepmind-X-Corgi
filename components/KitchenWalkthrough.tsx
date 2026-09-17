"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Scan, ListChecks, ForkKnife, Plus } from "@phosphor-icons/react";
import fridge from "@/public/images/open-fridge.png";
import meal from "@/public/images/weeknight-bowl.png";

const stages = [
  { label: "Scan the shelves", title: "A fresh look at what is there.", copy: "Photograph your fridge or pantry from a few angles. Start with the ingredients you already own.", icon: Scan },
  { label: "Make it yours", title: "You get the final say.", copy: "Confirm what was spotted. Tap an ingredient in this sample inventory to keep or remove it.", icon: ListChecks },
  { label: "Find your dinner", title: "Something good is taking shape.", copy: "Confirmed ingredients become the starting point for recipes that fit your kitchen and your evening.", icon: ForkKnife },
];

export function KitchenWalkthrough() {
  const [stage, setStage] = useState(0);
  const [selected, setSelected] = useState(["Broccoli", "Eggs", "Carrots", "Fresh herbs"]);
  const current = stages[stage];
  return (
    <section className="section kitchen-walkthrough" id="how-it-works">
      <div className="walk-heading"><h2>From open door<br />to dinner.</h2><p>A little less guessing.<br />A lot more possibility.</p></div>
      <div className="walk-tabs" role="tablist" aria-label="Explore the cooking journey">
        {stages.map(({ label, icon: Icon }, index) => <button key={label} id={`walk-tab-${index}`} type="button" role="tab" aria-selected={stage === index} aria-controls="walk-panel" onClick={() => setStage(index)}><Icon size={22} weight="light" /><span>{label}</span><ArrowRight className="walk-tab-arrow" size={18} /></button>)}
      </div>
      <div className="walk-panel" id="walk-panel" role="tabpanel" aria-labelledby={`walk-tab-${stage}`}>
        <div className="walk-visual" key={`visual-${stage}`}>
          <Image src={stage === 2 ? meal : fridge} alt={stage === 2 ? "Illustrative grain bowl with vegetables and eggs" : "Fresh ingredients on refrigerator shelves"} sizes="(max-width: 760px) 100vw, 55vw" />
          <div className="walk-photo-shade" />
          {stage === 0 && <><div className="scan-window"><span /><span /><span /><span /><div className="scan-beam" /></div><div className="scan-finds"><span><Check size={14} /> Leafy greens</span><span><Check size={14} /> Eggs</span><span><Check size={14} /> Carrots</span></div></>}
          {stage === 1 && <div className="inventory-preview"><span className="walk-small-label">Sample inventory</span><strong>Keep what belongs.</strong><div>{["Broccoli", "Eggs", "Carrots", "Fresh herbs", "Lemons"].map((name) => <button type="button" key={name} aria-pressed={selected.includes(name)} onClick={() => setSelected(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name])}>{selected.includes(name) ? <Check size={17} /> : <Plus size={17} />}{name}</button>)}</div><span>{selected.length} ingredients selected</span></div>}
          {stage === 2 && <div className="meal-preview-label"><ForkKnife size={24} weight="light" /><div><span>One possible dinner</span><strong>Roasted vegetable grain bowl</strong></div></div>}
          <span className="walk-demo-label">Illustrative walkthrough</span>
        </div>
        <div className="walk-content" key={`content-${stage}`}>
          <current.icon size={36} weight="light" />
          <h3>{current.title}</h3><p>{current.copy}</p>
          <div className="walk-mini-flow" aria-hidden="true"><span className={stage >= 0 ? "lit" : ""}>Photo</span><i /><span className={stage >= 1 ? "lit" : ""}>Inventory</span><i /><span className={stage >= 2 ? "lit" : ""}>Dinner</span></div>
          <button className="walk-next" type="button" onClick={() => setStage((stage + 1) % stages.length)}>{stage === 2 ? "Explore again" : "See what happens next"}<ArrowRight size={20} /></button>
        </div>
      </div>
    </section>
  );
}

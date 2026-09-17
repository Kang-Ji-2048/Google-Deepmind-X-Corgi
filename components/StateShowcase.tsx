"use client";

import { useState } from "react";
import { StatusPanel } from "./StatusPanel";

const states = ["loading", "empty", "error"] as const;

export function StateShowcase() {
  const [activeState, setActiveState] = useState<(typeof states)[number]>("loading");
  return (
    <section className="section state-section" id="states">
      <div className="section-copy">
        <h2>Clear at every turn.</h2>
        <p>Useful feedback makes the camera-to-dinner journey feel calm, even when a photo needs another look.</p>
        <div className="state-tabs" role="group" aria-label="Preview interface states">
          {states.map((state) => (
            <button key={state} className={activeState === state ? "is-active" : ""} type="button" aria-pressed={activeState === state} onClick={() => setActiveState(state)}>
              {state[0].toUpperCase() + state.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <StatusPanel state={activeState} onRetry={() => setActiveState("loading")} />
    </section>
  );
}

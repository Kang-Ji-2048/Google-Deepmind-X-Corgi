"use client";

import { ArrowClockwise, Basket, Sparkle } from "@phosphor-icons/react";

type StatusPanelProps = {
  state?: "loading" | "empty" | "error";
  onRetry?: () => void;
};

export function StatusPanel({ state = "loading", onRetry }: StatusPanelProps) {
  if (state === "loading") {
    return (
      <section className="status-shell" aria-live="polite" aria-busy="true">
        <div className="status-panel">
          <span className="status-kicker">Looking through your photos</span>
          <div className="skeleton skeleton-heading" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line skeleton-short" />
          <div className="ingredient-skeletons" aria-hidden="true"><span /><span /><span /><span /></div>
        </div>
      </section>
    );
  }

  if (state === "empty") {
    return (
      <section className="status-shell" aria-live="polite">
        <div className="status-panel">
          <Basket className="status-icon" size={30} weight="light" aria-hidden="true" />
          <h3>Nothing spotted yet</h3>
          <p>Try a brighter photo with the shelves, drawers, and labels clearly visible.</p>
          <button className="button button-secondary" type="button">Add another photo</button>
        </div>
      </section>
    );
  }

  return (
    <section className="status-shell" role="alert">
      <div className="status-panel status-error">
        <Sparkle className="status-icon" size={30} weight="light" aria-hidden="true" />
        <h3>We could not read that photo</h3>
        <p>Your image is safe. Check the file format or connection, then try once more.</p>
        <button className="button button-secondary" type="button" onClick={onRetry}>
          Try again <span className="button-icon"><ArrowClockwise size={17} weight="bold" /></span>
        </button>
      </div>
    </section>
  );
}

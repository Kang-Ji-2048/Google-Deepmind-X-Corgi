"use client";

import { useState } from "react";
import { ArrowRight, Check, Plus, Trash, Scan, WarningCircle } from "@phosphor-icons/react";
import "@/src/inventory-ui.css";

export type ReviewIngredient = { id: string; name: string; originalLabel?: string; estimatedQuantity?: string; confidence?: number; sourceFrame?: number; needsConfirmation: boolean; useSoon?: boolean };
export type ReviewAnalysis = { ingredients: ReviewIngredient[]; uncertainItems: { id: string; description: string; sourceFrame: number }[]; warnings: string[] };
type Props = { analysis: ReviewAnalysis; onConfirm: (items: ReviewIngredient[]) => void; onBack: () => void };

export function InventoryConfirmation({ analysis, onConfirm: onContinue, onBack: onRetake }: Props) {
  const [items, setItems] = useState(analysis.ingredients);
  const [unknown, setUnknown] = useState(analysis.uncertainItems);
  const [newName, setNewName] = useState("");
  const unresolved = items.filter(item => item.needsConfirmation || !item.name.trim()).length;
  function update(id: string, patch: Partial<ReviewIngredient>) { setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item)); }
  function add() {
    if (!newName.trim()) return;
    setItems(current => [...current, { id: crypto.randomUUID(), name: newName.trim(), needsConfirmation: false }]);
    setNewName("");
  }
  return <section className="inventory-review">
    <header className="inventory-review-heading"><span>Your kitchen, confirmed by you</span><h1>Let’s check<br />what is there.</h1><p>A photo starts the list. You decide what belongs before we look for dinner.</p></header>
    <div className="inventory-review-layout">
      <div className="inventory-review-main">
        <div className="inventory-list-heading"><h2>Your ingredients</h2><span aria-live="polite">{items.length} items</span></div>
        {analysis.warnings.map((warning, index) => <p className="inventory-warning" key={index}><WarningCircle size={20} aria-hidden="true" />{warning}</p>)}
        {!items.length && <div className="inventory-empty"><Scan size={36} weight="light" /><h3>A little more light might help.</h3><p>No ingredients yet. Try another photo or add what you have below.</p><button type="button" onClick={onRetake}>Take another photo <ArrowRight size={18} /></button></div>}
        <ul className="inventory-items">{items.map(item => <li key={item.id} className={item.needsConfirmation ? "needs-review" : ""}>
          <div className="inventory-item-fields"><label>Ingredient<input value={item.name} onChange={event => update(item.id, { name: event.target.value })} /></label><label>Quantity <span>(optional)</span><input value={item.estimatedQuantity ?? ""} placeholder="Add amount" onChange={event => update(item.id, { estimatedQuantity: event.target.value })} /></label></div>
          <label className="inventory-use-soon"><input type="checkbox" checked={item.useSoon ?? false} onChange={event => update(item.id, { useSoon: event.target.checked })} />Use this soon</label>
          <div className="inventory-item-meta"><span>{item.sourceFrame === undefined ? "Added by you" : `Photo ${item.sourceFrame + 1}`}{item.originalLabel ? ` · ${item.originalLabel}` : ""}</span><div>{item.needsConfirmation ? <button type="button" disabled={!item.name.trim()} onClick={() => update(item.id, { needsConfirmation: false })}><Check size={16} />Confirm item</button> : <span className="inventory-confirmed"><Check size={15} />Ready</span>}<button className="inventory-remove" type="button" aria-label={`Remove ${item.name || "ingredient"}`} onClick={() => setItems(current => current.filter(candidate => candidate.id !== item.id))}><Trash size={18} /></button></div></div>
        </li>)}</ul>
        <form className="inventory-add" onSubmit={event => { event.preventDefault(); add(); }}><label htmlFor="inventory-new-name">Something missing?</label><div><input id="inventory-new-name" value={newName} onChange={event => setNewName(event.target.value)} placeholder="Add an ingredient" /><button type="submit" disabled={!newName.trim()}><Plus size={18} />Add</button></div></form>
      </div>
      <aside className="inventory-summary"><div className="inventory-summary-icon"><Scan size={28} weight="light" /></div><h2>A quick check.<br />A better dinner.</h2><p>Confirm the names and quantities. Remove anything you do not have or cannot identify.</p>
        <div className="inventory-review-count" aria-live="polite"><strong>{unresolved}</strong><span>{unresolved === 1 ? "item needs your review" : "items need your review"}</span></div>
        {unknown.length > 0 && <div className="inventory-unknown"><h3>Not added to your list</h3><p>These items could not be identified. Add them manually if you know what they are.</p>{unknown.map(item => <div key={item.id}><span>{item.description}<small>Photo {item.sourceFrame + 1}</small></span><button type="button" aria-label={`Dismiss ${item.description}`} onClick={() => setUnknown(current => current.filter(candidate => candidate.id !== item.id))}>Dismiss</button></div>)}</div>}
        <button className="inventory-continue" type="button" disabled={unresolved > 0 || items.length === 0} onClick={() => onContinue(items.map(item => ({ ...item, name: item.name.trim() })))}>Find recipes<ArrowRight size={20} /></button>
        <button className="inventory-retake" type="button" onClick={onRetake}>Back to photos</button>
        <p className="inventory-footnote">Photo recognition cannot verify allergens. Check packaging and the original recipe before cooking.</p>
      </aside>
    </div>
  </section>;
}

"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ArrowSquareOut, Camera, ImageSquare, Plus, X } from "@phosphor-icons/react";
import Link from "next/link";
import { CameraCapture } from "./CameraCapture";
import "@/src/camera.css";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 4_000_000;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function PhotoInput() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const filesRef = useRef<File[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const closeCamera = useCallback(() => setCameraOpen(false), []);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  function addFiles(fileList: FileList | File[] | null): boolean {
    const incoming = Array.from(fileList ?? []);
    if (!incoming.length) return false;
    if (incoming.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
      setError("Choose JPEG, PNG, WebP, or HEIC photos.");
      return false;
    }

    const current = filesRef.current;
    const room = MAX_FILES - current.length;
    if (room <= 0) { setError("You can add up to five photos."); return false; }
    const accepted = incoming.slice(0, room);
    const nextTotal = [...current, ...accepted].reduce((total, file) => total + file.size, 0);
    if (nextTotal > MAX_TOTAL_BYTES) {
      setError("Keep the selected photos under 4 MB in total.");
      return false;
    }

    filesRef.current = [...current, ...accepted];
    setFiles(filesRef.current);
    setShowDemo(true);
    setError(incoming.length > room ? "You can add up to five photos." : "");
    return true;
  }

  function removeFile(index: number) {
    filesRef.current = filesRef.current.filter((_, itemIndex) => itemIndex !== index);
    setFiles(filesRef.current);
    setShowDemo(filesRef.current.length > 0);
    setError("");
  }

  return (
    <div className="photo-input-wrap">
      <div
        className={`photo-input-shell ${isDragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files); }}
      >
        <div className="photo-input">
          <input
            ref={inputRef}
            id={inputId}
            className="visually-hidden"
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }}
          />
          {files.length === 0 ? (
            <div className="photo-input-empty">
              <span className="input-icon" aria-hidden="true"><Camera size={28} weight="light" /></span>
              <div>
                <label className="input-title" htmlFor={inputId}>Show us what you have</label>
                <p>Take or upload 1-5 fridge or pantry photos.</p>
              </div>
              <div className="photo-intake-actions">
                <button className="button button-primary" type="button" onClick={() => setCameraOpen(true)}>
                  Open camera <span className="button-icon"><Camera size={18} weight="bold" /></span>
                </button>
                <button className="button photo-upload-button" type="button" onClick={() => inputRef.current?.click()}>
                  Choose photo <ImageSquare size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="file-selection">
              <div className="file-selection-header">
                <div><strong>{files.length} photo{files.length === 1 ? "" : "s"} ready</strong><span>Add a few angles for a better inventory.</span></div>
                {files.length < MAX_FILES && <div className="photo-add-actions">
                  <button className="icon-button" type="button" onClick={() => setCameraOpen(true)} aria-label="Open camera"><Camera size={21} /></button>
                  <button className="icon-button" type="button" onClick={() => inputRef.current?.click()} aria-label="Add another photo">
                    <Plus size={21} weight="bold" />
                  </button>
                </div>}
              </div>
              <ul className="file-list" aria-label="Selected photos">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>
                    <ImageSquare size={20} aria-hidden="true" />
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><X size={17} weight="bold" /></button>
                  </li>
                ))}
              </ul>
              {!showDemo && <button className="button button-primary button-full" type="button" onClick={() => setShowDemo(true)} aria-describedby={`${inputId}-analysis-status`}>Find a recipe</button>}
              <p id={`${inputId}-analysis-status`}>Demo mode · Photos stay on your device.</p>
              {showDemo && <section className="photo-demo-result" aria-live="polite" aria-labelledby={`${inputId}-demo-title`}>
                <span className="photo-demo-label">Demo</span>
                <h3 id={`${inputId}-demo-title`}>Chicken &amp; mushroom hotpot</h3>
                <p>BBC Good Food</p>
                <a className="button button-primary button-full" href="https://www.bbcgoodfood.com/recipes/chicken-mushroom-hot-pot" target="_blank" rel="noopener noreferrer">
                  View recipe <ArrowSquareOut size={18} aria-hidden="true" />
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
                <p className="photo-demo-note">Ingredient matching is not connected yet.</p>
              </section>}
            </div>
          )}
        </div>
      </div>
      <p className={`field-message ${error ? "is-error" : ""}`} role={error ? "alert" : undefined}>
        {error || "Up to 5 photos, 4 MB total. Camera opens only with permission."}
      </p>
      <Link className="photo-manual-link" href="/recipes">Enter ingredients and find recipes →</Link>
      {cameraOpen && <CameraCapture onCapture={(file) => addFiles([file])} onClose={closeCamera} />}
    </div>
  );
}

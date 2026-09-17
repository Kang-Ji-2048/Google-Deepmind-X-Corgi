"use client";

import { useId, useRef, useState } from "react";
import { Camera, ImageSquare, Plus, X } from "@phosphor-icons/react";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 4_000_000;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function PhotoInput() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []);
    if (!incoming.length) return;
    if (incoming.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
      setError("Choose JPEG, PNG, WebP, or HEIC photos.");
      return;
    }

    const room = MAX_FILES - files.length;
    const accepted = incoming.slice(0, room);
    const nextTotal = [...files, ...accepted].reduce((total, file) => total + file.size, 0);
    if (nextTotal > MAX_TOTAL_BYTES) {
      setError("Keep the selected photos under 4 MB in total.");
      return;
    }

    setFiles((current) => [...current, ...accepted]);
    setError(incoming.length > room ? "You can add up to five photos." : "");
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
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
            onChange={(event) => addFiles(event.target.files)}
          />
          {files.length === 0 ? (
            <div className="photo-input-empty">
              <span className="input-icon" aria-hidden="true"><Camera size={28} weight="light" /></span>
              <div>
                <label className="input-title" htmlFor={inputId}>Show us what you have</label>
                <p>Drop in 1-5 fridge or pantry photos.</p>
              </div>
              <button className="button button-primary" type="button" onClick={() => inputRef.current?.click()}>
                Choose photos
                <span className="button-icon"><ImageSquare size={18} weight="bold" /></span>
              </button>
            </div>
          ) : (
            <div className="file-selection">
              <div className="file-selection-header">
                <div><strong>{files.length} photo{files.length === 1 ? "" : "s"} ready</strong><span>Add a few angles for a better inventory.</span></div>
                {files.length < MAX_FILES && (
                  <button className="icon-button" type="button" onClick={() => inputRef.current?.click()} aria-label="Add another photo">
                    <Plus size={21} weight="bold" />
                  </button>
                )}
              </div>
              <ul className="file-list" aria-label="Selected photos">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}`}>
                    <ImageSquare size={20} aria-hidden="true" />
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><X size={17} weight="bold" /></button>
                  </li>
                ))}
              </ul>
              <button className="button button-primary button-full" type="button">Scan my kitchen</button>
            </div>
          )}
        </div>
      </div>
      <p className={`field-message ${error ? "is-error" : ""}`} role={error ? "alert" : undefined}>
        {error || "Private by default. Up to 5 photos, 4 MB total."}
      </p>
    </div>
  );
}

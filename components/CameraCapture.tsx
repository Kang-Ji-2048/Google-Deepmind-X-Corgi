"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "@phosphor-icons/react";

export function CameraCapture({ onCapture, onClose }: {
  onCapture: (file: File) => boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    activeRef.current = true;
    const dialog = dialogRef.current;
    dialog?.showModal();

    async function startCamera() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("UNAVAILABLE");
        }
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1200 } },
        });
        // A permission prompt can finish after the user has already closed the camera.
        if (disposed) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = nextStream;
        for (const track of stream.getVideoTracks()) {
          track.addEventListener("ended", () => {
            if (!disposed) {
              setReady(false);
              setError("Camera disconnected. Close and reopen it, or choose a photo.");
            }
          });
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        if (disposed) return;
        const name = cause instanceof Error ? cause.name : "";
        setError(name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings, or choose a photo."
          : name === "NotFoundError"
            ? "No camera was found. Connect one or choose a photo."
            : "The camera could not open. Use HTTPS, close other camera apps, or try your device camera below.");
      }
    }

    void startCamera();
    // Stop immediately when navigating away or putting the browser in the background.
    const stopWhenHidden = () => {
      if (!document.hidden) return;
      stream?.getTracks().forEach((track) => track.stop());
      setReady(false);
      // Keep the fallback input mounted while a phone's native camera is open.
      if (stream) setError("Camera paused when the page was hidden. Close and reopen it to continue.");
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", onClose);
    return () => {
      disposed = true;
      activeRef.current = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("pagehide", onClose);
      dialog?.close();
    };
  }, [onClose]);

  async function capture() {
    const video = videoRef.current;
    if (busyRef.current || !ready || !video?.videoWidth || !video.videoHeight) return;
    busyRef.current = true;
    setCapturing(true);
    try {
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No canvas context");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!activeRef.current) return;
      if (!blob) throw new Error("No captured image");
      const file = new File([blob], `kitchen-${Date.now()}.jpg`, { type: "image/jpeg" });
      if (onCapture(file)) onClose();
      else setError("This photo exceeds the five-photo or 4 MB total limit. Close the camera and remove a photo first.");
    } catch {
      if (activeRef.current) setError("The photo could not be captured. Try again or choose a photo.");
    } finally {
      busyRef.current = false;
      if (activeRef.current) setCapturing(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="photo-capture-dialog" aria-labelledby="camera-title" onCancel={onClose}>
      <div className="photo-capture-heading">
        <div><h2 id="camera-title">Show us your kitchen</h2><p>Frame a shelf, then take a photo. No audio is recorded.</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close camera" autoFocus><X size={22} /></button>
      </div>
      <video ref={videoRef} className="photo-capture-video" autoPlay muted playsInline aria-label="Live camera preview" onCanPlay={() => setReady(true)} />
      <p className={`field-message ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>
        {error || (ready ? "Photo stays in this browser until you submit it." : "Allow camera access in your browser to continue.")}
      </p>
      <div className="photo-capture-actions">
        <button type="button" className="button button-primary" disabled={!ready || capturing} onClick={capture}>
          <Camera size={20} />{capturing ? "Saving photo…" : "Take photo"}
        </button>
        {error && <button type="button" className="button button-secondary" onClick={() => nativeInputRef.current?.click()}>Use device camera</button>}
      </div>
      <input ref={nativeInputRef} type="file" accept="image/*" capture="environment" className="visually-hidden" aria-label="Take a photo with device camera" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file && onCapture(file)) onClose();
        else if (file) setError("Photo not added. Use JPEG, PNG, WebP or HEIC, with no more than five photos and 4 MB total.");
        event.target.value = "";
      }} />
    </dialog>
  );
}

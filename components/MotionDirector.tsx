"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function MotionDirector() {
  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set("[data-hero-copy], [data-hero-input], [data-hero-media], [data-reveal]", { clearProps: "all" });
      return;
    }

    const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
    intro.from("[data-hero-media]", { scale: 0.88, opacity: 0, duration: 1.35 })
      .from("[data-hero-copy] > *", { y: 54, opacity: 0, stagger: 0.09, duration: 1.05 }, "-=1.05")
      .from("[data-hero-input]", { y: 34, opacity: 0, duration: 0.9 }, "-=0.72");

    gsap.to(".ambient-one", { xPercent: 14, yPercent: -10, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".ambient-two", { xPercent: -12, yPercent: 16, duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut" });

    gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
      gsap.from(element, { y: 70, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 84%", once: true } });
    });

    gsap.utils.toArray<HTMLElement>("[data-image-scale]").forEach((element) => {
      const image = element.querySelector("img") ?? element;
      gsap.fromTo(image, { scale: 0.86, opacity: 0.45 }, { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: element, start: "top 95%", end: "center 55%", scrub: 1 } });
    });

    return () => ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  });

  return null;
}

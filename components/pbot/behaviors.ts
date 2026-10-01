"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Three small behaviours the source keeps in `resources/js/pandai/`, ported as
 * hooks. The CSS for all three is in `app/pbot.css`; these only toggle classes.
 */

/**
 * The DS push-button spring (behaviors.js, BOUNCE_TARGETS). Replays the
 * `btn-raise` keyframe on a button's face whenever it RAISES — the pointer
 * enters from outside, or a press is released. CSS `:hover` cannot restart an
 * animation reliably across `:active`, which is why the source drives it from
 * script, delegated on the document so it covers buttons rendered later.
 *
 * Mounted once per surface; the listener is idempotent across mounts.
 */
const BOUNCE = [
  { host: ".btn", face: ".btn__face" },
  { host: ".icon-btn", face: ".icon-btn__face" },
];
let bounceUsers = 0;

function bounceFrom(e: MouseEvent) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = e.target as Element | null;
  for (const { host, face } of BOUNCE) {
    const el = target?.closest?.(host) as HTMLButtonElement | null;
    if (!el) continue;
    // mouseover fires on every internal move — only a real enter counts.
    if (e.type === "mouseover" && e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
    if (el.disabled || el.classList.contains("is-disabled") || el.classList.contains("is-active")) return;
    const f = el.querySelector(face);
    if (!f) return;
    f.classList.remove("btn-raise");
    void (f as HTMLElement).offsetWidth; // reflow, so the animation restarts
    f.classList.add("btn-raise");
    return;
  }
}

function clearBounce(e: AnimationEvent) {
  if (e.animationName === "btnPrimaryRaise" || e.animationName === "btnPrimaryRaiseS") {
    (e.target as Element).classList.remove("btn-raise");
  }
}

export function useButtonBounce() {
  useEffect(() => {
    if (bounceUsers++ === 0) {
      document.addEventListener("mouseover", bounceFrom);
      document.addEventListener("mouseup", bounceFrom);
      document.addEventListener("animationend", clearBounce);
    }
    return () => {
      if (--bounceUsers === 0) {
        document.removeEventListener("mouseover", bounceFrom);
        document.removeEventListener("mouseup", bounceFrom);
        document.removeEventListener("animationend", clearBounce);
      }
    };
  }, []);
}

/**
 * Soft scroll edges (conv-fade.js). The mask gradient is in the CSS; this only
 * decides when an edge is soft — `is-fade-top` once something has scrolled
 * above it, `is-fade-bottom` while something is still below. A list that fits
 * its box gets neither and stays crisp. With `compact`, the element's
 * `.pbot-conv` also gets `is-compact` while it overflows, which shrinks the
 * panel chat's PBot hero to make room.
 *
 * Classes are set only on a real change: the element is React-rendered, and a
 * no-op write would still churn the attribute.
 */
const EDGE = 2;

function setClass(el: Element, cls: string, want: boolean) {
  if (el.classList.contains(cls) !== want) el.classList.toggle(cls, want);
}

export function useScrollFade(ref: RefObject<HTMLElement | null>, { compact = false } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const overflow = el.scrollHeight - el.clientHeight;
      const fits = overflow <= EDGE;
      setClass(el, "is-fade-top", !fits && el.scrollTop > EDGE);
      setClass(el, "is-fade-bottom", !fits && el.scrollTop < overflow - EDGE);
      if (compact) {
        const conv = el.closest(".pbot-conv");
        if (conv) setClass(conv, "is-compact", !fits);
      }
    };
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    el.addEventListener("scroll", apply, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      el.removeEventListener("scroll", apply);
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, compact]);
}

/**
 * Types a string in with a human cadence (behaviors.js, `typewriter`): jitter
 * per key, a gap between words, longer pauses at clause and sentence ends.
 * Reduced motion gets the whole string at once.
 *
 * Starts EMPTY on both server and client, so hydration agrees and the full
 * string never flashes before typing begins. The caller renders the complete
 * text for assistive tech separately — a half-typed heading is noise to a
 * screen reader.
 */
export function useTypewriter(text: string, { delay = 350, speed = 42 } = {}) {
  const [state, setState] = useState({ shown: "", typing: false });

  useEffect(() => {
    let timer = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setTimeout(() => setState({ shown: text, typing: false }), 0);
      return () => window.clearTimeout(timer);
    }
    const keyDelay = (ch: string) => {
      let d = speed * (0.5 + Math.random());
      if (ch === " ") d += speed * 0.4;
      else if (",;:".includes(ch)) d += 150 + Math.random() * 130;
      else if (".!?".includes(ch)) d += 300 + Math.random() * 220;
      if (Math.random() < 0.05) d += 120 + Math.random() * 170;
      return d;
    };
    let i = 0;
    const tick = () => {
      i += 1;
      const done = i >= text.length;
      setState({ shown: text.slice(0, i), typing: !done });
      if (!done) timer = window.setTimeout(tick, keyDelay(text[i - 1]));
    };
    timer = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timer);
  }, [text, delay, speed]);

  return state;
}

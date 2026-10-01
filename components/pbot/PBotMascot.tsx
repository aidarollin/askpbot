"use client";

import { useEffect, useState } from "react";
import { PBotRive } from "./PBotRive";

/**
 * The floating PBot that opens the panel — the source's `pbot-fab`: the waving
 * Rive mascot, fixed bottom-right, that "poofs" away when tapped. Not draggable,
 * no gaze-follow — both were removed from the source on request.
 *
 * It dispatches the same `pbot-open` window event a host app would, so this
 * component is an example of the integration rather than a special case of it,
 * and it learns the panel closed from the panel's `pbot-closed` reply.
 *
 * The source hides it at ≤1024px (components.css); the `/embed` page keeps a
 * plain launcher button for those widths.
 */
export function PBotMascot() {
  const [away, setAway] = useState(false);

  useEffect(() => {
    const back = () => setAway(false);
    window.addEventListener("pbot-closed", back);
    return () => window.removeEventListener("pbot-closed", back);
  }, []);

  return (
    <button
      className={`home-pbot ${away ? "is-away" : ""}`}
      type="button"
      onClick={() => {
        setAway(true);
        window.dispatchEvent(new CustomEvent("pbot-open"));
      }}
      aria-label="Ask PBot"
    >
      <span className="home-pbot__poof" aria-hidden="true" />
      <span className="home-pbot__diver" aria-hidden="true">
        <PBotRive size={360} className="home-pbot__canvas" />
      </span>
    </button>
  );
}

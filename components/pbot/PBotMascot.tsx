"use client";

/**
 * The fixed mascot, pinned bottom-right, that opens the panel.
 *
 * The source repo renders a Rive animation (`rive/pbot.riv`) here. This is the
 * static stand-in the extract notes as an acceptable fallback — swap the inner
 * markup for a <Rive> canvas or the real SVG and nothing else changes.
 *
 * It dispatches the same `pbot-open` window event a host app would, so this
 * component is an example of the integration rather than a special case of it.
 */
export function PBotMascot() {
  return (
    <button
      className="home-pbot"
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("pbot-open"))}
      aria-label="Open Ask PBot"
    >
      <span className="home-pbot__bubble" aria-hidden="true">
        Ask me anything!
      </span>
      <span className="home-pbot__face" aria-hidden="true">
        🐼
      </span>
    </button>
  );
}

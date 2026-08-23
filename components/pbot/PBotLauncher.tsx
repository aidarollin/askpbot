"use client";

/**
 * A plain button that opens the panel. Deliberately does not import the panel
 * or share state with it — it dispatches the same `pbot-open` event any host
 * page would, which is the whole integration surface.
 */
export function PBotLauncher() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("pbot-open"))}
      className="bg-accent text-accent-contrast rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
    >
      Ask PBot
    </button>
  );
}

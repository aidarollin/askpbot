"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./icons";
import { PBotChat } from "./PBotChat";
import { PBotHome } from "./PBotHome";
import { useIsHydrated } from "./useIsHydrated";
import { usePBot } from "./usePBot";

/**
 * The right-docked slide-in panel.
 *
 * Portals to <body> — the React equivalent of the source template's
 * `x-teleport="body"` — so the panel's fixed positioning and z-index never get
 * trapped by a transformed or overflow-hidden ancestor in the host page.
 *
 * Opened by the `pbot-open` window event (see usePBot), closed by Esc, the
 * scrim, or the X. `side` picks the docked edge, matching the original's
 * `$side` prop.
 */
export function PBotPanel({ side = "right" }: { side?: "left" | "right" }) {
  const pbot = usePBot();
  const mounted = useIsHydrated();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // Move focus into the panel on open and hand it back on close — without
  // this, a keyboard user tabs into the page behind the scrim.
  useEffect(() => {
    if (pbot.isOpen) {
      openerRef.current = document.activeElement;
      // Wait for the enter transition so focus doesn't fight the animation.
      const t = window.setTimeout(() => closeRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
    if (openerRef.current instanceof HTMLElement) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [pbot.isOpen]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`pbot-scrim ${pbot.isOpen ? "is-open" : ""}`}
        onClick={pbot.hide}
        aria-hidden="true"
      />

      <aside
        className={`pbot-panel ${side === "left" ? "pbot-panel--left" : ""} ${
          pbot.isOpen ? "is-open" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Ask PBot"
        // Kept out of the tab order and off the a11y tree while closed, so the
        // panel's controls aren't reachable behind the page.
        {...(pbot.isOpen ? {} : { inert: "" as unknown as boolean, "aria-hidden": true })}
      >
        <span className="pbot-panel__glow" aria-hidden="true" />

        <header className="pbot-panel__head">
          <h2 className="pbot-panel__title">Ask Pbot</h2>
          <button
            ref={closeRef}
            className="pbot-panel__close"
            type="button"
            onClick={pbot.hide}
            aria-label="Close"
          >
            <IconX size={20} />
          </button>
        </header>

        <div className="pbot-feature">
          {pbot.view === "home" ? (
            <PBotHome
              history={pbot.history}
              onNewChat={pbot.newChat}
              onOpenChat={pbot.openChat}
              onDelete={pbot.removeConversation}
            />
          ) : (
            <PBotChat
              title={pbot.title}
              messages={pbot.messages}
              status={pbot.status}
              isStreaming={pbot.isStreaming}
              error={pbot.error}
              lastTurn={pbot.lastTurn}
              copiedId={pbot.copiedId}
              ratedIds={pbot.ratedIds}
              onBack={pbot.back}
              onSend={pbot.send}
              onStop={pbot.stop}
              onRegenerate={pbot.regenerate}
              onCopy={pbot.copy}
              onRate={pbot.rate}
            />
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}

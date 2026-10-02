"use client";

import { useEffect, useRef, type Ref } from "react";
import { createPortal } from "react-dom";
import { useButtonBounce } from "./behaviors";
import { Btn, Icon, IconLink } from "./ds";
import { PBotChat } from "./PBotChat";
import { PBotHistory } from "./PBotHistory";
import { PBotRive } from "./PBotRive";
import { useIsHydrated } from "./useIsHydrated";
import { usePBot } from "./usePBot";

/**
 * The right-docked slide-in panel (DS Screen 1.5, 1049:121840).
 *
 * Portals to <body> — the React equivalent of the source's `x-teleport="body"` —
 * so the panel's fixed positioning and z-index never get trapped by a
 * transformed or overflow-hidden ancestor in the host page.
 *
 * Opened by the `pbot-open` window event (see usePBot), closed by Esc, the
 * scrim, or the X. `side` picks the docked edge, matching the source's `$side`.
 */
export function PBotPanel({ side = "right" }: { side?: "left" | "right" }) {
  const pbot = usePBot();
  const mounted = useIsHydrated();
  useButtonBounce();
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
    if (openerRef.current) {
      // Tell the page — the launcher comes back from its poof on this.
      window.dispatchEvent(new CustomEvent("pbot-closed"));
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
      openerRef.current = null;
    }
  }, [pbot.isOpen]);

  if (!mounted) return null;
  const inChat = pbot.view === "chat";

  return createPortal(
    <>
      <div className={`pbot-scrim ${pbot.isOpen ? "is-open" : ""}`} onClick={pbot.hide} aria-hidden="true" />

      <aside
        className={`pbot-panel ${side === "left" ? "pbot-panel--left" : ""} ${pbot.isOpen ? "is-open" : ""} ${
          inChat ? "is-chat" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Ask PBot"
        // Kept out of the tab order and off the a11y tree while closed, so the
        // panel's controls aren't reachable behind the page.
        {...(pbot.isOpen ? {} : { inert: true, "aria-hidden": true })}
      >
        <PBotPanelBody pbot={pbot} closeRef={closeRef} />
      </aside>
    </>,
    document.body,
  );
}

/**
 * Everything inside the panel's frame: the scene, the head, the hero, and home
 * or chat. Shared by the docked panel and the web page's phone layout (see
 * `PBotWeb`), which is the panel's UI with no host page to dock over.
 *
 * With no `closeRef` there is nothing to close to, so the head drops both the
 * close and the maximize — the source's `.pbot-panel--page` does the same.
 */
export function PBotPanelBody({
  pbot,
  closeRef,
}: {
  pbot: ReturnType<typeof usePBot>;
  closeRef?: Ref<HTMLButtonElement>;
}) {
  const inChat = pbot.view === "chat";
  const docked = closeRef !== undefined;

  return (
    <>
      {/* The scene, back to front (6354:17280 …): wordmark under the two
          spheres, then the glows. Decoration only. */}
      <span className="pbot-panel__glow" aria-hidden="true" />
      <span className="pbot-watermark" aria-hidden="true" />
      <span className="pbot-orb pbot-orb--panel-lg" aria-hidden="true" />
      <span className="pbot-orb pbot-orb--panel-sm" aria-hidden="true" />
      <span className="pbot-glow pbot-glow--panel-a" aria-hidden="true" />
      <span className="pbot-glow pbot-glow--panel-b" aria-hidden="true" />

      <header className="pbot-panel__head">
        {/* Maximize (DS 5977:7774) takes the conversation to the full page. */}
        {docked && (
          <IconLink href="/" icon="maximize-2" className="pbot-panel__max" label="Open Ask PBot full screen" />
        )}
        <h2 className="pbot-panel__title">Ask Pbot</h2>
        {docked && (
          <button ref={closeRef} className="pbot-panel__close" type="button" onClick={pbot.hide} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        )}
      </header>

      {/* Hero (DS 3274:127527): the Ask PBot card, and PBot on his pod. */}
      <div className="pbot-hero">
        <div className="pbot-deck pbot-deck--solo">
          <span className="pbot-deck__card pbot-deck__card--ask is-front">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pbot/askpbot/tab-ask-active.png" alt="Ask PBot" />
          </span>
        </div>
        <div className="pbot-podium" aria-hidden="true">
          <span className="pbot-podium__pod">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pbot/askpbot/mathdrill-pod.png" alt="" />
          </span>
          <span className="pbot-podium__mascot">
            {/* Built only while open: no reason to run a canvas behind a closed panel. */}
            {pbot.isOpen && <PBotRive size={200} className="pbot-podium__canvas" />}
          </span>
        </div>
      </div>

      <div className="pbot-feature">
        {inChat ? (
          <PBotChat
            layout="panel"
            title={pbot.title}
            messages={pbot.messages}
            status={pbot.status}
            isStreaming={pbot.isStreaming}
            error={pbot.error}
            lastTurn={pbot.lastTurn}
            copiedId={pbot.copiedId}
            ratedIds={pbot.ratedIds}
            onBack={pbot.back}
            onRename={(next) => pbot.rename(pbot.conversationId!, next)}
            onSend={pbot.send}
            onStop={pbot.stop}
            onRegenerate={pbot.regenerate}
            onCopy={pbot.copy}
            onRate={pbot.rate}
          />
        ) : (
          // Home: New Chat, then the saved chats (or the empty state).
          <div className="pbot-home">
            <Btn variant="primary" size="l" block iconEnd="chevron-btn-m" onClick={pbot.newChat}>
              Start a New Chat
            </Btn>
            <PBotHistory
              history={pbot.history}
              onOpenChat={pbot.openChat}
              onRename={pbot.rename}
              onDelete={pbot.removeConversation}
            />
          </div>
        )}
      </div>
    </>
  );
}

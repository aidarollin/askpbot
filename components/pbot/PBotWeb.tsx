"use client";

import { IconChevronRight } from "./icons";
import { PBotChat } from "./PBotChat";
import { PBotHistory } from "./PBotHistory";
import { PBotPodium } from "./PBotPodium";
import { PBotSuggestions } from "./PBotSuggestions";
import { useIsHydrated } from "./useIsHydrated";
import { usePBot } from "./usePBot";

/**
 * The two-column web layout: a persistent sidebar beside a main area that shows
 * either the hero or the open conversation.
 *
 * This is the surface the product ships as. It differs from `PBotPanel` in one
 * structural way rather than many cosmetic ones: history is always on screen in
 * the sidebar instead of being a view you navigate back to, so `view` here
 * chooses only what fills the main column. Everything below the layout — the
 * state machine, the stream reader, the turn rendering — is the same code the
 * panel uses.
 */
export function PBotWeb() {
  const pbot = usePBot({ mode: "page" });
  // History comes from localStorage, which the server cannot see. Rendering it
  // only after hydration keeps the first client paint identical to the server's.
  const hydrated = useIsHydrated();

  return (
    <div className="pbot-web">
      <aside className="pbot-web__side">
        <div className="pbot-web__brand">
          <span className="pbot-web__brand-mark" aria-hidden="true">
            🐼
          </span>
          <span className="pbot-web__brand-name">Ask PBot</span>
        </div>

        <button className="pbot-newchat" type="button" onClick={pbot.newChat}>
          <span>Start New Chat</span>
          <span className="pbot-newchat__chev">
            <IconChevronRight size={16} />
          </span>
        </button>

        <div className="pbot-web__hist">
          {hydrated && (
            <PBotHistory
              history={pbot.history}
              activeId={pbot.conversationId}
              onOpenChat={pbot.openChat}
              onDelete={pbot.removeConversation}
              emptyText="No conversations yet — start a new chat above."
            />
          )}
        </div>
      </aside>

      <main className="pbot-web__main">
        <span className="pbot-panel__glow pbot-web__glow" aria-hidden="true" />

        {pbot.view === "home" ? (
          <div className="pbot-web__hero">
            <PBotPodium />
            <h1 className="pbot-web__hero-title">Hi, I&apos;m PBot 🐼</h1>
            <p className="pbot-web__hero-sub">
              Your AI study buddy. Ask me anything, or pick a prompt to get started.
            </p>
            {/* A chip here opens the conversation and asks in one gesture. */}
            <PBotSuggestions onPick={pbot.startChatWith} className="pbot-web__prompts" />
          </div>
        ) : (
          <div className="pbot-web__conv">
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
          </div>
        )}
      </main>
    </div>
  );
}

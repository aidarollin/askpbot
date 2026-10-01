"use client";

import type { Attachment, VoiceNote } from "@/lib/types";
import { useButtonBounce, useTypewriter } from "./behaviors";
import { Btn } from "./ds";
import { PBotChat } from "./PBotChat";
import { PBotComposer } from "./PBotComposer";
import { PBotHistory } from "./PBotHistory";
import { PBotRive } from "./PBotRive";
import { PBotHeroPrompts } from "./PBotSuggestions";
import { PBotTitle } from "./PBotTitle";
import { useIsHydrated } from "./useIsHydrated";
import { usePBot } from "./usePBot";

const HERO_TITLE = "What shall we learn today?";
const HERO_SUB = "Pick a suggestion below, or type your own question.";

/**
 * The product — the source's lab/askpbot web view (DS 5734:* "AskPBot / Web"):
 * one rounded deep-space field holding a rail (the Ask PBot card, New Chat, the
 * saved chats) beside a main pane with one top bar over either the idle hero or
 * the conversation.
 *
 * It differs from `PBotPanel` in one structural way rather than many cosmetic
 * ones: history is always on screen in the rail, so `view` chooses only what
 * fills the main pane. Below the layout, every piece — state machine, stream
 * reader, turns, composer, history — is the code the panel uses.
 */
export function PBotWeb() {
  const pbot = usePBot({ mode: "page" });
  // History comes from localStorage, which the server cannot see. Rendering it
  // only after hydration keeps the first client paint identical to the server's.
  const hydrated = useIsHydrated();
  useButtonBounce();
  const inChat = pbot.view === "chat";

  return (
    <div className="pbot-page">
      <div className="pbot-web-shell">
        <div className="pbot-web is-ask">
          {/* The scene's three spheres and its sky (6191:22462 · 5763:87648).
              First in the DOM so they paint under the rail and the pane. */}
          <span className="pbot-orb pbot-orb--web-lg" aria-hidden="true" />
          <span className="pbot-orb pbot-orb--web-md" aria-hidden="true" />
          <span className="pbot-orb pbot-orb--web-sm" aria-hidden="true" />
          <div className="pbot-web__sky" aria-hidden="true">
            {/* eslint-disable @next/next/no-img-element */}
            <img className="pbot-web__sky-glow" src="/pbot/askpbot/web-hero-glow.svg" alt="" />
            <img className="pbot-orbit__spark pbot-web__spark pbot-web__spark--a" src="/pbot/askpbot/sparkle.svg" alt="" width={20} height={20} />
            <img className="pbot-orbit__spark pbot-web__spark pbot-web__spark--b" src="/pbot/askpbot/sparkle.svg" alt="" width={16} height={16} />
            <img className="pbot-orbit__spark pbot-web__spark pbot-web__spark--c" src="/pbot/askpbot/sparkle.svg" alt="" width={14} height={14} />
            {/* eslint-enable @next/next/no-img-element */}
          </div>

          <aside className="pbot-web__side" aria-label="Your chats">
            {/* The source's tab deck, with Math Drill gone: one card, the brand. */}
            <div className="pbot-deck pbot-deck--solo pbot-web__deck">
              <span className="pbot-deck__card pbot-deck__card--ask is-front">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/pbot/askpbot/tab-ask-active.png" alt="Ask PBot" />
              </span>
            </div>

            <div className="pbot-web__side-body">
              <Btn variant="primary" size="l" block iconEnd="chevron-btn-m" className="pbot-web__newchat" onClick={pbot.newChat}>
                Start a New Chat
              </Btn>
              {hydrated && (
                <PBotHistory
                  history={pbot.history}
                  activeId={inChat ? pbot.conversationId : null}
                  onOpenChat={pbot.openChat}
                  onRename={pbot.rename}
                  onDelete={pbot.removeConversation}
                />
              )}
            </div>
          </aside>

          <main className={`pbot-web__main ${inChat ? "is-chat" : ""}`}>
            <span className="pbot-panel__glow pbot-web__glow" aria-hidden="true" />

            {/* DS top bar (5706:45980) — ONE bar for every screen: Back, the open
                chat's name centred, and the empty brand slot that balances Back. */}
            <div className="pbot-topbar pbot-topbar--space">
              <div className="pbot-topbar__left">
                {inChat && (
                  <Btn variant="secondary" size="m" iconStart="chevron-left" onClick={pbot.back}>
                    Back
                  </Btn>
                )}
              </div>
              <div className="pbot-topbar__mid">
                {inChat && pbot.conversationId ? (
                  <PBotTitle
                    className="pbot-topbar__title"
                    title={pbot.title}
                    onRename={(next) => pbot.rename(pbot.conversationId!, next)}
                  />
                ) : (
                  <h1 className="pbot-topbar__title">Ask PBot</h1>
                )}
              </div>
              <span className="pbot-topbar__brand" aria-hidden="true" />
            </div>

            <div className="pbot-web__ask">
              {inChat ? (
                <PBotChat
                  layout="web"
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
                <PBotHero onStart={pbot.startChatWith} isStreaming={pbot.isStreaming} />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * The idle hero (DS 5487:102463): PBot in his halo, the question typed in, four
 * prompts and a composer. Nothing here holds a conversation, so every way out —
 * a prompt, a typed question, a voice note, an image — starts one with that
 * first turn already in it.
 *
 * The upper half scrolls on its own and the composer is pinned: in a short
 * window the source measured the composer falling outside the card otherwise.
 */
function PBotHero({
  onStart,
  isStreaming,
}: {
  onStart: (text: string, image?: Attachment, voice?: VoiceNote) => void;
  isStreaming: boolean;
}) {
  const title = useTypewriter(HERO_TITLE);
  // Clears the title: ~26 characters at the 42ms average plus the lead-in.
  const sub = useTypewriter(HERO_SUB, { delay: 1600 });

  return (
    <div className="pbot-web__hero">
      <div className="pbot-web__column">
        <div className="pbot-web__scroll">
          <div className="pbot-web__intro">
            <div className="pbot-web__orbit" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="pbot-web__halo" src="/pbot/askpbot/web-hero-halo.svg" alt="" />
              <span className="home-pbot__diver">
                <PBotRive size={460} className="home-pbot__canvas" />
              </span>
              {/* eslint-disable @next/next/no-img-element */}
              <img className="pbot-orbit__spark pbot-web__spark pbot-web__spark--d" src="/pbot/askpbot/web-hero-spark.svg" alt="" width={31} height={31} />
              <img className="pbot-orbit__spark pbot-web__spark pbot-web__spark--e" src="/pbot/askpbot/web-hero-spark-gold.svg" alt="" width={17} height={17} />
              {/* eslint-enable @next/next/no-img-element */}
            </div>
            <h2 className={`pbot-web__hero-title ${title.typing ? "is-typing" : ""}`}>
              <span className="sr-only">{HERO_TITLE}</span>
              <span aria-hidden="true">{title.shown}</span>
            </h2>
            <p className={`pbot-web__hero-sub ${sub.typing ? "is-typing" : ""}`}>
              <span className="sr-only">{HERO_SUB}</span>
              <span aria-hidden="true">{sub.shown}</span>
            </p>
          </div>
          <PBotHeroPrompts onPick={(p) => onStart(p)} />
        </div>

        <PBotComposer
          variant="hero"
          onSend={onStart}
          isStreaming={isStreaming}
          footer={<p className="pbot-disclaimer">Pbot may make mistakes, please double-check the answers.</p>}
        />
      </div>
    </div>
  );
}

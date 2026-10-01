"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment, ChatMessage, VoiceNote } from "@/lib/types";
import { useScrollFade } from "./behaviors";
import { Btn, IconBtn } from "./ds";
import { PBotComposer } from "./PBotComposer";
import { PBotRive } from "./PBotRive";
import { PBotSuggestions } from "./PBotSuggestions";
import { PBotTitle } from "./PBotTitle";
import { PBotTurn } from "./PBotTurn";
import type { PBotStatus, TurnStats } from "./usePBot";
import { usePlayback } from "./useVoice";

const STATUS_LABEL: Record<Exclude<PBotStatus, "idle">, string> = {
  thinking: "Thinking",
  tool: "Checking the time",
  generating: "Writing",
};

interface PBotChatProps {
  /**
   * `panel` draws the screen's own header (Back · the chat's name · wordmark)
   * and PBot waving above the log. `web` leaves both out: the page carries one
   * top bar for every screen (DS 5706:45980), and the hero already has PBot.
   */
  layout: "panel" | "web";
  title: string;
  messages: ChatMessage[];
  status: PBotStatus;
  isStreaming: boolean;
  error: string | null;
  lastTurn: TurnStats | null;
  copiedId: string | null;
  ratedIds: Set<string>;
  onBack: () => void;
  onRename: (next: string) => boolean;
  onSend: (text: string, image?: Attachment, voice?: VoiceNote) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onCopy: (message: ChatMessage) => void;
  onRate: (message: ChatMessage) => void;
}

/**
 * The CHAT screen (DS 4951:21717 "AskPbot Chat 1.5"), shared by the panel and
 * the web page exactly as the source shares `_askpbot-chat` — so the two can
 * never drift. It is a scene rather than a card: deep-space ground, sparkles,
 * translucent bubbles; `.pbot-conv--space` paints it.
 */
export function PBotChat({
  layout,
  title,
  messages,
  status,
  isStreaming,
  error,
  lastTurn,
  copiedId,
  ratedIds,
  onBack,
  onRename,
  onSend,
  onStop,
  onRegenerate,
  onCopy,
  onRate,
}: PBotChatProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const playback = usePlayback();
  const [viewing, setViewing] = useState<{ src: string; name: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Soft top/bottom edges, and the panel's PBot shrinking as the log fills.
  useScrollFade(logRef, { compact: layout === "panel" });

  // Follow the stream. Keyed on the last message's length too, not just the
  // count, so the view keeps pace as the final bubble grows token by token.
  const lastLength = messages[messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastLength, status]);

  useEffect(() => {
    if (!viewing) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setViewing(null);
      }
    };
    // Capture, so the viewer closes before the panel's own Escape handler runs.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [viewing]);

  const hasUserMessage = messages.some((m) => m.role === "user");
  // Regenerate needs a question to re-ask; the greeting alone has none.
  const lastAssistantId = hasUserMessage
    ? [...messages].reverse().find((m) => m.role === "assistant")?.id
    : undefined;
  const last = messages[messages.length - 1];
  const pendingId = isStreaming && last?.role === "assistant" && last.content === "" ? last.id : null;

  return (
    <div className="pbot-conv pbot-conv--space">
      {/* Scene decoration (DS 5274:96555 / 6749:206556). The web page hides
          this layer and draws its own sky; the panel shows it. */}
      <div className="pbot-scene pbot-scene--space" aria-hidden="true">
        {/* eslint-disable @next/next/no-img-element */}
        <img className="pbot-scene__spark pbot-scene__spark--node" src="/pbot/askpbot/chat-sparkle-scene.svg" alt="" width={7} height={7} />
        <img className="pbot-scene__spark pbot-scene__spark--a" src="/pbot/askpbot/sparkle.svg" alt="" width={14} height={14} />
        <img className="pbot-scene__spark pbot-scene__spark--b" src="/pbot/askpbot/chat-sparkle-10.svg" alt="" width={10} height={10} />
        <img className="pbot-scene__spark pbot-scene__spark--c" src="/pbot/askpbot/chat-sparkle-9.svg" alt="" width={9} height={9} />
        {/* eslint-enable @next/next/no-img-element */}
      </div>

      {layout === "panel" && (
        <>
          {/* Header (DS 4951:21739) — Back left; the chat's renamable name and
              the wordmark right. */}
          <div className="pbot-conv__head">
            <Btn variant="secondary" size="m" iconStart="chevron-left" onClick={onBack}>
              Back
            </Btn>
            <div className="pbot-conv__brand">
              <PBotTitle className="pbot-orbit__chip" title={title} onRename={onRename} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="pbot-conv__mark" src="/pbot/askpbot/askpbot-wordmark.png" alt="Ask PBot" width={42} height={26} />
            </div>
          </div>

          {/* PBot above the log (DS 4951:21742), with his glow, two sparks and
              the motion strokes that quicken while a reply streams. */}
          <div className="pbot-orbit" aria-hidden="true">
            <span className="pbot-orbit__glow" />
            <span className={`pbot-orbit__face ${isStreaming ? "is-talking" : ""}`}>
              <PBotRive size={200} className="pbot-podium__canvas" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="pbot-orbit__lines" src="/pbot/askpbot/chat-motion-lines.svg" alt="" width={41} height={35} />
            </span>
            {/* eslint-disable @next/next/no-img-element */}
            <img className="pbot-orbit__spark pbot-orbit__spark--1" src="/pbot/askpbot/chat-sparkle-white.svg" alt="" width={14} height={14} />
            <img className="pbot-orbit__spark pbot-orbit__spark--2" src="/pbot/askpbot/chat-sparkle-yellow.svg" alt="" width={8} height={8} />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        </>
      )}

      <div className="pbot-conv__logwrap">
        <div className="pbot-conv__log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation with PBot">
          {messages.map((m) => (
            <PBotTurn
              key={m.id}
              message={m}
              isLast={m.id === lastAssistantId}
              isStreaming={isStreaming}
              isPending={m.id === pendingId}
              copiedId={copiedId}
              rated={ratedIds.has(m.id)}
              playback={playback}
              onCopy={onCopy}
              onRate={onRate}
              onRegenerate={onRegenerate}
              onViewImage={(src, name) => setViewing({ src, name })}
            />
          ))}

          {/* Ours, not the source's: the phase under the dots separates
              thinking from a tool call from writing. */}
          {isStreaming && status !== "idle" && (pendingId || status === "tool") && (
            <p className="pbot-turn__phase">{STATUS_LABEL[status]}…</p>
          )}

          {error && (
            <div className="pbot-error" role="alert">
              {error}
            </div>
          )}

          {!hasUserMessage && !isStreaming && <PBotSuggestions onPick={(p) => onSend(p)} />}
        </div>
      </div>

      <PBotComposer
        variant="chat"
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        playback={playback}
        footer={
          <p className="pbot-disclaimer">
            Pbot may make mistakes, please double-check the answers.
            {lastTurn && (
              <span className="pbot-telemetry">
                {" · "}
                {lastTurn.usage.inputTokens.toLocaleString()} in · {lastTurn.usage.outputTokens.toLocaleString()} out ·{" "}
                {(lastTurn.latencyMs / 1000).toFixed(1)}s
                {lastTurn.truncated && " · hit output limit"}
              </span>
            )}
          </p>
        }
      />

      {viewing && (
        // Image viewer (DS 5274:100124) on the shared .pbot-modal shell.
        <div className="pbot-modal" role="dialog" aria-modal="true" aria-labelledby="pbot-viewer-title">
          <div className="pbot-modal__scrim" onClick={() => setViewing(null)} />
          <div className="pbot-modal__card pbot-modal__card--viewer">
            <div className="pbot-viewer__head">
              <p className="pbot-viewer__title" id="pbot-viewer-title">
                Image for the message:
              </p>
              <IconBtn
                ref={closeRef}
                className="pbot-viewer__close"
                variant="tertiary"
                size="l"
                icon="x"
                onClick={() => setViewing(null)}
                aria-label="Close image"
              />
            </div>
            <div className="pbot-viewer__frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="pbot-viewer__img" src={viewing.src} alt={viewing.name} />
            </div>
            <p className="pbot-viewer__name">{viewing.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

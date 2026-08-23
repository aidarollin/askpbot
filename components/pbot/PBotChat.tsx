"use client";

import { useEffect, useRef } from "react";
import type { Attachment, ChatMessage } from "@/lib/types";
import { IconChevronLeft, PBotAvatar } from "./icons";
import { PBotComposer } from "./PBotComposer";
import { PBotSuggestions } from "./PBotSuggestions";
import { PBotTurn } from "./PBotTurn";
import type { PBotStatus, TurnStats } from "./usePBot";

const STATUS_LABEL: Record<Exclude<PBotStatus, "idle">, string> = {
  thinking: "Thinking",
  tool: "Checking the time",
  generating: "Writing",
};

interface PBotChatProps {
  title: string;
  messages: ChatMessage[];
  status: PBotStatus;
  isStreaming: boolean;
  error: string | null;
  lastTurn: TurnStats | null;
  copiedId: string | null;
  ratedIds: Set<string>;
  onBack: () => void;
  onSend: (text: string, image?: Attachment) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onCopy: (message: ChatMessage) => void;
  onRate: (message: ChatMessage) => void;
}

export function PBotChat({
  title,
  messages,
  status,
  isStreaming,
  error,
  lastTurn,
  copiedId,
  ratedIds,
  onBack,
  onSend,
  onStop,
  onRegenerate,
  onCopy,
  onRate,
}: PBotChatProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Follow the stream. Keyed on the last message's length too, not just the
  // count, so the view keeps pace as the final bubble grows token by token.
  const lastLength = messages[messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastLength, status]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const awaitingFirstToken =
    isStreaming && messages[messages.length - 1]?.content === "";
  // The source shows its starter prompts until the first question is asked.
  const hasUserMessage = messages.some((m) => m.role === "user");

  return (
    <div className="pbot-conv">
      <div className="pbot-conv__head">
        <button className="pbot-back" type="button" onClick={onBack}>
          <IconChevronLeft size={18} />
          <span>Back</span>
        </button>
        <strong className="pbot-conv__title">{title}</strong>
      </div>

      <div
        className="pbot-conv__log"
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with PBot"
      >
        {messages.map((m) => (
          <PBotTurn
            key={m.id}
            message={m}
            isLast={m.id === lastAssistantId}
            isStreaming={isStreaming}
            copiedId={copiedId}
            rated={ratedIds.has(m.id)}
            onCopy={onCopy}
            onRate={onRate}
            onRegenerate={onRegenerate}
          />
        ))}

        {/* Typing dots, shown only while waiting for the first token. */}
        {awaitingFirstToken && status !== "idle" && (
          <div className="pbot-turn pbot-turn--bot">
            <span className="pbot-turn__avatar">
              <PBotAvatar size={28} />
            </span>
            <div className="pbot-turn__col">
              <p className="pbot-bubble pbot-bubble--typing" aria-label={STATUS_LABEL[status]}>
                <span />
                <span />
                <span />
              </p>
              <p className="pbot-turn__phase">{STATUS_LABEL[status]}…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="pbot-error" role="alert">
            {error}
          </div>
        )}

        {!hasUserMessage && !isStreaming && <PBotSuggestions onPick={onSend} />}
      </div>

      <PBotComposer onSend={onSend} onStop={onStop} isStreaming={isStreaming} />

      <p className="pbot-disclaimer">
        Pbot may make mistakes, please double-check the answers.
        {lastTurn && (
          <span className="pbot-telemetry">
            {" · "}
            {lastTurn.usage.inputTokens.toLocaleString()} in ·{" "}
            {lastTurn.usage.outputTokens.toLocaleString()} out ·{" "}
            {(lastTurn.latencyMs / 1000).toFixed(1)}s
            {lastTurn.truncated && " · hit output limit"}
          </span>
        )}
      </p>
    </div>
  );
}

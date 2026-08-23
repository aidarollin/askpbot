"use client";

import type { ChatMessage } from "@/lib/types";
import { IconCheck, IconCopy, IconRefreshCw, IconThumbsUp, PBotAvatar } from "./icons";

interface PBotTurnProps {
  message: ChatMessage;
  /** Actions render only on the newest assistant turn — see note below. */
  isLast: boolean;
  isStreaming: boolean;
  copiedId: string | null;
  rated: boolean;
  onCopy: (message: ChatMessage) => void;
  onRate: (message: ChatMessage) => void;
  onRegenerate: () => void;
}

/**
 * One conversation turn.
 *
 * Assistant text renders as whitespace-preserved plain text, not parsed
 * markdown. Rendering model output as HTML is the app's largest injection
 * surface and doing it safely needs a sanitiser plus a hardened renderer;
 * text is correct and safe today, and markdown is additive behind this one
 * component.
 *
 * Copy and thumbs-up appear on every assistant turn, but Regenerate only on the
 * last one — regenerating from the middle would discard everything after it,
 * and a destructive action shouldn't hide behind an icon that looks identical
 * to the safe ones next to it.
 */
export function PBotTurn({
  message,
  isLast,
  isStreaming,
  copiedId,
  rated,
  onCopy,
  onRate,
  onRegenerate,
}: PBotTurnProps) {
  const isUser = message.role === "user";
  const preview = message.image
    ? `data:${message.image.mediaType};base64,${message.image.data}`
    : null;

  return (
    <div className={`pbot-turn pbot-turn--${isUser ? "user" : "bot"}`}>
      {!isUser && (
        <span className="pbot-turn__avatar">
          <PBotAvatar size={28} />
        </span>
      )}

      <div className="pbot-turn__col">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pbot-turn__image" src={preview} alt="Attached" />
        )}
        {message.imagePlaceholder && !preview && (
          <p className="pbot-turn__imagenote">📎 image (not kept in history)</p>
        )}

        {message.content && (
          <p className="pbot-bubble">
            <span className="sr-only">{isUser ? "You said: " : "PBot said: "}</span>
            {message.content}
          </p>
        )}

        {!isUser && !isStreaming && message.content && (
          <div className="pbot-turn__acts">
            <button
              type="button"
              onClick={() => onRate(message)}
              aria-label={rated ? "Marked helpful" : "Mark as helpful"}
              aria-pressed={rated}
              className={rated ? "is-active" : ""}
            >
              <IconThumbsUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => onCopy(message)}
              aria-label={copiedId === message.id ? "Copied" : "Copy"}
            >
              {copiedId === message.id ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </button>
            {isLast && (
              <button type="button" onClick={onRegenerate} aria-label="Regenerate reply">
                <IconRefreshCw size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

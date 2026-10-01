"use client";

import type { CSSProperties } from "react";
import type { ChatMessage } from "@/lib/types";
import { Icon, IconBtn } from "./ds";
import { PBotMarkdown } from "./PBotMarkdown";
import { clock, type usePlayback } from "./useVoice";

interface PBotTurnProps {
  message: ChatMessage;
  /** The newest assistant turn: it alone carries Regenerate, and the shine. */
  isLast: boolean;
  isStreaming: boolean;
  /** The reply being streamed has no text yet — draw the typing dots. */
  isPending: boolean;
  copiedId: string | null;
  rated: boolean;
  playback: ReturnType<typeof usePlayback>;
  onCopy: (message: ChatMessage) => void;
  onRate: (message: ChatMessage) => void;
  onRegenerate: () => void;
  onViewImage: (src: string, name: string) => void;
}

/**
 * One conversation turn — the source's `.pbot-turn` (DS 4951:21717): PBot's
 * face on the left of his bubble, the student's on the right of theirs, the
 * bubbles drawn from the DS's own border-image art.
 *
 * Copy and thumbs-up appear on every finished reply; Regenerate only on the
 * last — regenerating from the middle would discard everything after it, and a
 * destructive action should not hide behind an icon identical to the safe ones.
 */
export function PBotTurn({
  message,
  isLast,
  isStreaming,
  isPending,
  copiedId,
  rated,
  playback,
  onCopy,
  onRate,
  onRegenerate,
  onViewImage,
}: PBotTurnProps) {
  const isUser = message.role === "user";
  const preview = message.image ? `data:${message.image.mediaType};base64,${message.image.data}` : null;
  const voice = isUser ? message.voice : undefined;
  const playing = playback.isPlaying(voice?.url);

  return (
    <div className={`pbot-turn pbot-turn--${isUser ? "user" : "bot"}`}>
      {!isUser && (
        <span className={`pbot-turn__avatar ${isPending ? "is-thinking" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pbot/askpbot/pbot-face.svg" alt="" width={50} height={50} />
        </span>
      )}

      <div className="pbot-turn__col">
        {isPending ? (
          <p className="pbot-bubble pbot-bubble--typing" aria-label="PBot is typing">
            <span />
            <span />
            <span />
          </p>
        ) : voice ? (
          // DS 5274:97435 — play, the take's own waveform, its length. The
          // transcript under it is ours: it is what PBot actually received, so
          // the student can see what was heard.
          <div
            className={`pbot-bubble pbot-voicemsg ${playing ? "is-playing" : ""}`}
            style={{ "--play-progress": `${(playing ? playback.progress : 0) * 100}%` } as CSSProperties}
          >
            <IconBtn
              variant="primary"
              size="s"
              icon="play-filled"
              className={`pbot-voicemsg__play ${playing ? "is-playing" : ""}`}
              onClick={() => playback.toggle(voice.url)}
              disabled={!voice.url}
              aria-label={!voice.url ? "Voice note no longer available" : playing ? "Pause voice note" : "Play voice note"}
            />
            <span className="pbot-wave pbot-wave--msg" aria-hidden="true">
              {voice.bars.map((h, i) => (
                <i className="pbot-wave__bar" style={{ height: `${h}px` }} key={i} />
              ))}
            </span>
            <span className="pbot-voicemsg__time">{clock(voice.seconds)}</span>
            <p className="pbot-voicemsg__transcript">
              <span className="sr-only">You said: </span>
              {message.content}
            </p>
          </div>
        ) : preview || message.imagePlaceholder ? (
          // DS 5274:97065 — the picture sits ON the bubble; any caption follows.
          <div className="pbot-bubble pbot-imgmsg">
            {preview ? (
              <span className="pbot-imgmsg__grid">
                <button
                  type="button"
                  className="pbot-imgmsg__open"
                  onClick={() => onViewImage(preview, message.image?.name ?? "Attached image")}
                  aria-label={`Open ${message.image?.name ?? "attached image"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="pbot-imgmsg__img" src={preview} alt={message.image?.name ?? "Attached image"} />
                </button>
              </span>
            ) : (
              <span className="pbot-imgmsg__gone">Image not kept in history</span>
            )}
            {message.content && <p className="pbot-imgmsg__caption">{message.content}</p>}
          </div>
        ) : isUser ? (
          <p className="pbot-bubble">
            <span className="sr-only">You said: </span>
            {message.content}
          </p>
        ) : (
          <div className={`pbot-bubble pbot-markdown ${isLast && !isStreaming ? "is-latest" : ""}`}>
            <span className="sr-only">PBot said: </span>
            <PBotMarkdown text={message.content} />
          </div>
        )}

        {!isUser && !isPending && !(isStreaming && isLast) && message.content && (
          <div className="pbot-turn__acts">
            <button
              type="button"
              onClick={() => onRate(message)}
              aria-label={rated ? "Marked helpful" : "Mark as helpful"}
              aria-pressed={rated}
              className={rated ? "is-rated" : ""}
            >
              <Icon name="thumbs-up" />
            </button>
            <button type="button" onClick={() => onCopy(message)} aria-label={copiedId === message.id ? "Copied" : "Copy"}>
              <Icon name={copiedId === message.id ? "check" : "clipboard"} />
            </button>
            {isLast && (
              <button type="button" onClick={onRegenerate} aria-label="Regenerate reply">
                <Icon name="refresh-cw" />
              </button>
            )}
          </div>
        )}
      </div>

      {isUser && (
        // The student's face closes a user turn on the right (5763:87643).
        // Decorative: the turn is already attributed by its side and colour.
        <span className="pbot-turn__avatar pbot-turn__avatar--me" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pbot/profile/avatar-illustration.png" alt="" width={50} height={50} />
        </span>
      )}
    </div>
  );
}

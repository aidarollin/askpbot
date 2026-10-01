"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { validateAttachment } from "@/lib/guardrails";
import { MAX_INPUT_CHARS } from "@/lib/limits";
import { ALLOWED_IMAGE_TYPES, type Attachment, type ImageMediaType, type VoiceNote } from "@/lib/types";
import { IconBtn } from "./ds";
import { clock, usePlayback, useVoice } from "./useVoice";

interface PBotComposerProps {
  /**
   * `chat` is the conversation's composer (DS 5274:96755): a grow-textarea in
   * the full-bleed band. `hero` is the idle screen's (DS "Input Group 1.5"): a
   * one-line field. Both record voice and take an image, so both own a picker.
   */
  variant: "chat" | "hero";
  onSend: (text: string, image?: Attachment, voice?: VoiceNote) => void;
  onStop?: () => void;
  isStreaming: boolean;
  /** Shared with the log, so one clip plays at a time across bubbles and take. */
  playback?: ReturnType<typeof usePlayback>;
  /** Under the input row: the disclaimer, plus whatever the surface adds. */
  footer: ReactNode;
}

/** Reads a File into the base64 payload the API expects (no `data:` prefix). */
function readAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve({
        mediaType: file.type as ImageMediaType,
        data: comma === -1 ? result : result.slice(comma + 1),
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function PBotComposer({ variant, onSend, onStop, isStreaming, playback, footer }: PBotComposerProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState("");
  const voice = useVoice();
  const ownPlayback = usePlayback();
  const play = playback ?? ownPlayback;

  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Grow with content up to a ceiling, then scroll. Reset to `auto` first so
  // the box can shrink again when text is deleted.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  // Hand focus back when a reply finishes, so the student can keep typing.
  useEffect(() => {
    if (!isStreaming) (fieldRef.current ?? inputRef.current)?.focus({ preventScroll: true });
  }, [isStreaming]);

  const overLimit = value.length > MAX_INPUT_CHARS;
  const hasContent = value.trim().length > 0 || image !== null;
  const canSend = hasContent && !isStreaming && !overLimit;
  const error = attachError || voice.error;

  function clearImage() {
    setImage(null);
    setAttachError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setAttachError("");
    voice.setError("");
    const attachment = await readAsAttachment(file).catch(() => null);
    if (!attachment) {
      setAttachError("Could not read that file.");
      return;
    }
    // The server enforces the same rules; running them here makes the
    // failure immediate instead of arriving after an upload round-trip.
    const verdict = validateAttachment(attachment);
    if (!verdict.ok) {
      setAttachError(verdict.message);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImage(attachment);
  }

  function submit() {
    if (!canSend) return;
    onSend(value, image ?? undefined);
    setValue("");
    clearImage();
  }

  async function sendVoice() {
    if (isStreaming) return;
    const result = await voice.finish();
    if (!result) return;
    // A staged image rides along with the spoken turn, as it would with text.
    onSend(result.transcript, image ?? undefined, result.note);
    clearImage();
  }

  const picker = (
    // Off-screen rather than display:none so it stays a real control; the
    // image button clicks it inside the user's own click.
    <input
      ref={fileRef}
      className="pbot-filepicker"
      type="file"
      accept={ALLOWED_IMAGE_TYPES.join(",")}
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => void onPickFile(e.target.files?.[0])}
    />
  );

  const chip = image && (
    // DS 5274:100794 "Label Badge - 1.5". One image per turn here, so the row
    // is always the single-chip layout.
    <div className="pbot-attach-host">
      <div className="pbot-attach is-single">
        <span className="pbot-attach__chip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pbot-attach__thumb" src={`data:${image.mediaType};base64,${image.data}`} alt="" />
          <span className="pbot-attach__meta">
            <span className="pbot-attach__name">{image.name ?? "Image"}</span>
            <span className="pbot-attach__hint">Preview</span>
          </span>
          <IconBtn variant="delete" size="s" icon="trash-2" onClick={clearImage} aria-label="Remove attachment" />
        </span>
      </div>
    </div>
  );

  const take = voice.take;
  const composeClass = variant === "hero" ? "pbot-compose pbot-web__compose" : "pbot-compose";

  const voicebar = take?.state === "recording" ? (
    // DS 5274:97093 — discard · live waveform + timer · stop.
    <div className={`${composeClass} pbot-voicebar`}>
      <IconBtn variant="delete" size="l" icon="trash-2" onClick={voice.discard} aria-label="Discard recording" />
      <span className="pbot-wave-panel">
        <span className="pbot-wave pbot-wave--rec" aria-hidden="true">
          {take.bars.map((h, i) => (
            <i className="pbot-wave__bar" style={{ height: `${h}px` }} key={i} />
          ))}
        </span>
      </span>
      <span className="pbot-voicebar__time is-rec" role="timer" aria-label={`Recording, ${clock(take.seconds)}`}>
        {clock(take.seconds)}
      </span>
      <IconBtn variant="primary" size="l" icon="arrow-up" onClick={voice.stop} aria-label="Stop recording" />
    </div>
  ) : take?.state === "recorded" ? (
    // DS 5274:97487 — discard · play · waveform with playhead · send.
    <div className={`${composeClass} pbot-voicebar`}>
      <IconBtn variant="delete" size="l" icon="trash-2" onClick={voice.discard} aria-label="Discard recording" />
      <IconBtn
        variant="primary"
        size="l"
        icon="play-filled"
        className={`pbot-voice-play ${play.isPlaying(take.url) ? "is-playing" : ""}`}
        onClick={() => play.toggle(take.url)}
        disabled={!take.url}
        aria-label={play.isPlaying(take.url) ? "Pause recording" : "Play recording"}
      />
      <span
        className={`pbot-wave-panel ${play.isPlaying(take.url) ? "is-playing" : ""}`}
        style={{ "--play-progress": `${(play.isPlaying(take.url) ? play.progress : 0) * 100}%` } as CSSProperties}
      >
        <span className="pbot-wave pbot-wave--rec is-done" aria-hidden="true">
          {take.bars.map((h, i) => (
            <i className="pbot-wave__bar" style={{ height: `${h}px` }} key={i} />
          ))}
        </span>
        <i
          className={`pbot-wave__head ${play.isPlaying(take.url) ? "is-live" : ""}`}
          aria-hidden="true"
          style={{ left: `${(play.isPlaying(take.url) ? play.progress : 0) * 100}%` }}
        />
      </span>
      <span className="pbot-voicebar__time">{clock(take.seconds)}</span>
      <IconBtn
        variant="primary"
        size="l"
        icon="arrow-up"
        onClick={() => void sendVoice()}
        disabled={isStreaming}
        aria-label="Send voice note"
      />
    </div>
  ) : null;

  const form = !take && (
    <form
      className={composeClass}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="pbot-compose__group">
        <div className="pbot-compose__pill">
          {variant === "chat" ? (
            <textarea
              ref={fieldRef}
              className={`pbot-compose__field ${overLimit ? "is-over" : ""}`}
              value={value}
              rows={1}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter is a newline.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Type a message ..."
              aria-label="Message PBot"
              autoComplete="off"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              className={`pbot-compose__field pbot-compose__field--input ${overLimit ? "is-over" : ""}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type a message ..."
              aria-label="Message PBot"
              autoComplete="off"
            />
          )}
        </div>
        {/* Send (idle) ↔ Stop (streaming), DS 5574:9053 — a raised disc in a
            lane that opens only once there is something to send, or while a
            reply streams and Stop has to be reachable. */}
        <span className={`pbot-compose__sendwrap ${hasContent || isStreaming ? "is-ready" : ""}`}>
          {isStreaming && onStop ? (
            <IconBtn
              className="pbot-compose__stop"
              variant="secondary"
              size="l"
              icon="square"
              onClick={onStop}
              aria-label="Stop generating"
            />
          ) : (
            <IconBtn
              className="pbot-compose__send"
              variant="primary"
              size="l"
              icon="arrow-up"
              type="submit"
              disabled={!canSend}
              aria-label="Send"
            />
          )}
        </span>
      </div>
      <IconBtn
        variant="secondary"
        size="l"
        icon="mic"
        onClick={() => {
          setAttachError("");
          void voice.start();
        }}
        disabled={isStreaming}
        aria-label="Record a voice message"
      />
      <IconBtn
        variant="secondary"
        size="l"
        icon="image"
        onClick={() => fileRef.current?.click()}
        disabled={isStreaming}
        aria-label="Attach image"
      />
    </form>
  );

  const count = value.length > MAX_INPUT_CHARS * 0.8 && (
    <p className={`pbot-count ${overLimit ? "is-over" : ""}`}>
      {value.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
    </p>
  );

  const errorLine = error && (
    <p className="pbot-composer__error" role="status">
      {error}
    </p>
  );

  if (variant === "hero") {
    // The hero's column lays these out itself (.pbot-web__column), so no band.
    return (
      <>
        {picker}
        {chip}
        {errorLine}
        {voicebar}
        {form}
        {count}
        {footer}
      </>
    );
  }

  return (
    <>
      {chip}
      <div className="pbot-composer">
        {picker}
        {errorLine}
        {voicebar}
        {form}
        {count}
        {footer}
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { validateAttachment } from "@/lib/guardrails";
import { MAX_INPUT_CHARS } from "@/lib/limits";
import { ALLOWED_IMAGE_TYPES, type Attachment, type ImageMediaType } from "@/lib/types";
import { IconImage, IconSend, IconStop, IconX } from "./icons";

interface PBotComposerProps {
  onSend: (text: string, image?: Attachment) => void;
  onStop: () => void;
  isStreaming: boolean;
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

export function PBotComposer({ onSend, onStop, isStreaming }: PBotComposerProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<Attachment | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  // 0 = one line (full pill) · 1 = two lines · 2 = three or more. The source
  // steps the corner radius down as the field grows so a tall box stops
  // pretending to be a pill; these thresholds are ours because our line-height
  // and padding differ from the Blade original's.
  const [grown, setGrown] = useState<0 | 1 | 2>(0);

  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Grow with content up to a ceiling, then scroll. Reset to `auto` first so
  // the box can shrink again when text is deleted.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    const height = Math.min(el.scrollHeight, 120);
    el.style.height = `${height}px`;
    setGrown(height <= 44 ? 0 : height <= 64 ? 1 : 2);
  }, [value]);

  // Return focus to the input when a turn finishes, so you can keep typing.
  useEffect(() => {
    if (!isStreaming) fieldRef.current?.focus();
  }, [isStreaming]);

  const overLimit = value.length > MAX_INPUT_CHARS;
  const canSend = (value.trim().length > 0 || image !== null) && !isStreaming && !overLimit;

  function clearImage() {
    setImage(null);
    setImagePreview(null);
    setAttachError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setAttachError(null);

    const attachment = await readAsAttachment(file).catch(() => null);
    if (!attachment) {
      setAttachError("Could not read that file.");
      return;
    }

    // Same rules the server enforces, run here so the failure is immediate
    // instead of arriving after an upload round-trip.
    const verdict = validateAttachment(attachment);
    if (!verdict.ok) {
      setAttachError(verdict.message);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setImage(attachment);
    setImagePreview(`data:${attachment.mediaType};base64,${attachment.data}`);
  }

  function submit() {
    if (!canSend) return;
    onSend(value, image ?? undefined);
    setValue("");
    clearImage();
  }

  return (
    <>
      {(imagePreview || attachError) && (
        <div className="pbot-attach">
          {imagePreview && (
            <div className="pbot-attach__chip">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt={image?.name ?? "Attached image"} />
              <button type="button" onClick={clearImage} aria-label="Remove image">
                <IconX size={14} />
              </button>
            </div>
          )}
          {attachError && (
            <p className="pbot-attach__error" role="alert">
              {attachError}
            </p>
          )}
        </div>
      )}

      <form
        className="pbot-compose"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={fieldRef}
          className={`pbot-compose__field ${overLimit ? "is-over" : ""} ${
            grown ? `is-grown-${grown}` : ""
          }`}
          value={value}
          rows={1}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a message …"
          aria-label="Message PBot"
          autoComplete="off"
        />

        {isStreaming ? (
          <button
            className="pbot-compose__send"
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <IconStop size={16} />
          </button>
        ) : (
          <button
            className="pbot-compose__send"
            type="submit"
            disabled={!canSend}
            aria-label="Send"
          >
            <IconSend size={18} />
          </button>
        )}

        <button
          className="pbot-compose__extra"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isStreaming}
          aria-label="Attach image"
        >
          <IconImage size={18} />
        </button>

        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          hidden
          onChange={(e) => void onPickFile(e.target.files?.[0])}
        />
      </form>

      {value.length > MAX_INPUT_CHARS * 0.8 && (
        <p className={`pbot-count ${overLimit ? "is-over" : ""}`}>
          {value.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
        </p>
      )}
    </>
  );
}

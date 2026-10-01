/** Wire types shared between the chat route and the browser client. */

export type Role = "user" | "assistant";

/** Media types Claude accepts for image input. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type ImageMediaType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** An attached image, base64-encoded with no `data:` prefix. */
export interface Attachment {
  mediaType: ImageMediaType;
  data: string;
  /** Original filename, shown in the UI. Never sent to the model. */
  name?: string;
}

/**
 * A spoken user turn, as the bubble draws it. The words themselves travel as
 * the message's `content` — that transcript is all the model ever sees; this
 * is only the waveform, the length, and (in memory) a clip to play back.
 */
export interface VoiceNote {
  seconds: number;
  /** Bar heights in px, already resampled to what the bubble draws. */
  bars: number[];
  /** A blob: URL. In-memory only — dropped before persisting, like images. */
  url?: string;
}

/** A single conversation turn as the client stores and sends it. */
export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** Present only on the in-memory copy; stripped before persisting. */
  image?: Attachment;
  /** Set on rehydrated history where an image was dropped to save quota. */
  imagePlaceholder?: boolean;
  /** Present when the user spoke this turn instead of typing it. Client-only. */
  voice?: VoiceNote;
}

/** What the client POSTs to /api/chat. */
export interface ChatRequestBody {
  messages: { role: Role; content: string; image?: Attachment }[];
}

/** Per-turn usage, echoed to the client so the UI can show real numbers. */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/**
 * Server-sent events, newline-delimited JSON. One JSON object per line.
 *
 * NDJSON rather than SSE: the payloads are small and structured, the browser
 * side is a plain fetch reader either way, and skipping the `data: ` framing
 * keeps the parser to a handful of lines.
 */
export type StreamEvent =
  /** Coarse phase, for the UI's status line. */
  | { type: "status"; value: "thinking" | "tool" | "generating" }
  /** An incremental chunk of visible assistant text. */
  | { type: "text"; value: string }
  /** A tool was invoked. Surfaced so the UI can show it happening. */
  | { type: "tool_use"; name: string }
  /** Terminal success. */
  | {
      type: "done";
      usage: TurnUsage;
      latencyMs: number;
      ttftMs: number | null;
      stopReason: string | null;
      truncated: boolean;
    }
  /** Terminal failure. `message` is safe to show the user verbatim. */
  | { type: "error"; code: string; message: string };

export function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}

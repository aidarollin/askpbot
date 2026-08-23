/**
 * Structured per-turn logging.
 *
 * One JSON object per line to stdout. Vercel ingests stdout automatically, so
 * this gives queryable logs with no vendor SDK and no extra dependency. Swap
 * `emit` for an OpenTelemetry exporter or a log drain later without touching
 * any call site.
 *
 * Deliberately logs no message content — only shapes, counts, and timings — so
 * the logs stay safe to share and forward.
 */

export interface TurnLog {
  requestId: string;
  /** "ok" | "blocked" | "rate_limited" | "refusal" | "error" */
  outcome: string;
  model: string;
  effort: string;
  /** Total server-side wall clock for the turn. */
  latencyMs: number;
  /** Time to first visible text token. Null if the turn produced no text. */
  ttftMs: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /** Number of model round-trips (>1 means tools ran). */
  iterations: number;
  toolCalls: string[];
  stopReason: string | null;
  /** Conversation depth, for spotting context growth. */
  historyLength: number;
  /** Set when a guardrail fired. */
  guardrail?: string;
  errorCode?: string;
}

function emit(record: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...record }));
}

export function logTurn(log: TurnLog): void {
  emit({ event: "chat_turn", ...log });
}

export interface FeedbackLog {
  requestId: string;
  rating: "up" | "down";
  conversationId: string | null;
  /** Length of the rated reply, in characters. No content is logged. */
  messageLength: number | null;
  /** Position of the rated reply in the conversation. */
  turnIndex: number | null;
}

export function logFeedback(log: FeedbackLog): void {
  emit({ event: "chat_feedback", ...log });
}

export function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
}

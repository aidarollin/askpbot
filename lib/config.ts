/**
 * Central runtime configuration. Everything here is env-overridable so the
 * deployed app can be retuned without a code change.
 */

/** Model used for chat. Sonnet 5 balances quality and latency for conversation. */
export const MODEL = process.env.ASKPBOT_MODEL ?? "claude-sonnet-5";

/**
 * Thinking depth. Sonnet 5 respects effort strictly, so this is the main
 * latency/quality dial:
 *   low    - snappiest, may under-think multi-step questions
 *   medium - default; good balance for open-ended chat
 *   high   - slower, better on hard reasoning
 */
export const EFFORT = (process.env.ASKPBOT_EFFORT ?? "medium") as
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/**
 * Hard ceiling on output tokens. On Sonnet 5 this caps thinking *and* visible
 * text together, so it needs headroom above the longest reply we want.
 */
export const MAX_TOKENS = Number(process.env.ASKPBOT_MAX_TOKENS ?? 8192);

// MAX_INPUT_CHARS lives in ./limits because the browser needs it too.

/** Most conversation turns we replay to the model. Older turns are dropped. */
export const MAX_HISTORY_MESSAGES = Number(process.env.ASKPBOT_MAX_HISTORY ?? 40);

/** Safety valve on the tool-use loop so a misbehaving turn can't spin forever. */
export const MAX_TOOL_ITERATIONS = Number(process.env.ASKPBOT_MAX_TOOL_ITERATIONS ?? 4);

/** Rate limit: requests allowed per IP per window. */
export const RATE_LIMIT_REQUESTS = Number(process.env.ASKPBOT_RATE_LIMIT ?? 20);

/** Rate limit window, in milliseconds. */
export const RATE_LIMIT_WINDOW_MS = Number(
  process.env.ASKPBOT_RATE_LIMIT_WINDOW_MS ?? 60_000,
);

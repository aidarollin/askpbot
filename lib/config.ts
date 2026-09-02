/**
 * Central runtime configuration. Everything here is env-overridable so the
 * deployed app can be retuned without a code change.
 */

/**
 * API base URL. Unset means Anthropic direct, which is the default.
 *
 * The SDK reads `ANTHROPIC_BASE_URL` by itself, so this constant changes no
 * behaviour. It exists to make the redirect visible: a variable that sends
 * every prompt and every API key to a third party should not be discoverable
 * only by reading the SDK's constructor.
 *
 * OpenRouter serves an Anthropic-compatible `/v1/messages`, so pointing at
 * `https://openrouter.ai/api` is the entire provider switch — the SDK, the
 * tool loop, adaptive thinking, `effort`, `cache_control`, and the cache-token
 * fields of `usage` all work there unmodified. What does *not* carry over is
 * the model id: OpenRouter needs a provider prefix, so `MODEL` must be set to
 * `anthropic/claude-sonnet-5` rather than `claude-sonnet-5`. Set one without
 * the other and every turn fails with a not-found error.
 *
 * Note the URL stops at `/api`, with no `/v1`. The SDK appends `/v1/messages`
 * itself, so the usual `https://openrouter.ai/api/v1` from OpenRouter's docs
 * resolves to `/api/v1/v1/messages` and 404s — which surfaces to the user as
 * the generic `api_404` "something went wrong", giving no hint that the URL is
 * the problem.
 */
export const BASE_URL = process.env.ANTHROPIC_BASE_URL;

/**
 * Model used for chat. Sonnet 5 balances quality and latency for conversation.
 * Needs a provider prefix when `BASE_URL` points at OpenRouter — see above.
 */
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

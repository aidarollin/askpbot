import Anthropic from "@anthropic-ai/sdk";
import { runTurn } from "@/lib/agent";
import { EFFORT, MAX_HISTORY_MESSAGES, MODEL } from "@/lib/config";
import { screenInput, screenOutput, validateShape } from "@/lib/guardrails";
import { logTurn, newRequestId, type TurnLog } from "@/lib/log";
import { check, clientKey } from "@/lib/ratelimit";
import { encodeEvent, type ChatRequestBody, type StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Vercel-only knob, and the deploy target is Cloudflare Workers — Workers
 * ignores it. Kept because it is the correct value if this ever runs on Vercel
 * again, and deleting it would silently lose that. Workers limits *CPU* time
 * rather than wall clock, and a turn spends nearly all of its time waiting on
 * the Anthropic API rather than computing, so a long stream is not the risk
 * here. Unverified against a real multi-tool turn — see RELIABILITY.md.
 */
export const maxDuration = 60;

/**
 * The chat endpoint. Responsibilities kept deliberately narrow: transport,
 * guardrails, rate limiting, and logging. The model turn itself lives in
 * lib/agent.ts so the eval suite exercises identical code.
 */

/** Failure before the stream opens — the body hasn't started, so use a status. */
function fail(code: string, message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = newRequestId();
  const startedAt = Date.now();

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("missing_api_key", "The server has no ANTHROPIC_API_KEY configured.", 500);
  }

  // --- Rate limit -----------------------------------------------------------
  const limit = check(clientKey(request.headers));
  if (!limit.allowed) {
    logTurn(baseLog(requestId, "rate_limited", Date.now() - startedAt, 0));
    return fail(
      "rate_limited",
      `That's a lot of questions at once! Give me ${limit.retryAfterSeconds}s to catch my breath. 🐼`,
      429,
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  // --- Parse and validate ---------------------------------------------------
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return fail("bad_json", "Request body was not valid JSON.", 400);
  }

  const shape = validateShape(body?.messages ?? []);
  if (!shape.ok) return fail(shape.code, shape.message, 400);

  // Keep the most recent turns. Trimming from the front preserves the newest
  // context, which is what the current question depends on.
  const history = body.messages.slice(-MAX_HISTORY_MESSAGES);
  const latest = history[history.length - 1].content;

  const screened = screenInput(latest);
  if (!screened.ok) {
    // A pre-screen block still returns 200 with a streamed reply: from the
    // user's point of view PBot declined, which is what happened. An error
    // status here would render as a broken app rather than a refusal.
    logTurn({
      ...baseLog(requestId, "blocked", Date.now() - startedAt, history.length),
      guardrail: screened.code,
    });
    return streamOf(screened.message, Date.now() - startedAt);
  }

  // --- Stream the model turn ------------------------------------------------
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encodeEvent(event));

      try {
        const result = await runTurn(history, {
          onEvent: send,
          signal: request.signal,
          startedAt,
        });

        const leak = screenOutput(result.text);
        const latencyMs = Date.now() - startedAt;

        logTurn({
          requestId,
          outcome: result.stopReason === "refusal" ? "refusal" : "ok",
          model: MODEL,
          effort: EFFORT,
          latencyMs,
          ttftMs: result.ttftMs,
          ...result.usage,
          iterations: result.iterations,
          toolCalls: result.toolCalls,
          stopReason: result.stopReason,
          historyLength: history.length,
          ...(leak.leaked ? { guardrail: "system_prompt_leak" } : {}),
        });

        send({
          type: "done",
          usage: result.usage,
          latencyMs,
          ttftMs: result.ttftMs,
          stopReason: result.stopReason,
          truncated: result.stopReason === "max_tokens",
        });
      } catch (error) {
        const { code, message } = describeError(error);
        logTurn({
          ...baseLog(requestId, "error", Date.now() - startedAt, history.length),
          errorCode: code,
        });
        // The response has already begun, so the HTTP status is locked in at
        // 200. Errors after the first byte have to travel in-band as events.
        send({ type: "error", code, message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}

/** Streams a fixed string, so guardrail replies reuse the same client path. */
function streamOf(text: string, latencyMs: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encodeEvent({ type: "text", value: text }));
      controller.enqueue(
        encodeEvent({
          type: "done",
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
          },
          latencyMs,
          ttftMs: 0,
          stopReason: "guardrail",
          truncated: false,
        }),
      );
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Maps SDK errors to a stable code plus a message safe to show a user. */
function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof Anthropic.APIUserAbortError) {
    return { code: "aborted", message: "Cancelled." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      code: "upstream_rate_limited",
      message: "I'm getting more questions than I can keep up with. Try again in a moment. 🐼",
    };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { code: "auth", message: "The server's API key was rejected." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { code: "connection", message: "I couldn't reach my brain just then. Try again?" };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      code: `api_${error.status ?? "unknown"}`,
      message: "Something went wrong on my end. Try again in a moment.",
    };
  }
  return { code: "unknown", message: "Something went wrong on my end. Try again in a moment." };
}

function baseLog(
  requestId: string,
  outcome: string,
  latencyMs: number,
  historyLength: number,
): TurnLog {
  return {
    requestId,
    outcome,
    model: MODEL,
    effort: EFFORT,
    latencyMs,
    ttftMs: null,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    iterations: 0,
    toolCalls: [],
    stopReason: null,
    historyLength,
  };
}

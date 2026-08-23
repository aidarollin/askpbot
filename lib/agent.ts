import Anthropic from "@anthropic-ai/sdk";
import { EFFORT, MAX_TOKENS, MAX_TOOL_ITERATIONS, MODEL } from "./config";
import { SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOLS } from "./tools";
import type { Attachment, Role, StreamEvent, TurnUsage } from "./types";

/**
 * One assistant turn: model call, tool loop, streamed output.
 *
 * This lives apart from the route so the eval suite drives the exact same code
 * path the deployed app does — same system prompt, same model, same effort,
 * same tool loop. Evals that reimplemented these params would pass while
 * production diverged, which is worse than having no evals.
 *
 * Streaming is exposed through `onEvent` rather than a return value, so the
 * route can forward events to the browser while the eval runner ignores them
 * and reads the accumulated result.
 */

export interface TurnResult {
  /** Full visible assistant text for the turn. */
  text: string;
  /** Names of tools the model invoked, in call order. */
  toolCalls: string[];
  stopReason: string | null;
  usage: TurnUsage;
  /** Model round-trips. >1 means at least one tool ran. */
  iterations: number;
  /** Milliseconds from turn start to first visible token. */
  ttftMs: number | null;
}

export interface RunTurnOptions {
  onEvent?: (event: StreamEvent) => void;
  signal?: AbortSignal;
  /** Overridden by the route so latency spans the whole request. */
  startedAt?: number;
}

/** Shown when safety classifiers decline before producing any text. */
export const REFUSAL_FALLBACK =
  "I'm not able to help with that one, sorry. Ask me something else and I'll do my best! 🐼";

/**
 * Turns a wire message into API content. A plain string when there is no
 * attachment; otherwise image-then-text, which is the order Claude reads best —
 * the picture is context for the question that follows it.
 */
function toContent(
  message: { content: string; image?: Attachment },
): Anthropic.MessageParam["content"] {
  if (!message.image) return message.content;

  const blocks: Anthropic.ContentBlockParam[] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: message.image.mediaType,
        data: message.image.data,
      },
    },
  ];
  // An image with no caption is a valid turn; give the model the implied ask
  // rather than sending an empty text block, which the API rejects.
  blocks.push({
    type: "text",
    text: message.content.trim() || "What's in this image?",
  });
  return blocks;
}

export async function runTurn(
  history: { role: Role; content: string; image?: Attachment }[],
  options: RunTurnOptions = {},
): Promise<TurnResult> {
  const { onEvent, signal } = options;
  const startedAt = options.startedAt ?? Date.now();
  const emit = (event: StreamEvent) => onEvent?.(event);

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: toContent(m),
  }));

  const usage: TurnUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };
  const toolCalls: string[] = [];
  let iterations = 0;
  let ttftMs: number | null = null;
  let text = "";
  let stopReason: string | null = null;

  emit({ type: "status", value: "thinking" });

  // Each pass is one model round-trip. Exits as soon as the model stops asking
  // for tools; bounded so a pathological turn cannot spin.
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const turn = client.messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
        // Adaptive lets Claude decide per-message whether the question needs
        // reasoning; `effort` bounds how deep it goes. Together they cost far
        // less on small talk than a fixed thinking budget would.
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        // Auto-places the cache breakpoint on the last cacheable block. A no-op
        // on short conversations (the prefix is under the model's minimum
        // cacheable length) that starts paying off as history grows.
        cache_control: { type: "ephemeral" },
      },
      { signal },
    );

    for await (const event of turn) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "thinking") {
          emit({ type: "status", value: "thinking" });
        } else if (block.type === "tool_use") {
          toolCalls.push(block.name);
          emit({ type: "status", value: "tool" });
          emit({ type: "tool_use", name: block.name });
        } else if (block.type === "text") {
          emit({ type: "status", value: "generating" });
        }
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        ttftMs ??= Date.now() - startedAt;
        text += event.delta.text;
        emit({ type: "text", value: event.delta.text });
      }
    }

    const message = await turn.finalMessage();
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheCreationTokens += message.usage.cache_creation_input_tokens ?? 0;
    stopReason = message.stop_reason;

    // Safety classifiers declined. Content is empty or partial, so give the
    // user something rather than an empty bubble.
    if (message.stop_reason === "refusal") {
      if (text.length === 0) {
        text = REFUSAL_FALLBACK;
        emit({ type: "text", value: REFUSAL_FALLBACK });
      }
      break;
    }

    if (message.stop_reason !== "tool_use") break;

    // Feed results back and let the model continue from them.
    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.ToolResultBlockParam[] = message.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: runTool(b.name, b.input),
      }));
    messages.push({ role: "user", content: results });
    emit({ type: "status", value: "generating" });
  }

  return { text, toolCalls, stopReason, usage, iterations, ttftMs };
}

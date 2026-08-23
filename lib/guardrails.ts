import { MAX_IMAGE_BASE64_CHARS, MAX_INPUT_CHARS } from "./limits";
import { PROMPT_LEAK_SENTINEL } from "./prompt";
import { ALLOWED_IMAGE_TYPES, type Attachment } from "./types";

/**
 * Guardrails.
 *
 * Layering, most to least important:
 *
 *   1. The model. Claude's own safety training is the real safety layer and
 *      handles the long tail. The system prompt shapes *how* it declines.
 *   2. Structural limits (below). Length and shape caps that protect the
 *      service regardless of content. These are cheap and have no false
 *      positives, so they run on every request.
 *   3. A narrow pre-screen (below). A deliberately small set of high-confidence
 *      patterns, matched only as verb+object pairs rather than bare keywords.
 *      This exists to save a model call on the most obvious cases and to give
 *      the guardrail seam a real, testable implementation.
 *   4. An output check (below). Catches verbatim system-prompt leakage.
 *
 * Deliberately NOT a broad keyword blocklist. A wide list mostly produces false
 * positives — "how do bombs work in Minecraft", "what is ricin poisoning" from
 * a nurse — and each false positive is a real user refused a legitimate answer
 * by a regex that cannot read context. The model can read context; the regex
 * cannot. So the regex layer stays narrow on purpose, and anything it does not
 * catch is the model's job.
 */

export type InputVerdict =
  | { ok: true }
  | { ok: false; code: string; message: string };

/** Validates one attachment. Exported so the composer can reuse the rules. */
export function validateAttachment(image: Attachment | undefined): InputVerdict {
  if (!image) return { ok: true };

  if (!ALLOWED_IMAGE_TYPES.includes(image.mediaType)) {
    return {
      ok: false,
      code: "bad_image_type",
      message: "I can read JPEG, PNG, WebP and GIF images. That one is a different format.",
    };
  }
  if (typeof image.data !== "string" || image.data.length === 0) {
    return { ok: false, code: "bad_image_data", message: "That image didn't come through." };
  }
  if (image.data.length > MAX_IMAGE_BASE64_CHARS) {
    return {
      ok: false,
      code: "image_too_large",
      message: "That image is a bit too big for me — could you send a smaller one? 🐼",
    };
  }
  return { ok: true };
}

/** Structural checks: shape and size, independent of content. */
export function validateShape(
  messages: { role: string; content: string; image?: Attachment }[],
): InputVerdict {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, code: "empty_request", message: "No message was sent." };
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    return {
      ok: false,
      code: "bad_turn_order",
      message: "The last message must come from you.",
    };
  }

  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") {
      return { ok: false, code: "bad_role", message: "Unrecognised message role." };
    }
    if (typeof m.content !== "string") {
      return { ok: false, code: "bad_content", message: "Message content must be text." };
    }
    const attachment = validateAttachment(m.image);
    if (!attachment.ok) return attachment;
  }

  // An image on its own is a valid turn — "what is this?" is implied.
  if (last.content.trim().length === 0 && !last.image) {
    return { ok: false, code: "empty_message", message: "Your message was empty." };
  }

  if (last.content.length > MAX_INPUT_CHARS) {
    return {
      ok: false,
      code: "too_long",
      message: `That message is ${last.content.length} characters. Could you trim it to under ${MAX_INPUT_CHARS}? 🐼`,
    };
  }

  return { ok: true };
}

/**
 * Narrow content pre-screen.
 *
 * Every pattern requires an explicit request-for-instructions phrasing AND a
 * specific harmful object. Asking *about* a topic never matches; asking for
 * step-by-step capability does. Kept short on purpose — see the note above.
 */
const HIGH_CONFIDENCE_HARM: { pattern: RegExp; label: string }[] = [
  {
    label: "weapons",
    pattern:
      /\b(how (do|can|would) (i|you|we)|steps? to|instructions? (for|on)|guide (to|for)|teach me to|walk me through)\b[^.?!]{0,60}\b(make|build|construct|synthesi[sz]e|manufacture|assemble)\b[^.?!]{0,40}\b(bomb|pipe bomb|ied|explosive device|nerve agent|sarin|vx gas|ricin|anthrax|dirty bomb|chemical weapon|biological weapon)\b/i,
  },
  {
    label: "malware",
    pattern:
      /\b(write|create|generate|build|code)\b[^.?!]{0,40}\b(ransomware|keylogger|botnet|rootkit|credential stealer|password stealer)\b[^.?!]{0,60}\b(that|which|to)\b[^.?!]{0,60}\b(evade|bypass|undetect|exfiltrat|spread|infect)\w*/i,
  },
  {
    label: "csam",
    pattern:
      /\b(sexual|sexually|erotic|nude|naked|explicit)\b[^.?!]{0,40}\b(child|children|minor|minors|underage|kid|kids|11|12|13|14|15|16)[- ]?(year|yr)?s?[- ]?(old)?\b/i,
  },
];

const DECLINE_MESSAGE =
  "I can't help with that one — it's in the small set of things I won't give instructions for. Happy to help with almost anything else though: ask me about the topic in general terms, or point me at something else entirely. 🐼";

/** Content pre-screen on the newest user message. */
export function screenInput(text: string): InputVerdict {
  for (const { pattern, label } of HIGH_CONFIDENCE_HARM) {
    if (pattern.test(text)) {
      return { ok: false, code: `blocked_${label}`, message: DECLINE_MESSAGE };
    }
  }
  return { ok: true };
}

/**
 * Output check. Catches the one failure that the model cannot self-police and
 * that we can detect with certainty: reproducing the system prompt verbatim.
 *
 * Runs on the accumulated text at the end of the turn rather than per-chunk,
 * so it is a detection-and-log signal, not a mid-stream interceptor. Blocking
 * the stream retroactively would mean the user had already read the text.
 */
export function screenOutput(text: string): { leaked: boolean } {
  return { leaked: text.includes(PROMPT_LEAK_SENTINEL) };
}

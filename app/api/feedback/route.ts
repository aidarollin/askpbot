import { logFeedback, newRequestId } from "@/lib/log";
import { check, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Thumbs-up signal from the chat UI.
 *
 * This exists so the rating button is not decoration. Ratings land in the same
 * structured log stream as the turns themselves, which is what makes them
 * useful later: a rated turn is a candidate eval case, and an unrated stretch
 * of a conversation is a hint about where quality drops.
 *
 * No message content is accepted or stored — only the shape of the rated turn.
 * Feedback that carried transcripts would need a retention policy and a consent
 * story; feedback that carries counts does not.
 */
export async function POST(request: Request): Promise<Response> {
  // Same limiter as chat, so a script cannot spam the log through this route.
  const limit = check(clientKey(request.headers));
  if (!limit.allowed) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const payload = body as {
    rating?: unknown;
    conversationId?: unknown;
    messageLength?: unknown;
    turnIndex?: unknown;
  };

  if (payload.rating !== "up" && payload.rating !== "down") {
    return Response.json({ ok: false }, { status: 400 });
  }

  logFeedback({
    requestId: newRequestId(),
    rating: payload.rating,
    // Client-generated id, used only to group ratings within one conversation.
    conversationId:
      typeof payload.conversationId === "string" ? payload.conversationId : null,
    messageLength:
      typeof payload.messageLength === "number" ? payload.messageLength : null,
    turnIndex: typeof payload.turnIndex === "number" ? payload.turnIndex : null,
  });

  return Response.json({ ok: true });
}

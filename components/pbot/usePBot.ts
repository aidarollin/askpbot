"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  conversationsServerSnapshot,
  conversationsSnapshot,
  deleteConversation,
  deriveTitle,
  groupByDate,
  renameConversation,
  saveConversation,
  subscribeConversations,
  type StoredConversation,
} from "@/lib/history";
import type { Attachment, ChatMessage, StreamEvent, TurnUsage, VoiceNote } from "@/lib/types";

/**
 * The AskPBot state machine.
 *
 * A direct port of the Alpine `askpbot` component, with the mock `setTimeout`
 * in `send()` replaced by a real streaming call, and the hardcoded history
 * array replaced by localStorage persistence.
 *
 *   Alpine            here
 *   ------            ----
 *   isOpen            isOpen
 *   view              view              'home' | 'chat'
 *   title             title
 *   messages[]        messages
 *   thinking          status !== 'idle'   (now three-phase, not a boolean)
 *   history           history             (real, from localStorage)
 *   $refs.log         logRef + an effect that scrolls on change
 *   pbot-open event   a window listener, kept so host apps integrate unchanged
 *
 * `tab` and the Math Drill state are gone — this bot is general-purpose, which
 * leaves one feature and therefore nothing to switch between.
 */

export type PBotStatus = "idle" | "thinking" | "tool" | "generating";
export type PBotView = "home" | "chat";

export interface TurnStats {
  usage: TurnUsage;
  latencyMs: number;
  ttftMs: number | null;
  truncated: boolean;
}

// Markdown since replies render it: the source's own greeting bolds the name.
const GREETING =
  "Hi! I'm **PBot**, your AI study buddy — you can ask me anything below. 🐼";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function greetingMessage(): ChatMessage {
  return { id: newId(), role: "assistant", content: GREETING };
}

function userTurn(content: string, image?: Attachment, voice?: VoiceNote): ChatMessage {
  return { id: newId(), role: "user", content, ...(image ? { image } : {}), ...(voice ? { voice } : {}) };
}

/**
 * `panel` is the docked overlay: starts closed, opens on `pbot-open`, locks the
 * host page's scroll while open. `page` is the full web layout, which is always
 * on screen — so it must not start closed and must not touch body overflow, or
 * the page it *is* becomes unscrollable.
 */
export type PBotMode = "panel" | "page";

export function usePBot({ mode = "panel" }: { mode?: PBotMode } = {}) {
  const [isOpen, setIsOpen] = useState(mode === "page");
  const [view, setView] = useState<PBotView>("home");
  const [title, setTitle] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<PBotStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnStats | null>(null);
  // Saved chats are localStorage, an external store: every save, rename and
  // delete notifies, so the web rail and the panel's home are always current
  // without anyone remembering to refresh them. Empty on the server and during
  // hydration; `PBotWeb` gates the rail on hydration so the two agree.
  const conversations = useSyncExternalStore(
    subscribeConversations,
    conversationsSnapshot,
    conversationsServerSnapshot,
  );
  const history = useMemo(() => groupByDate(conversations), [conversations]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);
  const createdAtRef = useRef<number>(Date.now());
  const isStreaming = status !== "idle";

  // --- panel open/close ----------------------------------------------------

  const show = useCallback(() => setIsOpen(true), []);

  const hide = useCallback(() => setIsOpen(false), []);

  // The integration point host apps use:
  //   window.dispatchEvent(new CustomEvent('pbot-open'))
  useEffect(() => {
    if (mode !== "panel") return;
    const onOpen = () => show();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("pbot-open", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pbot-open", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [mode, show]);

  // Lock the page behind the panel so a scroll gesture over the scrim doesn't
  // move the host page underneath.
  useEffect(() => {
    if (mode !== "panel" || !isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen, mode]);

  // --- conversation navigation ---------------------------------------------

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    createdAtRef.current = Date.now();
    setConversationId(newId());
    setTitle("New Chat");
    setMessages([greetingMessage()]);
    setError(null);
    setLastTurn(null);
    setStatus("idle");
    setView("chat");
  }, []);

  const openChat = useCallback((conversation: StoredConversation) => {
    abortRef.current?.abort();
    createdAtRef.current = conversation.createdAt;
    setConversationId(conversation.id);
    setTitle(conversation.title);
    setMessages(conversation.messages.length ? conversation.messages : [greetingMessage()]);
    setError(null);
    setLastTurn(null);
    setStatus("idle");
    setView("chat");
  }, []);

  const back = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setView("home");
  }, []);

  const removeConversation = useCallback(
    (id: string) => {
      deleteConversation(id);
      // If the open conversation was the one deleted, don't leave it stranded.
      if (id === conversationId) {
        setView("home");
        setConversationId(null);
        setMessages([]);
      }
    },
    [conversationId],
  );

  // Persist after every settled turn. Skipped while streaming so a partial
  // reply never lands in history, and skipped for a bare greeting so opening
  // a new chat and closing it doesn't litter the list.
  useEffect(() => {
    if (!conversationId || isStreaming) return;
    if (!messages.some((m) => m.role === "user")) return;
    saveConversation({
      id: conversationId,
      title: title === "New Chat" ? deriveTitle(messages) : title,
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      messages,
    });
  }, [conversationId, isStreaming, messages, title]);

  /**
   * Renames a conversation from the history row or the chat's own title.
   * Returns false when refused (blank, or unchanged) so an inline editor knows
   * to put the old name back.
   */
  const rename = useCallback(
    (id: string, next: string) => {
      const name = next.replace(/\s+/g, " ").trim();
      if (!name) return false;
      const isCurrent = id === conversationId;
      if (isCurrent && name === title) return false;
      // A chat with no question yet is not saved, so there is no row to rename —
      // the save effect writes this title when the first turn settles.
      const saved = renameConversation(id, name);
      if (!saved && !isCurrent) return false;
      if (isCurrent) setTitle(name);
      return true;
    },
    [conversationId, title],
  );

  // --- the turn ------------------------------------------------------------

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  /** Streams one turn given the full history to replay. */
  const runTurn = useCallback(async (outbound: ChatMessage[]) => {
    setError(null);
    setStatus("thinking");

    const assistantId = newId();
    setMessages([...outbound, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    const append = (chunk: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
      );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: outbound.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.image ? { image: m.image } : {}),
          })),
        }),
        signal: controller.signal,
      });

      // Failures before the stream opens arrive as a normal JSON error body.
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? `Request failed (${response.status}).`);
      }
      if (!response.body) throw new Error("No response body.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // NDJSON: one JSON object per line. A chunk can split a line anywhere, so
      // the trailing partial stays buffered until its newline arrives.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(line) as StreamEvent;
          } catch {
            continue; // Skip a malformed line rather than killing the turn.
          }

          switch (event.type) {
            case "status":
              setStatus(event.value);
              break;
            case "text":
              append(event.value);
              break;
            case "done":
              setLastTurn({
                usage: event.usage,
                latencyMs: event.latencyMs,
                ttftMs: event.ttftMs,
                truncated: event.truncated,
              });
              break;
            case "error":
              setError(event.message);
              break;
            case "tool_use":
              break;
          }
        }
      }
    } catch (err) {
      // An abort is the user pressing Stop — keep whatever streamed so far.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      abortRef.current = null;
      setStatus("idle");
      // Drop the placeholder if the turn produced nothing, so the transcript
      // never shows an empty bubble.
      setMessages((prev) =>
        prev.filter((m) => !(m.id === assistantId && m.content.length === 0)),
      );
    }
  }, []);

  const send = useCallback(
    (text: string, image?: Attachment, voice?: VoiceNote) => {
      const trimmed = text.trim();
      if ((!trimmed && !image) || isStreaming) return;
      const outbound = [...messages, userTurn(trimmed, image, voice)];
      // The first question names the chat — the same rule the save uses, applied
      // here so the open chat's title shows it immediately, not after a reload.
      if (title === "New Chat") setTitle(deriveTitle(outbound));
      void runTurn(outbound);
    },
    [isStreaming, messages, runTurn, title],
  );

  /**
   * Opens a new conversation *and* asks its first question in one call.
   *
   * The source does `newChat(); usePrompt(s)` because Alpine state is
   * synchronous. Here it cannot be two calls: `send` closes over `messages`,
   * which still holds the previous conversation on the render that queued the
   * new one, so the question would be sent with the wrong history. Building the
   * turn here sidesteps the stale closure entirely.
   */
  const startChatWith = useCallback(
    (text: string, image?: Attachment, voice?: VoiceNote) => {
      const trimmed = text.trim();
      if ((!trimmed && !image) || isStreaming) return;
      abortRef.current?.abort();
      createdAtRef.current = Date.now();
      setConversationId(newId());
      setError(null);
      setLastTurn(null);
      setView("chat");
      const outbound = [greetingMessage(), userTurn(trimmed, image, voice)];
      setTitle(deriveTitle(outbound));
      void runTurn(outbound);
    },
    [isStreaming, runTurn],
  );

  /**
   * Re-asks the last question. Drops every message after the final user turn,
   * so a regenerate from mid-conversation doesn't leave orphaned replies.
   */
  const regenerate = useCallback(() => {
    if (isStreaming) return;
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIndex === -1) return;
    void runTurn(messages.slice(0, lastUserIndex + 1));
  }, [isStreaming, messages, runTurn]);

  // --- per-message actions -------------------------------------------------

  const copy = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1500);
    } catch {
      // Clipboard is permission-gated and fails on insecure origins. The copy
      // silently not happening is better than an error dialog for a nicety.
    }
  }, []);

  /**
   * Thumbs-up. Fire-and-forget to the server so the signal lands in the same
   * structured log stream as the turns themselves — that is what makes it
   * useful later for eval curation rather than a button that does nothing.
   */
  const rate = useCallback(
    (message: ChatMessage) => {
      if (ratedIds.has(message.id)) return;
      setRatedIds((prev) => new Set(prev).add(message.id));
      void fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating: "up",
          conversationId,
          messageLength: message.content.length,
          turnIndex: messages.findIndex((m) => m.id === message.id),
        }),
      }).catch(() => {
        /* feedback is best-effort */
      });
    },
    [conversationId, messages, ratedIds],
  );

  return {
    // panel
    isOpen,
    show,
    hide,
    // navigation
    view,
    title,
    conversationId,
    back,
    newChat,
    openChat,
    history,
    removeConversation,
    rename,
    // conversation
    messages,
    status,
    isStreaming,
    error,
    lastTurn,
    send,
    startChatWith,
    stop,
    regenerate,
    // per-message
    copy,
    copiedId,
    rate,
    ratedIds,
  };
}

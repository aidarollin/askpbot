import type { ChatMessage } from "./types";

/**
 * Conversation history, persisted in localStorage.
 *
 * The source panel shipped a hardcoded history array. This is the real version:
 * conversations are saved as you chat, grouped by date the same way
 * (Today / Yesterday / "May 2026"), and reopen where you left them.
 *
 * localStorage rather than a database because the API route is deliberately
 * stateless and this is a single-user demo — no schema, no auth, no extra
 * service. The tradeoffs are honest ones: history is per-browser, and it does
 * not sync. Moving to a real store means reimplementing this one module.
 *
 * Images are NOT persisted. A base64 image is easily a megabyte and
 * localStorage caps around 5MB, so a couple of screenshots would evict the
 * entire history. Attachments are replaced with a marker on save.
 */

const STORAGE_KEY = "askpbot:conversations:v1";
/** Oldest conversations beyond this are dropped, newest kept. */
const MAX_CONVERSATIONS = 50;

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface HistoryGroup {
  label: string;
  items: StoredConversation[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/*
 * The list is an external store, read with `useSyncExternalStore` (see
 * `useConversations` in usePBot). Writes below notify this tab's subscribers;
 * the `storage` event covers other tabs, so `/` and `/embed` open side by side
 * stay in step. The snapshot is cached against the raw string, because the
 * store contract requires the same array back until something actually changed.
 */
const listeners = new Set<() => void>();
const EMPTY: StoredConversation[] = [];
let cachedRaw: string | null = null;
let cached: StoredConversation[] = EMPTY;

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeConversations(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function conversationsSnapshot(): StoredConversation[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseConversations(raw);
  }
  return cached;
}

/** The server has no history; neither does the hydration pass. */
export function conversationsServerSnapshot(): StoredConversation[] {
  return EMPTY;
}

export function loadConversations(): StoredConversation[] {
  if (!isBrowser()) return [];
  try {
    return parseConversations(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function parseConversations(raw: string | null): StoredConversation[] {
  try {
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tolerate anything malformed rather than throwing on read — a corrupt
    // entry should cost one conversation, not the whole panel.
    return (parsed as StoredConversation[])
      .filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveConversation(conversation: StoredConversation): void {
  if (!isBrowser()) return;
  try {
    const stripped: StoredConversation = {
      ...conversation,
      messages: conversation.messages.map(({ id, role, content, image, imagePlaceholder, voice }) => ({
        id,
        role,
        content,
        // Keep the fact that an image was sent; drop the payload.
        ...(image || imagePlaceholder ? { imagePlaceholder: true } : {}),
        // Keep a voice note's shape and length; its blob: URL dies with the tab.
        ...(voice ? { voice: { seconds: voice.seconds, bars: voice.bars } } : {}),
      })) as ChatMessage[],
    };

    const rest = loadConversations().filter((c) => c.id !== conversation.id);
    const next = [stripped, ...rest]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  } catch {
    // Quota exceeded or storage disabled (private mode, blocked cookies).
    // History is a convenience; losing it must never break the chat.
  }
}

/** Renames one saved conversation in place. A blank name is refused. */
export function renameConversation(id: string, title: string): boolean {
  const name = title.replace(/\s+/g, " ").trim();
  if (!isBrowser() || !name) return false;
  try {
    const all = loadConversations();
    const hit = all.find((c) => c.id === id);
    if (!hit) return false;
    hit.title = name;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function deleteConversation(id: string): void {
  if (!isBrowser()) return;
  try {
    const next = loadConversations().filter((c) => c.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  } catch {
    /* ignore */
  }
}

/** First user message, trimmed to something that fits one line in the list. */
export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content?.trim();
  if (!first) return "New Chat";
  const oneLine = first.replace(/\s+/g, " ");
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Groups into Today / Yesterday / "Previous 7 Days" / month-and-year, in the
 * order the source panel used.
 */
export function groupByDate(conversations: StoredConversation[]): HistoryGroup[] {
  const today = startOfDay(Date.now());
  const day = 86_400_000;
  const groups = new Map<string, StoredConversation[]>();
  const order: string[] = [];

  for (const c of conversations) {
    const at = startOfDay(c.updatedAt);
    let label: string;

    if (at === today) label = "Today";
    else if (at === today - day) label = "Yesterday";
    else if (at > today - 7 * day) label = "Previous 7 Days";
    else {
      label = new Date(c.updatedAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }

    if (!groups.has(label)) {
      groups.set(label, []);
      order.push(label);
    }
    groups.get(label)!.push(c);
  }

  // `conversations` arrives newest-first, so insertion order is already the
  // order we want to render.
  return order.map((label) => ({ label, items: groups.get(label)! }));
}

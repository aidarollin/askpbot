"use client";

import { useState } from "react";
import type { HistoryGroup, StoredConversation } from "@/lib/history";
import { IconMoreVertical, IconTrash } from "./icons";

/**
 * The saved-conversation list, grouped by day.
 *
 * Shared by both surfaces: it is the whole of the panel's home view and the
 * lower half of the web layout's sidebar. Only the container differs, so this
 * renders groups and rows and lets each parent supply its own box — the kebab
 * menu logic exists once rather than twice.
 */

interface PBotHistoryProps {
  history: HistoryGroup[];
  /** Highlights the conversation currently open in the main area. */
  activeId?: string | null;
  onOpenChat: (conversation: StoredConversation) => void;
  onDelete: (id: string) => void;
  emptyText?: string;
}

export function PBotHistory({
  history,
  activeId = null,
  onOpenChat,
  onDelete,
  emptyText = "Your chats will appear here once you start one. 🐼",
}: PBotHistoryProps) {
  // Which row's kebab menu is open. Only ever one at a time.
  const [menuFor, setMenuFor] = useState<string | null>(null);

  if (history.length === 0) {
    return <p className="pbot-history__empty">{emptyText}</p>;
  }

  return (
    <>
      {history.map((group) => (
        <div className="pbot-history__group" key={group.label}>
          <p className="pbot-history__label">{group.label}</p>
          {group.items.map((item) => (
            <div
              className={`pbot-history__item ${item.id === activeId ? "is-active" : ""}`}
              key={item.id}
            >
              <button
                className="pbot-history__open"
                type="button"
                onClick={() => onOpenChat(item)}
                title={item.title}
              >
                {item.title}
              </button>

              {menuFor === item.id ? (
                <button
                  className="pbot-history__menu is-danger"
                  type="button"
                  onClick={() => {
                    onDelete(item.id);
                    setMenuFor(null);
                  }}
                  onBlur={() => setMenuFor(null)}
                  aria-label={`Delete "${item.title}"`}
                  autoFocus
                >
                  <IconTrash size={18} />
                </button>
              ) : (
                <button
                  className="pbot-history__menu"
                  type="button"
                  onClick={() => setMenuFor(item.id)}
                  aria-label={`Options for "${item.title}"`}
                >
                  <IconMoreVertical size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

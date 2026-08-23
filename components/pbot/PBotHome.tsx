"use client";

import type { HistoryGroup, StoredConversation } from "@/lib/history";
import { IconChevronRight } from "./icons";
import { PBotHistory } from "./PBotHistory";

/**
 * The panel's home view: start a new chat, or reopen a saved one.
 *
 * The web layout keeps the same two controls but splits them across its
 * sidebar, so the list itself lives in `PBotHistory` and is shared.
 */

interface PBotHomeProps {
  history: HistoryGroup[];
  onNewChat: () => void;
  onOpenChat: (conversation: StoredConversation) => void;
  onDelete: (id: string) => void;
}

export function PBotHome({ history, onNewChat, onOpenChat, onDelete }: PBotHomeProps) {
  return (
    <div className="pbot-home">
      <button className="pbot-newchat" type="button" onClick={onNewChat}>
        <span>Start New Chat</span>
        <span className="pbot-newchat__chev">
          <IconChevronRight size={16} />
        </span>
      </button>

      <div className="pbot-history">
        <PBotHistory history={history} onOpenChat={onOpenChat} onDelete={onDelete} />
      </div>
    </div>
  );
}

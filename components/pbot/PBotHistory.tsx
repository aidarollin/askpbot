"use client";

import { useRef, useState } from "react";
import type { HistoryGroup, StoredConversation } from "@/lib/history";
import { useScrollFade } from "./behaviors";
import { Btn, Icon, IconBtn } from "./ds";

/**
 * Saved conversations — the source's `_askpbot-history`, shared by the panel's
 * home and the web rail exactly as the source shares it.
 *
 * Empty, it is the DS empty state (3274:127548). Otherwise a card of day-grouped
 * rows, each with a three-dot trigger that flips the ROW ITSELF (DS 4828:88679)
 * to Back / Rename / Delete instead of opening a floating menu, so the list
 * never shifts. Rename (4828:88757) is the composer's own fused field; Delete
 * (4828:88834) asks in the row, naming the chat. Back steps out of rename or
 * delete to the menu first, then closes it.
 *
 * Native overflow scrolling, not the source's ds-scroll pill — see SCOPE.md.
 */

interface PBotHistoryProps {
  history: HistoryGroup[];
  /** Highlights the conversation currently open in the main area. */
  activeId?: string | null;
  onOpenChat: (conversation: StoredConversation) => void;
  onRename: (id: string, title: string) => boolean;
  onDelete: (id: string) => void;
}

type Mode = "menu" | "rename" | "delete";

export function PBotHistory({ history, activeId = null, onOpenChat, onRename, onDelete }: PBotHistoryProps) {
  const [acting, setActing] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [draft, setDraft] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  useScrollFade(boxRef);

  if (history.length === 0) {
    return (
      <div className="pbot-empty">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pbot-empty__art" src="/pbot/askpbot/empty-state.png" alt="" width={108} height={108} />
        <p className="pbot-empty__text">No conversations yet — start a new chat above.</p>
      </div>
    );
  }

  const close = () => {
    setActing(null);
    setMode("menu");
  };
  const back = () => (mode === "menu" ? close() : setMode("menu"));

  return (
    <div className="pbot-history">
      <div className="pbot-history__box" ref={boxRef}>
        <div className="pbot-history__inner">
          {history.map((group) => (
            <div className="pbot-history__group" key={group.label}>
              <p className="pbot-history__label">{group.label}</p>
              {group.items.map((item) => {
                const isActing = acting === item.id;
                return (
                  <div
                    className={`pbot-history__item ${isActing ? "is-acting" : ""} ${item.id === activeId ? "is-active" : ""}`}
                    key={item.id}
                  >
                    {!isActing ? (
                      <>
                        <button
                          className="pbot-history__open"
                          type="button"
                          onClick={() => onOpenChat(item)}
                          title={item.title}
                          aria-current={item.id === activeId ? "true" : undefined}
                        >
                          {item.title}
                        </button>
                        <button
                          className="pbot-history__more"
                          type="button"
                          onClick={() => {
                            setActing(item.id);
                            setMode("menu");
                          }}
                          aria-label={`Options for "${item.title}"`}
                        >
                          <Icon name="more-vertical" size={20} />
                        </button>
                      </>
                    ) : (
                      <div className="pbot-history__acts">
                        <IconBtn variant="secondary" size="m" icon="chevron-left" onClick={back} aria-label="Back" />
                        {mode === "menu" && (
                          <div className="pbot-history__pair">
                            <Btn
                              variant="secondary"
                              size="m"
                              autoFocus
                              onClick={() => {
                                setDraft(item.title);
                                setMode("rename");
                              }}
                            >
                              Rename
                            </Btn>
                            <Btn variant="danger" size="m" onClick={() => setMode("delete")}>
                              Delete
                            </Btn>
                          </div>
                        )}
                        {mode === "rename" && (
                          <form
                            className="pbot-compose__group pbot-rename"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (onRename(item.id, draft) || draft.trim() === item.title) close();
                            }}
                          >
                            <div className="pbot-compose__pill">
                              <input
                                type="text"
                                className="pbot-compose__field pbot-compose__field--input pbot-rename__field"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.stopPropagation();
                                    close();
                                  }
                                }}
                                autoFocus
                                onFocus={(e) => e.currentTarget.select()}
                                aria-label="Chat name"
                                autoComplete="off"
                              />
                            </div>
                            <IconBtn
                              className="pbot-compose__send"
                              variant="primary"
                              size="m"
                              icon="edit"
                              type="submit"
                              disabled={!draft.trim()}
                              aria-label="Save name"
                            />
                          </form>
                        )}
                        {mode === "delete" && (
                          <div className="pbot-history__confirm">
                            <p className="pbot-history__ask">
                              Are you sure you want to delete?{" "}
                              <span>&ldquo;{item.title}&rdquo;</span>
                            </p>
                            <IconBtn
                              variant="delete"
                              size="m"
                              icon="trash-2"
                              autoFocus
                              onClick={() => {
                                onDelete(item.id);
                                close();
                              }}
                              aria-label={`Delete "${item.title}"`}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The open chat's name, renamable in place — the source's `.pbot-orbit__chip`
 * (6193:24390): Enter commits, Escape cancels, blur commits. Used for that chip
 * in the panel and for the web top bar's title.
 *
 * `plaintext-only`, so a paste cannot drop markup into a chat title. The text
 * is written imperatively rather than as children: React must not reconcile a
 * node the user is typing into. A refused edit (blank or unchanged) has to put
 * the old text back by hand for the same reason — nothing re-renders, because
 * `title` never changed.
 */
export function PBotTitle({
  className,
  title,
  onRename,
}: {
  className: string;
  title: string;
  onRename: (next: string) => boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) el.textContent = title;
  }, [title]);

  return (
    <p
      ref={ref}
      className={className}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label="Chat name"
      title="Rename this chat"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          // Kept from the panel's own Escape-to-close.
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.textContent = title;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        if (!onRename(e.currentTarget.textContent ?? "")) e.currentTarget.textContent = title;
      }}
    />
  );
}

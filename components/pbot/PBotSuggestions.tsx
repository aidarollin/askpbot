"use client";

import { useId, useState } from "react";
import { Icon } from "./ds";

/**
 * The starter prompts, in their two places, exactly as the source has them: on
 * the idle hero, where a chip opens a new chat and asks in one gesture; and in
 * a conversation with no question yet, under a "Suggestion" divider that
 * collapses the list (DS 5274:96729).
 */

export const PBOT_SUGGESTIONS = [
  "Explain photosynthesis simply",
  "Give me 5 ideas for a science project",
  "What is the Pythagorean theorem?",
  "Help me plan a study timetable",
] as const;

export function PBotHeroPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="pbot-web__prompts">
      {PBOT_SUGGESTIONS.map((prompt) => (
        <button className="pbot-suggest__chip pbot-web__prompt" type="button" key={prompt} onClick={() => onPick(prompt)}>
          {prompt}
        </button>
      ))}
    </div>
  );
}

export function PBotSuggestions({ onPick }: { onPick: (prompt: string) => void }) {
  const [open, setOpen] = useState(true);
  const listId = useId();
  const toggleId = useId();

  return (
    <div className={`pbot-suggest ${open ? "" : "is-collapsed"}`}>
      {/* The caption IS the collapse control: a real button, wired to the list. */}
      <button
        type="button"
        className="pbot-suggest__divider"
        id={toggleId}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
      >
        <span>
          <Icon name="chevron-down" size={12} />
          Suggestion
        </span>
      </button>
      {open && (
        <div className="pbot-suggest__list" id={listId} role="group" aria-labelledby={toggleId}>
          {PBOT_SUGGESTIONS.map((prompt) => (
            <button className="pbot-suggest__chip" type="button" key={prompt} onClick={() => onPick(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * The starter prompt chips.
 *
 * Ported from the source's `suggestions` array, which the first pass of this
 * port dropped without recording it. They appear in two places, exactly as the
 * source does it: on the hero, where a chip opens a new chat and asks the
 * question in one gesture, and inside a conversation that has no user message
 * yet, where it just fills the turn.
 */

export const PBOT_SUGGESTIONS = [
  "Explain photosynthesis simply",
  "Give me 5 ideas for a science project",
  "What is the Pythagorean theorem?",
  "Help me plan a study timetable",
] as const;

interface PBotSuggestionsProps {
  onPick: (prompt: string) => void;
  /** `pbot-suggest` stacks (in-chat); `pbot-web__prompts` wraps (hero). */
  className?: string;
}

export function PBotSuggestions({ onPick, className = "pbot-suggest" }: PBotSuggestionsProps) {
  return (
    <div className={className}>
      {PBOT_SUGGESTIONS.map((prompt) => (
        <button
          className="pbot-suggest__chip"
          type="button"
          key={prompt}
          onClick={() => onPick(prompt)}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

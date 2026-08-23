import type Anthropic from "@anthropic-ai/sdk";

/**
 * Client-side tool definitions and their executors.
 *
 * There is one tool on purpose. The point is to demonstrate the full
 * round-trip — schema, model-issued call, local execution, tool_result fed
 * back, model continues — with a tool whose correct answer the model provably
 * cannot know on its own. The current time qualifies: it is not in training
 * data and it cannot be guessed, so a wrong answer is unambiguous.
 *
 * It also needs no network and no credentials, which keeps the deployed demo
 * free of a second failure mode.
 */

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_current_time",
    description:
      "Get the current date and time. Call this whenever the answer depends on what the actual date or time is right now — for example 'what day is it', 'how many days until X', or anything about today. Do not guess the current date.",
    input_schema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "IANA timezone name, e.g. 'Asia/Kuala_Lumpur' or 'America/New_York'. Defaults to UTC if the user's timezone is unknown.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

/** Executes a tool call and returns the string sent back as the tool_result. */
export function runTool(name: string, input: unknown): string {
  if (name !== "get_current_time") {
    // Reported back to the model as an error result so it can adapt, rather
    // than thrown — a bad tool name should not fail the whole turn.
    return `Error: unknown tool "${name}".`;
  }

  const timezone =
    typeof input === "object" && input !== null && "timezone" in input
      ? String((input as { timezone: unknown }).timezone)
      : "UTC";

  const now = new Date();

  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "long",
    }).format(now);
    return `${formatted} (timezone: ${timezone}; ISO 8601 UTC: ${now.toISOString()})`;
  } catch {
    // Intl throws RangeError on an unrecognised timezone. Fall back to UTC and
    // tell the model what happened so it can mention it if relevant.
    const utc = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      dateStyle: "full",
      timeStyle: "long",
    }).format(now);
    return `Unknown timezone "${timezone}", so this is UTC instead: ${utc} (ISO 8601 UTC: ${now.toISOString()})`;
  }
}

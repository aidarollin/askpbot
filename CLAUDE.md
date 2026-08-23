@AGENTS.md

# AskPBot

A general-purpose AI chat assistant with a panda-mascot persona ("PBot"),
delivered as a two-column web app at `/`, with the same assistant available as a
docked slide-in panel at `/embed`. Next.js App Router, TypeScript, Tailwind v4.
`README.md` carries the full architecture and the reasoning behind each choice —
read it before changing anything structural.

Both surfaces are ports of the Pandai student-UI Blade/Alpine component, whose
stylesheet ships both shells. The README's "Ported from the Pandai student UI"
section records what was kept, added, dropped, and substituted; keep it accurate
if you change the UI. **An omission nobody wrote down is indistinguishable from
a bug** — that rule is why that section exists.

## Things that will bite you

**`lib/agent.ts` is the single source of truth for a model turn.** Both the chat
route and the eval suite call `runTurn()`. Never inline model parameters into
`app/api/chat/route.ts` or `evals/run.ts` — evals that test a copy of the config
prove nothing.

**Use the official `@anthropic-ai/sdk`**, not the Vercel AI SDK or raw `fetch`.
The reasoning is in the README; the short version is that per-turn `usage`,
`stop_reason: "refusal"`, and adaptive thinking all need the raw response.

**Two error paths in the route, and they are not interchangeable.** Before the
stream opens, fail with an HTTP status. After the first byte the status is locked
at 200, so errors must be emitted as `{"type":"error"}` stream events.

**Do not widen `HIGH_CONFIDENCE_HARM` in `lib/guardrails.ts`.** The patterns are
narrow on purpose — each requires an instruction-request phrasing *and* a
specific harmful object. `guard-prescreen-false-positives` in the eval suite will
fail if they start catching legitimate questions, which is the point of that case.

**`lib/config.ts` is server-only.** Anything the browser also needs goes in
`lib/limits.ts` with a `NEXT_PUBLIC_` env var, or its env override silently
resolves to `undefined` client-side.

**Keep `PROMPT_LEAK_SENTINEL` in sync with `SYSTEM_PROMPT`.** If you reword the
prompt's opening line, update the sentinel or the output leak check goes blind.
`npm run eval:offline` covers this.

**`pbot-open` is a public contract.** Host apps open the panel with
`window.dispatchEvent(new CustomEvent("pbot-open"))`. Don't replace it with
props or context — the event is why the panel drops into an existing app
without touching that app's component tree. The panel is no longer the product
(the web layout is), but it is still routed at `/embed` precisely so this
contract stays exercised instead of rotting as unrendered code.

**`usePBot` takes a `mode`; don't fork it.** `panel` starts closed and locks the
body scroll while open. `page` starts open and must not — a page that locks its
own scroll cannot be scrolled. Everything below the shell is shared, and a fork
would hide exactly that difference until it shipped.

**Don't wire a hero chip as `newChat()` then `send()`.** `send` closes over
`messages`, so on the render that queued the new conversation it still holds the
old one, and the question goes up with the wrong history. `startChatWith` builds
the turn itself for this reason.

**Don't persist images.** `lib/history.ts` strips attachments before writing to
localStorage on purpose: base64 images against a ~5MB quota would evict the
whole history after two screenshots.

**Don't reintroduce `useState` + `useEffect` for the SSR mount guard** in
`PBotPanel`. React 19's lint flags it as a cascading render; `useIsHydrated`
uses `useSyncExternalStore`, which is the correct shape.

## Before committing

```bash
npm run check     # typecheck + lint + offline evals (no API key needed)
npm run eval      # full suite, needs ANTHROPIC_API_KEY, costs a few cents
npm run build
```

## Secrets

`ANTHROPIC_API_KEY` is read server-side only and must never reach a client
component. `.env.local` is gitignored; `.env.example` is the committed template
and must stay in sync when config options change.

## The docs pack

`docs/` is the working memory for this project. Read the relevant page before
changing anything structural, and keep them true afterwards.

| Doc | Read it when |
| --- | --- |
| `docs/PROJECT.md` | You need to know what this is and who it serves |
| `docs/SCOPE.md` | Before adding anything — it names what is deliberately not being built |
| `docs/TECHNICAL-PLAN.md` | Before changing architecture, the stack, or deployment |
| `docs/STATUS.md` | Start of every session, to see the live blockers |
| `docs/RELIABILITY.md` | Before claiming something works |
| `docs/RUNBOOK.md` | Operating or recovering the deployed system |
| `docs/SYSTEM-EXPORT.md` | Handing the whole system to another repo or agent. **Regenerate it when source changes** — it inlines real files |

Rules for keeping them honest, in priority order:

1. **The docs describe what exists, not what is planned.** Anything unbuilt is
   marked unbuilt. A plan doc may look forward; STATUS and RELIABILITY may not.
2. **Never write a command nobody has run.** Unverified steps in the runbook
   carry a not-yet-run marker until someone executes them.
3. **Append to `docs/STATUS.md` every working session, dated that day.** Never
   backdate an entry. A logged gap is fine; a fabricated date is not.
4. **Adding a feature means checking `docs/SCOPE.md` first.** If it is on the
   not-building list, it needs an agreed re-scope entry before any code.
5. **If code and docs disagree, that is a bug in the docs.** Fix it in the same
   change, not later.

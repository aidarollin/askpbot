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

**The provider is two env vars, and they must move together.**
`ANTHROPIC_BASE_URL` unset means Anthropic direct. Pointed at OpenRouter it
serves an Anthropic-compatible `/v1/messages`, so `@anthropic-ai/sdk`, the tool
loop, adaptive thinking, `effort`, `cache_control` and cache-token `usage` all
work unmodified — but model ids there need a provider prefix, so `ASKPBOT_MODEL`
must become `anthropic/claude-sonnet-5`. Set one without the other and every
turn dies with a not-found error.

**The OpenRouter base URL stops at `/api` — no `/v1`.** The SDK appends
`/v1/messages` itself, so OpenRouter's own documented `https://openrouter.ai/api/v1`
resolves to `/api/v1/v1/messages` and 404s. It surfaces as a generic `api_404`
"something went wrong on my end", which points nowhere near the URL.

**A gateway turns a refusal into a thrown request, and `isContentFilterBlock`
in `lib/agent.ts` is what puts it back.** Anthropic direct declines in-band —
HTTP 200, `stop_reason: "refusal"`, model-authored text. Through OpenRouter the
upstream filter can fail the whole request with `content_policy_violation`
instead, which without that mapping reaches the user as a server error rather
than a decline. Keep the check narrow: auth failures, rate limits and outages
must still surface as errors. Note the residual gap — a filter-blocked turn has
no model text, so the decline falls back to fixed copy and cannot reference what
was actually asked. `safety-weapons` in the eval suite fails for exactly this
reason and is **left failing on purpose**; do not reword `REFUSAL_FALLBACK` to
turn it green.

**`.dev.vars` does not give `next dev` an API key — `.env.local` does.** The dev
server prints `Using secrets defined in .dev.vars`, which looks like the key
loaded, and then every chat request returns `500 missing_api_key`.
`initOpenNextCloudflareForDev()` puts those values on
`getCloudflareContext().env`; the chat route reads `process.env`. Deployment is
the opposite and needs no `.env.local`: the adapter's `populateProcessEnv`
copies Cloudflare vars and secrets onto `process.env` per request, so a Worker
**secret** does reach the route. Local and deployed load secrets by different
mechanisms — don't reason from one to the other.

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

**`npm run build` must stay `opennextjs-cloudflare build`, not `next build`.**
Cloudflare deploys the Worker in `.open-next/`, and `next build` only produces
`.next/`. Point the build script at plain `next build` and the hosted deploy
fails with `Could not find compiled Open Next config, did you run the build
command?` — a message that blames the build step while the build step reported
success. `opennextjs-cloudflare build` runs `next build` internally, so one
command covers both; `npm run build:next` is there when you only want the Next
half.

**`buildCommand` in `open-next.config.ts` is load-bearing, and the two settings
are a pair.** `opennextjs-cloudflare build` produces the Next output by shelling
out to the package manager's `build` script — which is itself. Without
`buildCommand: "npm run build:next"` overriding that, `npm run build` recurses
into itself until Node dies with a stack overflow. Change one of these two and
you must change the other: script name, or the `buildCommand` that points past
it. `defineCloudflareConfig()` does not take the option, which is why the config
spreads its result and sets `buildCommand` alongside.

**Keep `initOpenNextCloudflareForDev()` guarded in `next.config.ts`.** The
Cloudflare adapter's scaffold emits it unguarded, and Next loads that file for
`next build` as well as `next dev` — so every build spawns a `workerd` that
outlives it and holds `.open-next` open. The next build then dies with
`EPERM ... rm .open-next`, which reads like a permissions problem and is a
leaked child process. The `NODE_ENV === "development"` guard is load-bearing.
The same `EPERM` also appears for a mundane reason: a **running `npm run dev`**
legitimately holds `workerd` open, so builds fail while dev is up. Stop the dev
server before `npm run build`.

**`.open-next/` and `.wrangler/` must stay in `eslint.config.mjs`'s ignore
list.** They are generated and gitignored, but ESLint's flat config does not
read `.gitignore`. Without the ignores, `npm run check` reports ~15,000 problems
from minified vendor bundles and the pre-commit gate becomes useless noise.

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

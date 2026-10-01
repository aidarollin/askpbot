# TECHNICAL PLAN — AskPBot

_How it is built, why those choices, and what is still undecided._

Last reviewed: 2026-08-23

---

## Stack

Versions are the ones actually installed and building, not intentions.

| Layer | Choice | Version |
| --- | --- | --- |
| Runtime | Node | v24.15.0 |
| Framework | Next.js, App Router | 16.3.1 |
| UI | React | 19.2.8 |
| Language | TypeScript, `strict` | 5.x |
| Styling | Tailwind CSS v4, plus `app/pbot.css` — the Pandai DS rules, **generated** from `pandai.question.uiux` by `npm run design:sync` | 4.x |
| Markdown | `react-markdown` + `remark-gfm` — elements, never an HTML string | 10.1.0 / 4.0.1 |
| Mascot animation | `@rive-app/canvas`, **pinned exact**, WASM self-hosted | 2.38.5 |
| Model access | `@anthropic-ai/sdk` | 0.117.1 |
| Model | `claude-sonnet-5`, adaptive thinking, `effort: medium` | — |
| Eval runner | `tsx` | 4.x |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` | adapter 1.20.2, wrangler 4.125.0 |

## Shape of the system

```
Browser (web layout, or panel)  Server (Next route handlers)
------------------              ----------------------------
usePBot.ts  mode: page|panel    app/api/chat/route.ts
  state machine                   rate limit
  NDJSON stream reader            shape + attachment validation
  localStorage history            content pre-screen
       |                                  |
       |  POST /api/chat                  v
       |------------------------->  lib/agent.ts  -->  Claude API
       |  <---- NDJSON events -----   streaming            |
       |                              tool loop  <---------|
       |                                  |
       |                            lib/tools.ts (get_current_time)
       |                                  |
       |-- POST /api/feedback ---->  structured logs --> stdout
```

**Request path:** either surface, then `POST /api/chat`, then rate limit, shape and
attachment validation, content pre-screen, `runTurn()`, Claude (streaming, with
the tool loop), NDJSON events back, and one structured log line per turn.

## Module responsibilities

| Module | Owns |
| --- | --- |
| `lib/agent.ts` | The model turn: streaming, tool loop, usage accounting. **Single source of truth** — the route and the eval suite both call `runTurn()`. |
| `lib/prompt.ts` | The persona, plus a sentinel used by the leak check. |
| `lib/guardrails.ts` | Shape, attachment, content pre-screen, output leak check. |
| `lib/history.ts` | localStorage conversation store and date grouping. |
| `lib/tools.ts` | Tool schemas and local executors. |
| `lib/ratelimit.ts` | Per-IP sliding window. |
| `lib/config.ts` | Server tuning knobs. **Server-only.** |
| `lib/limits.ts` | Limits the browser also needs, behind `NEXT_PUBLIC_`. |
| `lib/log.ts` | Structured turn and feedback logging. |
| `lib/types.ts` | Wire types and the stream event union — the client/server contract. |
| `components/pbot/*` | Both surfaces. `PBotWeb` is the two-column app at `/`; `PBotPanel` is the docked overlay at `/embed`. They share `usePBot`, `PBotChat`, `PBotTurn`, `PBotComposer`, `PBotHistory`, `PBotSuggestions`, `useVoice` and one stylesheet — the shells differ, nothing below them does. `ds.tsx` emits the source DS's button and icon markup so its CSS applies unchanged. |
| `scripts/pbot-design/*` | The design pipeline: which classes the source renders (`collect-classes.mjs` → `classes.json`), and the extraction of its rules, art, icons and Rive file (`sync.mjs`). Its outputs — `app/pbot.css`, `public/pbot/` — are never hand-edited. |
| `evals/run.ts` | The eval suite. |

## Decisions and their reasons

### `lib/agent.ts` is shared by the route and the evals

Evals that reimplement model parameters pass while production drifts. Both call
the same function, so a change to the model, the prompt, or the effort level is
covered by construction.

### Official Anthropic SDK, not a provider wrapper

Three needed behaviours come off the raw response and are awkward or absent
through a wrapper: per-turn `usage` including cache tokens, the `refusal` stop
reason, and adaptive-thinking configuration. Cost is roughly 90 lines of stream
reading instead of a prebuilt hook. Accepted.

### Adaptive thinking with `effort: medium`

The model decides per message whether reasoning is needed; effort bounds the
depth. Small talk stays cheap, hard questions get room. `medium` because `low`
under-thinks multi-step questions and `high` adds latency a chat UI feels.
Moved by one env var.

### NDJSON, not SSE

One JSON object per line. Small structured payloads, a plain `fetch` reader
either way, and no `data:` framing to parse. The event union lives in
`lib/types.ts`, so the two sides cannot drift silently.

### Two error paths, deliberately

Before the response body opens, failures return a real HTTP status
(400, 429, 500). After the first byte the status is locked at 200, so failures
travel in-band as `error` events. Both render identically in the panel. This is
the most common streaming-chat bug.

### The content pre-screen is narrow on purpose

A broad keyword blocklist mostly generates false positives — "how do bombs work
in Minecraft", or a nurse asking about nerve-agent symptoms — and each one is a
real user refused by a regex that cannot read context. The model reads context;
the regex cannot. The `guard-prescreen-false-positives` eval fails if anyone
widens the patterns.

### Two shells, one state machine

`usePBot` takes a `mode` rather than being forked. `panel` starts closed, opens
on `pbot-open`, and locks the host page's scroll while open; `page` starts open
and does neither, because a page that locks its own scroll is unusable. Forking
the hook would have duplicated the stream reader and the persistence effect, and
that scroll lock is exactly the kind of difference a fork hides until someone
tries to scroll the deployed site.

The web layout keeps history on screen permanently, so `view` there selects only
what fills the main column. In the panel, `view` swaps the whole surface. That
is the one structural difference between them.

**`startChatWith` is not redundant with `send`.** A hero chip must open a new
conversation *and* ask its question. The source writes `newChat(); usePrompt(s)`
and gets away with it because Alpine state is synchronous; in React, `send`
closes over `messages`, which still holds the previous conversation on the
render that queued the new one — so the chip would send the question with the
wrong history attached. `startChatWith` builds the turn itself.

### Stateless server, client-side history

No session store, no sticky routing, any instance serves any turn. History lives
in `localStorage`, read through `useSyncExternalStore` so every write reaches
every surface (and other tabs, via the `storage` event). Tradeoffs accepted:
per-browser, no sync, and attachments stripped before saving, because base64
images against a 5MB quota would evict the history after two screenshots. A
voice note keeps its waveform and transcript but not its clip, a `blob:` URL
that dies with the tab anyway.

### Voice is transcribed in the browser

No audio input exists on this API path, so a voice note is recorded for the
bubble and, in parallel, transcribed by the Web Speech API; the transcript is
the turn and takes the typed-text path through every guardrail. Nothing new
reaches the server — the request shape is unchanged. Costs: no Firefox, and
Chrome's recogniser sends the audio to Google.

### The design is extracted, not re-implemented

`sync.mjs` keeps a source rule only when every class in its selector is one the
source renders in a state this app ships, so dropped features (Math Drill,
ds-scroll, the report modals) fall out without hand-pruning, and the components
reproduce the source markup class for class. A port that re-typed the CSS was
tried first (2026-08) and could only drift. The cost is a build-time dependency
on a sibling checkout of `pandai.question.uiux` — only to *re-sync*; the outputs
are committed, so building and deploying need nothing from it.

### Panel keeps brand colours in dark mode

It is a fixed-identity surface floating over a host app whose theme it does not
control. A dark azure panel is a different product, not a dark variant. The host
page does follow the system theme.

---

## Where this deploys — decided 2026-08-23

**Cloudflare Workers, via `@opennextjs/cloudflare`.** Option A below was taken;
the rest of this section is kept because the reasoning is what a reviewer will
ask about, and because the alternatives are what a re-scope would reverse to.

Built and verified locally before it was committed: `opennextjs-cloudflare
build` produces `.open-next/worker.js`, and `wrangler dev` serves it on the real
Workers runtime with both pages, validation, NDJSON streaming and the in-band
error path all behaving as they do under Node. **Not yet deployed** — that needs
a Cloudflare login, which is an account action.

| Requirement | State |
| --- | --- |
| Claude Code | Met |
| GitHub | **Met** — pushed 2026-08-23 |
| AWS or Cloudflare | **Met in configuration**, pending the actual deploy |
| N8N | **Unmet** — no workflow exists |
| MCP server, where relevant | **Unmet** — none built or wired |

### The decision as it stood

The capstone brief requires the real toolchain: Claude Code, GitHub, an MCP
server where relevant, AWS or Cloudflare, and N8N. The product brief supplied at
kickoff specified **Vercel**, which is neither AWS nor Cloudflare. Three
checklist items are currently unmet.

| Requirement | State | Gap |
| --- | --- | --- |
| Claude Code | Met | The entire build was driven through it |
| GitHub | Pending | Repo is local, not yet pushed |
| AWS or Cloudflare | **Unmet** | Plan targets Vercel |
| N8N | **Unmet** | No workflow exists |
| MCP server, where relevant | **Unmet** | None built or wired |

### Options

**A — Cloudflare Workers via `@opennextjs/cloudflare` (recommended).**
Runs this Next.js app on Workers through an adapter. Satisfies the platform
requirement, and a Cloudflare account already exists from Week 0 setup. Cost: an
adapter in the build path, and duration semantics differ from Vercel's, so the
streaming route needs re-verifying after the move. Cloudflare KV also makes the
shared-store rate limiter nearly free, which retires a known limitation.

**B — AWS.** Lambda plus API Gateway, or Amplify Hosting. Heavier setup, more
IAM surface, and streaming responses through API Gateway need care. Choose only
if AWS specifically is wanted.

**C — Stay on Vercel and argue the exception.** Fastest path to a live URL, but
knowingly fails a checklist line. Only viable with the mentor's written
agreement recorded in the SCOPE.md re-scope log.

**Recommendation: A.** It is the smallest change that closes the platform gap,
and it makes a second gap cheaper to close as well.

### Closing the N8N and MCP gaps without inventing busywork

Both have a genuinely relevant use here rather than a box-ticking one.

- **N8N — scheduled reliability checks.** A workflow that runs on a schedule,
  hits the deployed chat endpoint with a fixed probe set, asserts a streamed
  reply and a successful tool call, and alerts on failure. That is the same
  thing RELIABILITY.md asks for, so it is a deliverable and a requirement at
  once.
- **MCP — an eval and log server.** A small MCP server exposing two tools: run
  the eval suite, and query recent turn logs. That makes the operational surface
  reachable from Claude Code during development, which is the "where relevant"
  test rather than a decorative integration.

Neither is built. Both are sized at roughly half a day each.

---

## Configuration

All server knobs are env-overridable; `.env.example` carries the full list with
defaults. The only required variable is `ANTHROPIC_API_KEY`.

Anything the browser also needs lives in `lib/limits.ts` behind a
`NEXT_PUBLIC_` prefix. `lib/config.ts` is server-only — importing it from a
client component would bundle server config into the browser and silently
resolve its env vars to `undefined`.

## Data handling

- The API key is read server-side only and never reaches the browser.
- No message content is logged. Logs carry shapes, counts, and timings only,
  which is what makes them safe to forward to a log drain.
- Conversation content stays in the user's own browser.
- Attachments are sent to the model and are never persisted anywhere.

## Planned — live web retrieval (not built)

> **Status: designed, not implemented.** Nothing in this section exists in the
> codebase. Agreed as a re-scope on 2026-08-23 (see `SCOPE.md`), sequenced to
> start after the first successful deploy. It is here so the build is
> mechanical rather than exploratory; it is fenced so nobody reads it as a
> description of the running system.

### What it adds

PBot gains the ability to search the web and read pages when an answer depends
on current information, and to cite what it used. The persona, the panel, and
the general-purpose framing are unchanged.

### Why there is no retrieval infrastructure

`web_search_20260209` and `web_fetch_20260209` are **Anthropic-hosted server
tools**, available on `claude-sonnet-5`. They are declared in the `tools` array
and execute on Anthropic's infrastructure; results arrive as content blocks in
the same response. There is no crawler to run, no HTML to clean, no chunker, no
embedding model, no vector store, and no reranker — so none of those appear
here, and none of them appear in the dependency list.

The tradeoff is stated in `SCOPE.md`: this is the opposite of a self-hosted
retrieval stack, and two features that depend on owning the fetch — cache-drift
telemetry and force-re-crawl — are dropped rather than faked.

### Changes, by module

| Module | Change |
| --- | --- |
| `lib/tools.ts` | Declare both server tools alongside `get_current_time`. **They must not be routed through `runTool()`** — that function exists for client-side execution, and a server tool never reaches it. |
| `lib/agent.ts` | Handle the new result blocks and the `pause_turn` stop reason. Emit citation events. |
| `lib/types.ts` | Add a `citation` variant to the `StreamEvent` union. |
| `lib/config.ts` | `MAX_TOOL_ITERATIONS` 4 → 6; add a retrieval on/off switch and a per-turn `max_uses` cap. |
| `lib/guardrails.ts` | Injection mitigations — see below. |
| `components/pbot/*` | A citation drawer, and a source count on turns that used retrieval. |
| `evals/run.ts` | New cases — see below. |

### Four things that will bite whoever builds this

1. **`pause_turn` is not `end_turn`.** The loop in `lib/agent.ts` currently
   breaks on any stop reason that is not `tool_use`. A server tool can return
   `pause_turn`, meaning the turn is resumable and unfinished. Left unhandled,
   long retrievals silently truncate mid-answer with no error. `pause_turn`
   must continue the loop, not exit it.

2. **Server-tool errors arrive as HTTP 200.** A failed search is not a thrown
   exception; it is a `web_search_tool_result` block whose content is an error
   object. On success that content is a **list**; on error it is an **object**.
   Indexing before branching on the shape is the obvious crash.

3. **Do not also declare `code_execution`.** The `_20260209` variants run code
   execution internally for dynamic filtering. Declaring a second execution
   environment alongside them degrades the model's tool selection.

4. **`MAX_TOOL_ITERATIONS` is the multi-hop budget.** It is not a safety valve
   any more; it is the feature. Too low and multi-step questions truncate
   after the first hop; too high and a pathological turn burns tokens. 6 is the
   starting point, and it is env-overridable, so tune it against real turns
   rather than guessing again here.

### Citations

Set `citations: {enabled: true}` on the `web_fetch` declaration. Cited passages
come back with `cited_text` and the source URL, which is exactly what the drawer
renders — no separate quote-verification pass is needed, because the citation is
produced by the same call that read the page.

The panel will show the extracted passage and a link out. It will **not**
iframe the source: most documentation sites send `X-Frame-Options` or a
`frame-ancestors` CSP, so an embedded preview would be a broken grey box on the
sites users care about most.

### Pinned domains

A per-session list of domains maps to `allowed_domains` on the tool
declarations. This needs no store and no expiry — the list travels with the
request, so it is naturally ephemeral. `allowed_domains` and `blocked_domains`
are mutually exclusive; sending both is a validation error.

### Guardrails — the part that is not optional

Fetched pages are untrusted third-party text entering the model's context.
Replies render as markdown (since 2026-10-02), but as React elements with raw
HTML dropped and unsafe link schemes stripped — not as HTML. Retrieval is the
same injection argument against a larger surface, so the mitigations ship
**with** the feature:

- Domain policy defaults to a blocklist, configurable per deployment.
- The existing output leak check runs unchanged — `PROMPT_LEAK_SENTINEL` is
  what catches a page that talked the model into reciting its instructions.
- Turn logs record host names and result counts. Not page content, consistent
  with the existing rule that no message content is logged.
- Markdown stays element-only. Retrieval must not add `rehype-raw` or any other
  route from model text to live HTML.

### Evals

The offline half cannot cover any of this — every path runs server-side — so the
new cases are model cases, and they cannot run until blocker 1 clears:

| Case | Asserts |
| --- | --- |
| `retrieval-triggers-on-current-events` | A question about recent information calls `web_search` rather than answering from training data |
| `retrieval-skips-on-general-knowledge` | Small talk and settled facts do **not** trigger a search — the false-positive guard, mirroring `guard-prescreen-false-positives` |
| `retrieval-cites-sources` | A retrieved answer emits at least one citation event with a resolvable URL |
| `retrieval-multi-hop` | A comparative question produces more than one loop iteration |
| `retrieval-survives-tool-error` | An error-shaped tool result degrades to a useful answer instead of crashing the turn |

### Cost

Server-side search and fetch are billed separately from model tokens, and fetched
page content enters the context as input tokens — so a retrieval turn costs
materially more than a chat turn. **Not yet measured; no figure is quoted here
because nobody has run one.** First real numbers go in `RELIABILITY.md` after
blocker 1 clears. The per-turn `max_uses` cap is the blast-radius control until
then.

## Known technical debt

Carried deliberately, with the reason and the trigger to fix.

| Debt | Why it is acceptable now | Trigger to fix |
| --- | --- | --- |
| In-memory rate limiter, per-instance | Stops one tab hammering the API, which is the demo's actual threat | Any real traffic, or a move to Cloudflare where KV makes it cheap |
| LLM judge is the same model family it grades | Directional smoke test for tone, not an oracle | If persona regressions start slipping through |
| The design is a snapshot of the source | `app/pbot.css` names its source commit; re-syncing is one command | Whenever the AskPBot design changes upstream |
| `@rive-app/canvas` pinned exact | Its WASM is copied into `public/` and must match the JS | Upgrade both together: bump the version, `npm install`, `npm run design:sync` |
| Leak check runs post-turn, not mid-stream | Intercepting mid-stream means buffering, which defeats streaming | Not planned; the tradeoff is the right one |

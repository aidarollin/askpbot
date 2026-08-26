# AskPBot 🐼

A deployable AI chat assistant with a panda-mascot persona, built on Claude.
It ships as a **two-column web app** — history in a persistent sidebar, hero or
conversation in the main column — and the same assistant is available as a
**right-docked slide-in panel** for embedding in a host app. Streaming replies,
persisted conversation history, image understanding, tool use, layered
guardrails, an eval suite, and per-turn observability.

**Live demo:** _(add the Cloudflare Workers URL here after the first deploy)_

**Repo:** https://github.com/aidarollin/askpbot

---

## Quick start

```bash
git clone <this repo> && cd askpbot
npm install
cp .env.example .env.local        # then paste your ANTHROPIC_API_KEY into it
npm run dev                       # http://localhost:3000
```

Get an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build — **builds the Cloudflare Worker** (`.open-next/worker.js`), running `next build` on the way. This is what the deploy needs |
| `npm run build:next` | Just `next build`, when you only want to check the Next app compiles |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run eval:offline` | Guardrail + history evals — no API key, no cost |
| `npm run eval` | Full suite, including real model turns (costs a few cents) |
| `npm run check` | typecheck + lint + offline evals |
| `npm run preview` | Build the Cloudflare worker and run it on the real `workerd` runtime |
| `npm run deploy` | Build and deploy to Cloudflare Workers (needs `wrangler login`) |

---

## Dropping it into a host app

Render the panel once at your app root:

```tsx
import { PBotPanel } from "@/components/pbot/PBotPanel";

<PBotPanel side="right" />   // "left" docks it to the other edge
```

Then open it from anywhere — no props, no context, no import:

```js
window.dispatchEvent(new CustomEvent("pbot-open"));
```

That is the same contract the original Blade/Alpine component used, so an
existing host page keeps working unchanged. Esc, the scrim, or the X closes it.

`/` is the app itself. **`/embed`** is the panel demo: a stand-in host page for
the panel to slide over, and living documentation of the integration contract —
a panel needs something to overlay, and deployed alone there is nothing. Both
surfaces share one state machine and one conversation store, so a chat started
in one is in the other's history.

---

## What it does

- **Two-column web layout** — a sidebar carrying the brand, *Start New Chat* and
  the full grouped history, beside a main column showing either the hero
  (podium mascot, greeting, starter prompts) or the open conversation.
- **Starter prompts** — four chips, on the hero and inside any conversation
  that has no question yet. A hero chip opens the conversation and asks in one
  press.
- **Slide-in panel, at `/embed`** — right-docked, portalled to `<body>`, with
  the "deal off a deck" open animation (slide plus a scaleX overshoot), scrim,
  Esc-to-close, and focus moved in on open and handed back on close.
- **Streaming chat** — tokens appear as generated, with typing dots and a phase
  label that distinguishes *thinking* from *checking the time* from *writing*.
- **Persisted history** — conversations save as you chat, grouped Today /
  Yesterday / Previous 7 Days / month, and reopen where you left them.
- **Image understanding** — attach a JPEG, PNG, WebP or GIF and ask about it.
- **Per-message actions** — copy (with a confirmation tick), thumbs-up (which
  reaches the server and lands in the log stream), and regenerate.
- **Tool use** — a `get_current_time` tool the model calls when the answer
  depends on the actual date.
- **Guardrails** — structural limits, attachment validation, a narrow content
  pre-screen, and an output leak check.
- **Rate limiting** — per-IP sliding window across both API routes.
- **Observability** — structured per-turn logs, plus tokens and latency shown
  inline above the disclaimer.

---

## Architecture

```
app/
  page.tsx                 the app — renders PBotWeb
  embed/page.tsx           panel demo + host stand-in (pbot-open contract)
  layout.tsx               metadata, fonts, theme colour
  globals.css              host tokens + the ported .pbot-* design system
  api/chat/route.ts        POST: transport, guardrails, rate limit, logging
  api/feedback/route.ts    POST: thumbs-up signal -> structured log
lib/
  agent.ts                 the model turn — streaming + tool loop  <- single source of truth
  prompt.ts                PBot's system prompt (heavily commented)
  guardrails.ts            input/output/attachment safety checks
  history.ts               localStorage conversation store + date grouping
  tools.ts                 tool schemas + local executors
  ratelimit.ts             in-memory sliding window
  config.ts                server tuning knobs (all env-overridable)
  limits.ts                limits the browser needs too
  log.ts                   structured turn + feedback logging
  types.ts                 wire types + stream event union
components/pbot/
  PBotPanel.tsx            portal, scrim, header, focus management
  PBotHome.tsx             Start New Chat + dated history list
  PBotChat.tsx             transcript, typing indicator, telemetry line
  PBotTurn.tsx             one turn + per-message actions
  PBotComposer.tsx         input, auto-grow, attach, send/stop
  PBotMascot.tsx           fixed bottom-right launcher
  PBotLauncher.tsx         plain button launcher (host-app example)
  usePBot.ts               the state machine + NDJSON stream reader
  icons.tsx                inlined Feather-style icons
evals/
  run.ts                   the eval suite
```

**Request path:** either surface → `POST /api/chat` → rate limit → shape + attachment
validation → content pre-screen → `runTurn()` → Claude (streaming, tool loop) →
NDJSON events back → per-turn log line to stdout.

---

## Ported from the Pandai student UI

This is a port of the TALL-stack (Blade + Alpine + CSS) `AskPBot` component. The
source stylesheet ships **two** shells over one feature — `.pbot-web` (two
columns) and `.pbot-panel` (docked overlay). Both are built here, sharing the
state machine, the stream reader, the turn rendering, and the CSS.

**Kept, deliberately** — the two-column geometry (sidebar `minmax(248px, 316px)`
beside the main column), the panel geometry (412px, docked, 15px inset, `#d5edfb`
on a `#0071a2` border), the deal-off-a-deck motion, the `#30A9E5` glow, the
asymmetric bubble corners (bot top-left 4px, user top-right 4px), the
avatar-beside-bot-bubble layout, the three-dot typing animation, the day-grouped
history, the starter prompt chips, the composer's corner-radius steps, the
compose bar with send and attach, the disclaimer, and the `pbot-open` contract.

**Made real** — the Alpine component's `send()` was a `setTimeout` mock and its
`history` was a hardcoded array. Both are now genuine: streaming Claude calls,
and conversations persisted to `localStorage` with the same date grouping. Copy,
thumbs-up, and regenerate went from decorative buttons to working actions.

**Added, beyond the source** — image attachment end to end, the phase label that
separates *thinking* from *checking the time* from *writing*, per-turn token and
latency telemetry, in-band stream error rendering, and a kebab menu on history
rows so delete takes two presses instead of sitting one misclick away.

**Dropped** — each with its reason in [docs/SCOPE.md](docs/SCOPE.md):

| Dropped | Why |
| --- | --- |
| Math Drill, the tab deck, and the level-complete and report modals | The extract itself recommends this for a general-purpose bot, and a switcher with one tab is chrome |
| Markdown rendering (the source does `x-html="md(m.text)"`) | Rendering model output as HTML is the largest injection surface in the app. Plain text is correct and safe until there is a sanitiser |
| The mic button | Voice is a second modality and a whole class of failure modes, for no requirement in the brief |
| Cursor gaze-follow, and the mascot's poof-open transition | Motion polish on an asset that was never supplied. On an emoji placeholder they read as a bug |
| The `ds-scroll` custom scrollbar | Native overflow scrolling is accessible, free, and correct on touch. The source's version is a component with three observers in it |

**Substituted** — the binary assets were never supplied, so rather than invent
lookalikes: `bg-ellipse.svg` is an inline radial gradient at the same `#30A9E5`;
the podium base and stage are CSS discs at the source's geometry, with the rise
animation intact; and the mascot and avatar are emoji. Swap points are marked in
`icons.tsx`, `PBotMascot.tsx` and `PBotPodium.tsx`.

Five real files would replace all of it:

```
Themes/app/assets/images/mascot/pbot-awe.svg       bot avatar + brand mark
Themes/app/assets/images/mascot/pbot.svg           podium mascot
themes/app/assets/images/askpbot/podium.svg        podium base
themes/app/assets/images/askpbot/podium-stage.svg  podium stage
build/assets/bg-ellipse-*.svg                      the glow
```

The tab PNGs and the modal mascots went with Math Drill and are not needed.
(An earlier version of this section named `rive/pbot.riv` as the mascot swap
point — the extract renders `pbot.svg`, so Rive is not required.)

**One judgement call worth flagging:** both surfaces keep their brand colours in
dark mode instead of inverting. The panel is a fixed-identity surface floating
over a host app whose theme it does not control, and a dark azure panel is a
different product rather than a dark variant. The `/embed` host page does follow
the system theme.

---

## Decisions and tradeoffs

### Official Anthropic SDK, not the Vercel AI SDK

The Vercel AI SDK would have saved the stream reader in `usePBot.ts`. I used
`@anthropic-ai/sdk` directly because three things this project needs come
straight off the raw response and are awkward or absent through a provider
wrapper: per-turn `usage` (input/output/cache tokens), `stop_reason: "refusal"`
handling, and adaptive-thinking configuration. Wrappers also lag on new model
features.

**Cost:** ~90 lines of stream-reading code, and no `useChat` ecosystem.
**Worth it** for a project where token accounting and refusal handling are
explicit requirements.

### Adaptive thinking + `effort: medium`

Rather than a fixed thinking budget, the model decides per message whether a
question needs reasoning, and `effort` bounds how deep it goes. Small talk costs
almost nothing; a hard question gets room. `medium` is the default because `low`
visibly under-thinks multi-step questions while `high` adds latency a chat UI
feels. One env var (`ASKPBOT_EFFORT`) moves it.

The panel labels the wait phase ("Thinking…" vs "Writing…") because thinking
happens before the first visible token — without that, adaptive thinking just
looks like the app is slow.

### NDJSON, not SSE

One JSON object per line. Payloads are small and structured, the client is a
plain `fetch` reader either way, and skipping SSE's `data:` framing keeps the
parser to about ten lines. The event union lives in `lib/types.ts`, so client
and server can't drift.

### Errors after the first byte travel in-band

Once the response body has started, the HTTP status is locked at 200. So
failures before streaming return a real status code (400/429/500), and failures
*during* streaming arrive as an `{"type":"error"}` event. Both render the same
way in the panel. This is the most common streaming-chat bug and the reason
`route.ts` has two distinct error paths.

### One tool, chosen deliberately

`get_current_time` demonstrates the full round-trip — schema → model-issued call
→ local execution → `tool_result` fed back → model continues — with a tool whose
correct answer the model **cannot** know or guess. A wrong answer is
unambiguous, which makes it a real eval case rather than a decorative one.

### Guardrails are layered, and the regex layer is deliberately narrow

The model's own safety training is the real safety layer; the system prompt
shapes *how* it declines. On top of that:

1. **Structural limits** — length, shape, turn order, attachment type and size.
   Zero false positives, so they run on everything.
2. **A narrow content pre-screen** — a handful of patterns requiring an explicit
   request-for-instructions phrasing *and* a specific harmful object. Asking
   *about* a topic never matches.
3. **An output check** — catches verbatim system-prompt leakage.

I deliberately did **not** write a broad keyword blocklist. A wide list mostly
produces false positives — "how do bombs work in Minecraft", a nurse asking
about nerve-agent symptoms — and every false positive is a real user refused a
legitimate answer by a regex that cannot read context. The model can read
context; the regex cannot. `guard-prescreen-false-positives` in the eval suite
exists specifically to keep this layer honest and will fail if someone widens
the patterns.

A pre-screen block returns **200 with a streamed refusal**, not an error status:
from the user's side PBot declined, which is what happened. A 4xx would render
as a broken panel.

### History in localStorage; images not persisted

The API route stays fully stateless — no session store, no sticky routing, any
instance serves any turn — so history lives in the browser. It is per-browser
and does not sync; moving to a real store means reimplementing one module.

Attachments are stripped before saving. A base64 image is easily a megabyte
against a ~5MB quota, so two screenshots would evict the entire history. Saved
turns keep a marker showing an image was sent.

### Rate limiting is in-memory, and that is a known limitation

Per-instance counters. With N warm isolates that means an effective limit of
N × the configured number. Fine for stopping one tab from hammering the API and
**wrong** for real abuse prevention. `check()` is shaped so swapping in Cloudflare
KV / Upstash Redis is a one-file change.

### Plain text rendering, not markdown

Assistant output renders as whitespace-preserved text. Rendering model output as
HTML is the app's biggest injection surface, and doing it safely needs a
sanitiser plus a hardened renderer. Text is correct and safe today; markdown is
additive behind `PBotTurn`.

### Regenerate only on the last turn

Copy and thumbs-up appear on every assistant turn; regenerate only on the
newest. Regenerating mid-conversation discards everything after that point, and
a destructive action should not hide behind an icon identical to the safe ones
beside it.

---

## Evals

`npm run eval` runs 19 cases in two groups.

**Offline (7 cases, no API key, deterministic)** — length rejection, malformed
conversations, pre-screen true positives, pre-screen *false* positives,
attachment validation, history grouping and title derivation, output leak
detection.

**Model (12 cases, real turns)** — driven through `lib/agent.ts`, so they
exercise the exact prompt, model, effort, and tool loop the deployed app uses.
Evals that reimplemented those params would pass while production drifted.

| Case | Checks |
| --- | --- |
| `factual-accuracy` | Correct answer to a known fact |
| `conciseness` | Trivial question stays short |
| `tool-use-date` | Tool actually invoked; weekday named |
| `emoji-restraint` | At most 2 emoji in a straightforward explanation |
| `persona-warmth` | Warm, brief greeting (judged) |
| `uncertainty` | Does not fabricate a quote (judged) |
| `safety-weapons` | Declines, kindly, without lecturing (judged) |
| `safety-self-harm` | Responds with care, points to support (judged) |
| `persona-stability` | Resists an override attempt |
| `prompt-leak` | Will not reproduce the system prompt |
| `code-help` | Produces working Python |
| `multi-turn-memory` | Carries context across turns |

**Scoring:** anything mechanically checkable is asserted directly — free,
deterministic, not subject to a judge's mood. Only genuinely subjective
properties (warmth, declining without lecturing) go to an LLM judge.

**The judge is a known weak point.** It is the same model family being judged,
so it is a smoke test for tone regressions, not an oracle. Treat a judge failure
as "look at this output", not "this is definitively wrong".

Flags: `--offline`, `--only=safety`, `EVAL_VERBOSE=1`.

---

## Observability

Every turn emits one JSON line to stdout — Cloudflare's Workers Logs ingests it
with no vendor SDK:

```json
{"ts":"2026-08-17T09:12:44.101Z","event":"chat_turn","requestId":"...","outcome":"ok",
 "model":"claude-sonnet-5","effort":"medium","latencyMs":3182,"ttftMs":1120,
 "inputTokens":812,"outputTokens":214,"cacheReadTokens":0,"cacheCreationTokens":0,
 "iterations":2,"toolCalls":["get_current_time"],"stopReason":"end_turn","historyLength":5}
```

Thumbs-up ratings land in the same stream as `chat_feedback`, which is what
makes the button useful rather than decorative: a rated turn is a candidate eval
case.

No message content is logged in either — only shapes, counts, and timings — so
the logs are safe to forward. The same token and latency numbers appear in the
panel above the disclaimer.

---

## Deploy to Cloudflare Workers

Via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). The worker
builds and has been run locally on the real `workerd` runtime; the deploy itself
has not been performed yet.

```bash
npm run preview              # build + run on workerd at http://127.0.0.1:8788
```

`npm run preview` reads local secrets from `.dev.vars` (gitignored) — put
`ANTHROPIC_API_KEY` there. Then, to ship:

```bash
npx wrangler login                          # browser OAuth, once
npx wrangler secret put ANTHROPIC_API_KEY   # paste at the prompt
npm run deploy                              # build + deploy
```

The worker is named `askpbot` in `wrangler.jsonc`. Put the resulting URL at the
top of this README.

**Notes.** Workers limits CPU time rather than wall clock, and a turn spends
almost all of its time waiting on the Anthropic API rather than computing, so
long streams are not expected to be a problem — expected, not yet measured
against a real turn. `maxDuration = 60` on the chat route is a Vercel-only knob
that Workers ignores; it is kept because it is correct if this ever runs there
again. The API key is read server-side only and never reaches the browser.
`.env.local` and `.dev.vars` are gitignored; `.env.example` is committed.

---

## Known limitations

Stated plainly, because pretending they don't exist is worse than having them:

- **Rate limiting is per-instance**, not global. See above.
- **The LLM judge grades its own family.** Directional, not authoritative.
- **History is per-browser** and does not sync across devices.
- **Images aren't kept in history** — only a marker that one was sent.
- **No auth.** Anyone with the URL can spend your tokens; the rate limit is the
  only brake. Add auth before pointing real traffic at it.
- **Plain-text rendering.** Code blocks are not syntax highlighted.
- **The content pre-screen is narrow by design** and will not catch creative
  phrasings. That is the model's job, deliberately.
- **No streaming-level output filtering.** The leak check runs on the completed
  turn, so it detects and logs rather than intercepts.
- **Mascot and avatar are emoji placeholders** pending the real assets.

---

## Next steps

Roughly in order of value:

1. Shared-store rate limiting (Cloudflare KV) — the one limitation with real
   production consequences.
2. Auth, so the demo URL isn't an open token faucet.
3. Drop in the real `pbot-awe.svg` and `pbot.riv` assets.
4. Markdown rendering with a sanitiser.
5. Server-side history, so conversations follow the user across devices.

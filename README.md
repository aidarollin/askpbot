# AskPBot 🐼

A deployable AI chat assistant with a panda-mascot persona, built on Claude.
It ships as a **two-column web app** — history in a persistent sidebar, hero or
conversation in the main column — and the same assistant is available as a
**right-docked slide-in panel** for embedding in a host app. Streaming replies,
persisted conversation history, image understanding, tool use, layered
guardrails, an eval suite, and per-turn observability. The look is the Pandai
student UI's own AskPBot design — its stylesheet, art and animated PBot —
synced from `pandai.question.uiux` rather than redrawn.

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
| `npm run design:sync` | Re-pull the AskPBot design from a `pandai.question.uiux` checkout beside this repo — see *Ported from the Pandai student UI* |
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
On closing, the panel fires `pbot-closed` on `window` — the floating PBot uses
it to come back from his "poof", and a host can listen for it the same way.

`/` is the app itself. **`/embed`** is the panel demo: a stand-in host page for
the panel to slide over, and living documentation of the integration contract —
a panel needs something to overlay, and deployed alone there is nothing. Both
surfaces share one state machine and one conversation store, so a chat started
in one is in the other's history.

---

## What it does

- **Two-column web layout** — one deep-space field: a rail carrying the Ask PBot
  card, *Start a New Chat* and the grouped history, beside a main pane with one
  top bar over either the idle hero (PBot waving, the question typed in,
  starter prompts, a composer) or the open conversation.
- **The panel's UI on a phone** — below 764px, `/` is the panel itself rather
  than the two columns stacked: home (the card, PBot on his pod, *Start a New
  Chat*, the saved chats), then a full-screen chat. Full-bleed to 480px, the
  source's 412px card centred above that. Same state, so resizing across the
  line keeps the open conversation.
- **Starter prompts** — four chips, on the hero and inside any conversation
  that has no question yet. A hero chip opens the conversation and asks in one
  press.
- **Slide-in panel, at `/embed`** — right-docked, portalled to `<body>`, with
  the "deal off a deck" open animation (slide plus a scaleX overshoot), scrim,
  Esc-to-close, and focus moved in on open and handed back on close.
- **Streaming chat** — tokens appear as generated, with typing dots and a phase
  label that distinguishes *thinking* from *checking the time* from *writing*.
- **Persisted history** — conversations save as you chat, grouped Today /
  Yesterday / Previous 7 Days / month, and reopen where you left them. Each row
  flips in place to Back / Rename / Delete; the open chat's name is also
  editable where it is shown (top bar, panel chip).
- **Markdown replies** — bold, lists, code, links and tables, rendered as React
  elements, never as an HTML string.
- **Voice notes** — record, review with a live waveform and playback, send. The
  browser transcribes the take and the words are the turn; the bubble keeps the
  waveform, the clip, and what was heard.
- **Image understanding** — attach a JPEG, PNG, WebP or GIF and ask about it;
  tap the sent picture to open it in a viewer.
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
  layout.tsx               metadata, fonts (Poppins for PBot), theme colour
  globals.css              host page tokens; imports the two below
  pbot.css                 GENERATED — the source design system's own rules
  pbot-host.css            what this app adds on top (host fit + our extra parts)
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
  PBotWeb.tsx              the web page: rail, top bar, idle hero; the panel UI on a phone
  PBotPanel.tsx            the docked panel: portal, scrim, focus management; and
                           PBotPanelBody, its inside (hero, home, chat), shared with the phone page
  PBotChat.tsx             the chat screen both surfaces share
  PBotTurn.tsx             one turn: text / markdown / image / voice bubble + actions
  PBotComposer.tsx         field, send/stop, image, voice bar (chat + hero variants)
  PBotHistory.tsx          empty state, or the card of rows with the in-row menu
  PBotSuggestions.tsx      starter prompts (hero, and collapsible in-chat)
  PBotTitle.tsx            the open chat's name, renamable in place
  PBotMarkdown.tsx         reply markdown -> React elements
  PBotRive.tsx             PBot, animated (Rive canvas, self-hosted WASM)
  PBotMascot.tsx           the floating PBot launcher
  PBotLauncher.tsx         plain button launcher (host-app example)
  ds.tsx                   DS primitives: Icon, Btn, IconBtn — the source's markup
  behaviors.ts             button bounce, scroll-edge fades, typewriter
  useVoice.ts              recorder, waveform, transcription, playback
  usePBot.ts               the state machine + NDJSON stream reader
  useMediaQuery.ts         a media query as an external store (null until hydrated)
scripts/pbot-design/
  sync.mjs                 pulls CSS, art, icons and the Rive file from the source
  collect-classes.mjs      records which classes the source renders (input to sync)
  classes.json             that record
public/pbot/               GENERATED — art, icon sprite, pbot.riv, rive.wasm
evals/
  run.ts                   the eval suite
```

**Request path:** either surface → `POST /api/chat` → rate limit → shape + attachment
validation → content pre-screen → `runTurn()` → Claude (streaming, tool loop) →
NDJSON events back → per-turn log line to stdout.

---

## Ported from the Pandai student UI

This is a port of the TALL-stack (Blade + Alpine + CSS) `AskPBot` component in
`pandai.question.uiux`. That source ships **two** shells over one feature —
`.pbot-web` (the two-pane page, `lab/askpbot`) and `.pbot-panel` (the docked
slide-in). Both are built here, sharing the state machine, the stream reader,
the chat screen, the history, and the CSS — the same sharing the source does
with its `_askpbot-chat` and `_askpbot-history` partials.

### How the design gets here

The design is **synced, not redrawn**. The first port (2026-08) re-typed the
source's CSS into `globals.css` with emoji standing in for art that had not been
supplied. On 2026-10-02 it was replaced by a pipeline:

1. `scripts/pbot-design/collect-classes.mjs` drives the running source app
   through every state this port ships — idle hero, chat, streaming, the history
   row's menu / rename / delete, a voice take, an image and its viewer, the
   panel — and records every class the DOM actually carries. Rendered DOM, not a
   grep of the Blade files, because `<x-btn>` expands into classes the templates
   never mention.
2. `npm run design:sync` keeps every source rule whose selector uses only those
   classes, plus the design tokens and keyframes they reference — and the
   source's responsive tiers of those tokens (`:root` inside `@media`, e.g.
   titles dropping 18px → 16px below 764px) — and writes `app/pbot.css` with a
   header naming the source commit. It copies the art the
   rules and the components reference into `public/pbot/`, cuts the 424KB icon
   sprite down to the 17 glyphs used, and copies `pbot.riv`.
3. The React components emit the **source's markup, class for class**, so those
   rules apply unchanged. `components/pbot/ds.tsx` is the source's `<x-icon>`,
   `<x-btn>` and `<x-icon-btn>`.

`app/pbot.css` is generated: never edit it. A host-specific fix goes in
`app/pbot-host.css`, which says for each rule whether it adapts the source to
this app (no Pandai header to subtract, no Alpine `x-show`) or styles a part
the source does not have.

### What came over, and what did not

**Kept** — the deep-space field with its spheres, glows, sparkles, grid and
watermark; the rail with the Ask PBot card; the single top bar; the idle hero
with PBot in his halo and the question typed in; the bubbles drawn from the DS
border-image art, with PBot's analysing avatar and the student's face; the
latest-reply shine; the collapsible in-chat suggestions; the composer's fused
field-and-send, the mic and image buttons and the disclaimer; the image chip
and viewer; the voice bar and voice bubble; the history card with its in-row
Back / Rename / Delete; the panel's slide-in, podium and chat header with the
renamable chip; the floating PBot and his poof; the DS push-button bounce; the
soft scroll edges; and the `pbot-open` contract.

**Made real** — the source's `send()` streams a mock and its replies are
canned. Here they are streaming Claude calls. Its history was localStorage
already; here it is also an external store, so the rail updates as you chat and
other tabs follow. Its voice notes are recorded but never understood; here they
are transcribed (below) and the words are the turn.

**Added, beyond the source** — the phase label that separates *thinking* from
*checking the time* from *writing*; per-turn token and latency telemetry;
in-band stream errors; a character count near the input limit; the transcript
under a voice bubble; editing the chat's name from the web top bar; and
thumbs-up, which reaches `/api/feedback`.

**Changed, on purpose:**

| Source | Here | Why |
| --- | --- | --- |
| `x-html="md(text)"` — a regex escaper | `react-markdown`, no raw HTML | The source escapes `& < >` but not `"`, so a link URL in model output can break out of its `href`. React elements have no such seam — see *Markdown, as elements* below |
| Thumbs-down opens a "What's Wrong?" report | Thumbs-up, logged | The report modal posts nowhere real; the existing feedback route takes a rating. Not ported, not refused — not chosen in the 2026-10-02 re-scope |
| Up to 4 images a message | One | The API's message shape takes one image. The chip row renders in its single-chip layout |
| Hero copy in Malay ("Apa kita nak belajar hari ini?") | English | The persona is tuned and evaluated in English; see *Internationalisation* in SCOPE.md |
| The student's real avatar | The DS's illustrated default | No accounts here, so no one to picture |
| The rail's tab deck toggles Ask PBot ⇄ Math Drill | One card, not a control | Math Drill is not built |
| Below 764px the lab page stacks the rail above the pane — one long scroll, the chat a screen down | `/` renders the panel's UI instead: the source's phone panel to 480px, its 412px card centred above, with no close or maximize | Asked for on 2026-10-02. The panel is the source's own phone design; on a full page there is nothing to close to or maximize into, as the source's `.pbot-panel--page` also drops them |
| PBot's Rive WASM from the package default (unpkg) | Self-hosted at `/pbot/rive/rive.wasm` | No third-party fetch on page load. `@rive-app/canvas` is pinned exact because the WASM is copied from it |

**Dropped** — each with its reason in [docs/SCOPE.md](docs/SCOPE.md):

| Dropped | Why |
| --- | --- |
| Math Drill, the tab deck's second card, and the level-complete and report modals | General-purpose bot; a switcher with one tab is chrome |
| The `ds-scroll` custom scrollbar | Native overflow scrolling is accessible, free, and correct on touch |
| Cursor gaze-follow | Removed from the source's launcher too ("dont make it interact with mouse") |
| The Pandai app chrome around the lab page (header, pill nav, footer) | It is the host app's, not AskPBot's |

**One judgement call worth flagging:** both surfaces keep their brand colours in
dark mode instead of inverting — `sync.mjs` skips the source's `dark.css`. The
panel is a fixed-identity surface floating over a host app whose theme it does
not control, and a dark azure panel is a different product rather than a dark
variant. The `/embed` host page does follow the system theme.

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

**This did not lock the app to one vendor.** Since 2026-09-02 traffic runs
through OpenRouter, which serves an Anthropic-compatible `/v1/messages` — the
SDK, the tool loop, adaptive thinking, `effort`, `cache_control` and the
cache-token fields of `usage` all work there unchanged. It is two env vars
(`ANTHROPIC_BASE_URL` + a provider-prefixed `ASKPBOT_MODEL`), and unset still
means Anthropic direct. The one measured difference is safety declines: the
gateway's filter blocks before generation, so a declined turn has no
model-authored text and falls back to fixed copy. See `docs/RELIABILITY.md`.

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

### History in localStorage; images and voice clips not persisted

The API route stays fully stateless — no session store, no sticky routing, any
instance serves any turn — so history lives in the browser. It is per-browser
and does not sync; moving to a real store means reimplementing one module.
Components read it through `useSyncExternalStore`, so every save, rename and
delete reaches every surface, and the `storage` event carries it across tabs.

Attachments are stripped before saving. A base64 image is easily a megabyte
against a ~5MB quota, so two screenshots would evict the entire history. Saved
turns keep a marker showing an image was sent. A voice note keeps its waveform,
length and transcript; its clip is a `blob:` URL that dies with the tab, so a
reopened chat shows the bubble with playback disabled.

### Rate limiting is in-memory, and that is a known limitation

Per-instance counters. With N warm isolates that means an effective limit of
N × the configured number. Fine for stopping one tab from hammering the API and
**wrong** for real abuse prevention. `check()` is shaped so swapping in Cloudflare
KV / Upstash Redis is a one-file change.

### Markdown, as elements

Replies render as markdown (re-scoped in 2026-10-02 — until then they were plain
text, for the reason below). Model output is the app's biggest injection
surface, so the renderer never produces an HTML string: `react-markdown` builds
React elements, raw HTML in a reply is dropped as text (no `rehype-raw`), its
default `urlTransform` strips `javascript:` and other unsafe link targets,
links open in a new tab with `noopener noreferrer`, and an image in a reply
becomes a link rather than a fetch. That is what the source's own `md()` got
wrong, and why it was not ported.

### Voice notes go through the browser's speech recognition

No audio reaches the model — this API path takes text and images. A voice note
is recorded (for the bubble and playback) *and* transcribed by the Web Speech
API in parallel, and the transcript is the turn. It passes the same guardrails
as typed text. Two costs, stated: Firefox has no Web Speech API, so the mic says
so there rather than recording something PBot cannot hear; and in Chrome the
recognition runs on Google's servers — the browser's implementation, not this
app's, but the audio does leave the device. A take with no recognised words is
refused rather than sent.

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
- **Images and voice clips aren't kept in history** — only a marker that an
  image was sent, and a voice note's waveform and transcript.
- **Voice notes need the Web Speech API** — Chrome, Edge, Safari; not Firefox.
  Chrome sends the audio to Google for recognition.
- **No auth.** Anyone with the URL can spend your tokens; the rate limit is the
  only brake. Add auth before pointing real traffic at it.
- **Code blocks are not syntax highlighted.**
- **The content pre-screen is narrow by design** and will not catch creative
  phrasings. That is the model's job, deliberately.
- **No streaming-level output filtering.** The leak check runs on the completed
  turn, so it detects and logs rather than intercepts.
- **The design is a snapshot.** `app/pbot.css` matches the source commit in
  its header; `npm run design:sync` has to be re-run (with the source app
  running, for `collect-classes.mjs`, if new states appear) to follow it.

---

## Next steps

Roughly in order of value:

1. Shared-store rate limiting (Cloudflare KV) — the one limitation with real
   production consequences.
2. Auth, so the demo URL isn't an open token faucet.
3. Server-side history, so conversations follow the user across devices.

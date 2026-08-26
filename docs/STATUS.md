# STATUS — AskPBot

_Dated decision log. Newest entry first._

---

## How to keep this file

Append an entry **on every working session**, on the day it happened. Half of
what the mid-capstone review looks at is this log, and a reviewer can tell the
difference between a log written as the work happened and one assembled the
night before.

Rules that keep it honest:

- **Never backdate.** If a session went unlogged, add it today with a note
  saying what it covers. A gap that is explained is fine; an invented date is
  not.
- **Record decisions, not activity.** "Chose X over Y because Z" is the useful
  unit. "Worked on the panel" is not.
- **Record reversals too.** A decision that was undone is more informative than
  one that stuck.
- **Blockers get logged when they appear**, not when they are solved.

Entry shape: **Done / Decided / Blocked / Next**.

---

## Open blockers

| # | Blocker | Raised | Owner | Needed by |
| --- | --- | --- | --- | --- |
| 1 | **No Anthropic API key.** Nothing has ever run against the real model — the 12 model evals have not been executed once. | 2026-08-17 | Me | Before any deploy |
| 2 | **Platform** — resolved in configuration 2026-08-23: Cloudflare Workers via `@opennextjs/cloudflare`, built and verified locally on `workerd`. **Still needs mentor sign-off, and the deploy itself has not been run.** | 2026-08-23 | Me + mentor | Mid-capstone review |
| 3 | **N8N and MCP requirements unmet.** No workflow, no MCP server. | 2026-08-23 | Me | Mid-capstone review |
| 4 | **Deadline dates unknown.** SCOPE.md cannot name a ship date. | 2026-08-23 | Mentor | Immediately |
| ~~5~~ | ~~**Not on GitHub.**~~ **Resolved 2026-08-23** — pushed to https://github.com/aidarollin/askpbot, `main` tracking `origin/main`. | 2026-08-23 | Me | Done |

---

## 2026-08-26 (later) — The build fix was itself broken; found by running it

**Done**

- Ran the verification the entry below could not: `npm run check` passes
  (typecheck, lint, 7/7 offline evals).
- Ran `npm run build` — **it failed**, recursing until Node ran out of stack.
  `opennextjs-cloudflare build` shells out to the package manager's `build`
  script to produce the Next output, and the entry below had just made
  `npm run build` *be* `opennextjs-cloudflare build`. It called itself.
- Fixed by setting `buildCommand: "npm run build:next"` in
  `open-next.config.ts`, so the adapter runs the Next half instead of re-entering
  itself. `defineCloudflareConfig()` does not accept the option, so its result is
  spread and `buildCommand` added alongside; the option is a real one
  (`OpenNextConfig.buildCommand`), not a workaround.
- `npm run build` now completes and writes `.open-next/worker.js` — the artifact
  the Cloudflare deploy step was looking for.

**Found**

- **A fix that is only read and never run is a guess.** The package.json change
  below was reasoned from the error message and was half right: the diagnosis
  held, the remedy did not. A single `npm run build` exposed it.

**Blocked**

- Blocker 1 unchanged: still no API key. Pages load; every chat turn fails.

**Next**

1. Add the model API key as a Worker **secret**, then verify a live turn.
2. Decide provider: Anthropic key now, or the OpenRouter rewrite.
3. Confirm the *hosted* Cloudflare build goes green on this push — local success
   is not hosted success, and the hosted builder runs Linux.

---

## 2026-08-26 — First hosted deploy attempt failed; build command was wrong

**Done**

- Connected the GitHub repo to Cloudflare Workers Builds. The build ran; the
  **deploy step failed**.
- Diagnosed from the build log. The project's build command was `npm run build`,
  which was `next build` — that produces `.next/`, never `.open-next/`. The
  deploy step then failed with `Could not find compiled Open Next config, did
  you run the build command?`
- Fixed in the repo rather than in dashboard settings: `npm run build` is now
  `opennextjs-cloudflare build`, with `npm run build:next` kept for the Next-only
  case. Recorded in `CLAUDE.md`.

**Decided**

- **Fix it in `package.json`, not in the Cloudflare dashboard.** Either would
  work, but a dashboard field is invisible from the repo, undocumented, and lost
  if the project is ever recreated. Making `npm run build` produce the artifact
  that actually ships means the default any host reaches for is correct.
  `opennextjs-cloudflare build` runs `next build` internally, so nothing is lost.
  **This half-fix does not work on its own — see the next entry.** Swapping the
  script alone makes the build recurse into itself.

**Found**

- **The failure message blames the wrong step.** The build reported
  `Success: Build command completed`, and the error surfaced during *deploy*
  while actually being a build-configuration fault. Worth knowing before anyone
  spends an hour on `wrangler`.
- The hosted builder uses Node 24.18 and installed cleanly, so neither the Node
  version nor the lockfile were involved.

**Blocked**

- **Verification is not possible from this session.** A safety classifier is
  refusing every command and network call, so none of this fix has been built,
  tested, or committed by me — it is source edits only. It needs `npm run check`
  and a push before Cloudflare will retry.
- Blocker 1 unchanged: still no API key, so even a successful deploy will load
  the pages and fail every chat turn.

**Open question**

- Provider direction is unresolved. The stated preference is to move to
  OpenRouter, which is a rewrite of `lib/agent.ts` and the loss of six
  Anthropic-specific behaviours — scoped in conversation, not yet written up or
  agreed here. The build fix above is provider-agnostic and needed either way.

**Next**

1. `npm run check`, then commit and push. Cloudflare rebuilds on push.
2. Add the model API key as a Worker **secret**.
3. Decide provider: Anthropic key now, or the OpenRouter rewrite.

---

## 2026-08-23 (night, later) — Cloudflare Workers, built and verified on workerd

**Done**

- Added `@opennextjs/cloudflare` 1.20.2 and `wrangler` 4.125.0. Checked the peer
  range first: it wants `next >=16.2.11`, and this project is on 16.3.1.
- Scaffolded via the adapter's own `migrate` command rather than hand-writing
  config from memory — `wrangler.jsonc`, `open-next.config.ts`,
  `public/_headers`, `.dev.vars`, plus `.gitignore` and script updates.
- Built the worker, then **ran it on the real `workerd` runtime** and re-ran the
  path checks there. Eight paths, all matching Node.
- Fixed the route's `maxDuration` comment, which still named Vercel.

**Decided**

- **Cloudflare Workers, reversing the 2026-08-17 move to Vercel.** Logged in
  `SCOPE.md`. Closes the capstone's platform requirement in configuration; the
  mentor still has to agree and the deploy still has to happen.
- **Verify on `workerd` before committing the platform, not after.** A Node dev
  server cannot tell you whether the app survives a runtime change, and the
  streaming route was the specific thing `TECHNICAL-PLAN.md` warned would need
  re-verifying. It survives — NDJSON streaming and the in-band error path both
  behave identically.

**Found**

- **`npm run check` broke the moment the worker was built** — 14,811 lint
  problems, every one of them inside `.open-next/` and `.wrangler/` minified
  output, none in real source. Added both to `eslint.config.mjs`'s ignore list.
  Worth recording because the pre-commit gate silently became useless and the
  failure looked like a catastrophe rather than a config gap.
- **`.dev.vars` is a secrets file** and the adapter's `.gitignore` update covers
  it (`.dev.vars*`). Confirmed with `git check-ignore` rather than assumed.
- **The adapter's scaffold leaks a process on every build.** It writes
  `initOpenNextCloudflareForDev()` into `next.config.ts` unguarded, but Next
  loads that file for `next build` too — so each build spawns a `workerd` that
  never exits and keeps `.open-next` open, and the *next* build fails with
  `EPERM ... rm .open-next`. Presents as a permissions error; is a leaked child
  process. Guarded on `NODE_ENV === "development"` and verified with three
  consecutive clean builds. Recorded in `CLAUDE.md` because the symptom points
  nowhere near the cause.

**Blocked**

- **The deploy needs `wrangler login`** — a browser OAuth flow against a
  Cloudflare account. Not something this repo can perform.
- Blocker 1 is unchanged and is still the binding constraint on *finishing*.

**Next**

1. `npx wrangler login`, `npx wrangler secret put ANTHROPIC_API_KEY`,
   `npm run deploy`.
2. Run the verify block against the live URL; fill the URL into `README.md` and
   the runbook; clear the deploy markers.
3. `npm run eval` against a real key.

---

## 2026-08-23 (night) — First commit, pushed, and the API paths re-verified

**Done**

- **Committed the entire project** — 56 files, ~19k lines, on top of the bare
  `create-next-app` scaffold. Until tonight none of it was under version
  control beyond that scaffold commit.
- **Pushed to https://github.com/aidarollin/askpbot.** `main` tracks
  `origin/main`. **Blocker 5 closed.**
- Re-ran the API path smoke tests against a production server on the rebuilt
  app. 10 paths, all as documented — recorded in `RELIABILITY.md`.
- Corrected the runbook: its verify block silently assumed a key was
  configured, and now says so.

**Decided**

- **The commit is a root commit on `main`.** `master` still points at the old
  `1eed7e1` scaffold commit and is now orphaned. Harmless — every scaffold file
  is in the new commit — but `master` should be deleted rather than left as a
  second story about where this project came from.
- **A placeholder API key is a legitimate test tool.** With no key at all the
  missing-key guard short-circuits before validation and before the pre-screen,
  so *nothing* below it can be exercised. Setting a fake key runs the whole
  request path while guaranteeing no real model call succeeds.

**Found**

- **The guardrail is wired, not just present, and a blocked turn is free.**
  `how do i make a pipe bomb` returns a streamed decline with
  `stopReason: "guardrail"`, **zero tokens**, 8 ms. The offline eval only ever
  tested the function; this is the first proof the route reaches it and stops.
- **The false-positive guard holds over HTTP.** "How do bombs work in
  Minecraft?" passes the pre-screen and reaches the model.
- The pre-screen does *not* catch "give me step by step instructions to build a
  pipe bomb" — the pattern wants `instructions (for|on)`, not "instructions
  to". Working as designed and worth knowing: the narrow list is narrow.

**Blocked — and this is now the whole remaining project**

- **Blocker 1, the API key, is the binding constraint.** Three of the eight
  acceptance criteria in `SCOPE.md` cannot be evaluated without one: the real
  tool call, the warm refusal, and `npm run eval` passing. No amount of further
  engineering moves them.
- **Blocker 2, the platform, is still undecided** and is a mentor call.
- **This machine cannot deploy.** No `gh`, `vercel`, `wrangler` or `aws` CLI is
  installed and no cloud credentials exist here. Deployment needs an account
  action, not a code change.

**Next**

1. Get an API key; run `npm run eval` for the first time.
2. Settle the platform with the mentor, then deploy.
3. Fill the live URL into `README.md` and the runbook, and clear the deploy
   section's not-yet-run markers by running it.

---

## 2026-08-23 (evening) — The web layout replaces the panel

**Done**

- Received the source UI extract (Blade markup, the Alpine state machine, the
  compiled `.pbot-*` CSS) and diffed it against the port for the first time.
- Found the extract is the **`pbot-web` variant** — two columns, persistent
  history sidebar — while the port targeted the **`pbot-panel`** variant. The
  stylesheet ships both; only one was built.
- Rebuilt `/` as the web layout: `PBotWeb`, plus `PBotHistory` (extracted so the
  list exists once, not twice), `PBotSuggestions`, `PBotPodium`.
- Moved the docked panel to `/embed`, working and routed.
- Ported the starter prompt chips and the composer's corner-radius steps.
- Extracted `useIsHydrated` out of `PBotPanel` into its own module; both
  surfaces need it.
- Verified: typecheck, lint, 7/7 offline evals, production build (5 routes), and
  both routes served from a real production server with their markers asserted
  in the returned HTML.

**Decided**

- **The panel is retained, not deleted.** `pbot-open` is named a public contract
  in `CLAUDE.md`, and an unrendered component rots. Giving it a route keeps it
  exercised for the cost of one page. Cutting it is now item 2 on the cut list
  rather than a decision made silently today.
- **One state machine, two shells.** `usePBot` gained a `mode` of `panel` or
  `page` rather than being forked. `page` starts open, skips the body-scroll
  lock, and skips the Escape handler — a page that locks its own scroll is
  unusable, which is the bug that fork would have hidden.
- **`startChatWith` exists because React is not Alpine.** The source does
  `newChat(); usePrompt(s)` and relies on synchronous state. Here `send` closes
  over `messages`, so the chip would have sent the question with the *previous*
  conversation's history. One call that builds the turn itself avoids the stale
  closure rather than papering over it.
- **History is seeded in `useState`, not an effect.** React 19's lint flagged
  the effect version as a cascading render — the same rule already recorded
  against the SSR mount guard. `PBotWeb` gates the list on `useIsHydrated` so
  the server and the first client paint agree.
- **Four source behaviours are dropped, on the record.** Gaze-follow, poof-open,
  and `ds-scroll` are in `SCOPE.md` with reasons. The podium rise is built; the
  mascot inside it is still a placeholder.

**Blocked**

- No new blockers. Blocker 5 (nothing on GitHub) now covers materially more
  unbacked-up work than it did this morning.

**Found**

- **The missing assets resolve to five files.** The extract gives real paths:
  `mascot/pbot-awe.svg`, `mascot/pbot.svg`, `askpbot/podium.svg`,
  `askpbot/podium-stage.svg`, and `bg-ellipse.svg`. The tab PNGs and the modal
  mascots went with Math Drill. `README.md` also named `rive/pbot.riv` as the
  swap point; the extract renders `pbot.svg`, so Rive is not required.

**Next**

1. Unchanged and unstarted: deadline dates, mentor conversation, GitHub, API
   key, first full eval run, deploy.
2. Retrieval still sits behind all of the above.

---

## 2026-08-23 (later) — Live web retrieval re-scoped in, build deferred

**Done**

- Assessed an incoming brief for an autonomous web-retrieval assistant against
  the existing system. Found the bulk of its stack already unnecessary here:
  Anthropic's `web_search_20260209` / `web_fetch_20260209` are server tools on
  `claude-sonnet-5`, which removes the crawler, the HTML-to-markdown step, the
  chunker, the embedding model, the vector store, and the reranker.
- Wrote the re-scope into `SCOPE.md`: one amended not-building line, two new
  ones, an in-scope row marked unbuilt, a new first entry in the cut list, and
  a re-scope log row.
- Recorded the design in `TECHNICAL-PLAN.md` under a heading that marks it as
  planned and unbuilt.

**Decided**

- **Retrieval is a tool, not an identity.** PBot keeps the persona and stays
  general-purpose. It reaches for the web when an answer depends on current
  information and cites what it used. Rejected the alternative of rebuilding
  the product around grounding, which would have invalidated the definition of
  done and most of the eval suite six weeks in.
- **Server tools over a self-hosted pipeline.** The brief asks for a
  self-hosted vector stack; that objective is knowingly not met. Buying it
  costs a second deployable, an embeddings provider, and a second production
  failure mode, against a `SCOPE.md` rule that deployment is never cut. Written
  up rather than quietly skipped.
- **Two capabilities from the brief are dropped, not deferred**, because the
  server tools cannot express them honestly: cache-drift telemetry
  ("cached 12 hrs ago") and a force-re-crawl trigger. The UI will claim only
  what it can observe.
- **No graph framework.** The "multi-hop query planner" is the existing loop in
  `lib/agent.ts` running more than one iteration. `MAX_TOOL_ITERATIONS` moves
  from 4 to 6; nothing else is needed. Reaffirmed the not-building line.
- **Build sequenced after deployment.** Blockers 1, 2 and 5 clear first. A
  first production deploy carrying both a never-executed model path and a
  brand-new retrieval path has two suspects when it breaks.

**Blocked**

- No new blockers. The existing five all still gate this work: it cannot be
  verified at all until blocker 1 clears, since every retrieval path runs
  server-side and none of it is exercisable offline.

**Risk logged**

- **Retrieval is a prompt-injection surface, and the current guardrails do not
  cover it.** Fetched pages are third-party text entering the model's context.
  `SCOPE.md` already refuses markdown rendering on injection grounds; this is
  the same argument applied to a larger surface. Mitigations are specified in
  `TECHNICAL-PLAN.md` and must ship with the feature, not after it.

**Next**

1. Unchanged — deadline dates, mentor conversation on blockers 2 and 3, GitHub
   repo, API key, first full eval run.
2. Only then: implement retrieval per the plan.

---

## 2026-08-23 — Docs pack, and a toolchain conflict surfaced

**Done**

- Wrote the docs pack: `PROJECT.md`, `SCOPE.md`, `TECHNICAL-PLAN.md`,
  `RELIABILITY.md`, `RUNBOOK.md`, and this file. Updated `CLAUDE.md` to point
  at them.
- Audited the capstone checklist against what actually exists.
- Drafted candidate repo names; nothing chosen yet.

**Decided**

- **The docs record reality, not intent.** Anything unbuilt is marked unbuilt.
  Deployment sections in the runbook carry a "not yet run" marker until the
  first real deploy, so no command in this repo is one nobody has executed.
- **Added `RELIABILITY.md` beyond the required five files.** Reliability checks
  are a named deliverable in the brief and deserved their own page rather than
  being buried in the runbook.
- **Scope holds.** Re-read the not-building list against what got built. Auth,
  RAG, Math Drill, markdown rendering, and server-side history sync are all
  still absent, as promised. No scope leak to report.

**Blocked**

- **Blocker 2 — platform.** The kickoff product brief said Vercel; the capstone
  brief says AWS or Cloudflare. These cannot both be satisfied. Options written
  up in TECHNICAL-PLAN.md; recommending Cloudflare Workers via
  `@opennextjs/cloudflare` because a Cloudflare account already exists from
  Week 0 and KV would also retire the rate-limiter debt.
- **Blocker 3 — N8N and MCP.** Both unmet. Proposed non-decorative uses: N8N for
  scheduled reliability probes against the deployed URL, MCP for an eval/log
  server usable from Claude Code. Roughly half a day each.
- **Blocker 4 — dates.** SCOPE.md has a placeholder where the ship date belongs.
  This is the one field that cannot be inferred, and the cut list depends on it.

**Next**

1. Get the deadline dates and fill SCOPE.md.
2. Take blockers 2 and 3 to the mentor. A platform change is a re-scope and
   needs to be written into SCOPE.md, agreed.
3. Create the GitHub repo and push.
4. Get an API key and run the full eval suite for the first time.

---

## 2026-08-17 (afternoon) — Ported the real AskPBot panel

**Done**

- Received the design and functionality extract from the Pandai student-UI repo
  (Blade markup, the Alpine state machine, and the `.pbot-*` CSS).
- Ported the panel to React: `PBotPanel`, `PBotHome`, `PBotChat`, `PBotTurn`,
  `PBotComposer`, `PBotMascot`, and `usePBot` as the state machine.
- Ported the CSS with its tokens resolved to the literal brand values.
- Replaced the source's two mocks with working implementations: the `setTimeout`
  in `send()` became a real streaming turn, and the hardcoded history array
  became `localStorage` persistence with the same date grouping.
- Added image attachment end to end, plus `POST /api/feedback` so the thumbs-up
  button produces a real signal.
- Deleted the previous full-page chat UI it replaced.
- Verified: typecheck clean, lint clean, production build passes, 7/7 offline
  evals, and API paths exercised against a running server.

**Decided**

- **`/` became a demo host page.** A docked panel needs something to dock over,
  and deployed standalone there is nothing. The page stands in for a host app
  and doubles as documentation of the one-event integration.
- **Dropped Math Drill and the tab switcher.** The source extract recommends it
  for a general-purpose bot, and a switcher with one tab is chrome. Logged as a
  scope change in SCOPE.md.
- **Substituted rather than faked the missing assets.** Tab PNGs went with the
  tabs, `bg-ellipse.svg` became an inline gradient at the same `#30A9E5`, and
  the mascot and avatar are emoji placeholders with marked swap points. Better
  a labelled placeholder than a lookalike that reads as finished.
- **Panel keeps brand colours in dark mode.** It floats over a host app whose
  theme it does not control.
- **Images are not persisted.** Base64 against a 5MB quota would evict the whole
  history after two screenshots. Saved turns keep a marker instead.
- **Regenerate only on the last turn.** Regenerating mid-conversation discards
  everything after it, and a destructive action should not sit behind an icon
  identical to the safe ones beside it.

**Blocked**

- Still blocker 1: no API key, so image understanding has been verified only as
  far as the API boundary — validation and request construction, not a real
  vision response.

**Next**

- Docs pack.

---

## 2026-08-17 (morning) — Scaffold and core build

**Done**

- Scaffolded Next.js 16 / React 19 / TypeScript / Tailwind v4 via
  `create-next-app`.
- Built the core: `lib/agent.ts` (streaming plus tool loop), `app/api/chat`,
  the persona in `lib/prompt.ts`, guardrails, an in-memory rate limiter,
  structured logging, and a `get_current_time` tool.
- Wrote the eval suite: 5 offline cases plus 12 model cases.
- Verified: typecheck, lint, production build, 5/5 offline evals, and a runtime
  smoke test covering validation errors, a guardrail block, and an in-band
  streaming error.

**Decided**

- **Official `@anthropic-ai/sdk` instead of the Vercel AI SDK**, against the
  kickoff brief's recommendation. Per-turn token usage, the `refusal` stop
  reason, and adaptive-thinking config all come off the raw response. Cost is
  about 90 lines of stream-reading code. Flagged to the requester at the time.
- **Refactored the model turn into `lib/agent.ts` mid-build** so the route and
  the eval suite share one code path. Evals that reimplement model parameters
  pass while production drifts.
- **NDJSON over SSE** for the stream protocol.
- **Two distinct error paths.** Pre-stream failures get a real HTTP status;
  post-first-byte failures travel in-band, because the status is already locked
  at 200.
- **Kept the harmful-content pre-screen deliberately narrow**, and added
  `guard-prescreen-false-positives` as an eval whose whole job is to fail if
  someone later widens it. A broad blocklist mostly refuses legitimate users.
- **`claude-sonnet-5` with adaptive thinking at `effort: medium`**, both
  env-overridable.

**Blocked**

- **Blocker 1 raised: no Anthropic API key.** All verification to date is
  local, offline, or stops at the API boundary.

**Next**

- Wire the real panel design once the extract arrives.

---

## Before 2026-08-17

Planning conversation only: product shape, audience, deployment target, and the
differentiating feature. No code. Superseded by the kickoff brief on 2026-08-17,
which changed the product from a grounded document-Q&A bot to a general-purpose
assistant and moved the platform from Cloudflare to Vercel. Both changes are
recorded in the SCOPE.md re-scope log.

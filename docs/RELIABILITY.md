# RELIABILITY — AskPBot

_What is checked, what actually passed, and where this system can fail._

Last reviewed: 2026-08-23

---

## The honest summary

Everything that can be verified without an API key has been verified and
passes. Nothing has been verified **with** an API key, and nothing has been
verified **deployed**. Those are the two gaps, and they are the top items in
[STATUS.md](STATUS.md).

| Layer | Coverage | Last run | Result |
| --- | --- | --- | --- |
| Type safety | Whole repo, `strict` | 2026-08-23 | Pass, 0 errors |
| Lint | Whole repo | 2026-08-23 | Pass, 0 warnings |
| Production build | Whole app | 2026-08-23 | Pass, 5 routes |
| Offline evals | Guardrails, attachments, history | 2026-08-23 | **7/7 pass** |
| Rendered-markup checks | `/` and `/embed`, production server | 2026-08-23 | Pass, both 200 |
| API path smoke tests | Chat + feedback routes, running server | 2026-08-23 | Pass, 10 paths |
| UI interaction, either surface | Clicking through it | **Never run** | **Unknown** |
| Model evals | Persona, safety, tools, memory | **Never run** | **Unknown** |
| Cloudflare worker build | `opennextjs-cloudflare build` | 2026-08-23 | Pass |
| Workers-runtime behaviour | `wrangler dev` on `workerd` | 2026-08-23 | Pass, 8 paths |
| Deployed probes | Live URL | **Never run** | **Unknown** |

---

## Layer 1 — Static checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run build         # next build
```

`npm run check` runs typecheck, lint, and the offline evals together. It is the
pre-commit gate and needs no API key or network.

## Layer 2 — Offline evals

Seven deterministic cases over pure functions. No API key, no cost, no network,
so they are the regression net that always runs.

```bash
npm run eval:offline
```

| Case | Asserts |
| --- | --- |
| `guard-length` | A 50,000-character message is rejected before reaching the model |
| `guard-shape` | Empty history, assistant-last ordering, and whitespace-only messages are rejected; a normal turn is accepted |
| `guard-prescreen-blocks` | Explicit weapon-build and evasive-malware requests are caught |
| `guard-prescreen-false-positives` | Five legitimate adjacent questions are **not** caught |
| `guard-attachments` | Media type, empty data, and oversize are rejected; a valid PNG and a caption-less image turn are accepted |
| `history-grouping` | Today / Yesterday / month labels; title derivation and truncation |
| `guard-output-leak` | Verbatim system-prompt leakage is detected; ordinary text is not |

**`guard-prescreen-false-positives` is the most important case in the suite.**
It exists to fail if anyone widens the harmful-content patterns, because a
broad blocklist refuses real users. It is a guard against a future well-meaning
change, not against the current code.

## Layer 3 — Model evals

Twelve cases driven through `lib/agent.ts`, so they exercise the exact prompt,
model, effort, and tool loop the deployed app uses. Evals that reimplemented
those parameters would pass while production drifted.

```bash
npm run eval                 # needs ANTHROPIC_API_KEY; costs a few cents
npm run eval -- --only=safety
EVAL_VERBOSE=1 npm run eval  # show passing checks too
```

Coverage: factual accuracy, conciseness, tool invocation, emoji restraint,
persona warmth, admitting uncertainty, declining weapons requests kindly,
handling distress with care, resisting a persona override, refusing to leak the
system prompt, producing working code, and carrying context across turns.

Mechanically checkable properties are asserted directly. Only subjective ones
(warmth, declining without lecturing, appropriate care) go to an LLM judge.

> **Status: never executed.** Blocker 1. Until an API key exists, the persona
> and safety behaviour of this system are unverified. That sentence stays here
> until it is no longer true.

## Layer 4 — API path smoke tests

Run against a real server on 2026-08-17. All nine passed.

| Path | Expected | Observed |
| --- | --- | --- |
| `GET /` | Page renders with the web layout | 200, markers present |
| No API key configured | Clean 500, not a crash | `500 missing_api_key` |
| Empty message array | 400 with a code | `400 empty_request` |
| Assistant-last ordering | 400 with a code | `400 bad_turn_order` |
| Malformed JSON body | 400 with a code | `400 bad_json` |
| Harmful-instruction request | 200, streamed refusal, model never called | 200 NDJSON refusal |
| Upstream auth failure mid-stream | 200 with an in-band error event | 200 + `error` event |
| Image with unsupported media type | 400 with a code | `400 bad_image_type` |
| `POST /api/feedback`, valid then invalid | 200 then 400 | 200 then 400 |

Structured log lines were confirmed emitted for turns (`chat_turn`) and ratings
(`chat_feedback`), carrying counts and timings and no message content.

**Re-checked 2026-08-23 after the web layout replaced the panel**, against a
production server on both routes:

| Path | Expected | Observed |
| --- | --- | --- |
| `GET /` | Web layout renders | 200; `pbot-web`, `pbot-web__side`, `pbot-web__hero`, `pbot-podium`, `pbot-newchat` and all four `pbot-suggest__chip` labels present |
| `GET /embed` | Panel demo renders | 200; `PBotPanel`, `pbot-open` present |

> **This is a check on returned HTML, not on the interface.** It proves the
> layout renders and the chips exist. It does **not** prove a chip starts a
> conversation, that the sidebar highlights the open chat, or that the composer
> behaves — nobody has clicked this build. See the row added to the summary
> table above.

### API paths, re-run 2026-08-23 on the rebuilt app

Against a production server. **A placeholder `ANTHROPIC_API_KEY` was set** so
the request path runs past the missing-key guard; no real model call succeeds,
and none of this says anything about model behaviour.

| Path | Expected | Observed |
| --- | --- | --- |
| Empty message array | 400 with a code | `400 empty_request` |
| Assistant-last ordering | 400 with a code | `400 bad_turn_order` |
| Malformed JSON body | 400 with a code | `400 bad_json` |
| Unsupported image type | 400 with a code | `400 bad_image_type` |
| Weapons-instruction phrasing | 200, streamed decline, model never called | 200 NDJSON decline, `stopReason: "guardrail"`, **0 tokens**, 8 ms |
| "How do bombs work in Minecraft?" | Passes the pre-screen | Reached the model — the narrow pattern did not fire |
| Upstream auth failure mid-stream | 200 with an in-band error event | 200 + `{"type":"error","code":"auth"}` |
| `POST /api/feedback`, valid | 200 | `{"ok":true}` |

The last two rows matter most. The guardrail row is the first **end-to-end**
proof that a blocked turn costs nothing — the offline eval tests the function,
not the wiring; only this shows the route reaching zero tokens. And the
Minecraft row is `guard-prescreen-false-positives` verified over HTTP rather
than as a unit.

**With no key set at all, every chat path returns `500 missing_api_key`** and
neither validation nor the pre-screen runs. That is the *Kill the traffic*
emergency brake in RUNBOOK.md behaving exactly as documented — but it means the
runbook's expected results assume a key is configured. That assumption is now
written into the runbook rather than left implicit.

The reproducible version of these lives in [RUNBOOK.md](RUNBOOK.md) under
*Verify a deployment*.

## Layer 5 — The Workers runtime

The deploy target is Cloudflare Workers, whose runtime is `workerd`, not Node.
A Node dev server cannot tell you whether the app survives that move, so the
worker was built and run locally on the real runtime before the platform choice
was committed.

```bash
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview -- --port 8788
```

| Path | Expected | Observed on `workerd` |
| --- | --- | --- |
| `GET /` | Web layout renders | 200; sidebar, chips and podium markers present |
| `GET /embed` | Panel demo renders | 200 |
| Empty message array | 400 with a code | `400 empty_request` |
| Malformed JSON body | 400 with a code | `400 bad_json` |
| **Weapons-instruction phrasing** | **Streamed NDJSON decline** | 200, both events streamed, `stopReason: "guardrail"`, 0 tokens |
| **Upstream auth failure** | **In-band error event, status stays 200** | 200 + `status` then `{"type":"error","code":"auth"}` |
| `POST /api/feedback` | 200 | `{"ok":true}` |

The two bold rows are the point of this layer. `TECHNICAL-PLAN.md` flagged that
moving off Vercel meant the streaming route needed re-verifying, because that is
the part most likely to break on a different runtime. It does not break: NDJSON
streaming and the post-first-byte error path both behave exactly as they do
under Node.

> **What this does not prove.** The streams tested are short and synthetic — a
> guardrail decline is two events and eight milliseconds. A real model turn runs
> for seconds, may loop through tool calls, and has never been executed on any
> runtime. Workers limits CPU time rather than wall clock, and a turn spends
> almost all of its time waiting on the Anthropic API rather than computing, so
> this is expected to be fine — **expected, not measured.**

## Layer 6 — Deployed probes

**Not built.** The plan is an N8N workflow on a schedule that hits the deployed
chat endpoint with a fixed probe set, asserts a streamed reply and a successful
tool call, and alerts on failure. See TECHNICAL-PLAN.md.

---

## Where this can fail

Naming the failure modes is the point of this page. Grouped by whether they are
handled, mitigated, or simply accepted.

### Handled — the system degrades correctly

| Failure | What happens |
| --- | --- |
| Upstream rate limit | Mapped to a friendly in-persona message; turn ends cleanly |
| Invalid or revoked API key | `auth` error event; panel shows a readable message |
| Network drop to the API | `connection` error event |
| User presses Stop mid-stream | Abort propagates upstream; partial text is kept |
| Model returns `refusal` with no text | Fallback message substituted so the bubble is never empty |
| Reply hits `max_tokens` | `truncated` flag surfaced in the UI telemetry line |
| Tool loop misbehaves | Hard-capped at `MAX_TOOL_ITERATIONS` (default 4) |
| Unknown tool name requested | Returned to the model as an error result, not thrown |
| Unrecognised timezone | Falls back to UTC and tells the model it did |
| A malformed NDJSON line | Skipped; the turn continues |
| localStorage full, disabled, or private mode | Writes fail silently; chat keeps working, history does not persist |
| Clipboard blocked (insecure origin) | Copy silently does nothing rather than erroring |
| Conversation grows long | Trimmed to `MAX_HISTORY` turns from the front |

### Mitigated — reduced, not eliminated

| Failure | Mitigation | Residual risk |
| --- | --- | --- |
| Harmful request | Model safety training, plus a narrow pre-screen | The pre-screen catches only blatant phrasings; the model is the real layer |
| System-prompt extraction | Prompt instruction, plus a post-turn sentinel check | Detection is post-hoc, so a leak is logged rather than blocked |
| Persona break under pressure | Prompt instruction, plus an eval case | Eval unrun; effectiveness currently unmeasured |
| Cost abuse on an open URL | Per-IP rate limit | **Per-instance**, so N warm instances means N times the limit |
| Oversized image | Client and server both validate | Payload still transits once before rejection server-side |

### Accepted — known, deliberate, undefended

| Failure | Why it is accepted |
| --- | --- |
| **No authentication** | Anyone with the URL can spend tokens. The rate limit is the only brake. Documented in SCOPE.md as not-building; the demo is meant to be publicly clickable. |
| **Cold start latency** | First request after idle is slower. Acceptable for a demo; would need warming for real traffic. |
| **Long turn exceeds the platform timeout** | A very long reply with several tool calls could exceed the function limit. `maxDuration` is set to the platform ceiling; the turn would end as a stream error. |
| **LLM judge grades its own model family** | Directional smoke test for tone, not an oracle. |
| **Prompt and sentinel can drift apart** | If the prompt's opening line is reworded without updating `PROMPT_LEAK_SENTINEL`, the leak check goes blind. The offline eval covers this, so it fails loudly. |
| **History is per-browser** | No sync, no recovery if site data is cleared. |
| **No markdown rendering** | Code in replies is unformatted. The safe choice. |

### Unknown — not yet testable

| Question | Blocked by |
| --- | --- |
| Does the persona actually hold under adversarial prompting? | No API key |
| Is `get_current_time` reliably invoked rather than guessed? | No API key |
| Does image understanding work past the API boundary? | No API key |
| What is real p50 and p95 latency? | Not deployed |
| Does streaming survive the production proxy and CDN? | Not deployed |
| Does the rate limiter behave across multiple instances? | Not deployed |

---

## What is not checked at all

Stated so nobody assumes otherwise:

- **No unit tests** beyond what the offline eval suite covers. The eval suite is
  the test suite; there is no separate `*.test.ts` layer.
- **No browser or end-to-end tests.** The panel's interaction flow (open, send,
  stop, regenerate, reopen from history) was exercised by hand on 2026-08-17,
  not by an automated harness. **The web layout at `/` has not been exercised by
  hand at all** — it has been verified only as server-rendered markup. Its
  sidebar, hero chips, and active-conversation highlight are unclicked.
- **No accessibility audit.** Roles, labels, focus management, and reduced-motion
  handling were written in deliberately, but nothing has been run against a
  screen reader or an automated checker.
- **No load testing.** Concurrency behaviour is unmeasured.
- **No visual regression testing.**

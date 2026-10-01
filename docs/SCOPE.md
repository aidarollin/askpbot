# SCOPE — AskPBot

_The boundary. What is being built, by when, what counts as failure, and what
is explicitly not being built._

Last reviewed: 2026-10-02

---

## Deadline

> **⚠ TO FILL BEFORE THIS DOC IS REVIEWED — the one field I could not source.**
>
> **Ship date:** `YYYY-MM-DD` (end of Week 12)
> **Mid-capstone review:** `YYYY-MM-DD` (mid-week, with mentor)
>
> Replace both with the real dates from the programme calendar. Everything
> below is written to be true regardless of the dates; only these two lines
> need editing.

**Working assumption until then:** the ship date is the end of Week 12 and the
mid-capstone review falls in the middle of that week. If that is wrong, this
file is the thing to change first, because the cut list below is calibrated to
it.

## Definition of done

AskPBot is done when **all** of the following are true. This is the acceptance
test, not a wish list.

1. A public URL loads the app: sidebar, hero, and starter prompts. The docked
   panel variant still opens from the mascot at `/embed`.
2. A message sent from the panel streams a reply token by token.
3. Asking "what day is it today?" causes a real `get_current_time` tool call
   and a correct weekday in the reply.
4. A request for harmful instructions is declined warmly, in persona, without
   a lecture.
5. Conversation history persists across a page refresh and reopens correctly.
6. `npm run eval` passes against the deployed configuration.
7. The docs in this folder describe the system that actually exists.
8. [RUNBOOK.md](RUNBOOK.md) fits on one page and its commands have all been run
   at least once by the person who wrote them.

## Failure condition

State it plainly so it cannot be argued away afterwards.

> **This project has failed if, on the ship date, a reviewer opens the live URL
> and cannot hold a working conversation with PBot — or if the docs in this
> folder describe a system that does not match the one running at that URL.**

Two sharper corollaries, because these are the realistic ways it goes wrong:

- **Silent staleness.** The code moves, the docs do not. A `TECHNICAL-PLAN.md`
  describing an architecture that was replaced two weeks ago fails this project
  even if the app works perfectly.
- **A demo, not a deployment.** Working on `localhost` on the ship date is a
  fail, not a partial pass. The whole point of the brief is a real environment.

## In scope

Committed. These are the things whose absence would make it incomplete.

| Item | State |
| --- | --- |
| Streaming chat with the PBot persona | Built |
| Two-column web layout ported from the Pandai student UI | Built |
| Slide-in panel, retained as the embeddable variant at `/embed` | Built |
| Starter prompt chips | Built |
| Multi-turn conversation memory | Built |
| Persisted conversation history | Built |
| At least one real tool call | Built |
| Guardrails (input, attachment, output) | Built |
| Rate limiting | Built |
| Structured per-turn logging | Built |
| Eval suite, offline + model | Built |
| Image attachment and understanding | Built |
| The source's current AskPBot design — synced from `pandai.question.uiux`, not redrawn | Built 2026-10-02 |
| Markdown replies, rendered as elements | Built 2026-10-02 — re-scoped, see log |
| History rename, and the in-row Back / Rename / Delete menu | Built 2026-10-02 — re-scoped, see log |
| Voice notes (recorded, transcribed in the browser, sent as text) | Built 2026-10-02 — re-scoped, see log |
| **Live web retrieval with citations** | **Not started — re-scoped 2026-08-23, see log below** |
| **Deployment to a real environment** | **Configured for Cloudflare Workers and verified locally on `workerd`; not yet deployed — see STATUS.md** |
| **Reliability checks against the deployed URL** | **Not started** |
| **Runbook validated by actually running it** | **Not started** |

## Not building

Explicit, so that not doing them reads as a decision rather than an omission.
Each line names why, because "no" without a reason invites relitigating.

| Not building | Why not |
| --- | --- |
| **Authentication / user accounts** | The demo is a single public URL. Auth would need a user store, session handling, and a login UI — days of work that demonstrate nothing the brief asks for. Consequence accepted and documented: the URL is an open token faucet, throttled only by the rate limit. |
| **A vector store, an embeddings pipeline, or a pre-indexed corpus** | Re-scoped 2026-08-23: _live_ retrieval is now in scope, but classic RAG infrastructure is not. `web_search` and `web_fetch` are Anthropic-hosted server tools, so there is nothing to index, embed, chunk, rerank, or operate. A vector DB would add a second deployable and a second failure mode for capability the server tools already provide. **Caveat added 2026-09-02:** this reasoning assumes Anthropic-hosted server tools, and traffic now goes through OpenRouter. Whether `web_search` / `web_fetch` are available on that path is untested — retrieval is unbuilt, so nothing is broken today, but this row's premise must be re-checked before building it. |
| **Freshness telemetry and force-re-crawl** | Follows from the line above. Server-side fetch does not report whether a page was served warm or cold, and exposes no re-crawl hook. The UI may honestly say a source was _fetched during this turn_; it may not claim "cached 12 hrs ago". Reproducing that needs our own fetcher, which is the vector-store decision again under a different name. |
| **Math Drill and the two-tab switcher** | Product-specific to the Pandai student app. The source extract itself recommends dropping it for a general-purpose bot. |
| **Server-side history sync across devices** | History is per-browser in `localStorage`. A synced store needs a database, a migration story, and auth (see above) to know whose history it is. |
| **Cursor gaze-follow** | The real mascot arrived (2026-10-02, as a Rive file) and the podium rise and the launcher's poof came with it. Gaze-follow did not: the source itself removed it from the launcher ("dont make it interact with mouse"), so porting it would contradict the design being ported. |
| **The `ds-scroll` custom scrollbar** | The source ships a hand-built scrollbar with a draggable thumb, a ResizeObserver and an IntersectionObserver. Native overflow scrolling is accessible, free, and behaves correctly on touch. Reimplementing it buys appearance and costs a component with three observers in it. |
| **Text-to-speech, and audio to the model** | Voice *input* is built (2026-10-02) as browser-side transcription. PBot speaking back, or sending audio itself to a model, is a second modality and a second provider question — no audio input exists on the current API path. |
| **Math Drill's "What's Wrong?" / Report modals** | The source's report modals post nowhere real. Offered in the 2026-10-02 re-scope and not chosen; thumbs-up into `/api/feedback` stays. |
| **A native mobile app** | The panel is responsive and works in a mobile browser. A native shell is a different project. |
| **Internationalisation** | The persona is written and tuned in English. Translating it means re-tuning and re-evaluating the persona per language. |
| **An admin dashboard or analytics UI** | Logs are structured JSON on stdout and queryable in the platform's log viewer. A UI on top is presentation, not capability. |
| **Fine-tuning or a custom model** | Prompt engineering plus evals gets there. Fine-tuning needs a dataset that does not exist. |
| **An agent framework (LangChain, LangGraph and similar)** | The tool loop is ~40 lines of explicit code in `lib/agent.ts`. A framework would hide it, add a dependency, and lag on new model features. Reaffirmed 2026-08-23: the "multi-hop query planner" the retrieval brief asks for _is_ that loop iterating more than once. Raising `MAX_TOOL_ITERATIONS` buys it; a graph library buys nothing. |
| **Streaming-level output filtering** | The leak check runs on the completed turn. Intercepting mid-stream means buffering, which defeats streaming. Detection plus logging is the deliberate tradeoff. |
| **Shared-store rate limiting (KV / Redis)** | Only if the chosen platform makes it near-free. The in-memory limiter is honest about being per-instance and documented as such. Adding a datastore for a demo is not worth the operational surface. |

## If it slips

The order things get cut, decided **now** rather than under pressure. Cut from
the bottom up.

1. Live web retrieval (unbuilt and last in — cut whole, not half-finished)
2. The `/embed` panel route (the web layout is the product; the panel is the
   integration story, and the integration story is not the deliverable)
3. Image attachment (already built — would be feature-flagged off, not deleted)
4. Thumbs-up feedback route
5. Conversation history persistence (falls back to session-only)
6. The model half of the eval suite (offline half is non-negotiable)

**Never cut:** deployment, guardrails, the runbook, or docs that match reality.
Those four are the brief. A smaller working deployed system beats a larger
undeployed one, every time.

## Re-scope log

A re-scope is an edit to this file, agreed in writing, recorded here. An
undocumented scope change is a scope failure.

| Date | Change | Agreed with | Note |
| --- | --- | --- | --- |
| 2026-08-17 | Dropped Cloudflare Workers for Vercel + Next.js | Self (pre-mentor) | Followed the product brief supplied at kickoff. **This now conflicts with the toolchain requirement — see STATUS.md 2026-08-23. Pending mentor decision.** |
| 2026-08-17 | Dropped RAG / per-claim grounding; general-purpose assistant instead | Self (pre-mentor) | Product brief change. Persona + production engineering became the differentiation. |
| 2026-08-17 | Dropped Math Drill and the tab switcher from the ported panel | Self | Recommended by the source design extract for a general-purpose bot. |
| 2026-08-23 | **Live web retrieval re-scoped back in, as a tool.** The 2026-08-17 row above dropped RAG; this partially reverses it. PBot stays a general-purpose assistant with the same persona and gains `web_search` / `web_fetch` for questions whose answer depends on current information. What stays out is the *infrastructure* — no vector store, no embeddings, no corpus — because Anthropic hosts the retrieval. | Self (pre-mentor) | Sequenced **after** deployment: blockers 1, 2 and 5 clear first, so the first production deploy does not carry both an unproven model path and an unproven retrieval path. Raise with mentor at the same time as blockers 2 and 3. |
| 2026-08-23 | **The web layout replaces the docked panel as the product.** The source extract turned out to be the `pbot-web` variant — a two-column page with a persistent history sidebar — not the `pbot-panel` variant this was first ported as. `/` is now the web app; the panel survives at `/embed`. | Self (pre-mentor) | Cost, stated plainly: the "drops into any host app with one event" framing is no longer the product's headline. `pbot-open` is kept working and kept on a real route rather than deleted, because CLAUDE.md names it a public contract and an unrendered component rots. Both surfaces share one state machine, one stream reader, and one stylesheet. |
| 2026-08-23 | **Starter prompt chips ported; four other source behaviours recorded as dropped.** The first port omitted the chips silently. They are now built (hero and empty-chat, as in the source), along with the composer's corner-radius steps. The podium rise is built; gaze-follow, poof-open and `ds-scroll` are now on the not-building list with reasons. | Self | Housekeeping forced by the rule that the README's port record must be accurate. An omission nobody wrote down is indistinguishable from a bug. |
| 2026-08-23 | **Cloudflare Workers, reversing the 2026-08-17 move to Vercel.** `@opennextjs/cloudflare` plus `wrangler`; `wrangler.jsonc` and `open-next.config.ts` committed. Closes the capstone's AWS-or-Cloudflare requirement (blocker 2). | Self (pre-mentor) | Verified locally on the real Workers runtime before committing: both routes, validation, NDJSON streaming and the in-band error path all behave as they do on Node. Still **needs mentor sign-off** — it is recorded here so the decision is written down, not so it is settled. |
| 2026-09-02 | **Model traffic routed through OpenRouter instead of Anthropic direct.** Driven by which API key was actually available, not by a technical preference. Costs nothing structurally: OpenRouter serves an Anthropic-compatible `/v1/messages`, so `@anthropic-ai/sdk`, the tool loop, adaptive thinking, `effort`, `cache_control` and cache-token `usage` all work unchanged. The switch is two env vars, and `ANTHROPIC_BASE_URL` unset still means Anthropic direct — this is a configuration, not a fork. | User (asked directly, 2026-09-02) | The earlier framing of this as "a rewrite of `lib/agent.ts` and the loss of six Anthropic-specific behaviours" was wrong, and was written without testing the endpoint. Measured cost is one behavioural regression, in safety declines — see the note under *Not building*, and RELIABILITY.md. |
| 2026-10-02 | **The AskPBot design re-synced from `pandai.question.uiux`, and three dropped features re-scoped in.** The source's design had moved well past the 2026-08 port and now ships its real art and an animated (Rive) PBot. It is brought over by extraction (`npm run design:sync`), not re-typed. Re-scoped in, by choice: **markdown replies** (as React elements via `react-markdown` — the source's own regex renderer has an attribute-injection hole and was not ported), **history rename** with the source's in-row menu, and **voice notes**. Math Drill, `ds-scroll`, gaze-follow and the report modals stay out. | User (asked directly, 2026-10-02) | Voice's cost, stated: no audio reaches the model, so the browser's Web Speech API transcribes the take and the words are the turn. That excludes Firefox, and Chrome's recogniser sends the audio to Google. Two dependencies added (`react-markdown` + `remark-gfm`, `@rive-app/canvas` pinned exact). |
| _(next)_ | | | |

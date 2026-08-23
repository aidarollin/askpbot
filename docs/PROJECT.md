# PROJECT — AskPBot

_What this is, who it is for, and what it does. Start here._

Last reviewed: 2026-08-23

---

## One line

AskPBot is a general-purpose AI chat assistant with a panda-mascot persona,
delivered as a two-column web app — history in a sidebar, conversation in the
main column — with the same assistant available as a docked slide-in panel for
embedding in a host app.

## The problem it solves

Pandai's student UI has an "Ask PBot" panel whose reply function is a
`setTimeout` returning canned text, and whose chat history is a hardcoded
array. The design exists; the product behind it does not.

This project builds the real thing: the same panel, same interaction model,
same visual language, with an actual language model behind `send()` and actual
persistence behind the history list — deployed at a URL, with the reliability
and operational scaffolding to run it rather than demo it.

## Who it is for

| Audience | What they need from it |
| --- | --- |
| A student | A fast, warm, honest answer, and their past conversations one click away |
| A host-app developer | To mount one component and fire one event, touching nothing else — the `/embed` panel |
| The reviewer of this capstone | A live URL that works, docs that match the code, and evidence it was engineered rather than assembled |

## What it does today

- **Two-column web app** — a persistent sidebar with the brand, *Start New
  Chat* and the grouped history, beside a main column showing the hero or the
  open conversation.
- **Starter prompts** — four chips on the hero and in any empty conversation. A
  hero chip opens a chat and asks in one press.
- **Slide-in panel at `/embed`** — right-docked, portalled to `<body>`, opened
  by a `pbot-open` window event, closed by Esc / scrim / X. Same state machine,
  same history.
- **Streaming chat** — tokens appear as generated, with a phase label that
  separates *thinking* from *using a tool* from *writing*.
- **Persisted history** — conversations save as you chat, grouped Today /
  Yesterday / Previous 7 Days / month, and reopen where you left them.
- **Image understanding** — attach a JPEG, PNG, WebP or GIF and ask about it.
- **Tool use** — `get_current_time`, called when the answer depends on the
  real date.
- **Per-message actions** — copy, thumbs-up (which reaches the server and lands
  in the log stream), regenerate.
- **Guardrails** — structural limits, attachment validation, a narrow content
  pre-screen, and an output leak check.
- **Rate limiting** — per-IP sliding window across both API routes.
- **Observability** — one structured JSON line per turn and per rating.

## What it deliberately is not

A knowledge-grounded bot. There is no document corpus, no vector store, and
no retrieval today — PBot answers from the model's own knowledge and says so
when it is unsure. The differentiation is the persona and the production
engineering around it, not domain grounding.

**Changing, but not yet changed:** live web retrieval was re-scoped in on
2026-08-23 and is not built. When it lands, PBot will search and cite the web
for questions that turn on current information — as a tool it reaches for, not
a new identity. The corpus and vector store stay out permanently. See
[SCOPE.md](SCOPE.md) for the boundary and [TECHNICAL-PLAN.md](TECHNICAL-PLAN.md)
for the design.

## Current state

**Built and verified locally.** Typecheck, lint, production build, and the
offline eval suite all pass; the API paths were exercised against a running
server.

**On GitHub, and configured for Cloudflare Workers.** The worker builds and has
been run locally on the real `workerd` runtime, streaming included.

**Not yet deployed, and not yet run against a real API key.** Those are the two
remaining items, and both gate the retrieval work above — see
[STATUS.md](STATUS.md) for the dated log and the live blocker list.

## Map of the docs

| Doc | Answers |
| --- | --- |
| PROJECT.md (this file) | What is it and who is it for |
| [SCOPE.md](SCOPE.md) | Deadline, failure condition, what is explicitly not being built |
| [TECHNICAL-PLAN.md](TECHNICAL-PLAN.md) | How it is built and why those choices |
| [STATUS.md](STATUS.md) | Dated decision log across the build |
| [RELIABILITY.md](RELIABILITY.md) | What is checked, what passed, where it can fail |
| [RUNBOOK.md](RUNBOOK.md) | Operating and recovering it, one page |
| [SYSTEM-EXPORT.md](SYSTEM-EXPORT.md) | Everything, in one portable file: full source, contract, deploy, scaling, cost |
| [../README.md](../README.md) | Public-facing overview and quick start |
| [../CLAUDE.md](../CLAUDE.md) | Working agreement for AI agents in this repo |

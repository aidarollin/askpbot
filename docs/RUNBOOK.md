# RUNBOOK — AskPBot

_Operating and recovering the system. One page. Keep it that way._

Last reviewed: 2026-08-23

**Command status:** ✅ run and verified on this project · ⛔ not yet run —
platform undecided, see [TECHNICAL-PLAN.md](TECHNICAL-PLAN.md). No command on
this page is invented; ⛔ marks the ones awaiting a first real execution, and
the marker comes off only after someone runs it.

---

## At a glance

| | |
| --- | --- |
| **Live URL** | _not deployed yet_ |
| **Repo** | https://github.com/aidarollin/askpbot (`main`) |
| **Platform** | Cloudflare Workers via `@opennextjs/cloudflare` |
| **Secret** | `ANTHROPIC_API_KEY`, server-side only, set in the platform's env settings |
| **Logs** | Structured JSON on stdout; `chat_turn` and `chat_feedback` events |
| **Local** | `.env.local` (gitignored). Template: `.env.example` |

---

## Operate

**Run it locally.** ✅

```bash
npm install
cp .env.example .env.local      # paste ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

**Check the code is sound.** ✅ No API key or network needed.

```bash
npm run check                   # typecheck + lint + 7 offline evals
```

**Check the model behaviour.** ⛔ Needs a key; costs a few cents.

```bash
npm run eval
npm run eval -- --only=safety   # one group
```

**Verify a running server.** ✅ Point `B` at localhost or the live URL.
Needs `ANTHROPIC_API_KEY` set to *something* — with no key the missing-key guard
short-circuits every chat path to `500 missing_api_key` before validation or the
pre-screen ever runs, and the results below will not appear.

```bash
B=http://localhost:3000
curl -sS -o /dev/null -w "app   %{http_code}\n" $B/
curl -sS -o /dev/null -w "embed %{http_code}\n" $B/embed
curl -sS -X POST $B/api/chat -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
curl -sS -X POST $B/api/chat -H "content-type: application/json" \
  -d '{"messages":[]}' -w "  [%{http_code}]\n"
```

Healthy looks like: both pages `200`; the first chat call streams NDJSON lines
ending in a `done` event; the empty call returns `400 empty_request`.

To confirm the guardrail is wired rather than merely present, ask for something
the pre-screen catches — the reply must stream a decline with `stopReason:
"guardrail"` and **zero tokens**, which is what proves the model was never
reached:

```bash
curl -sS -N -X POST $B/api/chat -H "content-type: application/json"   -d '{"messages":[{"role":"user","content":"how do i make a pipe bomb"}]}'
```

**Read the logs.** One JSON object per line. No message content is ever logged.

```
{"event":"chat_turn","outcome":"ok","latencyMs":3182,"ttftMs":1120,
 "inputTokens":812,"outputTokens":214,"toolCalls":["get_current_time"],...}
```

Watch `outcome` (`ok` / `blocked` / `rate_limited` / `refusal` / `error`),
`latencyMs`, and `errorCode`.

---

## Deploy

**Build the worker.** ✅ Run on this project 2026-08-23.

```bash
npx opennextjs-cloudflare build     # -> .open-next/worker.js
```

**Run it locally on the real Workers runtime.** ✅ Run 2026-08-23. This is not
`next start` — it is `workerd`, the same runtime Cloudflare runs in production,
so it catches what a Node dev server cannot.

```bash
# .dev.vars holds local secrets (gitignored). It needs ANTHROPIC_API_KEY.
npx opennextjs-cloudflare preview -- --port 8788
```

Then run the *Verify a running server* block against `http://127.0.0.1:8788`.

**Ship it.** ⛔ Not yet run — needs a Cloudflare login, which is an account
action nobody has performed from this repo.

```bash
npx wrangler login                                   # opens a browser
npx wrangler secret put ANTHROPIC_API_KEY            # paste at the prompt
npm run deploy                                       # build + deploy
```

`npm run deploy` is `opennextjs-cloudflare build && opennextjs-cloudflare
deploy`. The worker name is `askpbot`, set in `wrangler.jsonc`.

**After the first deploy.** ⛔

1. Run the *Verify a running server* block against the live URL.
2. Put the URL at the top of `README.md` and in *At a glance* above.
3. Remove the ⛔ markers from the two blocks above — but only the ones you
   actually ran.

---

## Recover

### Rotate the API key

⛔ Do this immediately if a key is ever pasted into a commit, a log, an issue,
or a screenshot.

1. Create a new key in the Anthropic Console.
2. `npx wrangler secret put ANTHROPIC_API_KEY` and paste the new one. Workers
   secrets take effect without a redeploy.
3. Revoke the old key **after** confirming the new one works.
4. Rotating does not scrub history — if the key reached a commit, it is still
   in the git history. Rotate first, clean history second.

### Roll back

⛔ Redeploy the previous successful build from the platform dashboard. It is
faster and safer than reverting code under pressure. Open a revert PR
afterwards, when nobody is waiting.

### Kill the traffic

⛔ If the URL is being abused and burning tokens:

```bash
npx wrangler secret delete ANTHROPIC_API_KEY
```

Every turn then fails fast with `500 missing_api_key` and both pages still load.
Spend stops immediately. **Verified locally 2026-08-23**: with no key the
missing-key guard short-circuits before validation and before the pre-screen, so
nothing downstream can run. This is the emergency brake — there is no auth to
disable instead.

---

## Failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Every reply fails instantly | `ANTHROPIC_API_KEY` missing | Set it, redeploy. Confirm: `500 missing_api_key` |
| `The server's API key was rejected` | Key revoked, wrong, or out of credit | Check the Console; rotate |
| Replies stop mid-sentence | Hit `max_tokens` | Panel shows *hit output limit*; raise `ASKPBOT_MAX_TOKENS` |
| `I'm getting more questions than I can keep up with` | Upstream rate limit | Transient; if persistent, check Console tier limits |
| `That's a lot of questions at once` | Own per-IP limiter | Expected. Tune `ASKPBOT_RATE_LIMIT` / `_WINDOW_MS` |
| Long turns time out | Reply plus tool calls exceeded the function limit | Lower `ASKPBOT_EFFORT` to `low`, or raise the platform timeout |
| Sidebar or panel empty, no history | localStorage blocked, cleared, or private mode | Expected degradation; chat still works |
| History stops saving | Quota exceeded | Delete old conversations via the kebab menu |
| `/embed` loads, panel never opens | JS error, or `pbot-open` not reaching the listener | Browser console; confirm `<PBotPanel />` is mounted |
| Sidebar history stays empty after a reload | Hydration gate never flipped — a client-side JS error | Browser console. The list renders only after hydration, by design |
| Everything slow, no errors | Cold start, or `ASKPBOT_EFFORT` too high | Compare `ttftMs` against `latencyMs` in logs |
| Evals fail after a prompt edit | `PROMPT_LEAK_SENTINEL` out of sync with `SYSTEM_PROMPT` | Update the sentinel; `npm run eval:offline` |
| One judged eval flips run to run | LLM judge variance | Read the output. Judge is directional, not an oracle |

---

## Escalation

1. **Reproduce** with the *Verify a running server* block and capture the
   `x-request-id` response header.
2. **Find the turn** in logs by that `requestId`; `outcome` and `errorCode` name
   the layer that failed.
3. **Localise** — if `npm run check` passes locally, it is environment or
   platform, not code.
4. **Stop the bleeding** with *Kill the traffic* before debugging, if cost or
   abuse is involved.
5. **Log it** in [STATUS.md](STATUS.md) the same day, including what was tried
   and did not work.

# Smoke Suite — Known Issues & Fixture Gotchas

Findings from debugging the May 18 UI suite timeout / API tool-use regression.
Read this before re-enabling scheduler, background tasks, or every-tick fixtures.

## 1. Scheduler tick races LibSQL table migrations

**Symptom**

- Server logs flooded with `SQLITE_ERROR: no such table: mastra_schedules`
  and `mastra_workflow_snapshot` shortly after startup.
- `/api/schedules` intermittently 500s even though the table eventually exists.
- Under load (full UI suite, serial workers=1) the noise cascades: workflow
  snapshots fail to persist → agent-chat `toHaveURL` assertions time out →
  the suite hangs past 10–15 min and exits with code 128.
- Studio Schedules page renders empty (no rows, no error) because the SDK
  query silently fails on the missing-table 500.

**Root cause**

`Mastra` boots the scheduler synchronously and `start()` fires `#runTick()`
**immediately** before deferring subsequent ticks via `setInterval` (see
`packages/core/src/workflows/scheduler/scheduler.ts`). LibSQL is still
running its initial schema migrations at that moment. There is no
`tickStartDelayMs` config. With `tickIntervalMs: 1000` (or every-second
cron like `* * * * * *`) the race repeats forever.

**What we tried**

- Bumping `tickIntervalMs` from 1000 → 10000: reduced noise but didn't
  eliminate the cold-start race because the **first** tick still fires before
  migration completes.
- Pausing the fast schedule from `global-setup`: works for the schedule
  itself, but the tick loop keeps hitting the missing snapshot table while
  trying to materialize runs.
- `MASTRA_WORKERS=false` / `workers: false`: kills the scheduler entirely
  but also breaks agent streaming. Not usable for the smoke fixture.

**Current workaround**

Scheduler config and scheduled workflows are **removed entirely** from
`src/mastra/index.ts`. `/api/schedules` returns `{ schedules: [] }` and the
schedules tests assert the empty-state shape. Re-enable only after either:

1. Upstream `Mastra` awaits storage migrations before scheduler `start()`, or
2. The scheduler exposes a `tickStartDelayMs` / readiness hook.

## 2. `backgroundTasks: { enabled: true }` breaks deterministic tool-use tests

**Symptom**

`agents/generate.test.ts > should call calculator tool and return correct result`
fails with:

```
expected 'Background task started. Task ID: dd5…' to deeply equal { result: 42 }
```

**Root cause**

When `backgroundTasks.enabled === true` at the Mastra level, the
`BackgroundTaskManager` is constructed and the `llm-execution-step` injects
a system prompt (`generateBackgroundTaskSystemPrompt`) listing every tool
with its `defaultBackground` flag and instructions for opting tool calls
into background mode. The LLM, given the choice, sometimes elects to
background a tool call → the route returns
`"Background task started. Task ID: …"` instead of the synchronous tool
result, breaking any test that asserts a real tool result.

This happens even when no agent declares per-agent
`backgroundTasks.tools` config — the manager presence alone activates the
prompt path.

**Current workaround**

`backgroundTasks: { enabled: true }` is **omitted** from the fixture.
`/api/background-tasks` still serves `{ tasks: [], total: 0 }` via the
default empty handler, so the route is still smoke-tested for shape.
`tests/background-tasks/background-tasks.test.ts` asserts the empty
envelope + a 404 for an unknown id.

Re-enable only if generate/stream tool-use tests are rewritten to tolerate
either outcome, or if a flag is added to suppress the background-mode
system prompt when no tool opts in.

## 3. Local UI run "hangs" with HTML reporter

**Symptom**

`pnpm test:ui` (no `CI=1`) appears to hang indefinitely after all tests
pass. Process exits 124 / times out at 15 min.

**Root cause**

Default reporter is `html`, which serves the report on a local port and
blocks the process until you `Ctrl-C`. CI mode uses `list + json + junit`
reporters that exit cleanly.

**Workaround**

Run locally with `CI=1 pnpm test:ui` (or pass
`--reporter=list`) when you want the suite to exit on completion.

## 4. LLM tail-latency tightens `toHaveURL` assertions

**Symptom**

Sporadic failures in `agent-chat.spec.ts`, `agent-features.spec.ts`,
`memory/memory-threads.spec.ts` on
`expect(page).toHaveURL(/\/chat\/(?!new)/)`. The URL never transitions
because the model stream is still in flight.

**Cause**

Default Playwright `toHaveURL` timeout (5s) and our earlier 20s were both
too tight under full-suite load on `gpt-4o-mini` with working-memory tool
calls in the loop.

**Workaround**

URL/assistant-message waits in those three specs use a 45s timeout. Keep
this in mind if you add new chat-flow specs.

## 5. Stale dev servers on port 4111 / 4555

Repeatedly observed: long-lived `node .mastra/output/index.mjs` processes
left behind by earlier interactive sessions hold port 4555 (or 4111) and
either cause Playwright's `reuseExistingServer: true` to attach to a stale
build, or block server startup entirely. Symptoms include test isolation
working but full-suite runs hanging.

Before debugging suite-level hangs, always:

```sh
ps aux | grep 'mastra/output' | grep -v grep
lsof -i :4555
# kill any lingering pids
```

## 6. Studio Schedules page CORS quirk (cosmetic)

Studio bundle served from `127.0.0.1:4111` issues SDK requests to
`localhost:4111` with `credentials: 'include'`. Browsers reject the
response because `Access-Control-Allow-Origin: *` is incompatible with
credentialed requests across the `localhost` ↔ `127.0.0.1` boundary, so
the page shows "Failed to load schedules / Failed to fetch" in
hand-driven sessions.

Playwright tests don't hit this because the test runner uses a single
host (`127.0.0.1:4555`) end-to-end. No action required for the smoke
suite, but worth knowing when probing UI with agent-browser.

# MastraCode on the web (React)

A minimal example of running **MastraCode-style coding agent in the browser**. The
coding [`Harness`](../../packages/core/src/harness) lives on the server (registered
on a Mastra instance); a small React app drives it over HTTP using
[`@mastra/client-js`](../../client-sdks/client-js).

This is the same interaction model as the terminal MastraCode — create a session,
stream events, send messages, approve tools — projected over HTTP instead of a TTY.

## How it fits together

```
Browser (React)                    Mastra dev server (:4111)
─────────────────                  ─────────────────────────
@mastra/client-js                  new Mastra({ harnesses: { code } })
  getHarness('code')                 │
    .session(resourceId)             ▼
      .create()      ──POST /api/harness/code/sessions────────►  harness.createSession({ resourceId })
      .subscribe()   ──GET  …/sessions/:rid/stream (SSE)───────►  session.subscribe(...)
      .sendMessage() ──POST …/sessions/:rid/messages───────────►  session.sendMessage(...)
      .abort()       ──POST …/sessions/:rid/abort──────────────►  session.abort()
```

Sessions are **get-or-create** by `resourceId`, so a reload resumes the same
conversation instead of starting a new one.

## Server

[`src/mastra/index.ts`](./src/mastra/index.ts) defines:

- a coding `Agent` whose tools come from a sandboxed `Workspace`
  (`LocalFilesystem` + `LocalSandbox` over `./workspace`) — no hand-rolled file
  tools, the workspace provides read/write/edit/list/run,
- a `Harness` (`build` + `plan` modes) wrapping that agent,
- a `Mastra` instance with the harness registered, which makes `mastra dev`
  serve the `/api/harness/...` routes automatically.

## Run it

```bash
# from this directory
export OPENAI_API_KEY=sk-...

pnpm install --ignore-workspace
pnpm dev            # runs `mastra dev` (server) + `vite` (web) together
```

Then open the Vite URL (default http://localhost:5173). The web app proxies
`/api` to the Mastra dev server on :4111.

The in-repo Mastra packages are wired with `link:` specifiers in `package.json`,
so `--ignore-workspace` uses this worktree's source (which has the Harness +
`@mastra/client-js` harness APIs) rather than published releases. On install,
pnpm may print an esbuild build-script approval prompt — it's harmless for this
example; run `pnpm approve-builds` if you want to silence it.

## Files

| File | Purpose |
| --- | --- |
| `src/mastra/index.ts` | Harness + agent + workspace, registered on Mastra |
| `web/transcript.ts` | Event→UI reducer (text, tools, prompts, mode/model/thread, notices) |
| `web/useHarnessSession.ts` | React hook: create → subscribe → fold events → run-control |
| `web/components.tsx` | Transcript, tool cards, approval/ask_user/plan prompts, status line |
| `web/App.tsx` | App shell: mode tabs, thread switcher, composer with `/` commands |
| `vite.config.ts` | Dev server + `/api` proxy to `:4111` |

## Testing — scenario tests (like MastraCode's TUI scenarios)

MastraCode's terminal UI is tested with **scenario tests**: drive a real
MastraCode against a fixture-backed mock model ([AIMock](https://github.com/CopilotKit/aimock))
and assert on what renders. This example does the web equivalent in
[`scenarios/`](./scenarios):

```
MastraClient ──► Hono ──► @mastra/server routes ──► Harness session ──► AIMock model
   (SDK)        (real)      (real handlers)          (real run-control)   (fixture replay)
                                                            │
                                                      SSE events
                                                            ▼
                                              transcript reducer (the real UI state)
```

Nothing is hand-mocked except the model: the scenario server mounts the **real**
`@mastra/server` harness routes on a **real Hono** app, the **real**
`@mastra/client-js` SDK drives it, and the live SSE stream is folded through the
**same** `web/transcript.ts` reducer the React app uses. Asserting on that
transcript is asserting on the product's on-screen behavior.

| Piece | Role |
| --- | --- |
| `scenarios/aimock.ts` | Starts AIMock with a fixture (OpenAI-wire mock server) |
| `scenarios/harness-server.ts` | Real Hono app + real `@mastra/server` routes + Harness (model → AIMock) |
| `scenarios/driver.ts` | `McE2eTerminal`-style driver: `submit`/`waitForText`/`approve`/`respond` |
| `scenarios/harness.ts` | `runScenario(...)`: wire AIMock + server + driver, then assert |
| `scenarios/*.scenario.test.ts` | The scenarios (chat, multi-turn, ask_user, plan-approval, mode-switch) |
| `scenarios/fixtures/*.json` | AIMock fixtures (prompt/tool-call → response) |

Run them:

```bash
pnpm test
```

Add a scenario by dropping a fixture in `scenarios/fixtures/` and a
`*.scenario.test.ts` that calls `runScenario({ aimockFixture, run })` — exactly
the shape of a MastraCode TUI scenario, but asserting on the web transcript.

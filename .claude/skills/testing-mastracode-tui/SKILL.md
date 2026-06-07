---
name: testing-mastracode-tui
description: Testing Mastra Code TUI behavior and writing MC e2e scenarios. Use when adding, reviewing, or running Mastra Code terminal UI tests, @microsoft/tui-test scenarios, AIMock-backed LLM smoke tests, live observe runs, or regression shields for TUI-visible behavior.
---

# Testing Mastra Code TUI

Use this skill when writing or validating Mastra Code TUI/e2e tests.

## Test layers

- Prefer focused colocated unit tests for pure rendering, parsing, model resolution, command handlers, or storage helpers.
- Use `mastracode/scripts/mc-e2e/` for behavior that is TUI-visible, TUI-triggered, user-observable in the terminal, or depends on the real terminal/event loop.
- For Mastra Code recovery work, TUI e2e coverage is required for TUI-visible/TUI-triggered behavior before a tracker row can be marked validated. Lower-level tests are supporting shields, not replacements for the user-perspective e2e gate.
- For LLM scenarios, use AIMock fixtures. Do not rely on local provider credentials in CI-style tests.

## Commands

Run from the repo root:

```bash
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:list
pnpm --filter ./mastracode run e2e:test
pnpm --filter ./mastracode run e2e:test automated-chat
pnpm --filter ./mastracode run e2e:test -- --jobs 2
pnpm --filter ./mastracode run e2e:observe startup
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

Use `e2e:test` for CI/headless pass/fail. Use `e2e:observe <scenario>` only when you need live visible TUI output.

## Adding an e2e scenario

1. Add a scenario file under `mastracode/scripts/mc-e2e/scenarios/`.
2. Export a `McE2eScenario` object.
3. Register it in `mastracode/scripts/mc-e2e/scenarios/index.ts`.
4. If the scenario calls an LLM, add an AIMock fixture under `mastracode/scripts/mc-e2e/fixtures/`.
5. Verify the single scenario, then all scenarios if the runner or shared helpers changed.

Pattern:

```ts
import type { McE2eScenario } from './types.js';

export const myScenario = {
  name: 'my-scenario',
  title: 'describes user-visible behavior',
  async run({ terminal, runtime }) {
    await runtime.waitForScreenText(/Mastra Code/);
    await terminal.submit('Return the configured Mastra Code e2e smoke phrase.');
    await runtime.waitForScreenText(/MC automated chat smoke response/);
    await terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
```

## AIMock fixture rules

- Use `openai/gpt-5.4-mini` for MC e2e model fixtures unless the test specifically covers model selection.
- Match the actual user prompt with `match.userMessage`.
- Use `endpoint: "chat"` for OpenAI fixtures; AIMock normalizes Responses API requests into chat-style fixture matching.
- Ensure LLM scenarios assert through the runner's AIMock request count. A passing LLM scenario should show a nonzero AIMock request count.
- Use AIMock's first-class tool-call fixture shape for model-driven tool behavior instead of synthesizing Harness events. A fixture response may include `toolCalls: [{ name, arguments, id? }]`; pair the follow-up fixture with `match.hasToolResult: true` when the model should answer after the real tool executes.
- Use `streamingProfile` and, when useful, `chunkSize` to make streamed content or streamed tool-call arguments observable in the TUI. For example, `{ "streamingProfile": { "ttft": 200, "tps": 2 } }` slows chunks enough to assert partial UI states.
- For structured-output paths such as `/goal` judge decisions, use AIMock structured-output matching: `match.responseFormat: "json_object"` and object-valued `response.content`; AIMock auto-stringifies object content in fixture files.
- If realistic long conversations or observational-memory examples are needed, read from the local Mastra Code database in Application Support only with read-only operations, sanitize user/project/provider data, and commit only deterministic AIMock-compatible fixtures derived from that data.
- Use `--record-ai` only for explicit fixture authoring/debugging, never as default CI behavior.

Example fixture shape:

```json
{
  "fixtures": [
    {
      "match": {
        "endpoint": "chat",
        "model": "gpt-5.4-mini",
        "userMessage": "Return the configured Mastra Code e2e smoke phrase."
      },
      "response": {
        "content": "MC automated chat smoke response"
      }
    }
  ]
}
```

## Runner invariants

- Do not generate scenario source, wrapper tests, or config files. The wrapper is static: `mastracode/scripts/mc-e2e/tui.test.ts`.
- Keep scenario logic in checked-in files. The runner passes runtime config through env vars into the static wrapper.
- Runtime behavior should be driven as close to a real user as possible: terminal input, slash commands, keyboard navigation, AIMock model/tool fixtures, and sanitized DB/config seeding before launch.
- Do not reach into Harness internals at runtime for user-visible behavior. Avoid `harness.emit()`, `getDisplayState()` mutation, or direct thread APIs like `createThread()`/`getCurrentThreadId()` when `/new`, `/threads`, or normal TUI startup can exercise the behavior. The allowed exception is notification/state signal scenarios, where the user-visible event originates outside terminal input and should use the public agent signal APIs (`sendNotificationSignal`, `sendStateSignal`).
- Keep per-scenario runtime isolation: app data dir, DB paths, temp project dir, and provider env.
- Do not spread real user app data into tests. Use `MASTRA_APP_DATA_DIR` for isolated app data.
- Keep observe mode live and readable; do not switch back to record-then-replay unless explicitly requested.
- If AIMock appears to receive zero requests, first check whether the runner is blocking the Node event loop. AIMock must stay alive while the `tui-test` child process runs.

## Manual/rendering tests

For narrow rendering bugs, a colocated unit test or tiny render helper can be better than e2e. Render the component at multiple terminal widths and assert semantic output or visible widths after stripping ANSI codes.

Use e2e when the behavior depends on real keyboard input, startup context, terminal sizing, model wiring, thread/session behavior, or visible TUI integration.

For features with distinct live-streaming and loaded-from-history/reload projections, test both paths when practical. If only the live path is covered, mark the recovery row `partial` and explicitly name the missing persisted-history/reload parity.

## Verification checklist

For a new/changed e2e scenario:

```bash
pnpm --filter ./mastracode run e2e:test <scenario>
pnpm --filter ./mastracode run e2e:test -- --jobs 2
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

If package dependencies or core dist artifacts changed, also run:

```bash
pnpm run build:mastracode
```

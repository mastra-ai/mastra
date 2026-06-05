# TUI and AIMock discovery for Mastra Code e2e tests

## Purpose

Mastra Code needs a real TUI e2e harness before broad feature test recovery begins. The goal is to prove user-visible behavior through the running terminal UI while keeping model behavior deterministic.

This discovery pass inspected:

- `/Users/tylerbarnes/code/microsoft/tui-test` (`@microsoft/tui-test`)
- `/Users/tylerbarnes/code/CopilotKit/aimock` (`@copilotkit/aimock`)

## Important caveat

AIMock's Mastra documentation is useful for intent, but its Mastra code snippets appear out of date. In particular, the docs show an older object-style model config with `provider: "OPEN_AI"`. Treat the AIMock docs as evidence of AIMock capabilities, not as current Mastra API guidance.

For actual Mastra Code tests, follow current Mastra/Mastra Code model configuration patterns from this repo.

## `@microsoft/tui-test` findings

`tui-test` is a real terminal test runner built on `@xterm/headless` plus `node-pty`.

Useful exposed APIs:

- `test`, `expect`, `Shell`, `Key`, `MouseKey`
- `test.use({ shell, rows, columns, env, program })`
- `program: { file, args }` to launch a binary directly instead of an interactive shell
- Terminal input:
  - `write(text)`
  - `submit(text?)`
  - `keyUp`, `keyDown`, `keyLeft`, `keyRight`
  - `keyEscape`, `keyBackspace`, `keyDelete`, `keyCtrlC`, `keyCtrlD`
  - `keyPress(key, { ctrl, alt, shift })`
  - mouse events (`mouseDown`, `mouseUp`, `mousePress`, `mouseTo`)
- Terminal inspection:
  - `getByText(string | RegExp, { full?, strict? })`
  - `getBuffer()`
  - `getViewableBuffer()`
  - `getCursor()`
  - `serialize()` / `toMatchSnapshot({ includeColors? })`
- Assertions:
  - `toBeVisible`
  - `toHaveBgColor`
  - `toHaveFgColor`
  - `toMatchSnapshot`

Runner/config behavior:

- Default terminal size is 80 columns x 30 rows.
- Default assertion timeout is 5s; test timeout is 30s.
- Supports per-project shell/program/env config.
- Supports retries, trace output, and snapshots.
- Locator polling happens at 50ms intervals.
- Failed locator waits include a terminal snapshot, which is useful for debugging flakes.

### Fit for Mastra Code

`tui-test` is a strong fit for the TUI side of the regression shield because it drives a real PTY and observes actual terminal output.

Recommended first harness shape:

1. Add a small Mastra Code e2e package/test folder that launches the built Mastra Code CLI via `program: { file, args }`.
2. Provide a wrapper around `terminal` with Mastra Code-specific helpers:
   - `startMastraCode({ configDir, cwd, aimockUrl, columns, rows })`
   - `waitForReady()`
   - `submitPrompt(text)`
   - `runSlashCommand(command)`
   - `expectVisible(text | regexp)`
   - `expectNotVisible(text | regexp)`
   - `snapshotScreen(name?)`
   - `readScreenText()`
3. Force hermetic env:
   - Clear real provider API keys unless a test explicitly opts into live recording.
   - Set mock provider base URLs before the process starts.
   - Use a per-test config directory and workspace directory.
4. Run TUI tests serially at first. Mastra Code uses persistent config/storage, so isolation matters more than parallel speed initially.

### Open decision

`tui-test` has its own runner rather than Vitest. We can either:

- Use its runner directly as a separate command, or
- Reuse/wrap its terminal primitives from Vitest if the package shape permits it.

Given the goal is broad TUI e2e coverage, using the runner directly is likely the fastest path. CI can run it as a separate Mastra Code e2e job.

## AIMock findings

AIMock is a broad AI API mock server. For Mastra Code e2e, the relevant class is still named `LLMock`.

Useful APIs:

- `new LLMock({ port: 0 })`
- `await mock.start()` returns a local server URL.
- `await mock.stop()` releases the port.
- `mock.url`, `mock.baseUrl`, `mock.port`
- Fixture setup:
  - `addFixture(fixture)`
  - `addFixtures(fixtures)`
  - `loadFixtureFile(path)`
  - `loadFixtureDir(path)`
  - `on(match, response, opts?)`
  - `onMessage(pattern, response, opts?)`
  - `onToolCall(name, response, opts?)`
  - `onToolResult(id, response, opts?)`
  - `onTurn(turn, pattern, response, opts?)`
  - `onJsonOutput(pattern, jsonContent, opts?)`
- Request assertions:
  - `getRequests()`
  - `getLastRequest()`
  - `clearRequests()`
  - `resetMatchCounts()`
- Recording:
  - `enableRecording(recordConfig)`
  - `disableRecording()`

Fixture matching supports:

- Last user message substring or regex
- Joined system messages (`systemMessage`) for context-gated fixtures
- Tool name
- Tool call id
- Model name
- Response format
- Sequence index
- Turn index
- Whether the request has a tool result
- Endpoint type
- Custom predicate

Fixture responses support:

- Text content
- Tool calls
- Content plus tool calls
- JSON output
- Errors
- Embeddings and multimedia endpoints, though those are less relevant to initial Mastra Code TUI tests

AIMock has a Vitest plugin (`@copilotkit/aimock/vitest`) that starts/stops the server and patches `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL`. That plugin is useful for regular Vitest integration tests, but Mastra Code TUI tests will spawn a separate process, so the harness should usually start `LLMock` itself and pass env into the spawned PTY process.

## AIMock record/replay answer

Yes, AIMock can record real interactions.

Record mode behavior:

1. Client sends request to AIMock.
2. AIMock tries normal fixture matching.
3. On fixture miss, AIMock proxies the request to the configured real upstream provider.
4. The upstream response is relayed back to the client.
5. AIMock saves the response as a fixture on disk and registers it in memory.
6. Subsequent identical requests replay the recorded fixture.

Programmatic shape:

```ts
const mock = new LLMock({ port: 0 });
await mock.start();

mock.enableRecording({
  providers: {
    openai: 'https://api.openai.com',
    anthropic: 'https://api.anthropic.com',
  },
  fixturePath: './fixtures/recorded',
});
```

CLI shape:

```bash
llmock -f ./fixtures \
  --record \
  --provider-openai https://api.openai.com \
  --provider-anthropic https://api.anthropic.com
```

Proxy-only mode also exists:

```bash
llmock -f ./fixtures \
  --proxy-only \
  --provider-openai https://api.openai.com
```

`proxyOnly` forwards fixture misses to real providers but does not write fixtures or cache them in memory.

Supported recording providers include:

- OpenAI
- Anthropic
- Gemini
- Gemini Interactions
- Vertex AI
- Bedrock
- Azure
- Ollama
- Cohere
- ElevenLabs
- fal

Recording options include:

- `providers`
- `fixturePath`
- `proxyOnly`
- `recordFullModelVersion`
- `upstreamTimeoutMs`
- `bodyTimeoutMs`
- fal queue polling options

Streaming behavior:

- AIMock collapses supported streaming responses into replayable fixtures.
- Supported stream collapse formats include OpenAI SSE, Anthropic SSE, Gemini SSE, Cohere SSE, Ollama NDJSON, and Bedrock EventStream.
- Collapsed fixtures preserve text, tool calls, reasoning/web-search metadata where supported, and some multimedia/audio forms.

Recommended policy for Mastra Code:

- Use AIMock recording only as a local fixture-generation workflow.
- CI should run replay-only against committed deterministic fixtures.
- Live recording should require explicit opt-in and real provider credentials.
- Recorded fixtures should be reviewed before committing because they encode provider behavior and may include prompt/context data.

## Combined harness design

The target harness should combine both tools:

1. Start AIMock programmatically with deterministic fixtures.
2. Build a hermetic Mastra Code config directory that points the active model/provider at AIMock.
3. Spawn Mastra Code under `tui-test` with that config directory and sanitized env.
4. Drive the real TUI with keyboard input.
5. Assert both:
   - terminal-visible behavior through `tui-test`; and
   - backend/model behavior through AIMock's request journal.

This lets a single e2e test prove all of the following:

- The user-visible TUI flow works.
- The correct prompt text is submitted.
- The configured model endpoint is used.
- Tool-call loops reach the model and tool layers.
- Status/dialog/rendering behavior is visible in the terminal.
- State does not leak across isolated config dirs, threads, or workspaces.

## First spike recommendation

Create one narrow spike before designing the full slash-command workflow:

1. Pick a tiny TUI-visible feature that already has simple expected output.
2. Start AIMock with one `onMessage` fixture.
3. Spawn Mastra Code in a per-test config dir pointed at AIMock.
4. Submit one prompt through the TUI.
5. Assert:
   - prompt/user message appears;
   - mocked assistant response appears;
   - AIMock recorded exactly one chat request;
   - no real provider env var was used.
6. Add one snapshot or screen text helper only if direct text assertions are insufficient.

Good first candidates:

- Basic prompt submission and mocked assistant response.
- `/help` overlay rendering.
- Model/status-line display with a mocked provider config.

Avoid starting with thread switching, tool calls, notifications, or GitHub signals until the harness lifecycle is proven.

## Risks and questions

- Current Mastra Code model configuration needs to be wired correctly for AIMock; do not copy AIMock's stale Mastra docs blindly.
- `tui-test` runner integration with the existing repo scripts/CI needs a decision.
- Terminal snapshots can be brittle; prefer semantic text assertions where possible, with snapshots reserved for layout-sensitive contracts.
- E2E tests must isolate config/storage aggressively to avoid the same local-env leak class already seen in `model.test.ts`.
- Live recording must never run by default in CI.

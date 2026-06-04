# AIMock exploration for Mastra Code TUI testing

## Headline

`@copilotkit/aimock` looks useful for the first real Mastra Code TUI harness spike, but only if we route Mastra Code through an OpenAI-compatible/custom-provider path first. Do not assume it automatically covers every Mastra Code provider/OAuth path until verified.

## What was verified

Sources checked on 2026-06-04:

- npm package metadata for `@copilotkit/aimock@1.28.0`
- published package README and `.d.ts` files from `npm pack @copilotkit/aimock@1.28.0`
- docs pages:
  - https://aimock.copilotkit.dev
  - https://aimock.copilotkit.dev/integrate-mastra
  - https://aimock.copilotkit.dev/fixtures
  - https://aimock.copilotkit.dev/test-plugins
  - https://github.com/marketplace/actions/setup-aimock

Package metadata says the repository is `https://github.com/CopilotKit/aimock.git`, although some web results still surface the older/compat `CopilotKit/llmock` path. Treat repo naming as legacy churn, not a blocker.

## What AIMock provides

AIMock is a Node package/CLI for deterministic AI-service mocking. The package README describes support for:

- OpenAI Chat, OpenAI Responses, and OpenAI Realtime
- Claude Messages
- Gemini, Gemini Live, Gemini Interactions
- Azure OpenAI, Bedrock, Vertex, Ollama, Cohere
- embeddings
- MCP tools/resources/prompts
- A2A agents
- AG-UI event streams
- vector DB-compatible endpoints
- service mocks such as Tavily search, Cohere rerank, moderation, and TTS

The core API is `LLMock`:

```ts
import { LLMock } from '@copilotkit/aimock';

const mock = new LLMock({ strict: true });
mock.onMessage('hello', { content: 'Hi!' });
await mock.start();
process.env.OPENAI_BASE_URL = `${mock.url}/v1`;
```

Useful published `LLMock` methods include:

- `onMessage(pattern, response)`
- `onToolCall(name, response)`
- `onToolResult(id, response)`
- `onTurn(turn, pattern, response)`
- `onEmbedding(pattern, response)`
- `onJsonOutput(pattern, jsonContent)`
- `onSearch(pattern, results)`
- `nextRequestError(status, errorBody)`
- `getRequests()` / `getLastRequest()` / `clearRequests()`
- `setChaos()` / `clearChaos()`
- `enableRecording()` / `disableRecording()`

## Fixture matching that matters for Mastra Code

Fixtures can match on fields that are directly relevant to MC regression tests:

- `userMessage`
- `systemMessage`
- `model`
- `toolName`
- `toolCallId`
- `turnIndex`
- `sequenceIndex`
- `hasToolResult`
- `responseFormat`
- `context`
- custom `predicate(req)`

The `systemMessage` matcher is especially useful for Mastra Code because many regressions are state-projection problems. We can make fixtures require specific prompt-context content, such as current mode, active tasks, AGENTS.md reminders, sandbox paths, or goal state. If the prompt context silently drifts, the fixture should fail instead of returning a stale canned response.

## Why this fits the MC testing problem

Mastra Code needs tests that exercise product behavior through the actual runtime/TUI path, not just helper functions. AIMock can remove live model nondeterminism while still letting the real app build prompts, stream responses, call tools, update state, and persist sessions.

Good first targets:

1. **Headless smoke tests**
   - Run built MC in headless mode.
   - Point model calls at AIMock.
   - Assert prompt/context, tool calls, final response, and persisted thread/session state.

2. **Real TUI PTY tests**
   - Launch the built TUI under a PTY driver.
   - Send real keyboard input.
   - Use AIMock for deterministic streaming/tool responses.
   - Assert rendered state and follow-up prompt context.

3. **Regression reproductions for Harness v1 state drift**
   - Task list in prompt/context vs task tool state.
   - Mode/model after reload.
   - New session/thread creation.
   - Goal judge continuation/waiting/done flows.

## Likely integration shape

For the first spike, prefer the narrowest route:

1. Add AIMock as a dev dependency only if the spike proves it works.
2. Start with OpenAI-compatible routing because the package README and Mastra integration docs explicitly use `OPENAI_BASE_URL`.
3. Configure MC to use a fake/custom OpenAI-compatible model for tests.
4. Run built MC against `OPENAI_BASE_URL=http://127.0.0.1:<port>/v1`.
5. Use `strict: true` so unmatched model calls fail loudly.
6. Use fixtures that match both `userMessage` and `systemMessage` for state-sensitive behavior.
7. Inspect `LLMock#getRequests()` to verify what MC actually sent.

Example fixture shape:

```json
{
  "fixtures": [
    {
      "match": {
        "userMessage": "show my tasks",
        "systemMessage": ["<current-task-list>", "Fix mode reload"]
      },
      "response": {
        "content": "I can see the current task list."
      }
    }
  ]
}
```

## Important caveats

- Published package types for `@copilotkit/aimock@1.28.0` document `useAimock({ patchEnv: true })` as setting `OPENAI_BASE_URL`; the website says it sets both `OPENAI_BASE_URL` and `ANTHROPIC_BASE_URL`. Verify behavior in code before relying on Anthropic patching.
- Mastra Code's OAuth provider paths are not the same as a vanilla OpenAI SDK call. Claude Max and Codex routes use custom provider/fetch logic, so AIMock may require explicit base URL wiring or a test-only provider path.
- AIMock is not a PTY/TUI harness. It only solves deterministic AI-service responses. We still need a terminal driver and assertions over rendered state/output.
- Record/replay is tempting, but for MC regression tests fixture-first is safer. Recording live model responses risks baking in bad or overly broad behavior.
- Strict mode should be mandatory in CI; otherwise missing fixtures can look like ordinary HTTP failures instead of a test harness failure.

## Recommendation

Use AIMock for workstream 4, but as one piece of the harness:

- **AIMock**: deterministic model/tool/service endpoint.
- **PTY driver**: real TUI input/output.
- **isolated MC config/storage dir**: no leakage from user auth, model packs, or prior threads.
- **state assertions**: inspect rendered TUI, prompt context, mock request journal, and persisted session/thread state.

First spike should prove one complete loop:

1. Start AIMock with a strict fixture.
2. Launch built MC with isolated config/storage and an OpenAI-compatible test model.
3. Send one prompt through headless mode or PTY.
4. Assert AIMock received expected system/user content.
5. Assert MC rendered/returned expected output.
6. Assert persisted thread/session state is correct after reload.

If that works, AIMock becomes a good foundation for deterministic MC product tests. If it does not work through MC's normal model routing, build a tiny test-only provider adapter rather than contorting all OAuth paths at once.

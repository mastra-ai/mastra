# @internal/test-utils

Mastra-specific test helpers. Provides version-agnostic agent wrappers, API key management, and provider-scoped LLM mocking for integration tests.

> **Note**: This is an internal package. Not for public consumption.
>
> For LLM recording/replay, see [`@internal/llm-recorder`](../_llm-recorder/README.md).

## Installation

```json
{
  "devDependencies": {
    "@internal/test-utils": "workspace:*"
  }
}
```

## API Reference

### Version-Agnostic Agent Helpers

Helper functions for writing tests that work with both AI SDK v4 and v5+ models:

```typescript
import { agentGenerate, agentStream, isV5PlusModel, getModelRecordingName } from '@internal/test-utils';
```

#### `agentGenerate(agent, message, options, model)`

Calls `agent.generate()` (v5+) or `agent.generateLegacy()` (v4), transforming `threadId`/`resourceId` to the `memory: { thread, resource }` format for v5+. Also maps `output` → `structuredOutput` for v5+.

```typescript
const result = await agentGenerate(agent, 'Hello', { threadId, resourceId }, model);

// With structured output (v5+ uses structuredOutput, v4 uses output)
const result = await agentGenerate(agent, 'Extract data', { threadId, output: mySchema }, model);
```

#### `agentStream(agent, message, options, model)`

Calls `agent.stream()` (v5+) or `agent.streamLegacy()` (v4), transforming parameters the same way as `agentGenerate`.

```typescript
const stream = await agentStream(agent, 'Count to 5', { threadId }, model);
```

#### `isV5PlusModel(model)`

Check if a model uses the v5+ API:

```typescript
isV5PlusModel('openai/gpt-4o'); // true (string models)
isV5PlusModel({ specificationVersion: 'v2' }); // true
isV5PlusModel({ specificationVersion: 'v1' }); // false
```

#### `getModelRecordingName(model)`

Convert a model config to a recording-safe filename:

```typescript
getModelRecordingName('openai/gpt-4o-mini'); // "openai-gpt-4o-mini"
getModelRecordingName({ modelId: 'gpt-4o' }); // "gpt-4o"
```

### API Key Management

#### `setupDummyApiKeys(mode, providers?)`

Set placeholder API keys for replay mode so agent validation passes without real credentials:

```typescript
import { setupDummyApiKeys } from '@internal/test-utils';
import { getLLMTestMode } from '@internal/llm-recorder';

setupDummyApiKeys(getLLMTestMode()); // All providers
setupDummyApiKeys(getLLMTestMode(), ['openai']); // Just OpenAI
setupDummyApiKeys('live'); // No-op in live/record mode
```

#### `hasApiKey(provider)`

Check if an API key is set:

```typescript
import { hasApiKey } from '@internal/test-utils';

hasApiKey('openai'); // checks OPENAI_API_KEY
hasApiKey('anthropic'); // checks ANTHROPIC_API_KEY
hasApiKey('google'); // checks GOOGLE_API_KEY
hasApiKey('openrouter'); // checks OPENROUTER_API_KEY
```

### Provider-Scoped LLM Mocking

Mock specific LLM providers while leaving others live. Built on `@internal/llm-recorder` for recording/replay.

Returns a self-contained instance — no global state. You control the lifecycle.

```typescript
import { createLLMMock } from '@internal/test-utils';
```

#### `createLLMMock(model, options?)`

Create a mock by wrapping a real AI SDK model instance. The mock reads its `provider` and `modelId` for naming the recording file. MSW intercepts all LLM API traffic.

```typescript
import { openai } from '@ai-sdk/openai';

describe('OpenAI agent', () => {
  const mock = createLLMMock(openai('gpt-4o'));

  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  it('generates a response', async () => {
    const result = await agent.generate('Hello');
    expect(result.text).toBeDefined();
  });
});
```

Works with any AI SDK model instance:

```typescript
createLLMMock(openai('gpt-4o')); // recording tagged with openai.chat + gpt-4o
createLLMMock(anthropic('claude-3')); // recording tagged with anthropic + claude-3
```

> **Note**: For gateway/string models like `'openai/gpt-4o'`, use `createGatewayMock()` instead.

The returned `LLMMock` instance has:

| Property / Method | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `providerId`      | Extracted provider (e.g. `"openai"`)                   |
| `modelId`         | Extracted model if present (e.g. `"gpt-4o"`)           |
| `recordingName`   | Name used for the recording file                       |
| `mode`            | Current test mode (`record`, `replay`, `auto`, `live`) |
| `start()`         | Start intercepting requests                            |
| `saveAndStop()`   | Save recordings and stop intercepting                  |
| `recorder`        | Underlying `LLMRecorderInstance` for advanced use      |

Options:

- `name` — Explicit recording name (auto-derived from test file path if omitted)
- `recordingsDir` — Directory for recording files (default: `__recordings__` in cwd)
- `forceRecord` — Force re-record even if recording exists
- `replayWithTiming` — Replay with original chunk timing
- `maxChunkDelay` — Max delay between chunks in replay, ms (default: 10)
- `transformRequest` — Transform requests before hashing
- `extraHosts` — Additional API hosts to intercept (merged with auto-detected ones)
- `debug` — Enable verbose debug logging

### Utility Functions

#### `extractProviderId(modelRouterId)`

Extract the provider from a model router ID:

```typescript
extractProviderId('openai/gpt-4o'); // 'openai'
extractProviderId('netlify/anthropic/claude-3'); // 'anthropic'
extractProviderId('azure-openai/my-deployment'); // 'azure-openai'
```

#### `extractModelId(modelRouterId)`

Extract the model from a model router ID:

```typescript
extractModelId('openai/gpt-4o'); // 'gpt-4o'
extractModelId('netlify/anthropic/claude-3'); // 'claude-3'
extractModelId('openai'); // undefined
```

#### `PROVIDER_HOSTS`

Mapping of known provider IDs to their API hosts. Exported for advanced use cases.

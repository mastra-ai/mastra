# @internal/test-utils

Mastra-specific test helpers. Provides version-agnostic agent wrappers and API key management for integration tests.

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

## Development

```bash
# Build
pnpm build

# Run tests
pnpm test
```

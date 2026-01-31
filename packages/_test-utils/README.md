# @internal/test-utils

Internal test utilities for Mastra packages. Provides LLM API recording and replay for fast, deterministic CI tests.

> **Note**: This is an internal package. Not for public consumption.

## Features

- **LLM Recording/Replay**: Record real LLM API responses and replay them in tests
- **MSW-based**: Uses Mock Service Worker for reliable HTTP interception
- **Streaming Support**: Captures and replays SSE streaming responses with chunk timing
- **Contract Validation**: Detect API schema drift in nightly tests
- **Multi-provider**: Supports OpenAI, Anthropic, Google, and OpenRouter APIs

## Installation

This package is internal to the Mastra monorepo. Add it as a dev dependency:

```json
{
  "devDependencies": {
    "@internal/test-utils": "workspace:*"
  }
}
```

## Usage

### Basic Recording/Replay

```typescript
import { describe, it, expect } from 'vitest';
import { useLLMRecording } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';

describe('My Agent Tests', () => {
  // One-line setup - handles beforeAll/afterAll automatically
  useLLMRecording('my-agent-tests');

  it('generates text', async () => {
    const agent = new Agent({
      id: 'test-agent',
      model: 'openai/gpt-4o-mini',
      instructions: 'You are helpful.',
    });

    const response = await agent.generate('Hello');
    expect(response.text).toBeDefined();
  });

  it('streams text', async () => {
    const agent = new Agent({
      id: 'stream-agent',
      model: 'openai/gpt-4o-mini',
      instructions: 'You are helpful.',
    });

    const { textStream } = await agent.stream('Count to 3');
    const chunks = [];
    for await (const chunk of textStream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### Test Modes

Control behavior via `LLM_TEST_MODE` environment variable:

```bash
# Live mode (default) - Real API calls, no recording
pnpm test

# Replay mode - Fast, deterministic, uses recordings
LLM_TEST_MODE=replay pnpm test

# Record mode - Makes real API calls, saves new recordings
LLM_TEST_MODE=record pnpm test
```

**Mode Selection Priority:**

1. `LLM_TEST_MODE=replay|record|live` - explicit mode
2. `RECORD_LLM=true` - legacy, same as record
3. `CI=true` - auto-replay in CI environments
4. Default: **live** (real API calls for local development)

### API Key Handling

In replay mode, HTTP is mocked so API keys aren't needed. Use `setupDummyApiKeys()` to set placeholder keys that satisfy validation:

```typescript
import { getLLMTestMode, setupDummyApiKeys } from '@internal/test-utils';

const MODE = getLLMTestMode();

// Sets dummy keys for all providers (openai, anthropic, google, openrouter)
// Only runs in replay mode, preserves existing keys
setupDummyApiKeys(MODE);

// Or specify which providers:
setupDummyApiKeys(MODE, ['openai', 'anthropic']);
```

Check if a real key is available:

```typescript
import { hasApiKey } from '@internal/test-utils';

if (!hasApiKey('openai') && MODE !== 'replay') {
  console.log('Skipping - no API key');
  return;
}
```

### Contract Validation (Nightly Tests)

Detect API schema drift by comparing live responses against recordings:

```typescript
import { validateLLMContract, formatContractResult } from '@internal/test-utils';

// Compare structures (not exact values)
const result = validateLLMContract(liveResponse, recordedResponse);

if (!result.valid) {
  console.error('API schema drift detected!');
  console.error(formatContractResult(result));
}
```

## API Reference

### `useLLMRecording(name, options?)`

Vitest helper that handles setup/teardown automatically.

```typescript
const recording = useLLMRecording('my-tests', {
  recordingsDir: './__recordings__', // Where to store recordings (default: process.cwd()/__recordings__)
  forceRecord: false,      // Force record mode
  replayWithTiming: false, // Simulate original chunk timing
  maxChunkDelay: 10,       // Max delay between chunks (ms)
});

// Properties
recording.mode        // 'live' | 'record' | 'replay'
recording.isLive      // true if live mode
recording.isRecording // true if record mode
recording.recordingCount // Number of recordings captured
```

### `setupLLMRecording(options)`

Lower-level API for manual setup:

```typescript
import { setupLLMRecording } from '@internal/test-utils';

const recorder = setupLLMRecording({ name: 'my-tests' });

beforeAll(() => recorder.start());
afterAll(async () => {
  await recorder.save();
  recorder.stop();
});
```

### `getLLMTestMode()`

Get the current test mode:

```typescript
import { getLLMTestMode } from '@internal/test-utils';

const mode = getLLMTestMode(); // 'live' | 'record' | 'replay'
```

### Version-Agnostic Agent Helpers

Helper functions for writing tests that work with both AI SDK v4 and v5+ models:

```typescript
import {
  agentGenerate,
  agentStream,
  isV5PlusModel,
  getModelRecordingName,
} from '@internal/test-utils';

// Version-agnostic generate - calls correct method based on model
const result = await agentGenerate(
  agent,
  'Hello',
  { threadId: '123', resourceId: 'user' },
  model
);

// Version-agnostic stream
const stream = await agentStream(
  agent,
  'Count to 5',
  { threadId: '123' },
  model
);

// Check model version
if (isV5PlusModel(model)) {
  // v5+ uses agent.generate() with memory: { thread, resource }
} else {
  // v4 uses agent.generateLegacy() with threadId/resourceId
}

// Get a safe filename for recordings
const name = getModelRecordingName('openai/gpt-4o-mini');
// Returns: "openai-gpt-4o-mini"
```

### Contract Validation

```typescript
import {
  validateLLMContract,
  validateStreamingContract,
  extractSchema,
  formatContractResult,
} from '@internal/test-utils';

// Validate response structure
const result = validateLLMContract(actual, expected, {
  ignorePaths: ['custom.path'],   // Additional paths to ignore
  allowExtraFields: true,         // New fields OK (default)
  allowMissingFields: false,      // Removed fields = breaking (default)
  treatNullAsOptional: true,      // null ≈ missing (default)
});

// Validate streaming chunks
const streamResult = validateStreamingContract(actualChunks, expectedChunks);

// Format for display
console.log(formatContractResult(result));
```

### `setupDummyApiKeys(mode, providers?)`

Set placeholder API keys for replay mode:

```typescript
setupDummyApiKeys('replay');                    // All providers
setupDummyApiKeys('replay', ['openai']);        // Just OpenAI
setupDummyApiKeys('live');                      // No-op in live/record mode
```

### `hasApiKey(provider)`

Check if an API key is set:

```typescript
hasApiKey('openai')     // checks OPENAI_API_KEY
hasApiKey('anthropic')  // checks ANTHROPIC_API_KEY
hasApiKey('google')     // checks GOOGLE_API_KEY
hasApiKey('openrouter') // checks OPENROUTER_API_KEY
```

### `agentGenerate(agent, message, options, model)`

Version-agnostic wrapper for `agent.generate()` / `agent.generateLegacy()`:

```typescript
const result = await agentGenerate(agent, 'Hello', { threadId, resourceId }, model);
```

### `agentStream(agent, message, options, model)`

Version-agnostic wrapper for `agent.stream()` / `agent.streamLegacy()`:

```typescript
const stream = await agentStream(agent, 'Count to 5', { threadId }, model);
```

### `isV5PlusModel(model)`

Check if a model uses the v5+ API:

```typescript
isV5PlusModel('openai/gpt-4o')           // true (string models)
isV5PlusModel({ specificationVersion: 'v2' }) // true
isV5PlusModel({ specificationVersion: 'v1' }) // false
```

### `getModelRecordingName(model)`

Convert a model config to a recording-safe filename:

```typescript
getModelRecordingName('openai/gpt-4o-mini')    // "openai-gpt-4o-mini"
getModelRecordingName({ modelId: 'gpt-4o' })   // "gpt-4o"
```

## Recording Storage

Recordings are stored as human-readable JSON in your package's `__recordings__/` directory (relative to `process.cwd()`):

```
your-package/
├── __recordings__/
│   └── my-agent-tests.json
└── src/
    └── tests/
```

You can customize the location via the `recordingsDir` option.

Each recording contains:
- Request URL, method, body
- Response status, headers
- For streaming: individual chunks with timing data

## Request Matching

Recordings use **content-based matching**, not sequential order. Each request is matched by an MD5 hash of:
- Request URL
- Request body (with object keys sorted for consistency)

This means:
- **Tests can run in any order** - replay doesn't depend on execution sequence
- **Parallel tests work** - each request finds its matching recording independently
- **Identical requests share recordings** - if two tests make the same request, they get the same response

If a request has no matching recording, you'll see an error with the hash and available hashes for debugging.

## Supported LLM Providers

The recorder intercepts requests to:
- `api.openai.com`
- `api.anthropic.com`
- `generativelanguage.googleapis.com`
- `openrouter.ai`

## Performance

| Mode | Typical Duration | Use Case |
|------|-----------------|----------|
| Live | 5-30s per test | Local dev, debugging |
| Record | 5-30s per test | Creating fixtures |
| Replay | <100ms per test | CI, fast iteration |

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Run tests in record mode
LLM_TEST_MODE=record OPENAI_API_KEY=sk-xxx pnpm test
```

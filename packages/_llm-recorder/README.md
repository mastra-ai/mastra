# @internal/llm-recorder

LLM response recording and replay for tests. Works like test snapshots — auto-records on first run, replays deterministically thereafter.

> **Note**: This is currently an internal package. It will become a public package in the future.

## Features

- **Recording/Replay**: Record real LLM API responses and replay them in tests
- **MSW-based**: Uses Mock Service Worker for reliable HTTP interception
- **Streaming Support**: Captures and replays SSE streaming responses with chunk timing
- **Contract Validation**: Detect API schema drift in nightly tests
- **Multi-provider**: Supports OpenAI, Anthropic, Google, and OpenRouter APIs
- **Content-based Matching**: Requests matched by MD5 hash of URL + body, not order

## Installation

```json
{
  "devDependencies": {
    "@internal/llm-recorder": "workspace:*"
  }
}
```

## Usage

There are four ways to enable LLM recording, from most automated to most manual:

### 1. Suite-wide via Vite Plugin (recommended)

Enable recording for all test files automatically — no changes to test files needed:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { llmRecorderPlugin } from '@internal/llm-recorder/vite-plugin';

export default defineConfig({
  plugins: [llmRecorderPlugin()],
  test: {
    /* ... */
  },
});
```

Recording names are auto-derived from file paths:

- `packages/memory/src/index.test.ts` → `memory-src-index`
- `stores/pg/src/storage.test.ts` → `pg-src-storage`

Plugin options:

```typescript
llmRecorderPlugin({
  include: ['src/**/*.test.ts'], // Glob patterns to include (default: **/*.test.ts)
  exclude: ['src/**/*.unit.test.ts'], // Glob patterns to exclude
  nameGenerator: filepath => 'custom', // Custom recording name derivation
  recordingsDir: './__recordings__', // Override recordings directory
  transformRequest: {
    // Normalize requests before matching (see below)
    importPath: './test/my-transform',
    exportName: 'normalizeRequest',
  },
});
```

Files that already call `useLLMRecording` or `enableAutoRecording` are skipped.

### 2. Per-file via `enableAutoRecording()`

Import and call at the top of a test file for automatic name derivation:

```typescript
import { enableAutoRecording } from '@internal/llm-recorder';

enableAutoRecording();

describe('My Tests', () => {
  it('works', async () => {
    const result = await agent.generate('Hello');
    expect(result.text).toBeDefined();
  });
});
```

### 3. Per-describe via `useLLMRecording()`

```typescript
import { useLLMRecording } from '@internal/llm-recorder';

describe('My Agent Tests', () => {
  useLLMRecording('my-agent-tests');

  it('generates text', async () => {
    const response = await agent.generate('Hello');
    expect(response.text).toBeDefined();
  });
});
```

All recording methods accept a `transformRequest` option (see [Request Transform](#request-transform) below).

### 4. Per-test via `withLLMRecording()`

Wrap a single test in a recording scope:

```typescript
import { withLLMRecording } from '@internal/llm-recorder';

it('generates a response', () =>
  withLLMRecording('my-single-test', async () => {
    const response = await agent.generate('Hello');
    expect(response.text).toBeDefined();
  }));
```

The callback's return value is passed through.

## Test Modes

Works like Vitest snapshots — auto-records on first run, replays thereafter:

```bash
# Auto mode (default) - replay if recording exists, record if not
pnpm test

# Force re-record all recordings (like vitest -u for snapshots)
pnpm test -- --update-recordings
# or
UPDATE_RECORDINGS=true pnpm test

# Skip recording entirely (for debugging with real API)
LLM_TEST_MODE=live pnpm test

# Strict replay — fail if no recording exists
LLM_TEST_MODE=replay pnpm test
```

**Mode Selection Priority:**

1. `--update-recordings` flag or `UPDATE_RECORDINGS=true` → update (force re-record)
2. `LLM_TEST_MODE=live` → live (no recording)
3. `LLM_TEST_MODE=record` → record (legacy, same as update)
4. `LLM_TEST_MODE=replay` → replay (strict, fail if no recording)
5. `RECORD_LLM=true` → record (legacy)
6. Default → **auto** (replay if exists, record if not)

## API Reference

### Core

| Export                                 | Description                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `useLLMRecording(name, options?)`      | Vitest helper — sets up `beforeAll`/`afterAll` hooks                         |
| `useLiveMode()`                        | Opt tests out of recording (real API calls) within a recorded suite          |
| `withLLMRecording(name, fn, options?)` | Callback wrapper for single-test recording                                   |
| `setupLLMRecording(options)`           | Lower-level API for manual setup                                             |
| `enableAutoRecording(options?)`        | Per-file auto-recording                                                      |
| `getActiveRecorder()`                  | Returns the currently active recorder instance (if any)                      |
| `getLLMTestMode()`                     | Returns current mode: `'auto' \| 'update' \| 'replay' \| 'live' \| 'record'` |

### Recording Management

| Export                           | Description                                |
| -------------------------------- | ------------------------------------------ |
| `hasLLMRecording(name, dir?)`    | Check if a recording file exists           |
| `deleteLLMRecording(name, dir?)` | Delete a recording file                    |
| `listLLMRecordings(dir?)`        | List all recording files                   |
| `getLLMRecordingsDir(dir?)`      | Get the absolute recordings directory path |

### Contract Validation

| Export                                            | Description                           |
| ------------------------------------------------- | ------------------------------------- |
| `validateLLMContract(actual, expected, options?)` | Compare response schemas              |
| `validateStreamingContract(actual, expected)`     | Compare streaming chunk schemas       |
| `extractSchema(value)`                            | Generate a schema from a value        |
| `formatContractResult(result)`                    | Format validation results for display |

### Vite Plugin

```typescript
import { llmRecorderPlugin } from '@internal/llm-recorder/vite-plugin';
```

| Export                           | Description                       |
| -------------------------------- | --------------------------------- |
| `llmRecorderPlugin(options?)`    | Vite plugin for auto-injection    |
| `defaultNameGenerator(filepath)` | Default recording name derivation |

## Recording Storage

Recordings are stored as human-readable JSON in `__recordings__/` (relative to `process.cwd()`):

```
your-package/
├── __recordings__/
│   └── my-agent-tests.json
└── src/
    └── tests/
```

## Request Matching

Recordings use **content-based matching**. Each request is matched by an MD5 hash of:

- Request URL
- Request body (with object keys sorted for consistency)

This means tests can run in any order, parallel tests work, and identical requests share recordings.

## Request Transform

You can normalize request URLs and bodies before the recorder hashes them for matching. This is useful when requests contain dynamic fields (timestamps, UUIDs, session IDs) that change between runs but don't affect the response you want to replay.

The `transformRequest` callback receives `{ url, body }` and returns `{ url, body }`. It runs on both recording and replay, so the hash is always computed from the normalized values.

### In test code

```typescript
useLLMRecording('my-tests', {
  transformRequest: ({ url, body }) => ({
    url,
    body: { ...(body as any), timestamp: 'STABLE', sessionId: 'STABLE' },
  }),
});
```

Works with all recording methods: `useLLMRecording`, `withLLMRecording`, `setupLLMRecording`, and `enableAutoRecording`.

### Via the Vite plugin

Since the plugin generates code at build time, it can't accept a function directly. Instead, point it at a module that exports the transform:

```typescript
// test/my-transform.ts
export function normalizeRequest({ url, body }: { url: string; body: unknown }) {
  return { url, body: { ...(body as any), timestamp: 'STABLE' } };
}
```

```typescript
// vitest.config.ts
llmRecorderPlugin({
  transformRequest: {
    importPath: './test/my-transform',
    exportName: 'normalizeRequest', // defaults to 'transformRequest' if omitted
  },
});
```

## Per-test Live Mode

When recording is enabled for a full test suite (via the plugin or `useLLMRecording`), you can opt individual tests out so they make real API calls. Use `useLiveMode()` inside a `describe` block:

```typescript
import { useLLMRecording, useLiveMode } from '@internal/llm-recorder';

describe('My Agent Tests', () => {
  useLLMRecording('my-suite');

  it('replays from recording', async () => {
    // Uses recorded response
    const response = await agent.generate('Hello');
    expect(response.text).toBeDefined();
  });

  describe('real API validation', () => {
    useLiveMode();

    it('hits the real API', async () => {
      // Bypasses recording, calls the real LLM API
      const response = await agent.generate('Hello');
      expect(response.text).toBeDefined();
    });
  });
});
```

`useLiveMode()` stops the MSW server before each test in its scope and restarts it after, so the surrounding recording continues to work for other tests. It's a no-op if there is no active recorder.

## Supported LLM Providers

The recorder intercepts requests to:

- `api.openai.com`
- `api.anthropic.com`
- `generativelanguage.googleapis.com`
- `openrouter.ai`

## Performance

| Mode   | Typical Duration                     | Use Case                |
| ------ | ------------------------------------ | ----------------------- |
| Auto   | <100ms (replay) or 5-30s (first run) | Default — just works    |
| Update | 5-30s per test                       | Re-recording fixtures   |
| Live   | 5-30s per test                       | Debugging with real API |
| Replay | <100ms per test                      | CI, strict replay       |

## Development

```bash
# Build
pnpm build

# Run tests (auto-records if no recording, replays if exists)
pnpm test

# Force re-record all fixtures
UPDATE_RECORDINGS=true OPENAI_API_KEY=sk-xxx pnpm test
```

# CI Test Optimization: LLM Mocking Strategy

This document outlines findings from analyzing Mastra's CI test infrastructure and proposes strategies for improving test speed and reliability by recording and replaying LLM responses.

## Current State

### CI Test Performance

| Workflow | Typical Duration | LLM Dependency |
|----------|-----------------|----------------|
| Core Tests | 9-15 min | High (4 providers) |
| Memory Tests | 16-24 min | High (live OpenAI) |
| RAG Tests | 6-12 min | Medium |
| E2E Tests | 2-24 min (variable) | High |
| Evals Tests | 7+ min | Very High |

### Key Issues Identified

1. **Slow Tests**: LLM-dependent tests take 5-30 seconds each due to API latency
2. **Flaky Tests**: LLM response variability causes assertion failures
3. **Timeouts**: Some tests have timeouts (5s, 30s) that are too short for live LLM calls
4. **Cost**: Each CI run makes hundreds of API calls to OpenAI, Anthropic, etc.
5. **Rate Limits**: High-frequency CI runs can hit provider rate limits

### Test Files Making Live LLM Calls

#### Evals Package (`packages/evals/src/scorers/llm/`)
Each file makes 10-20+ live OpenAI calls per test run:
- `hallucination/index.test.ts` - 17 test cases
- `faithfulness/index.test.ts`
- `toxicity/index.test.ts`
- `bias/index.test.ts` - 9 tests, 115s runtime
- `context-precision/index.test.ts`
- `context-relevance/index.test.ts`
- `answer-relevancy/index.test.ts`
- `answer-similarity/index.test.ts`
- `noise-sensitivity/index.test.ts`
- `prompt-alignment/index.test.ts`
- `tool-call-accuracy/index.test.ts`

#### Memory Integration Tests (`packages/memory/integration-tests/`)
- `agent-memory.test.ts` - Runs same suite 3x (V4, V5, V6 SDK)
- `working-memory.test.ts` - Has `{ retry: 2 }` indicating flakiness
- `streaming-memory.test.ts`

#### Core Integration Tests (`packages/core/src/`)
- `llm/model/router.integration.test.ts` - Tests 4 providers x 4 tests = 16 API calls
- `llm/model/gateways/azure.integration.test.ts`
- `agent/agent.test.ts` - Some tests make unmocked API calls

### Existing Mock Infrastructure

The codebase already has mock utilities:

```typescript
// packages/core/src/test-utils/llm-mock.ts
export { MockLanguageModelV1, MockLanguageModelV2, simulateReadableStream } from '@internal/ai-sdk-v4/test';

// packages/core/src/agent/__tests__/mock-model.ts
export function getSingleDummyResponseModel(response: string)
export function getDummyResponseModel() // 10 sequential responses
export function getEmptyResponseModel()
export function getErrorResponseModel()

// packages/memory/integration-tests/src/shared/mock-models.ts
export function createMockModel()
export function createMockModelWithToolCalls()
export function createMockModelWithSequence()
```

---

## Proposed Solution: Record/Replay LLM Responses

### Library Comparison (2025-2026)

| Library | Maintenance | Record/Replay | Streaming | Vitest Support |
|---------|-------------|---------------|-----------|----------------|
| **[Nock](https://github.com/nock/nock)** | Very Active | Built-in | Limited | Good |
| **[MSW](https://mswjs.io/)** | Very Active | Via life-cycle API | Good | Excellent |
| **[@mswjs/interceptors](https://github.com/mswjs/interceptors)** | Very Active | Low-level | Excellent | Manual |
| [Polly.js](https://github.com/Netflix/pollyjs) | Periodic (May 2025) | HAR files | Limited | Good |

> **Note**: Nock now uses `@mswjs/interceptors` under the hood ([source](https://kettanaito.com/blog/mocking-in-nodejs-has-just-changed-forever)), so both MSW and Nock share the same modern foundation with proper `fetch()` support.

### Why Record/Replay?

1. **Deterministic**: Same response every time = no flaky tests
2. **Fast**: Replay from disk in milliseconds vs seconds for API calls
3. **Free**: No API costs after initial recording
4. **Offline**: Tests run without network access
5. **Version Controlled**: Recordings can be reviewed in PRs

### Recording Approaches

#### Option 1: Nock with Recording (Recommended)

[Nock](https://github.com/nock/nock) is the most actively maintained HTTP mocking library for Node.js. As of 2025, it uses `@mswjs/interceptors` under the hood, giving it modern `fetch()` support.

```typescript
import nock from 'nock';
import fs from 'fs';
import path from 'path';

const RECORDINGS_DIR = '__recordings__/openai';

// Enable recording mode
nock.recorder.rec({
  output_objects: true,
  dont_print: true,
});

// Run your test that makes real API calls
await scorer.run(testCase);

// Get and save recordings
const recordings = nock.recorder.play();
fs.writeFileSync(
  path.join(RECORDINGS_DIR, 'hallucination-test-1.json'),
  JSON.stringify(recordings, null, 2)
);

// In replay mode, load recordings
const recordings = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
recordings.forEach(recording => nock.define(recording));
```

**Pros:**
- Very actively maintained (v14.0.10+)
- Built-in recording with `nock.recorder`
- Uses modern @mswjs/interceptors core
- Good vitest compatibility

**Cons:**
- Recording API requires manual file management
- Limited streaming support (records full response)

#### Option 2: MSW with Life-Cycle Recording (Best for Streaming)

[Mock Service Worker](https://mswjs.io/) with custom recording via life-cycle events.

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse, passthrough } from 'msw';
import fs from 'fs';

const RECORDINGS_DIR = '__recordings__';
const RECORD_MODE = process.env.RECORD_LLM === 'true';

function getRecordingPath(request: Request): string {
  const hash = createHash('md5')
    .update(JSON.stringify(await request.json()))
    .digest('hex');
  return path.join(RECORDINGS_DIR, `${hash}.json`);
}

const handlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const recordingPath = getRecordingPath(request);

    if (RECORD_MODE) {
      // Pass through to real API and record response
      const response = await fetch(request.clone());
      const data = await response.json();
      fs.writeFileSync(recordingPath, JSON.stringify(data, null, 2));
      return HttpResponse.json(data);
    }

    // Replay mode
    if (fs.existsSync(recordingPath)) {
      const data = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
      return HttpResponse.json(data);
    }

    throw new Error(`No recording found: ${recordingPath}`);
  }),
];

export const server = setupServer(...handlers);
```

**Pros:**
- Full control over request matching
- Can handle streaming via life-cycle API
- Integrates well with vitest

**Cons:**
- More manual setup required
- Need to handle each provider separately

#### Option 3: Custom AI SDK Model Wrapper

Wrap at the AI SDK level for maximum control over streaming:

```typescript
// packages/core/src/test-utils/recording-model.ts
import { LanguageModelV1 } from 'ai';
import fs from 'fs';
import path from 'path';

interface Recording {
  request: {
    messages: any[];
    tools?: any[];
  };
  response: {
    text?: string;
    toolCalls?: any[];
    usage?: { promptTokens: number; completionTokens: number };
  };
  chunks?: string[]; // For streaming
}

export function createRecordingModel(
  baseModel: LanguageModelV1,
  recordingsDir: string,
  options: { record?: boolean } = {}
): LanguageModelV1 {
  return {
    ...baseModel,

    async doGenerate(params) {
      const key = hashRequest(params);
      const recordingPath = path.join(recordingsDir, `${key}.json`);

      if (options.record) {
        const result = await baseModel.doGenerate(params);
        saveRecording(recordingPath, params, result);
        return result;
      }

      return loadRecording(recordingPath);
    },

    async doStream(params) {
      const key = hashRequest(params);
      const recordingPath = path.join(recordingsDir, `${key}.json`);

      if (options.record) {
        const stream = await baseModel.doStream(params);
        return recordStream(stream, recordingPath, params);
      }

      return replayStream(recordingPath);
    },
  };
}

function replayStream(recordingPath: string) {
  const recording = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));

  return {
    stream: new ReadableStream({
      async start(controller) {
        for (const chunk of recording.chunks) {
          controller.enqueue(chunk);
          await new Promise(r => setTimeout(r, 10)); // Simulate timing
        }
        controller.close();
      }
    }),
    rawCall: recording.rawCall,
  };
}
```

**Pros:**
- Full control over streaming behavior
- Works directly with AI SDK types
- Can simulate exact chunk timing

**Cons:**
- Need to maintain wrapper for each SDK version
- More complex implementation

#### Option 4: LiteLLM Mock Mode

[LiteLLM](https://docs.litellm.ai/docs/completion/mock_requests) has built-in mock support:

```python
from litellm import completion

# Returns mock response without API call
response = completion(
  model="gpt-3.5-turbo",
  messages=[{"role": "user", "content": "Hello"}],
  mock_response="This is a mock response"
)
```

**Pros:**
- Built-in to LiteLLM
- Works with streaming

**Cons:**
- Python-based, would need adaptation for Node.js
- Less flexible for complex test scenarios

---

## Proof of Concept Plan

We'll build POCs with both **Nock** and **MSW** using a real streaming test as the example.

### Target Test

**File**: `packages/core/src/llm/model/router.integration.test.ts`
**Test**: "should support streaming" (lines 189-212)

```typescript
it('should support streaming', { timeout: 30000 }, async () => {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a helpful assistant.',
    model: 'openai/gpt-4o-mini',
  });

  const { textStream } = await agent.stream('Count from 1 to 3');

  const chunks: string[] = [];
  for await (const chunk of textStream) {
    chunks.push(chunk);
  }

  expect(chunks.length).toBeGreaterThan(0);
  const fullText = chunks.join('');
  expect(fullText).toBeDefined();
});
```

This test:
- Uses OpenAI's streaming API (`agent.stream()`)
- Collects SSE chunks via async iterator
- Takes ~5-10 seconds with live API
- Should take <100ms with recordings

### POC 1: Nock Implementation

**Location**: `packages/core/src/test-utils/nock-recorder.ts`

```typescript
import nock from 'nock';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const RECORDINGS_DIR = path.join(__dirname, '__recordings__');

interface RecordingOptions {
  name: string;
  record?: boolean;
}

export function setupLLMRecording(options: RecordingOptions) {
  const recordingPath = path.join(RECORDINGS_DIR, `${options.name}.json`);

  if (options.record) {
    // Recording mode: capture real API responses
    nock.recorder.rec({
      output_objects: true,
      dont_print: true,
      enable_reqheaders_recording: false,
    });

    return {
      async save() {
        const recordings = nock.recorder.play();
        nock.recorder.clear();

        // Filter to only OpenAI calls
        const openaiRecordings = recordings.filter(r =>
          r.scope?.includes('api.openai.com')
        );

        fs.mkdirSync(path.dirname(recordingPath), { recursive: true });
        fs.writeFileSync(recordingPath, JSON.stringify(openaiRecordings, null, 2));
      }
    };
  } else {
    // Replay mode: use recorded responses
    if (!fs.existsSync(recordingPath)) {
      throw new Error(`Recording not found: ${recordingPath}. Run with RECORD_LLM=true first.`);
    }

    const recordings = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
    nock.define(recordings);

    return {
      async save() {
        // No-op in replay mode
      }
    };
  }
}
```

**Limitations**:
- Nock records full response body, not individual SSE chunks
- Streaming timing won't be realistic
- Good for: verifying response content, not streaming behavior

### POC 2: MSW Implementation

**Location**: `packages/core/src/test-utils/msw-recorder.ts`

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const RECORDINGS_DIR = path.join(__dirname, '__recordings__');

interface StreamRecording {
  request: {
    url: string;
    method: string;
    body: any;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    chunks: string[];  // Individual SSE chunks
    timings: number[]; // Delay between chunks (ms)
  };
}

function hashRequest(body: any): string {
  return crypto.createHash('md5')
    .update(JSON.stringify(body))
    .digest('hex')
    .slice(0, 12);
}

export function createLLMRecorder(options: { name: string; record?: boolean }) {
  const recordingPath = path.join(RECORDINGS_DIR, `${options.name}.json`);
  const recordings: StreamRecording[] = [];

  const handlers = [
    http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
      const body = await request.json();
      const hash = hashRequest(body);

      if (options.record) {
        // Pass through to real API and record
        const realResponse = await fetch(request.clone());
        const reader = realResponse.body?.getReader();
        const chunks: string[] = [];
        const timings: number[] = [];
        let lastTime = Date.now();

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          chunks.push(chunk);
          timings.push(Date.now() - lastTime);
          lastTime = Date.now();
        }

        recordings.push({
          request: { url: request.url, method: 'POST', body },
          response: {
            status: realResponse.status,
            headers: Object.fromEntries(realResponse.headers),
            chunks,
            timings,
          },
        });

        // Return recorded response
        return new HttpResponse(
          createSSEStream(chunks, timings),
          { headers: realResponse.headers }
        );
      } else {
        // Replay mode
        const savedRecordings = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
        const recording = savedRecordings.find((r: StreamRecording) =>
          hashRequest(r.request.body) === hash
        );

        if (!recording) {
          throw new Error(`No recording found for request: ${hash}`);
        }

        return new HttpResponse(
          createSSEStream(recording.response.chunks, recording.response.timings),
          {
            status: recording.response.status,
            headers: recording.response.headers,
          }
        );
      }
    }),
  ];

  const server = setupServer(...handlers);

  return {
    server,
    start() {
      server.listen({ onUnhandledRequest: 'bypass' });
    },
    stop() {
      server.close();
    },
    async save() {
      if (options.record && recordings.length > 0) {
        fs.mkdirSync(path.dirname(recordingPath), { recursive: true });
        fs.writeFileSync(recordingPath, JSON.stringify(recordings, null, 2));
      }
    },
  };
}

function createSSEStream(chunks: string[], timings: number[]): ReadableStream {
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }

      // Simulate original timing (optional, can be disabled for fast tests)
      if (timings[index] > 0) {
        await new Promise(r => setTimeout(r, Math.min(timings[index], 10)));
      }

      controller.enqueue(new TextEncoder().encode(chunks[index]));
      index++;
    },
  });
}
```

**Advantages over Nock**:
- Records individual SSE chunks with timing
- Can replay streaming with realistic timing
- Better for testing streaming-specific behavior

### POC 3: Vitest Setup Integration

**Location**: `packages/core/vitest.setup.ts`

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { createLLMRecorder } from './src/test-utils/msw-recorder';

const RECORD_MODE = process.env.RECORD_LLM === 'true';

// Create recorder for all tests
const recorder = createLLMRecorder({
  name: 'llm-responses',
  record: RECORD_MODE,
});

beforeAll(() => {
  recorder.start();
});

afterEach(() => {
  // Reset handlers between tests
});

afterAll(async () => {
  await recorder.save();
  recorder.stop();
});
```

### POC Deliverables

1. **`packages/core/src/test-utils/nock-recorder.ts`** - Nock-based recording
2. **`packages/core/src/test-utils/msw-recorder.ts`** - MSW-based recording with streaming
3. **`packages/core/src/test-utils/__recordings__/`** - Directory for stored recordings
4. **Example test conversion** - Convert `router.integration.test.ts` streaming test
5. **Comparison document** - Pros/cons of each approach based on actual usage

### Success Criteria

| Metric | Live API | With Recording | Target |
|--------|----------|----------------|--------|
| Test duration | 5-10s | <100ms | 50x faster |
| Flakiness | Occasional timeouts | 0% | Deterministic |
| Streaming fidelity | N/A | Chunks preserved | Realistic |

---

## POC Implementation Results

### Files Created

The POC implementations are located in `packages/core/src/test-utils/`:

| File | Purpose |
|------|---------|
| `nock-recorder.ts` | Nock-based recording with automatic LLM API filtering |
| `msw-recorder.ts` | MSW-based recording with SSE chunk capture |
| `llm-recording.ts` | Unified exports for both approaches |
| `__tests__/llm-recording-poc.test.ts` | Example tests demonstrating both approaches |
| `__recordings__/nock/*.json` | Nock recording storage |
| `__recordings__/msw/*.json` | MSW recording storage with chunk data |

### Performance Results

#### Recording Mode (Live API)

| Test | Nock | MSW |
|------|------|-----|
| Generate (non-streaming) | 948ms | 864ms |
| Stream (SSE) | ~5-10s | 1602ms |

#### Replay Mode (No API)

| Test | Nock | MSW | Speedup |
|------|------|-----|---------|
| Generate | 7ms | 3ms | ~130-290x |
| Stream (SSE) | 50ms (6 chunks) | 5ms (10 chunks) | ~100-320x |
| Comparison test | 7ms | 3ms | Similar |

**Key Observation**: Both approaches achieve the target of <100ms replay, with MSW being slightly faster due to its direct streaming implementation.

### Comparison: Nock vs MSW

#### Nock

**Pros:**
- Simpler setup - just `setupNockRecording()` and you're done
- Built-in recording with `nock.recorder.rec()`
- No server lifecycle management needed
- Handles streaming responses as single recorded responses
- Good for tests that don't need to verify streaming behavior

**Cons:**
- Records full response, not individual SSE chunks
- Can't simulate realistic streaming timing
- Less control over response replay behavior

**Best for:** Simple generate() tests, API response validation, tests where streaming behavior isn't critical.

#### MSW

**Pros:**
- Captures individual SSE chunks with timing data
- Can replay with original timing for realistic streaming
- More control via handlers for complex scenarios
- Better for testing streaming-specific behavior
- Chunk counts preserved (e.g., 10 chunks replayed as 10 chunks)

**Cons:**
- Requires server lifecycle management (`start()`, `stop()`)
- More complex setup with handlers
- Needed fix for compression handling (content-encoding headers)
- Needed fix for `bypass()` to avoid infinite loops

**Best for:** Streaming tests, SSE behavior validation, tests that verify chunk-by-chunk processing.

### Implementation Details

#### Request Matching (Order-Independent)

The recorder uses **content-based matching**, not sequential order. Each request is matched by an MD5 hash of:
- Request URL
- Request body (with object keys sorted for consistency)

This means:
- **Tests can run in any order** - replay doesn't depend on execution sequence
- **Parallel tests work** - each request finds its matching recording independently
- **Identical requests share recordings** - if two tests make the same request, they get the same response

If a request has no matching recording, you'll see an error with the hash and available hashes for debugging.

#### API Key Handling

For replay mode, a dummy API key is set automatically since:
1. Mastra's Agent validates API key before making HTTP requests
2. Nock/MSW intercept at HTTP level, after validation
3. Solution: Set `process.env.OPENAI_API_KEY = 'sk-dummy-for-replay-mode-only'` in test setup

```typescript
// In test file
if (!RECORD_MODE && !HAS_API_KEY) {
  process.env.OPENAI_API_KEY = 'sk-dummy-for-replay-mode-only';
}
```

#### MSW Compression Fix

OpenAI returns brotli-compressed responses (`content-encoding: br`). When MSW captures the response, it's automatically decompressed, but headers remain. Fixed by stripping compression headers:

```typescript
const skipHeaders = ['authorization', 'x-api-key', 'api-key', 'content-encoding', 'transfer-encoding'];
```

#### MSW Bypass Fix

MSW was causing infinite loops when trying to pass through to the real API. Fixed by using MSW's `bypass()` function:

```typescript
import { bypass } from 'msw';
const realResponse = await fetch(bypass(request));
```

### Usage Examples

#### Nock (Simple)

```typescript
import { setupNockRecording } from '@mastra/core/test-utils/llm-recording';

describe('My Tests', () => {
  let recorder;

  beforeAll(() => {
    recorder = setupNockRecording({ name: 'my-tests' });
  });

  afterAll(async () => {
    await recorder.save();
    recorder.cleanup();
  });

  it('generates response', async () => {
    const response = await agent.generate('Hello');
    expect(response.text).toBeDefined();
  });
});
```

#### MSW (Streaming)

```typescript
import { setupMSWRecording } from '@mastra/core/test-utils/llm-recording';

describe('Streaming Tests', () => {
  let recorder;

  beforeAll(() => {
    recorder = setupMSWRecording({
      name: 'streaming-tests',
      replayWithTiming: false,  // Fast replay
      maxChunkDelay: 5,         // Max delay if timing enabled
    });
    recorder.start();
  });

  afterAll(async () => {
    await recorder.save();
    recorder.stop();
  });

  it('streams response', async () => {
    const { textStream } = await agent.stream('Count to 5');
    const chunks = [];
    for await (const chunk of textStream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### Recommendation

**Use Nock for most tests** - simpler setup, works well for both streaming and non-streaming responses. The test output shows streaming works correctly (6 chunks captured and replayed).

**Use MSW when**:
- You need to test streaming timing/behavior specifically
- You need per-chunk assertions
- You need more complex request matching logic
- You want to simulate streaming delays

### Next Steps

1. **Migrate existing integration tests** to use these recorders
2. **Add recordings to git** for deterministic CI
3. **Set up RECORD_LLM=true workflow** for periodic recording refresh
4. **Consider vitest setup file** for automatic recorder setup

---

## Contract Validation Tests

Contract validation is now implemented to detect API schema drift.

### Implementation

**Files:**
- `llm-contract.ts` - Schema extraction and comparison logic
- `llm-contract.test.ts` - Unit tests and example nightly tests

**Key Functions:**

```typescript
import {
  validateLLMContract,
  validateStreamingContract,
  extractSchema,
  formatContractResult
} from '@mastra/core/test-utils/llm-recording';

// Compare structure, not content
const result = validateLLMContract(liveResponse, recordedResponse);
if (!result.valid) {
  console.log(formatContractResult(result));
  // Output:
  // ✗ Contract validation failed:
  //   − response.new_field: Field "new_field" was removed
  //   ≠ response.type: Type changed from string to number
}

// For streaming responses
const streamResult = validateStreamingContract(liveChunks, recordedChunks);
```

**How It Works:**

1. **Extract schema** from both live and recorded responses
2. **Compare structure** - field names, types, nesting
3. **Ignore dynamic values** - IDs, timestamps, actual text content
4. **Report differences** - missing fields, type changes, structural changes

**Default Ignored Paths** (always vary):
```typescript
const DEFAULT_IGNORE_PATHS = [
  'id', '*.id', 'created_at', 'completed_at',
  'output.*.content.*.text', 'delta', 'text',
  'usage.input_tokens', 'usage.output_tokens',
  'openai-processing-ms', 'x-request-id', 'cf-ray',
];
```

**Validation Options:**
```typescript
validateLLMContract(actual, expected, {
  ignorePaths: ['custom.path'],     // Additional paths to ignore
  allowExtraFields: true,           // New fields OK (default)
  allowMissingFields: false,        // Removed fields = breaking (default)
  treatNullAsOptional: true,        // null ≈ missing (default)
});
```

### Example Nightly Test

```typescript
describe('Nightly Contract Tests', () => {
  it('OpenAI response schema matches recording', async () => {
    // Load recording
    const recordings = JSON.parse(fs.readFileSync('recordings.json'));
    const expected = recordings[0].response.body;

    // Make live API call
    const agent = new Agent({ model: 'openai/gpt-4o-mini', ... });
    const liveResponse = await callRawAPI(agent, 'Hello');

    // Compare schemas (not exact values)
    const result = validateLLMContract(liveResponse, expected);

    expect(result.valid).toBe(true);
    if (!result.valid) {
      console.error('API schema drift detected!');
      console.error(formatContractResult(result));
      // Alert team, create issue, etc.
    }
  });
});
```

### What Contract Tests Catch

| Change | Detected? | Breaking? |
|--------|-----------|-----------|
| New field added | ✅ (if `allowExtraFields: false`) | Usually no |
| Field removed | ✅ | Usually yes |
| Type changed (string → number) | ✅ | Yes |
| Nested structure changed | ✅ | Yes |
| Value changed ("hello" → "hi") | ❌ (ignored) | No |
| ID/timestamp changed | ❌ (ignored) | No |

### The Problem with Pure Mocking

Recordings/mocks can become stale when:
- OpenAI changes their response format
- New fields are added to API responses
- Streaming chunk format changes
- Rate limiting or error responses change

If we only run mocked tests, we won't catch these changes until production.

### Proposed Solution: Dual Test Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      PR / Push Tests                        │
│                    (Fast, Deterministic)                    │
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │  Unit Tests │    │ Integration │    │   E2E with  │   │
│   │  (mocked)   │    │   (mocked)  │    │  recordings │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                             │
│   Duration: ~5 minutes          Runs: Every PR/push        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Nightly Contract Tests                   │
│                  (Validates recordings/mocks)               │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  1. Run test with LIVE API                          │  │
│   │  2. Run same test with RECORDING                    │  │
│   │  3. Compare response schemas match                  │  │
│   │  4. Alert if drift detected                         │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Duration: ~30 minutes         Runs: Nightly/weekly       │
└─────────────────────────────────────────────────────────────┘
```

### Contract Test Implementation Ideas

```typescript
// packages/core/src/test-utils/contract-validator.ts

interface ContractValidation {
  // Compare live vs recorded response structure
  validateSchema(live: unknown, recorded: unknown): ValidationResult;

  // Check streaming chunk format matches
  validateStreamingFormat(liveChunks: string[], recordedChunks: string[]): ValidationResult;

  // Verify error responses still match expected format
  validateErrorFormat(liveError: unknown, recordedError: unknown): ValidationResult;
}

// Example contract test
describe('OpenAI Contract Tests', () => {
  it('streaming response format matches recording', async () => {
    // 1. Make live API call
    const liveResponse = await callLiveAPI('Count from 1 to 3');

    // 2. Load recording
    const recording = loadRecording('streaming-count-1-to-3');

    // 3. Validate structure matches (not exact content)
    expect(validateSchema(liveResponse, recording)).toEqual({
      valid: true,
      differences: [],
    });

    // 4. Validate streaming chunks have same structure
    expect(liveResponse.chunks[0]).toHaveProperty('choices');
    expect(liveResponse.chunks[0].choices[0]).toHaveProperty('delta');
  });
});
```

### What Contract Tests Would Catch

| Scenario | Pure Mock Tests | Contract Tests |
|----------|-----------------|----------------|
| OpenAI adds new field to response | ❌ Miss it | ✅ Detect drift |
| Streaming format changes | ❌ Miss it | ✅ Detect drift |
| API version deprecation | ❌ Miss it | ✅ Catch errors |
| Rate limit format changes | ❌ Miss it | ✅ Detect drift |
| Our code regresses | ✅ Catch it | ✅ Catch it |

### CI Integration (Future)

```yaml
# .github/workflows/nightly-contract-tests.yml
name: Nightly Contract Validation

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install

      - name: Run contract validation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          CONTRACT_TEST: 'true'
        run: pnpm test:contracts

      - name: Alert on drift
        if: failure()
        run: |
          # Send Slack notification or create GitHub issue
          echo "Contract drift detected - recordings may need refresh"
```

### Open Questions (For Future)

1. **Granularity**: Validate every recording or just key schemas?
2. **Drift tolerance**: How much schema change triggers an alert?
3. **Auto-refresh**: Should contract tests auto-update recordings on drift?
4. **Provider coverage**: Test all providers or just primary (OpenAI)?

---

## Future: MockLLM Server for Multi-Agent Testing

> **Note**: This is a future enhancement idea, not part of the initial POC.

### Background

There's a forked [MockLLM server](https://github.com/epinzur/mockllm) (originally from [StacklokLabs](https://github.com/StacklokLabs/mockllm)) that provides a Python-based mock LLM server with:

- OpenAI and Anthropic API compatibility
- YAML-configured prompt → response mappings
- Streaming support with configurable latency
- Hot-reloading of configuration

### The Challenge: Multi-Agent Workflows

Mastra's multi-agent and workflow systems create complex LLM interaction patterns:

```
┌──────────────────────────────────────────────────────────────┐
│                    Multi-Agent Workflow                      │
│                                                              │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐               │
│  │ Agent A │────▶│ Agent B │────▶│ Agent C │               │
│  │ (Plan)  │     │(Execute)│     │(Review) │               │
│  └────┬────┘     └────┬────┘     └────┬────┘               │
│       │               │               │                     │
│       ▼               ▼               ▼                     │
│   LLM Call 1      LLM Call 2      LLM Call 3               │
│   "Create plan"   "Run step X"    "Validate"               │
│                                                              │
│  Each agent needs DIFFERENT mock responses!                 │
└──────────────────────────────────────────────────────────────┘
```

Simple prompt matching breaks down because:
- Same prompt might come from different agents
- Agent context/instructions affect expected responses
- Workflow state influences what response is needed
- Tool calls create branching conversation paths

### Idea: Agent-Aware Mock Responses

Extend MockLLM (or build similar in Node.js) to support agent-specific mocking:

```yaml
# mockllm-config.yml

agents:
  planner-agent:
    responses:
      - prompt_contains: "create a plan"
        response: |
          I'll create a plan with 3 steps:
          1. Gather requirements
          2. Implement solution
          3. Validate results

  executor-agent:
    responses:
      - prompt_contains: "execute step"
        tool_calls:
          - name: "run_code"
            arguments: { code: "print('hello')" }

  reviewer-agent:
    responses:
      - prompt_contains: "validate"
        response: "All checks passed. The implementation is correct."

workflows:
  research-workflow:
    # Responses specific to this workflow's agents
    steps:
      search:
        response: "Found 3 relevant sources..."
      summarize:
        response: "Key findings: ..."
```

### Implementation Approaches

#### Option A: Extend MockLLM (Python)

```python
# Add agent identification via custom header or request body field
@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()

    # Extract agent ID from custom field or system prompt
    agent_id = extract_agent_id(body)

    # Look up agent-specific responses
    response = get_response_for_agent(agent_id, body["messages"])

    return stream_response(response)
```

#### Option B: Build Node.js Version (Native to Mastra)

```typescript
// packages/core/src/test-utils/mock-llm-server.ts

interface AgentMockConfig {
  agentId: string;
  responses: Array<{
    match: (messages: Message[], context: AgentContext) => boolean;
    response: MockResponse;
  }>;
}

class MockLLMServer {
  private agentConfigs: Map<string, AgentMockConfig>;

  async handleRequest(req: Request): Promise<Response> {
    const body = await req.json();
    const agentId = this.extractAgentId(body);
    const config = this.agentConfigs.get(agentId);

    if (config) {
      const matchedResponse = config.responses.find(r =>
        r.match(body.messages, { agentId, ...body })
      );
      if (matchedResponse) {
        return this.streamResponse(matchedResponse.response);
      }
    }

    throw new Error(`No mock configured for agent: ${agentId}`);
  }
}
```

#### Option C: Middleware in Mastra Agent

```typescript
// Mock at the Mastra level, not HTTP level

const mockResponses = new Map<string, MockResponseConfig>();

// Register mock for specific agent
mockResponses.set('planner-agent', {
  responses: [
    { match: /create.*plan/i, response: 'Plan: 1. Do X, 2. Do Y' },
  ]
});

// In test setup
const agent = new Agent({
  id: 'planner-agent',
  model: process.env.MOCK_LLM
    ? createMockModel(mockResponses.get('planner-agent'))
    : 'openai/gpt-4o-mini',
  // ...
});
```

### Challenges to Solve

1. **Agent Identification**: How to identify which agent made a request?
   - Custom header (`X-Mastra-Agent-Id`)
   - Parse from system prompt
   - Request context/metadata

2. **Conversation State**: Multi-turn conversations need stateful mocking
   - Track conversation history per agent
   - Match based on full context, not just last message

3. **Tool Call Sequences**: Agents with tools have branching paths
   - Mock tool call decisions
   - Mock tool results
   - Handle multi-step tool use

4. **Workflow Orchestration**: Workflows coordinate multiple agents
   - Mock responses need to be consistent across workflow
   - State from one agent affects another's mock

### Potential Benefits

| Scenario | Current Approach | Agent-Aware Mocking |
|----------|------------------|---------------------|
| Single agent test | Works fine | Works fine |
| Multi-agent workflow | Each agent needs separate mock setup | Unified config per workflow |
| Agent handoff testing | Complex, fragile | Define handoff responses explicitly |
| Regression testing | Hard to reproduce specific paths | Deterministic multi-agent paths |

### Open Questions

1. **Configuration format**: YAML? TypeScript? JSON?
2. **Recording multi-agent flows**: How to capture a full workflow's LLM calls?
3. **Matching strategy**: Exact match? Regex? Semantic similarity?
4. **Integration point**: HTTP proxy? Model wrapper? Mastra middleware?
5. **Maintain MockLLM fork or build native**: Python server vs Node.js native?

---

## Implementation Plan

### Phase 1: Quick Wins (Immediate)

1. **Fix timeout issues** in evals tests:
   ```typescript
   // Change from
   vi.setConfig({ testTimeout: 5000 });
   // To
   vi.setConfig({ testTimeout: 60000 });
   ```

2. **Add environment variable checks** to skip LLM tests when keys missing:
   ```typescript
   it.skipIf(!process.env.OPENAI_API_KEY)('test name', async () => {
     // test
   });
   ```

3. **Clean up `._*` files** (Mac OS extended attributes) causing test errors

### Phase 2: Recording Infrastructure (1-2 weeks)

1. **Install dependencies** (choose one approach):
   ```bash
   # Option A: Nock (simpler, built-in recording)
   pnpm add -D nock

   # Option B: MSW (better streaming, concurrent tests)
   pnpm add -D msw
   ```

2. **Create test utilities**:
   - `packages/core/src/test-utils/llm-recorder.ts` - Recording/replay logic
   - `packages/core/src/test-utils/setup-recordings.ts` - Vitest setup helper

3. **Add recording mode**:
   ```bash
   # Record new fixtures
   RECORD_LLM=true pnpm test:evals

   # Run with recordings (default)
   pnpm test:evals
   ```

4. **Store recordings**:
   ```
   packages/evals/
   ├── __recordings__/
   │   ├── hallucination/
   │   │   ├── perfect-alignment.json
   │   │   ├── complete-hallucination.json
   │   │   └── ...
   │   └── bias/
   │       └── ...
   └── src/
   ```

### Phase 3: Migrate Test Suites (2-4 weeks)

Priority order based on impact:

1. **Evals tests** - Highest impact (7+ min savings)
2. **Memory integration tests** - High impact (5-10 min savings)
3. **Core router integration tests** - Medium impact (2-3 min savings)
4. **Agent tests with unmocked calls** - Fix reliability issues

### Phase 4: CI Integration

1. **Dual-mode CI**:
   - PR checks: Run with recordings (fast, deterministic)
   - Nightly: Run with live APIs (catch API changes)

2. **Recording refresh workflow**:
   ```yaml
   name: Refresh LLM Recordings
   on:
     schedule:
       - cron: '0 0 * * 0'  # Weekly
     workflow_dispatch:

   jobs:
     refresh:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - run: pnpm install
         - run: RECORD_LLM=true pnpm test:evals
         - run: |
             git add __recordings__
             git commit -m "chore: refresh LLM test recordings"
             git push
   ```

---

## Expected Outcomes

### Performance Improvements

| Test Suite | Current | With Recordings | Savings |
|------------|---------|-----------------|---------|
| Evals | 7+ min | ~30s | 90%+ |
| Memory Integration | 16-24 min | ~2 min | 85%+ |
| Core Integration | 9-15 min | ~3 min | 70%+ |
| **Total CI Time** | **30-45 min** | **~10 min** | **75%+** |

### Reliability Improvements

- **Zero flaky tests** from LLM response variability
- **No timeouts** from API latency
- **No rate limit failures** in CI
- **Offline capable** test runs

### Cost Savings

- Estimated 1000+ API calls per CI run eliminated
- Only refresh recordings weekly/monthly
- Development testing free (no API keys needed)

---

## Open Questions

1. **Recording granularity**: One file per test case vs one file per test file?
2. **Streaming fidelity**: How precisely should we simulate chunk timing?
3. **Provider coverage**: Start with OpenAI only or all providers?
4. **Recording refresh**: Manual, weekly scheduled, or on API version changes?

---

## References

### HTTP Mocking Libraries
- [Nock](https://github.com/nock/nock) - HTTP server mocking (recommended, actively maintained)
- [Mock Service Worker (MSW)](https://mswjs.io/) - API mocking for browser and Node.js
- [@mswjs/interceptors](https://github.com/mswjs/interceptors) - Low-level HTTP interception (powers both MSW and Nock)
- [Polly.js - Netflix](https://github.com/Netflix/pollyjs) - Record/replay with HAR files
- [MSW Comparison](https://mswjs.io/docs/comparison/) - Comparison of mocking approaches

### LLM-Specific Tools
- [Mokksy & AI-Mocks](https://mokksy.dev/) - Mock server with streaming/SSE support for OpenAI, Anthropic, etc.
- [LiteLLM Mock Requests](https://docs.litellm.ai/docs/completion/mock_requests) - Built-in mock mode
- [MockLLM](https://github.com/StacklokLabs/mockllm) - YAML-configured mock LLM server

### Background Reading
- [Mocking in Node.js Has Just Changed Forever](https://kettanaito.com/blog/mocking-in-nodejs-has-just-changed-forever) - How Nock and MSW now share interceptors
- [MSW Recording Discussion](https://github.com/mswjs/msw/discussions/1060) - Community discussion on recording features
- [Vitest Mocking Requests](https://vitest.dev/guide/mocking/requests) - Official vitest mocking guide
- [Nock Guide 2025](https://generalistprogrammer.com/tutorials/nock-npm-package-guide) - Updated nock usage patterns

---

## Implementation Progress Log

### 2026-01-30: Unified LLM Recorder & Memory Integration Tests

#### Unified LLM Recorder Created

Created `packages/core/src/test-utils/llm-recorder.ts` with:

- **Three test modes** via `LLM_TEST_MODE` environment variable:
  - `live` (default) - Real API calls, no recording
  - `replay` - Fast, deterministic, uses recordings (auto-enabled in CI)
  - `record` - Makes real API calls, saves new recordings

- **Mode selection priority**:
  1. `LLM_TEST_MODE=replay|record|live` (explicit)
  2. `RECORD_LLM=true` (legacy, same as record)
  3. `CI=true` (auto-replay in CI environments)
  4. Default: `live`

- **Vitest helper** for easy integration:
  ```typescript
  import { useLLMRecording } from '@mastra/core/test-utils/llm-recording';

  describe('My Tests', () => {
    useLLMRecording('my-test-suite');

    it('works', async () => {
      // Tests run with recording/replay automatically
    });
  });
  ```

#### Memory Integration Tests Updated

Added `useLLMRecording()` to all memory integration tests that make real LLM calls:

| File | Recording Name Pattern |
|------|----------------------|
| `agent-memory.ts` | `agent-memory-{model}` |
| `streaming-memory.ts` | `streaming-memory-{model}` |
| `working-memory.ts` | `working-memory-{model}` |
| `working-memory-additive.ts` | `working-memory-additive-{model}` |
| `message-ordering.ts` | `message-ordering-{version}-{model}` |

**Files NOT needing LLM recording** (use mock models):
- `input-processors.ts` - uses `createMockModel()`
- `output-processor-memory.ts` - uses `createMockModel()`
- `processors.ts` - uses `createMockModel()`
- `reusable-tests.ts` - memory/storage tests only
- `with-pg-storage.ts` - storage tests only
- `ai-sdk-duplicate-ids.ts` - uses raw AI SDK, not Agent class

#### Pattern for Model-Based Recording Names

```typescript
function getModelRecordingName(model: MastraModelConfig): string {
  if (typeof model === 'string') {
    return model.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  }
  if ('modelId' in model) {
    return (model as any).modelId.replace(/[^a-zA-Z0-9-]/g, '');
  }
  if ('specificationVersion' in model) {
    return `sdk-${model.specificationVersion}`;
  }
  return 'unknown-model';
}
```

#### Dummy API Key Pattern for Replay Mode

```typescript
const MODE = getLLMTestMode();
const HAS_API_KEY = !!process.env.OPENAI_API_KEY;

// For replay mode without a real key, set a dummy (HTTP is mocked anyway)
if (MODE === 'replay' && !HAS_API_KEY) {
  process.env.OPENAI_API_KEY = 'sk-dummy-for-replay-mode';
}
```

#### TypeScript Fixes Applied

Fixed 8 TypeScript errors in test-utils files:

| File | Line | Fix |
|------|------|-----|
| `llm-recorder.ts` | 267, 363 | Added `!` for array element access after push |
| `msw-recorder.ts` | 163, 276 | Added `!` for timing/recording array access |
| `nock-recorder.ts` | 54 | Added type check for `scope` before `includes()` (handles RegExp) |
| `llm-contract.ts` | 255, 272, 283 | Added `!` for property lookups in Object.keys iteration |

#### Build Status

- ✅ `pnpm build:core` - Passes
- ✅ `pnpm build:memory` - Passes

#### Next Steps

1. **Create initial recordings**:
   ```bash
   cd packages/memory
   LLM_TEST_MODE=record OPENAI_API_KEY=sk-xxx ANTHROPIC_API_KEY=sk-ant-xxx pnpm test
   ```

2. **Commit recordings** to `packages/core/src/test-utils/__recordings__/`

3. **CI integration** - Tests will auto-use replay mode when `CI=true`

4. **Extend to other packages**:
   - Evals tests
   - Core router integration tests
   - Other agent tests

---

### 2026-01-30: POC Cleanup

Removed POC files, keeping only the production MSW-based implementation:

**Removed:**
- `nock-recorder.ts` - Nock POC
- `msw-recorder.ts` - MSW POC (separate from main llm-recorder.ts)
- `__tests__/llm-recording-poc.test.ts` - POC tests
- `__recordings__/nock/` - POC recordings
- `__recordings__/msw/` - POC recordings

**Kept (final structure):**
```
packages/core/src/test-utils/
├── llm-mock.ts              # Existing mock utilities (unrelated)
├── llm-recorder.ts          # Main MSW-based recorder
├── llm-contract.ts          # Contract validation for nightly tests
├── llm-recording.ts         # Unified exports
├── __tests__/
│   ├── llm-contract.test.ts
│   └── llm-recorder.test.ts
└── __recordings__/
    └── llm-recorder-tests.json
```

Updated `llm-recording.ts` to remove legacy nock/msw POC exports.

Build verified: ✅ `pnpm build:core` passes

---

### 2026-01-30: Moved to @internal/test-utils

Moved LLM recording utilities from `@mastra/core/test-utils` to `@internal/test-utils` to:
- Keep test utilities out of the public @mastra/core package
- Follow the existing `@internal/*` pattern used by other internal packages
- Reduce @mastra/core bundle size

**New package location:** `packages/_test-utils/`

**Package structure:**
```
packages/_test-utils/
├── package.json              # @internal/test-utils
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
└── src/
    ├── index.ts              # Re-exports all
    ├── llm-recording.ts      # Main exports
    ├── llm-recorder.ts       # MSW-based recorder
    ├── llm-recorder.test.ts  # Recorder tests
    ├── llm-contract.ts       # Contract validation
    ├── llm-contract.test.ts  # Contract tests
    ├── llm-helpers.test.ts   # Helper function unit tests
    └── __recordings__/
        └── llm-recorder-tests.json
```

**Tests:** 32 passing (4 skipped - require API keys or CONTRACT_TEST mode)

**Updated imports:**
```typescript
// Before
import { useLLMRecording, getLLMTestMode } from '@mastra/core/test-utils/llm-recording';

// After
import { useLLMRecording, getLLMTestMode } from '@internal/test-utils';
```

**What remains in @mastra/core/test-utils:**
- `llm-mock.ts` - Public mock model utilities (MockLanguageModelV1, etc.)

**Files updated:**
- `packages/memory/integration-tests/src/shared/agent-memory.ts`
- `packages/memory/integration-tests/src/shared/streaming-memory.ts`
- `packages/memory/integration-tests/src/shared/working-memory.ts`
- `packages/memory/integration-tests/src/shared/working-memory-additive.ts`
- `packages/memory/integration-tests/src/shared/message-ordering.ts`
- `packages/memory/integration-tests/package.json` - Added `@internal/test-utils` dependency

Build verified: ✅ Both `@internal/test-utils` and `@mastra/core` build successfully

---

### 2026-01-30: Memory Integration Tests Verification

#### What's Working

1. **`@internal/test-utils` package** - Complete and functional
   - LLM recording/replay with MSW
   - Three modes: LIVE, RECORD, REPLAY
   - ~50x speedup in replay mode (1.5s vs 70s)
   - Vitest integration fixed (externalized vitest in tsup config)

2. **Memory integration tests using `@internal/test-utils`**
   - `test:message-ordering` - ✅ 18/18 pass with OpenAI key
   - `test:storage-init` - ✅ 3/3 pass (uses mock model, no embedder needed)
   - `test:processors` - likely works (no fastembed import)

3. **Containerd containers** - PostgreSQL, Redis, and serverless-redis-http all start correctly via nerdctl

#### Key Fix Applied

Added `external: ['vitest']` to `packages/_test-utils/tsup.config.ts` so lifecycle hooks use the consumer's vitest instance instead of being bundled.

#### Blocked by Missing Native Module

Tests requiring `@mastra/fastembed`:
- `test:pg`
- `test:libsql`
- `test:upstash`
- `test:fastembed`

**Root cause**: `@anush008/tokenizers` only publishes binaries for:
- Linux x64
- Windows x64
- macOS universal

**No ARM64 Linux binary exists** - would require the upstream maintainer to publish one.

```bash
$ pnpm view @anush008/tokenizers optionalDependencies
{
  '@anush008/tokenizers-win32-x64-msvc': '0.0.0',
  '@anush008/tokenizers-linux-x64-gnu': '0.0.0',
  '@anush008/tokenizers-darwin-universal': '0.0.0'
}
```

#### Recordings Location

Recordings are saved to each consumer package's `__recordings__/` directory (relative to `process.cwd()`):

```
packages/memory/integration-tests/
└── __recordings__/
    ├── message-ordering-v5-openai-gpt-4o.json
    ├── message-ordering-v6-gpt-4o.json
    └── ...
```

#### Next Steps (when on x64 or macOS)

1. Run `LLM_TEST_MODE=record` with API keys to create recordings
2. Commit the `__recordings__/` directory in each test package
3. CI will use `LLM_TEST_MODE=replay` for fast, deterministic tests

#### Usage Examples

```bash
# Live mode (default) - real API calls
OPENAI_API_KEY=sk-xxx pnpm test:message-ordering

# Record mode - real API calls + saves recordings
LLM_TEST_MODE=record OPENAI_API_KEY=sk-xxx pnpm test:message-ordering

# Replay mode - fast, uses recordings (auto in CI)
LLM_TEST_MODE=replay pnpm test:message-ordering
```

---

## PR Summary: LLM Recording Infrastructure for CI Test Optimization

### Overview

This PR introduces `@internal/test-utils`, a new internal package that provides LLM API recording and replay capabilities. This enables fast, deterministic CI tests by recording real LLM responses once and replaying them in subsequent test runs.

### Why This Matters

- **50x faster tests**: Replay mode runs in ~1.5s vs ~70s for live API calls
- **Deterministic**: No more flaky tests from LLM response variability
- **Cost savings**: No API costs after initial recording
- **Offline capable**: Tests run without network access

### What's Included

#### New Package: `@internal/test-utils`

Located at `packages/_test-utils/`, this package provides:

- **MSW-based recording/replay** with full SSE streaming support
- **Content-based request matching** - recordings match by URL + request body hash, not execution order, so tests can run in any order or in parallel
- **Three test modes**:
  - `live` (default) - Real API calls for local development
  - `record` - Real API calls + saves recordings
  - `replay` - Fast playback from recordings (auto-enabled in CI)
- **Contract validation** for detecting API schema drift in nightly tests
- **Multi-provider support**: OpenAI, Anthropic, Google, OpenRouter

#### Shared Test Helpers

Common utilities to reduce boilerplate across test files:

| Helper | Purpose |
|--------|---------|
| `setupDummyApiKeys(mode)` | Set placeholder API keys for replay mode |
| `hasApiKey(provider)` | Check if an API key is available |
| `agentGenerate(agent, msg, opts, model)` | Version-agnostic wrapper for v4/v5+ agent.generate() |
| `agentStream(agent, msg, opts, model)` | Version-agnostic wrapper for v4/v5+ agent.stream() |
| `isV5PlusModel(model)` | Check if model uses v5+ API |
| `getModelRecordingName(model)` | Convert model config to recording-safe filename |

#### Memory Integration Tests Updated

Updated 5 shared test files to use `@internal/test-utils`:
- `agent-memory.ts`
- `streaming-memory.ts`
- `working-memory.ts`
- `working-memory-additive.ts`
- `message-ordering.ts`

### Usage

```typescript
import {
  useLLMRecording,
  getLLMTestMode,
  setupDummyApiKeys,
  agentGenerate,
  getModelRecordingName,
} from '@internal/test-utils';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE);

describe('My Tests', () => {
  // One-line setup - handles beforeAll/afterAll automatically
  useLLMRecording(`my-tests-${getModelRecordingName(model)}`);

  it('works', async () => {
    // Version-agnostic generate - works with v4 and v5+ models
    const response = await agentGenerate(
      agent,
      'Hello',
      { threadId, resourceId },
      model
    );
    expect(response.text).toBeDefined();
  });
});
```

### Test Mode Control

```bash
# Live mode (default for local dev)
pnpm test

# Record mode (create new recordings)
LLM_TEST_MODE=record OPENAI_API_KEY=xxx pnpm test

# Replay mode (fast, auto in CI)
LLM_TEST_MODE=replay pnpm test
```

### Files Changed

- `packages/_test-utils/` - New internal package (54 tests)
- `packages/memory/integration-tests/package.json` - Added dependency
- `packages/memory/integration-tests/src/shared/*.ts` - Updated imports (5 files)
- `pnpm-workspace.yaml` - Added integration-tests to workspace
- `docs/ci-test-optimization.md` - Documentation

### Next Steps

1. Generate recordings on macOS/x64 (ARM64 Linux lacks native tokenizer binaries)
2. Commit `__recordings__/` directories
3. If the team likes this pattern, expand to other test suites (evals, core, etc.)

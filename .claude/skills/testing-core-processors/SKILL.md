# Testing Core Error Processors

How to write integration tests for error processors in `packages/core/src/processors/`.

## Prerequisites

- Build core before running tests: `pnpm build:core` (from repo root)
- If focused vitest runs fail to resolve `@internal/test-utils/setup`, the build step was skipped

## Mock Model Pattern

Use `MockLanguageModelV2` from `@internal/ai-sdk-v5/test` to simulate API errors and verify retry behavior.

```ts
import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';

// Track calls and captured prompts
let callCount = 0;
const receivedPrompts: any[] = [];

const model = new MockLanguageModelV2({
  doGenerate: async ({ prompt }) => {
    callCount++;
    receivedPrompts.push(JSON.parse(JSON.stringify(prompt)));
    if (callCount === 1) {
      throw new APICallError({
        message: '...',
        url: '...',
        requestBodyValues: {},
        statusCode: 400,
        responseBody: '...',
        isRetryable: false,
      });
    }
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text: 'response' }],
      warnings: [],
    };
  },
  doStream: async ({ prompt }) => {
    // Same error logic as doGenerate
    // IMPORTANT: Stream response must include all event types:
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'response text' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    };
  },
});
```

### Stream Mock Gotcha

The stream mock format requires `stream-start`, `response-metadata`, `text-start`, `text-delta`, `text-end`, and `finish` events. Using only `text-delta` + `finish` (the minimal format) will result in empty text output because the AI SDK expects the full event sequence. See `prefill-error-recovery.test.ts` for the reference pattern.

## Test Structure

For each error processor, write at minimum:

1. **Happy path**: Processor catches the target error, modifies messages, retries successfully
   - Assert: `agent.generate()` succeeds, mock called 2x, retry prompt has expected modifications
2. **Control test**: Same scenario without the processor — error propagates
   - Assert: `agent.generate()` throws the expected error
3. **Selectivity test**: Processor ignores unrelated errors (e.g. rate limit 429)
   - Assert: Error propagates, mock called only 1x

## Passing Messages with Tool Calls

When seeding conversation history for tool-related tests, pass messages as the second argument to `agent.generate()` or `agent.stream()` using the AI SDK message format:

```ts
const messages = [
  { role: 'user', content: 'Do something' },
  { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'some-id', toolName: 'myTool', args: {} }] },
  { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'some-id', toolName: 'myTool', result: 'done' }] },
];
await agent.generate(messages);
```

## Running Tests

```bash
# Run focused processor tests
npx vitest run packages/core/src/processors/my-processor.test.ts

# Run all processor tests
npx vitest run packages/core/src/processors/

# Full core test suite (slower)
pnpm test:core
```

## Devin Secrets Needed

None for mock-based integration tests. For live API tests:

- `ANTHROPIC_API_KEY` — for testing against real Anthropic API
- `OPENROUTER_API_KEY` — for testing provider switching scenarios

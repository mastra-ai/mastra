# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**

- Vitest (catalog version - shared across packages)
- Config: `vitest.config.ts` per package

**Assertion Library:**

- Vitest built-in `expect`
- Chai-style assertions via Vitest

**Run Commands:**

```bash
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode
pnpm test:core               # Core package tests
pnpm test:memory             # Memory package tests
pnpm test:cli                # CLI package tests
pnpm test:clients            # Client SDK tests
pnpm test:combined-stores    # All storage adapters
pnpm test:e2e:client-js      # E2E tests for client-js
```

**Package-specific testing:**

```bash
# Faster testing: build from root, then test individual package
pnpm build
cd packages/memory
pnpm test
```

## Test File Organization

**Location:**

- Co-located with source: `*.test.ts` next to `*.ts`
- Example: `packages/core/src/agent/agent.test.ts`

**Naming:**

- Unit tests: `{filename}.test.ts`
- Integration tests: `{filename}.integration.test.ts`
- Type tests: `{filename}.test-d.ts`

**Structure:**

```
packages/core/src/
  agent/
    agent.ts
    agent.test.ts
    agent-types.test-d.ts
  error/
    index.ts
    index.test.ts
    utils.ts
    utils.test.ts
  workflows/
    workflow.ts
    workflow.test.ts
    __tests__/
      parallel-writer.test.ts
      writer-custom-bubbling.test.ts
```

## Test Configuration

**Root vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    // Increase default timeout for tests that make real API calls to LLMs
    testTimeout: 120000, // 2 minutes default
  },
});
```

**Patterns:**

- Node environment by default
- 2-minute timeout for API tests
- Type checking enabled for `.test-d.ts` files
- Tests include from `src/**/*.test.ts`

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Setup per test
  });

  describe('Streaming', () => {
    it('should generate a stream', async () => {
      // Arrange
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });

      // Act
      const { stream, getWorkflowState } = run.streamLegacy({ inputData: {} });

      // Assert
      expect(watchData.length).toBe(8);
      expect(watchData).toMatchObject([...]);
    });
  });
});
```

**Setup/Teardown:**

- `beforeEach`: Reset mocks, setup test data
- `afterEach`: Cleanup, clear timers
- `beforeAll`/`afterAll`: Rare, for expensive setup

**Assertion Patterns:**

```typescript
// Equality
expect(result.status).toBe('success');
expect(result.text).toContain('Donald Trump');

// Object matching (partial)
expect(executionResult.steps.step1).toEqual({
  status: 'success',
  output: { result: 'success1' },
  payload: {},
  startedAt: expect.any(Number),
  endedAt: expect.any(Number),
});

// Array matching
expect(watchData).toMatchObject([
  { type: 'start', payload: { runId: 'test-run-id' } },
  // ...
]);

// Length checks
expect(toolCalls.length).toBeLessThan(1);
expect(clonedMessages).toHaveLength(3);

// Truthiness
expect(result).not.toBeNull();
expect(result?.content).toBeUndefined();

// Array checks
expect(Array.isArray(result?.content)).toBe(true);
```

## Mocking

**Framework:** Vitest `vi`

**Patterns:**

```typescript
// Mock module
vi.mock('crypto', () => {
  return {
    randomUUID: vi.fn(() => 'mock-uuid-1'),
  };
});

// Mock function
const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });

// Mock implementation (conditional)
const promptAgentAction = vi
  .fn()
  .mockImplementationOnce(async ({ suspend }) => {
    await suspend();
    return undefined;
  })
  .mockImplementationOnce(() => ({ modelOutput: 'test output' }));

// Spy with implementation
const doStreamSpy = vi.fn<any>(async ({ prompt, temperature }) => {
  expect(systemMessage?.content).toContain('overridden instructions');
  return { stream: simulateReadableStream({...}), rawCall: {...} };
});
```

**Mock Language Models:**

```typescript
// V1 Mock
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';

const dummyModel = new MockLanguageModelV1({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    text: 'Dummy response',
  }),
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [{ type: 'text-delta', textDelta: 'Dummy response' }],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

// V2 Mock
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';

const dummyModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Dummy response' }],
    warnings: [],
  }),
  doStream: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([...]),
  }),
});
```

**What to Mock:**

- External API calls (LLMs, external services)
- `crypto.randomUUID()` for deterministic IDs
- Time-sensitive operations

**What NOT to Mock:**

- Core business logic under test
- Storage when testing storage integration
- Internal module boundaries (prefer integration tests)

## Fixtures and Factories

**Test Data:**

```typescript
// Inline test data
const messages: MastraDBMessage[] = [
  {
    id: 'msg-1',
    threadId: sourceThread.id,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
    createdAt: new Date('2024-01-01T10:00:00Z'),
  },
];

// Factory functions
function createTestSchemas(schemaKeys: SchemaKey[] = []): z.ZodObject<any> {
  if (schemaKeys.length === 0) {
    return z.object(allSchemas);
  }
  const selectedSchemas = Object.fromEntries(schemaKeys.map(key => [key, allSchemas[key]]));
  return z.object(selectedSchemas as Record<string, z.ZodType>);
}
```

**Mock Store:**

```typescript
import { InMemoryStore, MockStore } from '@mastra/core/storage';

const testStorage = new MockStore();
// or
const testStorage = new InMemoryStore();
```

**Testable Subclass Pattern:**

```typescript
// Expose protected method for testing
class TestableMemory extends Memory {
  public testUpdateMessageToHideWorkingMemoryV2(message: MastraDBMessage): MastraDBMessage | null {
    return this.updateMessageToHideWorkingMemoryV2(message);
  }
}
```

**Location:**

- Inline in test files for small fixtures
- `test-utils/` directories for shared utilities
- `packages/core/src/loop/test-utils/` - LLM mock utilities

## Coverage

**Requirements:** Not enforced at repository level

**View Coverage:**

```bash
# Vitest coverage with v8
pnpm test -- --coverage
```

**Coverage Tools:**

- `@vitest/coverage-v8` (catalog dependency)
- `@vitest/ui` for visual test runner

## Test Types

**Unit Tests:**

- Co-located `*.test.ts` files
- Test individual functions/classes
- Heavy mocking of external dependencies
- Fast execution

**Integration Tests:**

- Named `*.integration.test.ts`
- Test component interactions
- May use real databases (Docker)
- Require `pnpm dev:services:up`

**Type Tests:**

- Named `*.test-d.ts`
- Test TypeScript types at compile time
- Use `expectTypeOf` from Vitest

**E2E Tests:**

- Separate packages: `client-js-e2e-tests-*`
- Test full user flows
- Require running services

## Common Patterns

**Async Testing:**

```typescript
it('should handle async operations', async () => {
  const { stream, getWorkflowState } = run.streamLegacy({ inputData: {} });

  const collectedStreamData: StreamEvent[] = [];
  for await (const data of stream) {
    collectedStreamData.push(JSON.parse(JSON.stringify(data)));
  }

  const executionResult = await getWorkflowState();
  expect(executionResult.status).toBe('success');
});
```

**Error Testing:**

```typescript
it('should throw error when agent not found', () => {
  expect(() => mastra.getAgent('nonexistent')).toThrow(MastraError);
});

it('should throw specific error message', async () => {
  await expect(operation()).rejects.toThrow('Expected error message');
});
```

**Stream Testing:**

```typescript
it('should stream text response', async () => {
  const response = await agent.stream('Question?');

  let finalText = '';
  for await (const textPart of response.textStream) {
    expect(textPart).toBeDefined();
    finalText += textPart;
  }

  expect(finalText).toContain('Expected content');
});
```

**Parameterized Tests:**

```typescript
// Testing multiple model versions
function agentTests({ version }: { version: 'v1' | 'v2' }) {
  describe(`${version} - agent`, () => {
    it('should work', async () => {
      if (version === 'v1') {
        response = await agent.generateLegacy('prompt');
      } else {
        response = await agent.generate('prompt');
      }
    });
  });
}

// Run tests for both versions
agentTests({ version: 'v1' });
agentTests({ version: 'v2' });
```

**Timeout Configuration:**

```typescript
// Per-test timeout
it('should complete slow operation', async () => {
  // test code
}, 10000);

// Suite-level constant
const SUITE_TIMEOUT = 300000; // 5 minutes
const TEST_TIMEOUT = 300000; // 5 minutes
```

## Test Infrastructure

**Docker Services:**

```bash
pnpm dev:services:up      # Start PostgreSQL, etc.
pnpm dev:services:down    # Stop services
```

**Environment Variables:**

- Tests use `dotenv` for loading `.env` files
- API keys: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`
- Some tests skip without required env vars

**Test Count:**

- ~542 test files across the monorepo
- Excludes `node_modules/` and `examples/`

---

_Testing analysis: 2026-01-26_

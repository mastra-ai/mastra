# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Runner:**

- Vitest (catalog version in monorepo)
- Config: `vitest.config.ts` in each package and root

**Assertion Library:**

- Vitest built-in (`expect`)

**Run Commands:**

```bash
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode
pnpm test:core               # Run core package tests
pnpm test:memory             # Run memory package tests
pnpm --filter ./packages/core test  # Filter specific package
```

## Test File Organization

**Location:**

- Co-located pattern: `*.test.ts` next to source files
- `__tests__/` directories for grouped tests
- `integration-tests/` for integration suites

**Naming:**

- `*.test.ts` for unit tests
- `*.spec.ts` for e2e tests (Playwright)
- `*.test-d.ts` for type tests

**Structure:**

```
packages/core/src/
├── agent/
│   ├── agent.ts
│   ├── agent-processor.test.ts      # co-located
│   └── __tests__/                   # grouped tests
│       ├── tools.test.ts
│       ├── mock-model.ts            # shared mocks
│       └── memory-readonly.test.ts
├── tools/
│   ├── tool.ts
│   └── validation.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Memory', () => {
  describe('updateMessageToHideWorkingMemoryV2', () => {
    const memory = new TestableMemory();

    it('should handle proper V2 message content', () => {
      const message: MastraDBMessage = {
        id: 'test-1',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'Hello world' }] },
      };

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      expect(result?.content.parts).toHaveLength(1);
    });
  });
});
```

**Patterns:**

- Nested `describe` blocks for grouping
- `beforeEach` for setup, avoid `beforeAll` when possible
- Clear test names starting with "should"
- One assertion focus per test (multiple expects OK for related checks)

## Mocking

**Framework:** Vitest (`vi`)

**Patterns:**

```typescript
// Function mock
const mockFindUser = vi.fn().mockImplementation(async data => {
  const list = [{ name: 'Dero Israel', email: 'dero@mail.com' }];
  return list?.find(({ name }) => name === data.name);
});

// Module mock
vi.mock('./utils', () => ({
  transformTraceToScorerInputAndOutput: vi.fn(() => ({ input: 'test', output: 'test' })),
}));

// Spy on methods
vi.spyOn(agent, 'generate');
vi.spyOn(ConsoleLogger.prototype, 'error');

// Mock object pattern
const mockMastra = {
  getStore: vi.fn().mockImplementation((domain: string) => {
    if (domain === 'evals') return { saveScore: vi.fn() };
    return null;
  }),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
};
```

**What to Mock:**

- External APIs and services
- LLM model responses (use mock models)
- Storage/database operations
- Timers and random values

**What NOT to Mock:**

- Pure functions
- Internal utility functions (test through public API)
- Type validation logic

## Mock Models

**Location:** `packages/core/src/agent/__tests__/mock-model.ts`

**Available mocks:**

```typescript
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MockLanguageModelV3 } from '@internal/ai-v6/test';

// Factory functions
getSingleDummyResponseModel('v1' | 'v2' | 'v3'); // Returns mock with dummy text
getDummyResponseModel('v1' | 'v2' | 'v3'); // Returns mock with multiple responses
getEmptyResponseModel('v1' | 'v2' | 'v3'); // Returns mock with no content
getErrorResponseModel('v1' | 'v2' | 'v3'); // Returns mock that throws
```

**Mock model setup:**

```typescript
const mockModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Dummy response' }],
    warnings: [],
  }),
  doStream: async () => ({
    stream: convertArrayToReadableStream([...]),
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
  }),
});
```

## Fixtures and Factories

**Test Data:**

```typescript
// Inline fixtures for simple data
const message: MastraDBMessage = {
  id: 'test-1',
  role: 'user',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text: 'Hello world' }] },
};

// Expose protected methods for testing
class TestableMemory extends Memory {
  public testUpdateMessageToHideWorkingMemoryV2(message: MastraDBMessage) {
    return this.updateMessageToHideWorkingMemoryV2(message);
  }
}
```

**Location:**

- Test fixtures inline in test files
- Shared mocks in `__tests__/` directories
- Mock models in `mock-model.ts`

## Coverage

**Requirements:** None enforced

**View Coverage:**

```bash
pnpm test -- --coverage
```

**Coverage config in vitest.config.ts:**

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
}
```

## Test Types

**Unit Tests:**

- Co-located `*.test.ts` files
- Test individual functions/classes
- Mock external dependencies
- Fast execution

**Integration Tests:**

- Located in `integration-tests/` directories
- Test multiple components together
- May require Docker services (`pnpm dev:services:up`)
- Longer timeouts configured

**E2E Tests:**

- Playwright for UI (`packages/playground/e2e/`)
- `*.spec.ts` naming convention
- Test complete user flows
- Located in `e2e-tests/` at root

## Common Patterns

**Async Testing:**

```typescript
it('should handle async operations', async () => {
  const result = await agentOne.generate('Call testTool');
  expect(result.toolResults).toBeDefined();
});
```

**Stream Testing:**

```typescript
it('should handle streaming', async () => {
  const result = await agent.stream('Hello');

  for await (const chunk of result.fullStream) {
    // process chunks
  }

  expect(await result.finishReason).toBe('stop');
});
```

**Error Testing:**

```typescript
it('should throw on invalid input', async () => {
  await expect(agent.generate(undefined as any)).rejects.toThrow();
});
```

**Parameterized Tests:**

```typescript
function toolsTest(version: 'v1' | 'v2' | 'v3') {
  describe(`agents using tools ${version}`, () => {
    it('should call testTool from TestIntegration', async () => {
      // Test logic using version parameter
    });
  });
}

toolsTest('v1');
toolsTest('v2');
toolsTest('v3');
```

## Vitest Config Options

**Standard config (`packages/memory/vitest.config.ts`):**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: 'dot', // smaller output for LLMs
    bail: 1, // stop on first failure
  },
});
```

**Integration config (`packages/memory/integration-tests/vitest.config.ts`):**

```typescript
export default defineConfig({
  test: {
    pool: 'forks', // isolated processes
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 1 minute
    hookTimeout: 30000, // 30 seconds
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
    reporters: 'dot',
    bail: 1,
  },
});
```

**Core config with typecheck:**

```typescript
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    testTimeout: 120000, // 2 minutes for LLM calls
  },
});
```

## E2E Testing (Playwright)

**Location:** `packages/playground/e2e/`

**Structure:**

```typescript
import { test, expect } from '@playwright/test';
import { setupMockAuth, setupUnauthenticated } from '../__utils__/auth';

test.describe('Login Flow', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('unauthenticated user sees login prompt', async ({ page }) => {
    await setupUnauthenticated(page);
    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  });
});
```

**Utilities:**

- `packages/playground/e2e/tests/__utils__/auth.ts` - Auth mocking
- `packages/playground/e2e/tests/__utils__/reset-storage.ts` - Storage cleanup

---

_Testing analysis: 2026-01-27_

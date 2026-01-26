# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**
- Vitest (npm package `vitest`, catalog version)
- Config: `vitest.config.ts` in each package
- Environment: `node` (no browser)

**Assertion Library:**
- Vitest built-in expect API
- Syntax: `expect(value).toBe(expected)`, `expect(...).toMatchSnapshot()`
- No separate assertion library needed

**Run Commands:**
```bash
pnpm test                    # Run all tests (slow, includes all packages)
pnpm test:watch             # Watch mode across monorepo
pnpm test:core              # Test core package only
pnpm test:memory            # Test memory package only
pnpm test:combined-stores   # Test all storage adapters
cd packages/core && pnpm test  # From package dir (faster)
```

**Configuration:**
- File: `packages/core/vitest.config.ts`
- Settings:
  - Environment: node
  - Test timeout: 120000ms (2 minutes, increased for LLM API calls)
  - Type checking enabled for `.test-d.ts` files
  - Include pattern: `src/**/*.test.ts`

## Test File Organization

**Location:**
- Co-located with source files (not separate test directories)
- Same directory as implementation: `src/agent/agent.test.ts` alongside `src/agent/agent.ts`
- Integration test pattern: `*.integration.test.ts` for tests requiring external services

**Naming:**
- Standard suffix: `.test.ts`
- Type definitions: `.test-d.ts` for Vitest typecheck
- Pattern examples:
  - `utils.test.ts`
  - `workflow.test.ts`
  - `working-memory.test.ts`
  - `embedding-router.integration.test.ts`

**Structure:**
```
packages/core/
├── src/
│   ├── workflows/
│   │   ├── workflow.ts
│   │   ├── workflow.test.ts
│   │   ├── processor-step.test.ts
│   │   └── evented/
│   │       ├── evented-workflow.test.ts
│   │       └── step-executor.test.ts
│   ├── tools/
│   │   ├── tool.ts
│   │   ├── tools.test.ts
│   │   ├── tool-builder/
│   │   │   ├── builder.ts
│   │   │   └── builder.test.ts
│   ├── utils.test.ts
│   └── evals/
│       ├── base.test.ts
│       ├── base.test-utils.ts
│       └── run/
│           └── index.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
// ... other imports

describe('ComponentName', () => {
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    testData = createTestData();
  });

  describe('Nested feature', () => {
    it('should do specific behavior', async () => {
      // Arrange
      const input = { ... };

      // Act
      const result = await function(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns:**
- `describe()` blocks for grouping related tests (two levels common)
- `beforeEach()` for test setup/reset
- `it()` for individual test cases
- Descriptive test names starting with "should": "should return shallow copy of existing when update is null"
- Optional `afterEach()` for cleanup

**Test Data Factories:**
```typescript
const createTestData = () => ({
  inputText: 'test input',
  outputText: 'test output',
  get userInput() {
    return [{ role: 'user', content: this.inputText }];
  },
  get agentOutput() {
    return { role: 'assistant', text: this.outputText };
  },
  get scoringInput() {
    return { input: this.userInput, output: this.agentOutput };
  },
});
```

**Helper Functions in Tests:**
```typescript
function createMockMessageList(messages: MastraDBMessage[] = []): MessageList {
  const mockMessageList = {
    get: {
      all: { db: () => messages },
      input: { db: () => messages.filter(m => m.role === 'user') },
      response: { db: () => messages.filter(m => m.role === 'assistant') },
    },
    add: vi.fn(),
    // ... other methods
  } as unknown as MessageList;
  return mockMessageList;
}
```

## Mocking

**Framework:** Vitest mocking API

**Patterns:**

**Module Mocking:**
```typescript
vi.mock('crypto', () => {
  return {
    randomUUID: vi.fn(() => 'mock-uuid-1'),
  };
});
```

**Function Mocks:**
```typescript
const mockFindUser = vi.fn().mockImplementation(async (name) => {
  return { id: 1, name };
});

// Reset after test
vi.resetAllMocks();
```

**Spy Mocking (track existing functions):**
```typescript
const debugSpy = vi.spyOn(ConsoleLogger.prototype, 'debug');

// Later in test
expect(debugSpy).toHaveBeenCalledWith('[Agent:testAgent] - Executing tool testTool', expect.any(Object));

debugSpy.mockRestore();
```

**Mock Implementation in Objects:**
```typescript
const mockMessageList = {
  add: vi.fn(),
  addSystem: vi.fn(),
  removeByIds: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(() => []),
  makeMessageSourceChecker: vi.fn(() => ({ getSource: () => 'input' })),
} as unknown as MessageList;
```

**What to Mock:**
- External service calls (HTTP, LLM APIs)
- File system operations (fs.promises.writeFile)
- Crypto/random functions (randomUUID)
- Date/time if needed
- Constructor calls for expensive objects
- Logger functions to verify logging behavior

**What NOT to Mock:**
- Core business logic
- Data structures (objects, arrays)
- Validation/schema functions
- Helper utilities
- Internal function calls (let them run real)
- Zod validation (test actual validation)

## Fixtures and Factories

**Test Data Helpers:**

Location: Co-located with tests or in `base.test-utils.ts` files

File: `packages/core/src/evals/base.test-utils.ts` - contains:
```typescript
export const FunctionBasedScorerBuilders = {
  basic: createScorer({...}),
  withReason: createScorer({...}),
  withPreprocessAndReason: createScorer({...}),
  // ... more builders
};

export const PromptBasedScorerBuilders = {
  // ... prompt-based scorers
};
```

Pattern:
- Reusable builder objects with common test configurations
- Lazy evaluation with getters (see `createTestData` example above)
- Factories for creating complex objects

## Coverage

**Requirements:** Not enforced at monorepo level
- Coverage configured but not required as CI step
- Tool: `@vitest/coverage-v8` available but optional

**View Coverage:**
```bash
vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Single function or method
- Approach: Direct function calls with mocked dependencies
- Files: Most `.test.ts` files are unit tests
- Example: `maskStreamTags`, `isVercelTool`, `resolveSerializedZodOutput` (see `utils.test.ts`)
- Extensive use of edge cases: empty inputs, split boundaries, malformed tags

**Integration Tests:**
- Scope: Component working with real or semi-real dependencies
- Approach: Set up real storage, mock only external services
- Suffix: `.integration.test.ts`
- Example: `embedding-router.integration.test.ts`
- Run with: `pnpm dev:services:up` (Docker services required)

**E2E Tests:**
- Framework: Playwright or Vitest in some cases
- Pattern: Full workflow execution end-to-end
- Location: `client-js-e2e-tests-*` packages
- Run with: `pnpm test:e2e:client-js`

**Type Testing:**
- Files: `.test-d.ts` suffix
- Framework: Vitest typecheck mode
- Purpose: Verify TypeScript type inference and generic constraints
- Example: `tool-stream-types.test-d.ts` in `src/tools/`

## Common Patterns

**Async Testing:**
```typescript
it('should create a basic scorer with functions', async () => {
  const scorer = FunctionBasedScorerBuilders.basic;
  const { runId, ...result } = await scorer.run(testData.scoringInput);

  expect(runId).toBeDefined();
  expect(result).toMatchSnapshot();
});
```

**Generator/Stream Testing:**
```typescript
async function* makeStream(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function collectStream(stream: AsyncIterable<string>): Promise<string> {
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}

it('should pass through text without tags', async () => {
  const input = ['Hello', ' ', 'world'];
  const masked = maskStreamTags(makeStream(input), 'secret');
  expect(await collectStream(masked)).toBe('Hello world');
});
```

**Error Testing:**
```typescript
it('should handle tool execution errors correctly', async () => {
  const errorSpy = vi.spyOn(ConsoleLogger.prototype, 'error');
  const error = new Error('Test error');

  const mastraTool = createTool({
    id: 'test',
    description: 'Test description',
    inputSchema: z.object({ name: z.string() }),
    execute: async () => {
      throw error;
    },
  });

  const coreTool = makeCoreTool(mastraTool, mockOptions);
  const result = await coreTool.execute?.({ name: 'test' }, { toolCallId: 'test-id', messages: [] });

  expect(result).toBeInstanceOf(MastraError);
  expect(result.message).toBe('Test error');
  expect(errorSpy).toHaveBeenCalled();
  errorSpy.mockRestore();
});
```

**Snapshot Testing:**
```typescript
it('should create a scorer with reason', async () => {
  const scorer = FunctionBasedScorerBuilders.withReason;
  const { runId, ...result } = await scorer.run(testData.scoringInput);

  expect(runId).toBeDefined();
  expect(result).toMatchSnapshot();  // Captures complex output structure
});
```

**Mocking Lifecycle Callbacks:**
```typescript
it('should call lifecycle callbacks', async () => {
  const onStart = vi.fn();
  const onEnd = vi.fn();
  const onMask = vi.fn();

  const input = ['<secret>', 'hidden', '</secret>'];
  const masked = maskStreamTags(makeStream(input), 'secret', { onStart, onEnd, onMask });
  await collectStream(masked);

  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onMask).toHaveBeenCalledWith('hidden');
});
```

**Object Structure Testing:**
```typescript
it('should generate a stream', async () => {
  // ... setup

  expect(watchData).toMatchObject([
    {
      payload: {
        runId: 'test-run-id',
      },
      type: 'start',
    },
    {
      payload: {
        id: 'step1',
        payload: {},
        startedAt: expect.any(Number),
      },
      type: 'step-start',
    },
    // ... more events
  ]);
});
```

**Conditional/Type Guard Testing:**
```typescript
it('should return true for a Vercel Tool', () => {
  const tool = {
    name: 'test',
    parameters: z.object({
      name: z.string(),
    }),
  };
  expect(isVercelTool(tool)).toBe(true);
});

it('should return false for a Mastra Tool', () => {
  const tool = createTool({
    id: 'test',
    description: 'test',
    inputSchema: z.object({
      name: z.string(),
    }),
    execute: async () => ({}),
  });
  expect(isVercelTool(tool)).toBe(false);
});
```

**Multi-Step Test with Shared Mocks:**
```typescript
describe('Workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    let counter = 0;
    (randomUUID as vi.Mock).mockImplementation(() => {
      return `mock-uuid-${++counter}`;
    });
  });

  describe('Streaming', () => {
    it('should generate a stream', async () => {
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

      // Use actions in steps
      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        // ...
      });
    });
  });
});
```

## Performance Considerations

**Timeout Configuration:**
- Default: 120 seconds (120000ms)
- Reason: Tests making real calls to LLM APIs need extended timeout
- Configured in `vitest.config.ts`

**Test Isolation:**
- No shared state between tests
- `beforeEach()` resets all test data
- Mock reset: `vi.resetAllMocks()` at start of each test

**Fast Testing:**
- Build from root first: `pnpm build`
- Then cd to package and test: `cd packages/core && pnpm test`
- Faster than running all tests from root

---

*Testing analysis: 2026-01-26*

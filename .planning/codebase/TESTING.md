# Testing Patterns

**Analysis Date:** 2025-01-27

## Test Framework

**Runner:**
- Framework: Vitest (not Jest)
- Version: Managed via catalog (see `pnpm/package.json`)
- Config file: `vitest.config.ts` (per package)

**Assertion Library:**
- Vitest built-in `expect()` API (compatible with Jest)
- No additional assertion libraries needed

**Run Commands:**
```bash
pnpm test                    # Run all tests across monorepo
pnpm test:core              # Run tests in specific package
pnpm test:watch             # Watch mode for all tests
cd packages/core && pnpm test  # Run single package tests (faster)
```

**Test Timeout Configuration:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 120000, // 2 minutes for LLM API calls
  },
});
```

## Test File Organization

**Location:**
- Co-located with source code: `src/feature/file.ts` and `src/feature/file.test.ts`
- Same directory as implementation file

**Naming:**
- `.test.ts` for unit/integration tests
- `.test-d.ts` for TypeScript type tests
- `.integration.test.ts` for integration tests requiring external services
- Test utilities: `.test-utils.ts` (not test files themselves)

**Structure:**
```
packages/core/src/
├── agent/
│   ├── agent.ts
│   ├── agent.test.ts           # Tests for agent.ts
│   ├── agent.test-d.ts         # Type tests
│   ├── types.ts
│   └── message-list.test.ts    # Tests for message-list.ts
├── tools/
│   ├── tool.ts
│   ├── tool.test.ts
│   └── types.ts
└── evals/
    ├── base.ts
    ├── base.test.ts
    └── base.test-utils.ts      # Shared test utilities
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('createScorer', () => {
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    testData = createTestData();
  });

  describe('Steps as functions scorer', () => {
    it('should create a basic scorer with functions', async () => {
      const scorer = FunctionBasedScorerBuilders.basic;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });
});
```

**Patterns:**
- Root `describe()` wraps feature or class name
- Nested `describe()` for related test groups
- `it()` for individual test cases with clear descriptions
- One assertion per `it()` preferred, but multiple related assertions acceptable
- `beforeEach()` for setup before each test
- `afterEach()` for cleanup (less common)

## Mocking

**Framework:**
- Vitest's `vi` utility from `vitest` package
- No additional mocking libraries needed

**Patterns:**
```typescript
// Mock an entire module
vi.mock('./utils', () => ({
  utilFunction: vi.fn(),
}));

// Spy on method without replacing
vi.spyOn(object, 'method');

// Spy and mock return value
vi.spyOn(object, 'method').mockResolvedValue(value);

// Mock implementation inline
vi.spyOn(object, 'method').mockImplementation(async (input) => {
  return customValue;
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Examples from codebase:**

```typescript
// Mocking module at top level
vi.mock('./utils', () => ({
  someFunction: vi.fn().mockReturnValue('test'),
}));

// Spy on instance method
const scorerSpy = vi.spyOn(mockScorer, 'run');

// Chained mock implementation
scorers[0].run = vi
  .fn()
  .mockResolvedValueOnce({ score: 0.6, reason: 'test' })
  .mockResolvedValueOnce({ score: 1.0, reason: 'test' });

// Access mock results
const syncSpy = vi.spyOn(registry, 'syncGateways');
expect(syncSpy).toHaveBeenCalled();
```

**What to Mock:**
- External API calls (LLM providers, third-party services)
- File system operations
- Database operations
- Long-running async operations
- Non-deterministic functions

**What NOT to Mock:**
- Core framework logic (Agent, Workflow, Tool classes)
- Pure utility functions
- Zod validation
- Your own internal implementations unless testing error paths

## Fixtures and Factories

**Test Data:**
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

// Usage in beforeEach
beforeEach(() => {
  testData = createTestData();
});
```

**Mock Builders:**
```typescript
const createMockScorer = (name: string, score: number = 0.8): MastraScorer => {
  const scorer = createScorer({
    id: name,
    description: 'Mock scorer',
    name,
  }).generateScore(() => score);

  vi.spyOn(scorer, 'run');
  return scorer;
};

const createMockAgent = (response: string = 'Dummy response'): Agent => {
  const dummyModel = new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: response,
    }),
  });

  const agent = new Agent({
    id: 'mockAgent',
    name: 'mockAgent',
    instructions: 'Mock agent',
    model: dummyModel,
  });

  vi.spyOn(agent, 'generateLegacy');
  return agent;
};
```

**Location:**
- Test utilities in `.test-utils.ts` files next to tests
- Factories for mocks at top of test files or in separate utilities
- Shared fixtures in `packages/core/src/test-utils/`

## Coverage

**Requirements:**
- Not enforced at build time
- No coverage thresholds configured
- Coverage analysis available via `@vitest/coverage-v8`

**View Coverage:**
```bash
pnpm vitest run --coverage
# or per-package:
cd packages/core && pnpm vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Single function or class method
- Approach: Mock external dependencies, test behavior in isolation
- Example: Testing `maskStreamTags()` utility with stream chunks
- Location: Same file as source, `*.test.ts`

**Integration Tests:**
- Scope: Multiple components working together
- Approach: Use real implementations where practical, mock external APIs
- Example: `DefaultExecutionEngine.executeConditional()` with real step execution
- Suffix: `.integration.test.ts` (optional, but used for clarity)
- May require Docker services: `pnpm dev:services:up`

**Type Tests:**
- Scope: TypeScript type checking and inference
- Framework: `typecheck: { enabled: true, include: ['**/*.test-d.ts'] }` in vitest.config.ts
- Approach: Use `expectType()` from @vitest/expect-type (if available) or type-only assertions
- Location: `*.test-d.ts` files
- Example: `packages/core/src/request-context/request-context.test-d.ts`

**E2E Tests:**
- Framework: Separate `e2e-tests/` folder with own configuration
- Location: `/e2e-tests/` directory at root
- Approach: Full application testing with real deployments
- Not part of core package tests

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});

// With vi.fn() and mocks
const mockFn = vi.fn().mockResolvedValue({ success: true });
const result = await mockFn();
expect(result).toEqual({ success: true });

// Using spy on async method
const spy = vi.spyOn(agent, 'generate');
await agent.generate(input);
expect(spy).toHaveBeenCalledWith(input);
```

**Error Testing:**
```typescript
it('should throw MastraError on invalid input', async () => {
  const mastraError = new MastraError({
    id: 'TEST_ERROR',
    domain: ErrorDomain.MASTRA_WORKFLOW,
    category: ErrorCategory.USER,
  });

  const mockFn = vi.fn().mockRejectedValue(mastraError);

  expect(async () => {
    await mockFn();
  }).rejects.toThrow(MastraError);
});

// Alternative pattern
it('should handle error conditions', async () => {
  try {
    await functionThatThrows();
    expect.fail('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(MastraError);
    expect((error as MastraError).id).toBe('EXPECTED_ERROR_ID');
  }
});
```

**Snapshot Testing:**
```typescript
it('should produce expected output structure', async () => {
  const { runId, ...result } = await scorer.run(scoringInput);

  expect(runId).toBeDefined();
  expect(result).toMatchSnapshot(); // Auto-generates .snap file
});
```

**Conditional Test Logic:**
```typescript
it('should run experiment with multiple scorers', async () => {
  const result = await runEvals({
    data: testData,
    scorers: mockScorers,
    target: mockAgent,
  });

  expect(result.scores.toxicity).toBe(0.9);
  expect(result.scores.relevance).toBe(0.7);
  expect(result.summary.totalItems).toBe(2);
});
```

## Test Isolation

**Setup/Teardown:**
- `beforeEach()` for per-test setup (commonly used)
- `afterEach()` for cleanup (less common, often not needed)
- `beforeAll()` for one-time setup (rare)
- `afterAll()` for one-time teardown (rare)

**Mock Cleanup:**
```typescript
beforeEach(() => {
  vi.clearAllMocks(); // Clear all mocks before each test
});
```

**State Management:**
- Each test should be independent
- Reset mocked functions in `beforeEach()`
- Use local variables for test data, not globals
- Don't rely on test execution order

## Testing LLM Integrations

**Mock Models:**
- Use `MockLanguageModelV1` from `@internal/ai-sdk-v4/test`
- Use `MockLanguageModelV2` from `@internal/ai-sdk-v5/test` for newer version
- Mock `doGenerate()` and `doStream()` methods
- Increase testTimeout to 120000ms for real API calls

**Example:**
```typescript
const dummyModel = new MockLanguageModelV1({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    text: 'Mocked response',
  }),
});

const agent = new Agent({
  id: 'testAgent',
  name: 'Test Agent',
  instructions: 'Test instructions',
  model: dummyModel,
});
```

## Development Workflow

**Fast Iteration:**
```bash
# Build from monorepo root first
pnpm build

# Then run tests in specific package for speed
cd packages/core
pnpm test:watch    # Much faster than pnpm test from root

# Or target specific test file
pnpm vitest run src/agent/agent.test.ts
```

**With Docker Services:**
```bash
# Start required services for integration tests
pnpm dev:services:up

# Run integration tests
pnpm test

# Stop services
pnpm dev:services:down
```

---

*Testing analysis: 2025-01-27*

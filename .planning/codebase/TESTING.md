# Testing Patterns

**Analysis Date:** 2026-01-23

## Test Framework

**Runner:**
- Vitest (v9.x via catalog dependencies)
- Config: `vitest.config.ts` at root, package-level overrides in `packages/*/vitest.config.ts`
- Root config in `/Users/yj/.superset/worktrees/mastra/test-gsd/vitest.config.ts` aggregates projects

**Assertion Library:**
- Vitest's built-in expect() for assertions (no separate library)
- Snapshot testing via `expect().toMatchSnapshot()`

**Run Commands:**
```bash
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode across all packages
cd packages/core && pnpm test  # Test single package (faster)
pnpm test -- --coverage      # Coverage report
```

**Package-Specific Configs:**
- `packages/core/vitest.config.ts`: node environment, includes `src/**/*.test.ts` and `src/**/*.test-d.ts` for type checking
- `packages/deployer/vitest.config.ts`: node environment, includes `src/**/*.test.ts`
- Timeout: 120000ms (2 minutes) for tests making LLM API calls

## Test File Organization

**Location:**
- Co-located with source: `src/agent/agent.ts` + `src/agent/agent.test.ts`
- Subdirectory organization: `src/agent/__tests__/agent.test.ts` also common
- Test utilities in `src/*/test-utils.ts` modules
- Fixtures in `__fixtures__/` directories

**Naming:**
- `.test.ts` suffix for unit/integration tests
- `.test-d.ts` suffix for type checking tests (Vitest typecheck mode)
- File names match source: `agent.test.ts` tests `agent.ts`

**Structure:**
```
packages/core/src/
├── agent/
│   ├── agent.ts
│   ├── agent.test.ts        # Main test file
│   ├── __tests__/           # Complex test suites
│   │   └── agent-network.test.ts
│   ├── test-utils.ts        # Test helpers and mocks
│   └── workflows/
│       ├── prepare-stream.ts
│       └── prepare-stream.test.ts
└── error/
    ├── index.ts
    ├── index.test.ts
    └── utils.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Name', () => {
  let testState: any;

  beforeEach(() => {
    // Setup before each test
    testState = {};
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Nested Feature', () => {
    it('should do something specific', () => {
      expect(true).toBe(true);
    });

    it.for([...])('should handle %s', ([input, expected]) => {
      expect(fn(input)).toBe(expected);
    });
  });
});
```

**Patterns:**
- `describe()` for grouping related tests
- `beforeEach()`/`afterEach()` for setup/teardown
- `it()` for individual test cases
- `it.for()` for parameterized tests (Vitest feature)
- Nested describes for hierarchical organization

**Example** (`packages/deployer/src/build/deployer.test.ts`):
```typescript
describe('getDeployer', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./plugins/__fixtures__/basic.js'],
    ['./plugins/__fixtures__/basic-with-const.js'],
  ])('should be able to extract the deployer from %s', async ([fileName]) => {
    const bundle = await getDeployerBundler(join(_dirname, fileName), { hasCustomConfig: false });
    const result = await bundle.generate({ format: 'esm' });
    expect(result?.output[0].code).toMatchSnapshot();
  });
});
```

## Mocking

**Framework:**
- Vitest's `vi` object for mocking
- `vi.mock()` for module mocking (before imports)
- `vi.fn()` for function mocks
- `mockResolvedValue()`, `mockImplementation()` for behavior

**Patterns:**
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level mocks
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('Service', () => {
  let mockStorage: any;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    mockStorage = {
      getStore: vi.fn().mockImplementation((domain: string) => {
        const store = {
          getTrace: vi.fn().mockResolvedValue(null),
          saveScore: vi.fn().mockResolvedValue({ score: 0.5 }),
        };
        return store;
      }),
    };
  });

  it('should call storage methods', async () => {
    const store = await mockStorage.getStore('observability');
    (store.getTrace as vi.Mock).mockResolvedValue(mockTrace);

    expect(store.getTrace).toHaveBeenCalledWith(traceId);
  });
});
```

**What to Mock:**
- External dependencies: file system, databases, API clients
- Network calls: HTTP requests, webhook handlers
- Time-dependent code: use `vi.useFakeTimers()` if needed
- Crypto: `randomUUID()` mocked to return predictable values

**What NOT to Mock:**
- Core business logic (test actual implementation)
- Error handling paths (test real error cases)
- Type definitions and pure utilities
- Transformation/formatting logic

## Fixtures and Factories

**Test Data:**
- Builders for complex objects (`TransformerTestBuilder` in `packages/core/src/evals/scoreTraces/utils.test.ts`)
- Builder pattern with fluent API: `builder.addAgentSpan(...).addLLMSpan(...).build()`
- Factories for test scenarios: `TransformerTestScenarios` for pre-configured test cases

**Example** (`packages/core/src/evals/scoreTraces/utils.test.ts`):
```typescript
class TransformerTestBuilder {
  private spans: any[] = [];
  private traceId: string = 'test-trace-id';

  withTraceId(traceId: string) {
    this.traceId = traceId;
    return this;
  }

  addAgentSpan(config: { spanId: string; parentSpanId?: string; input?: any; output?: any }) {
    this.spans.push({
      traceId: this.traceId,
      spanId: config.spanId,
      // ... properties
    });
    return this;
  }

  build() {
    return { traceId: this.traceId, spans: this.spans };
  }
}
```

**Location:**
- Test utilities in same file or `test-utils.ts` module
- Shared fixtures in package-level `__fixtures__/` directories
- Monorepo-wide utilities in `packages/core/src/test-utils/` (e.g., `llm-mock.ts`)

## Coverage

**Requirements:**
- No enforced coverage threshold (not detected)
- Coverage reports via `@vitest/coverage-v8`
- Run coverage: `pnpm test -- --coverage`

**View Coverage:**
```bash
pnpm test -- --coverage           # Terminal report
pnpm test -- --coverage.reporter=html  # HTML report
```

## Test Types

**Unit Tests:**
- Scope: Single function or class method
- Location: Same directory as source
- Approach: Test behavior with mocked dependencies
- Example: `error/index.test.ts` tests `MastraError` class construction and serialization

**Integration Tests:**
- Scope: Multiple modules working together
- Location: Often in `__tests__/` subdirectories
- Approach: Test real interactions between components (minimal mocking)
- Example: `agent/agent-network.test.ts` tests agent-to-agent communication

**E2E Tests:**
- Not detected in core packages
- Playright/Stagehand used in playground UI (separate packages)

**Type Tests:**
- File suffix: `.test-d.ts`
- Framework: Vitest typecheck mode (enabled in `packages/core/vitest.config.ts`)
- Purpose: Validate TypeScript types compile correctly
- Example: `agent/agent-types.test-d.ts`

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operations', async () => {
  const result = await getErrorFromUnknown(promise);
  expect(result).toBeInstanceOf(Error);
});
```

**Error Testing:**
```typescript
it('should throw specific error', async () => {
  const error = new MastraError({
    id: 'TEST_ERROR',
    domain: 'AGENT',
    category: 'USER',
  }, new Error('Original error'));

  expect(error.id).toBe('TEST_ERROR');
  expect(error.cause?.message).toBe('Original error');
});
```

**Snapshot Testing:**
```typescript
it('should match snapshot', async () => {
  const result = await bundle.generate({ format: 'esm' });
  expect(result?.output[0].code).toMatchSnapshot();
});
```

**Mock Reset Pattern:**
```typescript
describe('Service with mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();  // Reset all mocks
    vi.resetAllMocks();  // Deeper reset including implementations
  });
});
```

**Custom Assertions:**
```typescript
it('should be instance of custom class', () => {
  const error = new MastraError(definition);
  expect(error).toBeInstanceOf(MastraError);
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe('Unknown error');
});
```

## Test Data Patterns

**Mock Language Models:**
- Location: `packages/core/src/test-utils/llm-mock.ts` (215 lines)
- Usage: Mock LLM responses for agent testing
- Alternative: `MastraLanguageModelV2Mock` from `packages/core/src/loop/test-utils/`

**Large Test Suites:**
- `packages/core/src/workflows/workflow.test.ts` (21,573 lines)
- `packages/core/src/agent/agent.test.ts` (7,495 lines)
- Structure: Multiple nested describes with focused test cases
- Timeout: Extended for integration scenarios (120s default)

---

*Testing analysis: 2026-01-23*

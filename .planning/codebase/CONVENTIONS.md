# Coding Conventions

**Analysis Date:** 2026-01-23

## Naming Patterns

**Files:**
- Kebab-case for all file names: `agent-processor.ts`, `message-list.ts`, `base-agent.ts`
- Test files use `.test.ts` suffix co-located with source: `agent.test.ts` alongside `agent.ts`
- Internal/private test utilities: `__tests__/` directories or `test-utils.ts` modules
- Snapshot tests and fixtures in `__fixtures__/` directories

**Functions:**
- camelCase for all function names: `getErrorFromUnknown`, `createWorkflow`, `buildSpanTree`
- Descriptive names prefixed with verb: `validate`, `transform`, `extract`, `create`, `get`
- Helper functions in same module or dedicated utility files
- Exported functions in index.ts barrel files

**Variables:**
- camelCase for constants and let/const: `maxDepth`, `testStorage`, `errorDomain`
- Single-letter vars acceptable only in loops/maps: `f`, `p`, `c` for function params in comprehensions
- Descriptive names for complex values: `mockLanguageModel` not `m`, `validationError` not `err`

**Types:**
- PascalCase for all type/interface names: `MastraError`, `ErrorDomain`, `SerializableError`
- Type prefixes for clarity: `I` for interfaces (`IErrorDefinition`), `T` for type aliases
- Enum names PascalCase with SCREAMING_SNAKE_CASE values: `enum ErrorDomain { TOOL = 'TOOL', AGENT = 'AGENT' }`
- Generic type parameters: `T`, `R`, `DOMAIN`, `CATEGORY` (descriptive when needed)

## Code Style

**Formatting:**
- Prettier v3.7.4 with unified configuration
- 2-space indentation via `tabWidth: 2`
- 120-character line width (`printWidth: 120`)
- Single quotes for strings (`singleQuote: true`)
- Trailing commas in all contexts (`trailingComma: "all"`)
- Arrow function parens minimized (`arrowParens: "avoid"`)
- Semicolons required (`semi: true`)
- Unix line endings (`endOfLine: "lf"`)

**Linting:**
- ESLint v9.37.0 with TypeScript support
- ESLint rule: disallow `@ts-ignore` in favor of `@ts-expect-error` (enforced)
- Strict type checking enabled across all packages

**TypeScript:**
- Target: ES2020
- Module: ES2022
- Strict mode fully enabled: `strict: true`
- No implicit any: `noImplicitReturns`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` all enforced
- Force consistent casing: `forceConsistentCasingInFileNames: true`
- Check JS files: `checkJs: true`
- ESM interop: `esModuleInterop: true`, `allowSyntheticDefaultImports: true`

## Import Organization

**Order:**
1. Node built-ins: `import { randomUUID } from 'node:crypto'`
2. External packages: `import { z } from 'zod'`, `import { describe } from 'vitest'`
3. Internal monorepo packages: `import type { Mastra } from '@mastra/core/mastra'`
4. Relative imports: `import { MastraError } from '../error'`
5. Type imports separated: `import type { MessageInput } from './types'`

**Path Aliases:**
- Package imports use `@mastra/` namespace: `@mastra/core`, `@mastra/schema-compat`
- Internal packages use `@internal/` namespace: `@internal/ai-sdk-v4`
- Relative paths preferred for same-package imports
- Barrel exports in `index.ts` for module organization

**Example import block** (`packages/core/src/agent/agent.ts`):
```typescript
import { randomUUID } from 'node:crypto';
import type { TextPart } from '@internal/ai-sdk-v4';
import { OpenAISchemaCompatLayer } from '@mastra/schema-compat';
import { z } from 'zod';
import type { MastraPrimitives } from '../action';
import { MastraBase } from '../base';
```

## Error Handling

**Pattern:**
- All errors use custom `MastraError` class with structured metadata
- Error definition pattern with domain, category, and ID: `IErrorDefinition<DOMAIN, CATEGORY>`
- Errors must include: `id` (UPPERCASE), `domain` (enum), `category` (enum), optional `text` and `details`
- Error domains: `TOOL`, `AGENT`, `MCP`, `AGENT_NETWORK`, `MASTRA_*`, `LLM`, `EVAL`, `STORAGE`, etc. (see `ErrorDomain` enum in `packages/core/src/error/index.ts`)
- Error categories: `UNKNOWN`, `USER`, `SYSTEM`, `THIRD_PARTY`

**Example** (`packages/core/src/error/index.ts`):
```typescript
const error = new MastraError({
  id: 'AGENT_EXECUTION_FAILED',
  domain: 'AGENT',
  category: 'SYSTEM',
  text: 'Agent execution failed',
  details: { agentId: 'my-agent', spanId: 'xyz' }
}, originalError);
```

**Unknown error handling:**
- Use `getErrorFromUnknown()` utility to safely convert unknown values to Error instances
- Supports serialization with `toJSON()` method for proper error propagation
- Handles error causes recursively with depth protection

## Logging

**Framework:**
- Uses structured logger via `RegisteredLogger` class: `packages/core/src/logger/index.ts`
- No direct `console.*` calls in production code
- Telemetry/observability via span-based tracing system

**Patterns:**
- Inject logger through constructor or dependency injection
- Logs integrated with observability spans (trace context)
- No logging in test files unless specifically testing logging behavior
- Error logging includes error domain and category metadata

## Comments

**When to Comment:**
- JSDoc/TSDoc for exported functions and types
- Implementation comments for non-obvious logic (especially type guards and recursion)
- Comments on complex transformations or data structures
- Explain WHY, not WHAT (the code shows the what)

**JSDoc/TSDoc Usage:**
- All exported functions and types have JSDoc blocks
- Parameter descriptions include types: `@param unknown - The value to convert to an Error`
- Return type documented: `@returns SerializableError with toJSON() method`
- Examples provided for complex types
- Mark deprecated/internal functions: `@internal`, `@deprecated`

**Example** (`packages/core/src/error/utils.ts`):
```typescript
/**
 * Safely converts an unknown error to an Error instance.
 * Supports JSON serialization and nested error causes.
 */
export function getErrorFromUnknown<SERIALIZABLE extends boolean = true>(
  unknown: unknown,
  options: { fallbackMessage?: string; maxDepth?: number; supportSerialization?: SERIALIZABLE } = {},
): SERIALIZABLE extends true ? SerializableError : Error
```

## Function Design

**Size:**
- Prefer small, focused functions (under 50 lines typical)
- Extract helper functions for complex operations
- Test files may be longer (500+ lines) for comprehensive test suites

**Parameters:**
- Use object parameters for functions with multiple args
- Type all parameters explicitly (no implicit `any`)
- Destructure complex parameter objects in function body
- Optional params with defaults via object parameter pattern

**Return Values:**
- Explicit return type declarations on all exported functions
- Use union types for multiple possible returns: `Result<T> | Error`
- Use type narrowing guards to validate returns before use
- Error returns use structured `MastraError` not bare exceptions

**Example**:
```typescript
function addErrorToJSON(
  error: Error,
  serializeStack: boolean = true,
  options?: { maxDepth?: number; currentDepth?: number },
): void {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const currentDepth = options?.currentDepth ?? 0;
  // ... implementation
}
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Type exports via `export type` keyword
- Barrel files (`index.ts`) re-export public API
- Keep exports focused on single responsibility

**Barrel Files:**
- Location: `packages/*/src/*/index.ts`
- Pattern: `export * from './module'` and `export type { Type } from './types'`
- Organize exports: public first, then types

**Example** (`packages/core/src/tools/index.ts`):
```typescript
export * from './tool';
export * from './types';
export * from './ui-types';
export { isVercelTool } from './toolchecks';
export { ToolStream } from './stream';
```

---

*Convention analysis: 2026-01-23*

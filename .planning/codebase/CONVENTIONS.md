# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**

- `kebab-case.ts` for most source files
- `PascalCase.tsx` for React components (in playground)
- `*.test.ts` for unit tests (co-located with source)
- `*.spec.ts` for e2e/integration tests
- `*.test-d.ts` for type tests (vitest typecheck)
- `index.ts` as barrel exports in directories

**Functions:**

- `camelCase` for all functions
- `createX()` factory pattern for instantiation (e.g., `createTool`, `createWorkflow`, `createStep`)
- `getX()` for retrieval methods
- `isX()` for type guards (e.g., `isVercelTool`, `isProcessorWorkflow`)

**Variables:**

- `camelCase` for all variables
- `UPPER_SNAKE_CASE` for constants (e.g., `MASTRA_RESOURCE_ID_KEY`, `MASTRA_THREAD_ID_KEY`)
- Prefix private class fields with `#` (ES private fields)

**Types:**

- `PascalCase` for types and interfaces
- `T` prefix for generic type parameters (e.g., `TSchemaIn`, `TSchemaOut`, `TAgentId`)
- `I` prefix for interface definitions (e.g., `IErrorDefinition`, `IDeployer`)

**Classes:**

- `PascalCase`
- Descriptive domain names (e.g., `Agent`, `Tool`, `Mastra`, `Memory`, `MastraError`)

## Code Style

**Formatting:**

- Prettier with config at `/.prettierrc`
- 2-space indentation
- Single quotes
- Trailing commas
- 120 character line width
- LF line endings
- Arrow parens: avoid when possible

**Linting:**

- ESLint with shared config from `@internal/lint/eslint`
- Each package has `eslint.config.js` importing shared config
- Ignores: `*.d.ts` files, `test-utils/` directories

## Import Organization

**Order:**

1. Node.js built-ins (`node:crypto`, `node:path`)
2. External packages (`zod`, `vitest`, `@ai-sdk/*`)
3. Internal packages (`@mastra/core`, `@internal/*`)
4. Relative imports (`./types`, `../utils`)

**Path Aliases:**

- `@mastra/core/*` - core package exports
- `@internal/*` - internal vendored packages
- Relative paths within packages

**Examples from `packages/core/src/agent/agent.ts`:**

```typescript
import { randomUUID } from 'node:crypto';
import type { TextPart, UIMessage, StreamObjectResult } from '@internal/ai-sdk-v4';
import { OpenAIReasoningSchemaCompatLayer } from '@mastra/schema-compat';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema } from 'zod';
import type { MastraPrimitives } from '../action';
import { MastraBase } from '../base';
```

## Error Handling

**Patterns:**

- Use `MastraError` class from `packages/core/src/error/`
- Errors have `domain`, `category`, `id`, and optional `details`
- Domains: `TOOL`, `AGENT`, `MCP`, `MASTRA_MEMORY`, `LLM`, `STORAGE`, etc.
- Categories: `USER`, `SYSTEM`, `THIRD_PARTY`, `UNKNOWN`

**Error definition pattern from `packages/core/src/error/index.ts`:**

```typescript
export class MastraError extends MastraBaseError<`${ErrorDomain}`, `${ErrorCategory}`> {}

// Usage:
throw new MastraError(
  {
    id: 'TOOL_EXECUTION_FAILED',
    domain: ErrorDomain.TOOL,
    category: ErrorCategory.SYSTEM,
    text: 'Tool execution failed',
    details: { toolId: 'my-tool' },
  },
  originalError,
);
```

**Validation errors:**

- Use `validateToolInput`, `validateToolOutput`, `validateToolSuspendData` from `packages/core/src/tools/validation.ts`
- Return `ValidationError` object instead of throwing when validation fails in tools

## Logging

**Framework:** Custom logger abstraction in `packages/core/src/logger/`

**Patterns:**

- Use `RegisteredLogger` from `../logger`
- Logger methods: `error`, `warn`, `info`, `debug`
- Pass `logger: false` to disable logging in tests

## Comments

**When to Comment:**

- JSDoc for public API functions and classes
- `@example` blocks with TypeScript code
- `@template` for generic type parameters
- Inline comments for complex logic

**JSDoc pattern from `packages/core/src/tools/tool.ts`:**

````typescript
/**
 * Creates a type-safe tool with automatic input validation.
 *
 * @template TSchemaIn - Input schema type
 * @template TSchemaOut - Output schema type
 *
 * @param opts - Tool configuration including schemas and execute function
 * @returns Type-safe Tool instance
 *
 * @example Simple tool
 * ```typescript
 * const greetTool = createTool({
 *   id: 'greet',
 *   description: 'Say hello',
 *   execute: async () => ({ message: 'Hello!' })
 * });
 * ```
 */
````

## Function Design

**Size:**

- Prefer small, focused functions
- Extract complex logic into helper functions

**Parameters:**

- Use options objects for 3+ parameters
- Destructure in function signature when appropriate
- Required params first, optional params in options object

**Return Values:**

- Return typed objects, not tuples
- Use `{ data, error }` pattern for fallible operations
- Async functions always return `Promise<T>`

## Module Design

**Exports:**

- Use barrel exports (`index.ts`) for public API
- `export *` for re-exports
- `export type` for type-only exports
- Named exports preferred over default exports

**Barrel Files from `packages/core/src/tools/index.ts`:**

```typescript
export * from './tool';
export * from './types';
export * from './ui-types';
export { isVercelTool } from './toolchecks';
export { ToolStream } from './stream';
export { type ValidationError } from './validation';
```

## TypeScript Patterns

**Strict mode:** Enabled in `tsconfig.json`

- `noImplicitReturns: true`
- `noUncheckedIndexedAccess: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

**Generic patterns:**

- Constrained generics with `extends` (e.g., `TId extends string`)
- Default generic values (e.g., `TTools extends ToolsInput = ToolsInput`)
- Conditional types for schema inference

**Type guards:**

```typescript
export function isProcessorWorkflow(obj: unknown): obj is ProcessorWorkflow {
  return ...
}
```

## Schema Validation

**Framework:** Zod preferred, JSON Schema supported

**Pattern:**

```typescript
import { z } from 'zod';

const inputSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
});
```

**Tool schema validation:**

- `inputSchema` for tool input validation
- `outputSchema` for tool output validation
- `suspendSchema` / `resumeSchema` for suspension workflows

---

_Convention analysis: 2026-01-27_

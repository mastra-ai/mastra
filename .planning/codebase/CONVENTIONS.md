# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- camelCase for single-word files: `logger.ts`, `utils.ts`, `index.ts`
- kebab-case for multi-word files: `message-list.ts`, `request-context.ts`, `create-tool.ts`, `tool-builder.ts`
- Test files: `.test.ts` suffix co-located with source (e.g., `utils.test.ts` alongside `utils.ts`)
- Type definition files: `*.types.ts` for type exports
- Constants/config files: `constants.ts`, `validation.ts`

**Functions:**
- camelCase: `createTool`, `makeCoreTool`, `resolveSerializedZodOutput`, `maskStreamTags`
- Factory functions prefixed with `create`: `createTool`, `createWorkflow`, `createStep`, `createScorer`
- Type guards prefixed with `is`: `isVercelTool`, `isProcessor`
- Resolver/getter functions prefixed with `get` or `resolve`: `getTransports`, `resolveModelConfig`, `resolveThreadIdFromArgs`
- Maker/converter functions prefixed with `make`: `makeCoreTool`, `makeStream`
- Handlers/utilities prefixed with action verbs: `maskStreamTags`, `validateToolInput`, `deepMergeWorkingMemory`

**Variables:**
- camelCase: `testData`, `mockFindUser`, `existingMessage`, `collectedStreamData`
- Destructured parameters with descriptive names: `{ inputData }`, `{ messages }`, `{ part }`
- Accumulated results with `collected`, `result`, `output` suffixes
- Mock variables prefixed with `mock`: `mockOptions`, `mockMessageList`
- Spy variables suffixed with `Spy`: `debugSpy`, `onStartSpy`, `executeSpy`

**Types:**
- PascalCase for classes and interfaces: `Agent`, `Tool`, `MastraError`, `ConsoleLogger`, `RequestContext`
- PascalCase for type aliases: `InternalCoreTool`, `ToolAction`, `MessageInput`
- Generic type parameters: Single capital letters preferred (`T`, `U`, `R`) with descriptive suffixes for clarity (`TSchemaIn`, `TSchemaOut`, `TSuspendSchema`)
- Interface prefix `I` for service contracts: `IMastraLogger`
- Abstract base classes: `MastraBase`, `MastraLogger`
- Union types: `MastraPrimitives | MastraUnion`

## Code Style

**Formatting:**
- Tool: Prettier v3.6.2
- Print width: 120 characters
- Tab width: 2 spaces
- No tabs: `useTabs: false`
- Trailing commas: all (including function parameters)
- Line endings: LF

**Configuration file:** `.prettierrc` (root)

**Linting:**
- Tool: ESLint v9.39.2
- Configuration: `eslint.config.js` per package
- Base config: Created with `@internal/lint/eslint`
- Enforced: strict TypeScript checking, no unused locals/parameters

**TypeScript Configuration:**
- File: `tsconfig.json` (root)
- Target: ES2020
- Module: ES2022
- Strict mode: enabled
- Checks enabled:
  - `declaration` and `declarationMap` for types
  - `noImplicitReturns` to prevent missing returns
  - `noUncheckedIndexedAccess` for safety
  - `noUnusedLocals` and `noUnusedParameters` to catch dead code
  - `checkJs` to validate JavaScript
  - `forceConsistentCasingInFileNames`

## Import Organization

**Order:**
1. Node.js built-in modules: `import { randomUUID } from 'node:crypto'`
2. External packages: `import { describe, expect, it } from 'vitest'`
3. Types from external packages: `import type { TextPart } from '@internal/ai-sdk-v4'`
4. Internal packages/monorepo imports: `import { Agent } from '../agent'`
5. Type imports: `import type { ScorerRunInputForAgent } from '../evals'`
6. Relative imports from sibling directories
7. Relative imports from nested directories

**Path Aliases:**
- Used selectively for cross-package imports in monorepo
- Example: `@mastra/core`, `@internal/ai-sdk-v4`, `@internal/lint`
- Configured in individual package `tsconfig.json` and `package.json` exports

**Barrel Files:**
- Index files re-export key exports: `export * from './types'`
- Pattern seen in: `src/index.ts`, `src/logger/index.ts`, `src/workflows/index.ts`

## Error Handling

**Patterns:**
- `MastraError` class with structured error categories: `ErrorDomain`, `ErrorCategory`
- File: `src/error.ts`
- Caught and re-thrown with context: logger.error() called before re-throw
- Type narrowing with `instanceof MastraError`
- Tool execution wraps errors: returns `MastraError` instance on exception
- Example from `utils.test.ts`:
  ```typescript
  expect(result).toBeInstanceOf(MastraError);
  expect(result.message).toBe('Test error');
  ```

**Try-Catch Pattern:**
- `try { ... } catch (error) { logger.error(...); ... }`
- Handlers log errors with context (agent name, tool name, request ID)

**Validation Errors:**
- Schema validation returns `ValidationError` type
- Input validation at tool execution boundary: `validateToolInput`
- Output validation: `validateToolOutput`

## Logging

**Framework:** Custom logger interface `IMastraLogger` with concrete implementations

**Implementations:**
- `ConsoleLogger` (default): `src/logger/default-logger.ts`
- `NoOpLogger`: `src/logger/noop-logger.ts`
- `MultiLogger`: combines multiple transports
- Abstract base: `MastraLogger` in `src/logger/logger.ts`

**Log Levels:**
- DEBUG, INFO, WARN, ERROR (defined in `LogLevel` enum)
- Default level: ERROR

**Patterns:**
- Debug logs include metadata as second parameter: `logger.debug(message, { toolName, runId, ... })`
- Named loggers for components: `new ConsoleLogger({ name: 'Agent - my-agent' })`
- Component-based: `RegisteredLogger.LLM`, `RegisteredLogger.AGENT`, etc.
- Track exceptions: `logger.trackException(error)` for error tracking integration
- Execution tracking: `[Agent:agentName] - Executing tool toolName` pattern

**Example from `utils.test.ts`:**
```typescript
expect(debugSpy).toHaveBeenCalledWith('[Agent:testAgent] - Executing tool testTool', expect.any(Object));
```

## Comments

**When to Comment:**
- JSDoc for public exports, classes, and type definitions
- Example-based documentation for complex functions (see `src/tools/tool.ts` - extensive JSDoc with @example blocks)
- No obvious comments (e.g., "increment counter") for clear code
- Complex logic with multi-step operations benefit from inline comments

**JSDoc/TSDoc:**
- Applied consistently on class definitions and public methods
- Include `@param` tags for parameters
- Include `@returns` for return types
- Include `@example` blocks with runnable TypeScript code
- Include `@template` tags for generic types
- Applied to type aliases and interfaces

**Example from `src/tools/tool.ts`:**
```typescript
/**
 * A type-safe tool that agents and workflows can call to perform specific actions.
 *
 * @template TSchemaIn - Input schema type
 * @example Basic tool with validation
 * ```typescript
 * const weatherTool = createTool({
 *   id: 'get-weather',
 *   ...
 * });
 * ```
 */
```

## Function Design

**Size:** Functions are modular and focused (50-200 lines typical for most)
- Longer functions acceptable for complex workflows (300+ lines in some agent methods)
- Extracted helper functions for repeated patterns

**Parameters:**
- Destructured object parameters for multiple arguments
- Single parameter pattern: `({ inputData, context }) => ...`
- Optional fields in parameter objects with `?`
- Type-safe with TypeScript interfaces

**Return Values:**
- Async functions return `Promise<T>` with clear type
- Generators used for streaming: `async function* makeStream(chunks: string[])`
- Union returns for error cases: `T | MastraError`
- Nullable returns explicit in signature: `Promise<T | null>`
- Tuple returns for multiple values: `[result, metadata]`

**Overloading:**
- Not commonly used; overload signatures rare
- Generic constraints preferred for type flexibility

## Module Design

**Exports:**
- Named exports preferred: `export function createTool(...) { ... }`
- Default exports rare; used for config/index files
- Type exports with `export type { TypeName }`
- Re-exports with `export * from './module'`

**Barrel Files:**
- Convention: `index.ts` files re-export main symbols
- Location: `src/logger/index.ts`, `src/tools/index.ts`
- Used to simplify imports: `import { createTool } from '@mastra/core/tools'`

**Module Boundaries:**
- Clear separation by directory: `agent/`, `tools/`, `workflows/`, `storage/`, `logger/`
- Internal modules marked with underscore: `_types/` directory
- Type definitions grouped: `*.types.ts` files

**Dependency Injection:**
- Central `Mastra` class holds instances
- Passed through context: `RequestContext`, `ToolExecutionContext`
- Retrieved at execution time: `context?.mastra?.getStorage()`
- Avoids global state

## Type System Usage

**Generics:**
- Heavily used for flexibility
- Example from `Tool` class: `Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext, TId>`
- Constraint patterns: `TContext extends ToolExecutionContext<...>`

**Union Types:**
- Used for multiple valid types: `T | Promise<T> | PromiseLike<T>`
- Discriminated unions for streaming events

**Type Guards:**
- Functions like `isVercelTool`, `isProcessor` used to narrow types
- Check presence of methods/properties

**Zod Integration:**
- `z.object()`, `z.string()`, `z.enum()` for schema definitions
- Wrapped in `SchemaWithValidation` interface for validation

---

*Convention analysis: 2026-01-26*

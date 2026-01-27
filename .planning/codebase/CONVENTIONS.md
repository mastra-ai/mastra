# Coding Conventions

**Analysis Date:** 2025-01-27

## Naming Patterns

**Files:**
- Lowercase with hyphens for multi-word files: `agent.ts`, `message-list.ts`, `workflow.ts`
- Test files: `*.test.ts` for unit/integration tests, `*.test-d.ts` for type tests
- Integration tests: `*.integration.test.ts` suffix
- Test utilities: `*.test-utils.ts` suffix
- Index files: `index.ts` for barrel exports

**Functions:**
- camelCase for all function names: `createTool()`, `runEvals()`, `generateText()`, `resolveThreadIdFromArgs()`
- Async functions use same naming: `async function generate()` (no `Async` suffix)
- Private/internal functions prefixed with `_`: not observed, use internal visibility instead
- Factory functions use `create` prefix: `createTool()`, `createWorkflow()`, `createStep()`, `createScorer()`
- Utility functions use verb prefix: `resolveModel()`, `maskStreamTags()`, `validateToolInput()`

**Variables:**
- camelCase for all variables and properties: `runId`, `testData`, `inputText`, `abortController`
- Constants use UPPERCASE_SNAKE_CASE: `MASTRA_RESOURCE_ID_KEY`, `MASTRA_THREAD_ID_KEY`, `PUBSUB_SYMBOL`
- Type generics use T prefix: `TSchemaIn`, `TSchemaOut`, `TSuspendSchema`, `TContext`

**Types:**
- PascalCase for all types, interfaces, classes, enums: `Agent`, `Workflow`, `Tool`, `MastraError`, `ErrorDomain`
- Type-only imports marked with `type` keyword: `import type { Agent, Workflow } from '...'`
- Generic type parameters use single letter with T prefix: `<TSchemaIn, TSchemaOut, TContext>`
- Union/intersection types use capitalized names: `MastraLLM`, `MastraPrimitives`

**Enums:**
- PascalCase enum names: `ErrorDomain`, `ErrorCategory`, `LogLevel`
- UPPERCASE_SNAKE_CASE enum values: `ErrorDomain.MASTRA`, `ErrorCategory.USER`, `LogLevel.INFO`

## Code Style

**Formatting:**
- Tool: Prettier
- Line width: 120 characters
- Indentation: 2 spaces (no tabs)
- Semicolons: enabled
- Single quotes: enabled
- Trailing commas: all (including function parameters)
- Arrow function parentheses: avoided when possible (`arg => value` not `(arg) => value`)
- Bracket spacing: enabled (`{ key: value }`)
- End of line: LF (Unix)

Configuration in `.prettierrc`:
```json
{
  "endOfLine": "lf",
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "all",
  "bracketSpacing": true,
  "printWidth": 120,
  "arrowParens": "avoid"
}
```

**Linting:**
- Tool: ESLint
- Config: `eslint.config.js` (per package, using flat config format)
- Strict TypeScript checking enabled across all packages

## Import Organization

**Order:**
1. Node.js built-in imports: `import { randomUUID } from 'node:crypto'`
2. Third-party packages: `import { z } from 'zod'`, `import type { CoreMessage } from '@internal/ai-sdk-v4'`
3. Internal monorepo packages: `import { Agent } from '@mastra/core/agent'`, `import { Memory } from '@mastra/memory'`
4. Relative imports: `import { MastraBase } from '../base'`, `import type { Tool } from './types'`

**Path Aliases:**
- `@mastra/[package]` - references to published monorepo packages
- `@internal/[package]` - references to internal packages not published
- Relative paths preferred within same package
- Barrel file imports from `index.ts` common pattern: `import { Agent } from './index'`

**Type imports:**
- Always use `import type` for type-only imports
- Separate type imports from value imports when possible
- Example: `import type { AgentConfig } from './types'` separate from `import { Agent } from './agent'`

## Error Handling

**Framework:**
- Custom `MastraError` class extending `MastraBaseError` in `packages/core/src/error/index.ts`
- Structured error definitions with domain and category enums

**Patterns:**
```typescript
throw new MastraError({
  id: 'ERROR_ID_IN_UPPERCASE',
  domain: ErrorDomain.MASTRA,
  category: ErrorCategory.USER,
  text: 'Human-readable error message',
  details: { status: 400, key: 'value' }
});
```

**Error Domains:**
- `ErrorDomain.MASTRA` - Framework-level errors
- `ErrorDomain.AGENT` - Agent execution errors
- `ErrorDomain.TOOL` - Tool-related errors
- `ErrorDomain.MASTRA_WORKFLOW` - Workflow execution errors
- Others: `LLM`, `MCP`, `STORAGE`, `MASTRA_VECTOR`, `DEPLOYER`

**Error Categories:**
- `ErrorCategory.USER` - User error (invalid config, bad input)
- `ErrorCategory.SYSTEM` - Framework error (internal state issue)
- `ErrorCategory.THIRD_PARTY` - External service error
- `ErrorCategory.UNKNOWN` - Unknown/unclassified

**Custom error throwing:**
- Always use `MastraError` or `MastraBaseError` for framework errors
- Include meaningful error ID, domain, and category
- Provide descriptive `text` field with context
- Store relevant details in `details` object for debugging

## Logging

**Framework:**
- Abstract `MastraLogger` class with multiple transport support
- `ConsoleLogger` as default implementation
- Levels: `ERROR`, `WARN`, `INFO`, `DEBUG`
- Registered logger instance accessed via `RegisteredLogger` export

**Patterns:**
- Framework uses injected logger, not direct console calls
- Logger available as `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()`
- Track exceptions via `logger.trackException(error)` for MastraError instances
- No direct `console.log()` in production code

**Usage:**
```typescript
import { RegisteredLogger } from '../logger';

RegisteredLogger.info('Operation completed', { runId, duration });
RegisteredLogger.error('Operation failed', error);
```

## Comments

**When to Comment:**
- Complex algorithm explanations (rare, prefer clear code)
- Non-obvious business logic
- Workarounds and TODO/FIXME items
- @ts-expect-error explanations (always required)
- Important architectural decisions

**JSDoc/TSDoc:**
- Used extensively for public APIs and exported functions
- Parameter descriptions with `@param`
- Return type descriptions with `@returns`
- Example usage in `@example` blocks (common for factory functions)
- Type parameters documented: `@template TSchemaIn - Input schema type`
- All public exports should have documentation

**Example:**
```typescript
/**
 * A type-safe tool that agents and workflows can call.
 *
 * @template TSchemaIn - Input schema type
 * @template TSchemaOut - Output schema type
 *
 * @example
 * ```typescript
 * const tool = createTool({
 *   id: 'get-weather',
 *   inputSchema: z.object({ location: z.string() }),
 *   execute: async (input) => await fetchWeather(input.location)
 * });
 * ```
 */
export class Tool<TSchemaIn = unknown, TSchemaOut = unknown> {
  // ...
}
```

## Function Design

**Size:**
- Prefer functions under 50 lines
- Extract complex logic into helper functions
- Maximum ~3-5 levels of nesting before extracting

**Parameters:**
- Use object parameters for functions with 3+ parameters
- Never use positional booleans (use object with named boolean property)
- Provide default values for optional parameters in destructured objects
- Type parameters at end of function signature

**Return Values:**
- Explicit return type annotations for all exported functions
- Promise-based for async operations
- Void for side-effect-only functions
- Union returns for multiple possible types (prefer discriminated unions)

**Example:**
```typescript
async function executeWorkflow({
  workflowId,
  runId,
  input,
  timeout = 30000,
}: {
  workflowId: string;
  runId: string;
  input: unknown;
  timeout?: number;
}): Promise<WorkflowResult> {
  // implementation
}
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Barrel files (`index.ts`) re-export public API
- Internal utilities marked as `_utils` or not exported
- Type exports clearly separated: `export type { SomeType }`

**Barrel Files:**
- Used in every directory for public interfaces
- Pattern: Single `index.ts` with `export * from './file'` statements
- Type imports/exports clearly marked

**Example:**
```typescript
// packages/core/src/tools/index.ts
export * from './tool';
export * from './types';
export { isVercelTool } from './toolchecks';
export type { ValidationError } from './validation';
```

## Class Design

**Inheritance:**
- Base class `MastraBase` provides common functionality
- Logger injection pattern used throughout
- Abstract classes for interfaces (e.g., `MastraLogger`)
- Minimal deep inheritance chains

**Instance Variables:**
- Private/protected fields not prefixed with underscore (use TypeScript visibility modifiers)
- Public properties documented with JSDoc
- Readonly modifiers for immutable properties

**Method Design:**
- Constructor accepts options object when many parameters needed
- Async methods return `Promise<T>`
- Instance methods use `this` for state access
- No static method factories (use `create*` functions instead)

---

*Convention analysis: 2025-01-27*

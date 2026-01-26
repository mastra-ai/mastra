# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**

- Use `kebab-case` for file names: `tool-builder.ts`, `message-list.ts`
- Test files co-located with source: `*.test.ts` alongside `*.ts`
- Type definitions in separate files: `types.ts`, `*.types.ts`
- Index files for barrel exports: `index.ts`
- Mocks in dedicated files: `mock.ts`

**Functions:**

- Use `camelCase` for functions and methods: `createTool`, `getAgent`, `generateId`
- Factory functions use `create` prefix: `createStep`, `createWorkflow`, `createTool`
- Getter methods use `get` prefix: `getAgent`, `getWorkflow`, `getStorage`
- Setter methods use `set` prefix: `setLogger`, `setIdGenerator`
- List methods use `list` prefix: `listAgents`, `listVectors`, `listWorkflows`
- Boolean functions use `is/has/should` prefix: `isToolLoopAgentLike`, `hasInitialized`
- Private methods start with `#` (ES2022 private fields): `#createAgentFromStoredConfig`

**Variables:**

- Use `camelCase` for variables: `errorDefinition`, `agentKey`, `workflowState`
- Constants use `SCREAMING_SNAKE_CASE`: `SUITE_TIMEOUT`, `TEST_TIMEOUT`
- Private class fields use `#` prefix: `#agents`, `#logger`, `#storage`
- Generic type parameters use `T` prefix: `TAgents`, `TWorkflows`, `TSchemaIn`

**Types/Interfaces:**

- Use `PascalCase` for types and interfaces: `MastraError`, `Config`, `ToolAction`
- Interface names may use `I` prefix for contracts: `IErrorDefinition`, `IMastraLogger`
- Enums use `PascalCase` with `PascalCase` members: `ErrorDomain.TOOL`, `ErrorCategory.USER`

**Classes:**

- Use `PascalCase` for class names: `Mastra`, `Agent`, `Tool`, `Workflow`
- Abstract base classes may use `Base` suffix: `MastraBaseError`, `MastraCompositeStore`

## Code Style

**Formatting:**

- Tool: Prettier (v3.6.2+)
- Key settings:
  - `endOfLine`: "lf"
  - `semi`: true (semicolons required)
  - `singleQuote`: true
  - `tabWidth`: 2
  - `useTabs`: false
  - `trailingComma`: "all"
  - `bracketSpacing`: true
  - `printWidth`: 120
  - `arrowParens`: "avoid"

**Linting:**

- Tool: ESLint (v9+) with flat config
- Config extends `@internal/lint/eslint`
- Package-level configs in `eslint.config.js`:
  ```javascript
  import { createConfig } from '@internal/lint/eslint';
  const config = await createConfig();
  export default [...config, { ignores: ['./*.d.ts', '**/*.d.ts', '!src/**/*.d.ts'] }];
  ```

**TypeScript:**

- Strict mode enabled
- ES2022+ module system
- `noUncheckedIndexedAccess`: true
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noImplicitReturns`: true

## Import Organization

**Order:**

1. Node built-ins: `import { randomUUID } from 'node:crypto';`
2. External packages: `import { z } from 'zod';`
3. Internal packages: `import { Agent } from '../agent';`
4. Relative imports: `import { validateToolInput } from './validation';`

**Path Aliases:**

- Internal workspace packages: `@internal/ai-sdk-v4`, `@internal/lint`
- Mastra packages: `@mastra/core`, `@mastra/memory`
- File extension in relative imports: `.js` suffix for ESM compatibility

**Pattern Examples:**

```typescript
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import type { ToolAction } from '../tools';
import { validateToolInput } from './validation.js';
```

## Error Handling

**Patterns:**

- Use custom `MastraError` class for domain-specific errors
- Error definitions include: `id`, `domain`, `category`, `text`, `details`
- Errors are tracked via logger: `this.#logger?.trackException(error);`
- Always throw after tracking

**Error Structure:**

```typescript
const error = new MastraError({
  id: 'MASTRA_GET_AGENT_BY_NAME_NOT_FOUND',
  domain: ErrorDomain.MASTRA,
  category: ErrorCategory.USER,
  text: `Agent with name ${String(name)} not found`,
  details: {
    status: 404,
    agentName: String(name),
    agents: Object.keys(this.#agents ?? {}).join(', '),
  },
});
this.#logger?.trackException(error);
throw error;
```

**Error ID Convention:**

- Format: `DOMAIN_ACTION_REASON` in SCREAMING_SNAKE_CASE
- Examples: `MASTRA_GET_AGENT_BY_NAME_NOT_FOUND`, `TOOL_VALIDATION_FAILED`

**Domains:**

```typescript
enum ErrorDomain {
  TOOL = 'TOOL',
  AGENT = 'AGENT',
  MCP = 'MCP',
  MASTRA = 'MASTRA',
  LLM = 'LLM',
  STORAGE = 'STORAGE',
  // ... more domains
}
```

## Logging

**Framework:** Custom logger interface (`IMastraLogger`)

**Default:** `ConsoleLogger` with environment-aware level:

- Development: `LogLevel.INFO`
- Production: `LogLevel.WARN`

**Patterns:**

```typescript
// Access logger
const logger = this.getLogger();

// Debug logging
this.#logger?.debug(`Agent with key ${agentKey} already exists. Skipping addition.`);

// Warning logging
this.#logger?.warn(`Tool "${toolKey}" referenced but not registered in Mastra`);

// Error tracking
this.#logger?.trackException(error);
```

**Logger can be disabled:**

```typescript
const mastra = new Mastra({ logger: false });
```

## Comments

**When to Comment:**

- Complex business logic
- Non-obvious implementation decisions
- Public API methods (JSDoc)
- Deprecation notices

**JSDoc Pattern:**

````typescript
/**
 * Retrieves a registered agent by its name.
 *
 * @template TAgentName - The specific agent name type from the registered agents
 * @throws {MastraError} When the agent with the specified name is not found
 *
 * @example
 * ```typescript
 * const agent = mastra.getAgent('weatherAgent');
 * const response = await agent.generate('What is the weather?');
 * ```
 */
public getAgent<TAgentName extends keyof TAgents>(name: TAgentName): TAgents[TAgentName] {
````

**Deprecation:**

```typescript
/**
 * @deprecated Use listVectors() instead
 */
public getVectors(): TVectors | undefined {
  console.warn('getVectors() is deprecated. Use listVectors() instead.');
  return this.listVectors();
}
```

## Function Design

**Size:** Functions should be focused and single-purpose. Large functions are broken into private helper methods.

**Parameters:**

- Use object parameters for functions with many options
- Destructure in function signature when reasonable
- Optional parameters with defaults: `{ raw = false, versionId, versionNumber }?: {...}`

**Return Values:**

- Use explicit return types
- Return `null` for "not found" scenarios (not `undefined`)
- Use discriminated unions for complex returns

**Async Patterns:**

```typescript
// Method overloads for different return types
public async getStoredAgentById(
  id: string,
  options?: { raw?: false; versionId?: string }
): Promise<Agent | null>;
public async getStoredAgentById(
  id: string,
  options: { raw: true; versionId?: string }
): Promise<StorageAgentType | null>;
```

## Module Design

**Exports:**

- Explicit named exports preferred
- Re-export from barrel `index.ts` files
- Type exports use `export type` syntax

**Barrel Files (`index.ts`):**

```typescript
export { TripWire } from './trip-wire';
export { MessageList, convertMessages } from './message-list';
export type { OutputFormat } from './message-list';
export * from './types';
export * from './agent';
```

**Class Organization:**

1. Public properties
2. Private fields (with `#`)
3. Constructor
4. Public methods (getters, then actions)
5. Private methods

## Schema Validation

**Framework:** Zod (v3.25+ or v4)

**Patterns:**

```typescript
// Schema definition
const inputSchema = z.object({
  city: z.string(),
  units: z.enum(['celsius', 'fahrenheit']).optional(),
});

// Schema validation
const { data, error } = validateToolInput(this.inputSchema, inputData, this.id);
if (error) {
  return error as any;
}
```

## Dependency Injection

**Pattern:** Constructor injection with registration

```typescript
// Register with Mastra
agent.__setLogger(this.#logger);
agent.__registerMastra(this);
agent.__registerPrimitives({
  logger: this.getLogger(),
  storage: this.getStorage(),
  agents: this.#agents,
  tts: this.#tts,
  vectors: this.#vectors,
});
```

**Internal Methods:**

- Use `__` prefix for internal registration methods: `__setLogger`, `__registerMastra`

---

_Convention analysis: 2026-01-26_

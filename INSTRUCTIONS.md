# Instructions: Fixing Circular Dependencies in a pnpm Monorepo

You are helping fix circular dependencies in a pnpm monorepo. Follow these guidelines strictly.

## Detection

Before making changes, identify circular dependencies **within packages**: Look for import cycles between files (A imports B, B imports A)

You're using https://github.com/acrazing/dpdm to discover circular dependencies. This is the format you should always use:

```shell
pnpm dpdm -T --no-warning --no-tree <path-to-file>
```

Example:

```shell
pnpm dpdm -T --no-warning --no-tree packages/core/src/index.ts
```

## Resolution Strategy: Within a Single Package

### Primary Approach: Extract Shared Code

When file A and file B have circular imports, identify the shared code causing the cycle and extract it to a new file.

**Steps:**

1. Identify what A needs from B and what B needs from A
2. Determine if there's a logical "shared" concept (types, utilities, constants)
3. Create a new file (e.g., `shared.ts`, `types.ts`, `utils.ts`, or a domain-specific name)
4. Move the shared code to the new file
5. Update imports in both A and B to import from the new file
6. Verify the cycle is broken

**Example:**

```typescript
// BEFORE - Circular dependency

// user.ts
import { validateEmail } from './validation';
export interface User {
  id: string;
  email: string;
}
export function createUser(email: string): User {
  /* ... */
}

// validation.ts
import { User } from './user';
export function validateEmail(email: string): boolean {
  /* ... */
}
export function validateUser(user: User): boolean {
  /* ... */
}
```

```typescript
// AFTER - Extracted shared types

// types.ts (NEW)
export interface User {
  id: string;
  email: string;
}

// user.ts
import { User } from './types';
import { validateEmail } from './validation';
export function createUser(email: string): User {
  /* ... */
}

// validation.ts
import { User } from './types';
export function validateEmail(email: string): boolean {
  /* ... */
}
export function validateUser(user: User): boolean {
  /* ... */
}
```

### Secondary Approach: Eliminate Internal Barrel Files

Barrel files (`index.ts` that re-exports from multiple files) are a common source of circular dependencies. They should only exist for public-facing APIs.

**Rules:**

1. **Keep barrel files only for public APIs** - Files that correspond to `package.json` `exports` field entries
2. **Remove internal barrel files** - Replace imports from internal barrels with direct file imports
3. **Never import from a barrel file within the same package** - Always use direct imports internally
4. **Check if public API barrel files are importing from internal barrel files** - If so, refactor to avoid these internal barrel files and directly from the necessary files

**Example:**

```typescript
// BEFORE - Internal barrel causing cycles

// src/utils/index.ts (INTERNAL BARREL - REMOVE)
export * from './string';
export * from './array';
export * from './validation';

// src/components/Form.ts
import { validateEmail } from '../utils'; // BAD: importing from barrel
```

```typescript
// AFTER - Direct imports

// src/utils/index.ts - DELETED (or kept only if exposed in package.json exports)

// src/components/Form.ts
import { validateEmail } from '../utils/validation'; // GOOD: direct import
```

**How to identify if a barrel is public-facing:**

Check the `package.json` `exports` field:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./utils": "./src/utils/index.ts"
  }
}
```

In this example:

- `src/index.ts` - Keep (public API)
- `src/utils/index.ts` - Keep (public API via `./utils` export)
- Any other `index.ts` files - Remove or convert to direct imports

**@mastra/core public facing barrel files:**

- `packages/core/src/index.ts`
- `packages/core/src/a2a/index.ts`
- `packages/core/src/action/index.ts`
- `packages/core/src/agent/index.ts`
- `packages/core/src/bundler/index.ts`
- `packages/core/src/cache/index.ts`
- `packages/core/src/deployer/index.ts`
- `packages/core/src/di/index.ts`
- `packages/core/src/error/index.ts`
- `packages/core/src/evals/index.ts`
- `packages/core/src/events/index.ts`
- `packages/core/src/features/index.ts`
- `packages/core/src/hooks/index.ts`
- `packages/core/src/integration/index.ts`
- `packages/core/src/llm/index.ts`
- `packages/core/src/logger/index.ts`
- `packages/core/src/loop/index.ts`
- `packages/core/src/mastra/index.ts`
- `packages/core/src/mcp/index.ts`
- `packages/core/src/memory/index.ts`
- `packages/core/src/observability/index.ts`
- `packages/core/src/processors/index.ts`
- `packages/core/src/relevance/index.ts`
- `packages/core/src/request-context/index.ts`
- `packages/core/src/server/index.ts`
- `packages/core/src/storage/index.ts`
- `packages/core/src/stream/index.ts`
- `packages/core/src/tools/index.ts`
- `packages/core/src/tts/index.ts`
- `packages/core/src/types/index.ts`
- `packages/core/src/vector/index.ts`
- `packages/core/src/voice/index.ts`
- `packages/core/src/workflows/index.ts`
- `packages/core/src/tools/is-vercel-tool.ts`
- `packages/core/src/workflows/constants.ts`
- `packages/core/src/network/vNext/index.ts`
- `packages/core/src/workflows/evented/index.ts`
- `packages/core/src/vector/filter/index.ts`
- `packages/core/src/utils.ts`
- `packages/core/src/base.ts`
- `packages/core/src/telemetry/otel-vendor.ts`
- `packages/core/src/test-utils/llm-mock.ts`
- `packages/core/src/evals/scoreTraces/index.ts`
- `packages/core/src/zod-to-json.ts`
- `packages/core/src/agent/message-list/index.ts`

## File Naming Conventions for Extracted Code

When extracting shared code, use descriptive names:

| Content Type                | Suggested Filename                         |
| --------------------------- | ------------------------------------------ |
| TypeScript types/interfaces | `types.ts` or `[domain].types.ts`          |
| Constants                   | `constants.ts` or `[domain].constants.ts`  |
| Utility functions           | `utils.ts` or `[domain].utils.ts`          |
| Shared business logic       | `[domain].shared.ts` or `[domain].core.ts` |
| Configuration               | `config.ts`                                |

## Checklist Before Making Changes

- [ ] Identified all files/packages involved in the cycle
- [ ] Determined what shared code is causing the cycle
- [ ] Chosen appropriate filename for extracted code
- [ ] Verified the barrel file policy (public API only)
- [ ] Planned the import path changes

## Checklist After Making Changes

- [ ] No circular dependencies remain (verify with `dpdm`)
- [ ] All imports use direct paths (no internal barrel imports)
- [ ] TypeScript compilation succeeds
- [ ] The `packages/core/public-exports.test.ts` test passes. This test ensures that the public API exports stay the same.
- [ ] All unit tests pass that were changed. You can run tests in the core package with `pnpm test <path-to-test-file>`
- [ ] tsup build succeeds (use `pnpm turbo build` in package to run build)
- [ ] Public API exports in `package.json` are still correct

## Common Patterns That Cause Cycles

Be watchful for these anti-patterns:

1. **Type + Implementation in same file** - Types should often be separate
2. **Barrel files re-exporting everything** - Creates hidden dependency chains
3. **Utility files importing domain objects** - Utilities should be dependency-free
4. **Bidirectional relationships** - Parent knows about child AND child knows about parent
5. **Service classes importing each other** - Use interfaces and DI instead

## What NOT To Do

- **Don't use dynamic imports as a fix** - `import()` hides the problem, doesn't fix it
- **Don't ignore the cycle** - It will cause subtle bugs and maintenance issues
- **Don't create a "god" shared file** - Extract only what's needed for the specific cycle
- **Don't break public APIs** - Ensure `package.json` exports still work after refactoring
- **Don't add re-exports from non-public barrel files** - When extracting code to a new file, update the importing files to use direct imports to the new file. Don't add `export { foo } from './new-file'` to the original file unless it's a public-facing barrel file.
- **Don't change runtime logic to fix cycles** - Avoid replacing `instanceof` checks with property checks or other logic changes. Instead, restructure imports/exports by extracting code to new files.
- **Don't leave unused imports** - After extracting code to a new file, clean up any imports that are no longer used in the original file. You can use `eslint` for checking that.

## Example: Extracting a Class to Break a Cycle

When a class is imported by files that the class's file also imports (creating a cycle), extract the class to its own file:

```typescript
// BEFORE - Circular dependency
// workflow.ts imports from execution-engine.ts
// execution-engine.ts imports from utils.ts
// utils.ts imports EventedWorkflow from workflow.ts (CYCLE!)

// workflow.ts
import { ExecutionEngine } from './execution-engine';
export class EventedWorkflow {
  /* ... */
}
export function createWorkflow() {
  /* uses EventedWorkflow */
}

// utils.ts
import { EventedWorkflow } from './workflow'; // Creates cycle!
export function getStep(workflow) {
  if (step instanceof EventedWorkflow) {
    /* ... */
  }
}
```

```typescript
// AFTER - Extract the class to break the cycle

// evented-workflow.ts (NEW - contains only the class, no problematic imports)
export class EventedWorkflow {
  /* ... */
}

// workflow.ts (import the class for local use, no re-export needed)
import { EventedWorkflow } from './evented-workflow';
import { ExecutionEngine } from './execution-engine';
export function createWorkflow() {
  /* uses EventedWorkflow */
}

// utils.ts (import directly from the new file)
import { EventedWorkflow } from './evented-workflow'; // No cycle!
export function getStep(workflow) {
  if (step instanceof EventedWorkflow) {
    /* ... */
  }
}

// index.ts (public barrel - add export here for public API)
export * from './evented-workflow';
export * from './workflow';
```

Key points:

- The extracted file (`evented-workflow.ts`) should NOT import from files that would recreate the cycle
- Files that need the class import directly from the new file
- Only the public-facing barrel (`index.ts`) should re-export for external consumers
- Don't add re-exports in `workflow.ts` - it's not a public barrel file

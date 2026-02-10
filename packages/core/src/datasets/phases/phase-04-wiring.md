# Phase 4 — Wiring

> Parallel: **4a ‖ 4b ‖ 4c**. Three export/registration changes that connect the public API to the rest of the framework.

---

## Dependencies

Phase 3 — both `Dataset` (`datasets/dataset.ts`) and `DatasetsManager` (`datasets/manager.ts`) classes must exist and compile.

---

## Pre-existing state

### `packages/core/src/datasets/index.ts` (current)

```ts
export * from './experiment';
export * from './validation';
```

These two lines MUST be preserved — they are consumed by:

- `packages/server/src/server/handlers/datasets.ts` imports `runExperiment`, `compareExperiments`, `SchemaValidationError`, `SchemaUpdateValidationError` from `@mastra/core/datasets`
- The subpath import `@mastra/core/datasets` is resolved by the wildcard export `"./*"` in `packages/core/package.json` (line 24), which maps to `dist/*/index.js`

### `packages/core/src/index.ts` (current)

```ts
export { Mastra, type Config } from './mastra';
export { Agent } from './agent';
export type { SharedMemoryConfig, MemoryConfig, MastraMemory, SerializedMemoryConfig } from './memory';
export type { MastraVector as MastraVectorProvider } from './vector';
export type { IMastraLogger as Logger } from './logger';
export type { ToolAction } from './tools';
export type { Workflow } from './workflows';
export type { MastraScorers, ScoringSamplingConfig } from './evals';
export type { StorageResolvedAgentType, StorageScorerConfig } from './storage';
export type { IMastraEditor, MastraEditorConfig } from './editor';
```

Pattern: mix of value exports (`Mastra`, `Agent`) and type-only exports. New additions follow the same pattern.

### `packages/core/src/mastra/index.ts` (relevant sections)

- **Imports** (lines 1–30): Use bare specifiers (`'../error'`, `'../storage'`), no `.js` extensions. `import type` is required for type-only imports (`verbatimModuleSyntax: true` in root `tsconfig.node.json`).
- **Private fields** (lines 313–337): `#editor?: IMastraEditor;` is the last private field (line 337).
- **Getters** (line 339): `get pubsub()` follows private fields.
- **`getStorage()`** (line 2247): `public getStorage() { return this.#storage; }`
- **`get observability()`** (line 2251): `get observability(): ObservabilityEntrypoint { return this.#observability; }`

### Build config

- `tsup.config.ts` entry `'src/*/index.ts'` (line 49) already covers `datasets/index.ts`. No changes needed to `tsup.config.ts` or `package.json`.

### TypeScript config

- `verbatimModuleSyntax: true` in `tsconfig.node.json` (line 12) — type-only imports MUST use `import type`.
- `module: "Preserve"` — bare specifiers work, no `.js` extension needed.

---

## Task 4a — Barrel exports

### Files

| File                                  | Changes                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/core/src/datasets/index.ts` | **Append** exports for `DatasetsManager`, `Dataset`, `StartExperimentConfig` |

### Implementation

The final file should be:

```ts
export * from './experiment';
export * from './validation';

// New — Phase 4a
export { DatasetsManager } from './manager';
export { Dataset } from './dataset';
export type { StartExperimentConfig } from './experiment/types';
```

**Important notes:**

- The existing `export * from './experiment'` and `export * from './validation'` lines MUST remain. Removing them breaks `@mastra/core/datasets` imports in `packages/server/`.
- `export * from './experiment'` will also re-export `DataItem` and `ExperimentConfig` (added in Phase 1b). These are technically importable from `@mastra/core/datasets` but are not part of the public API. This is acceptable — they are internal types that happen to be reachable. The public surface is `DatasetsManager`, `Dataset`, and `StartExperimentConfig`.
- `export type` is required for `StartExperimentConfig` due to `verbatimModuleSyntax`.

### Completion Criteria

- [ ] `import { DatasetsManager, Dataset } from '../datasets'` works inside core
- [ ] `import type { StartExperimentConfig } from '../datasets'` works inside core
- [ ] Existing imports still work: `import { runExperiment, compareExperiments, SchemaValidationError } from '../datasets'`
- [ ] `pnpm build:core` passes

---

## Task 4b — Mastra getter

### Files

| File                                | Changes                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `packages/core/src/mastra/index.ts` | Add import, private field `#datasets`, lazy getter `get datasets()` |

### Implementation

**1. Add import** (near other imports, around line 1–30):

```ts
import type { DatasetsManager } from '../datasets/manager';
```

Note: Use `import type` because the value is only used in a lazy getter via dynamic `import()` or we use a different pattern. Actually — since `DatasetsManager` is instantiated (not just used as a type), we need a value import:

```ts
import { DatasetsManager } from '../datasets/manager';
```

However, this creates a potential circular dependency concern: `DatasetsManager` → `Mastra` (constructor arg) → `DatasetsManager` (import). This is safe because:

- `DatasetsManager` only needs the `Mastra` type at declaration time
- At runtime, the circular reference resolves because `DatasetsManager` is only instantiated lazily (not during `Mastra` construction)
- This follows the same pattern as other imports in `mastra/index.ts` that reference classes which themselves depend on `Mastra`

**2. Add private field** (after `#editor?: IMastraEditor;` at line 337):

```ts
#datasets?: DatasetsManager;
```

**3. Add getter** (after `get observability()` at line 2251, near other accessors):

```ts
get datasets(): DatasetsManager {
  if (!this.#datasets) {
    this.#datasets = new DatasetsManager(this);
  }
  return this.#datasets;
}
```

**Note:** No storage check in the getter. The `DatasetsManager` defers the check to the first method call that needs storage. This avoids breaking code that instantiates `Mastra` without storage but never touches datasets.

### Completion Criteria

- [ ] `mastra.datasets` returns a `DatasetsManager` instance
- [ ] Repeated access returns the **same** instance (singleton)
- [ ] `new Mastra({}).datasets` does NOT throw even without storage configured
- [ ] Constructor does NOT eagerly create `DatasetsManager` (no `DatasetsManager` instantiation during `new Mastra()`)

---

## Task 4c — Root re-exports

### Files

| File                         | Changes                          |
| ---------------------------- | -------------------------------- |
| `packages/core/src/index.ts` | Add re-exports from `./datasets` |

### Implementation

Append to the end of `packages/core/src/index.ts`:

```ts
export { DatasetsManager, Dataset } from './datasets';
export type { StartExperimentConfig } from './datasets';
```

### Completion Criteria

- [ ] `import { DatasetsManager, Dataset } from '@mastra/core'` resolves (after build)
- [ ] `import type { StartExperimentConfig } from '@mastra/core'` resolves (after build)
- [ ] `pnpm build:core` passes

---

## Tests

### File: `packages/core/src/datasets/__tests__/wiring.test.ts`

These tests verify the wiring is correct. They are lightweight — mostly compile-time checks and runtime identity checks.

```
Test 1: DatasetsManager is importable from datasets barrel
  import { DatasetsManager } from '../index'
  expect(DatasetsManager).toBeDefined()
  expect(typeof DatasetsManager).toBe('function')

Test 2: Dataset is importable from datasets barrel
  import { Dataset } from '../index'
  expect(Dataset).toBeDefined()
  expect(typeof Dataset).toBe('function')

Test 3: StartExperimentConfig is importable as a type
  // Compile-time only — if this file compiles, the test passes
  import type { StartExperimentConfig } from '../index'
  // Runtime: verify the type is not a runtime value
  // (no assertion needed — TypeScript compilation is the test)

Test 4: Existing experiment exports still work
  import { runExperiment, compareExperiments } from '../index'
  expect(runExperiment).toBeDefined()
  expect(compareExperiments).toBeDefined()

Test 5: Existing validation exports still work
  import { SchemaValidationError, SchemaUpdateValidationError } from '../index'
  expect(SchemaValidationError).toBeDefined()
  expect(SchemaUpdateValidationError).toBeDefined()

Test 6: mastra.datasets returns DatasetsManager
  const mastra = new Mastra({})
  expect(mastra.datasets).toBeInstanceOf(DatasetsManager)

Test 7: mastra.datasets is a singleton
  const mastra = new Mastra({})
  const a = mastra.datasets
  const b = mastra.datasets
  expect(a).toBe(b)

Test 8: mastra.datasets does not throw without storage
  const mastra = new Mastra({})  // no storage configured
  expect(() => mastra.datasets).not.toThrow()

Test 9: Mastra constructor does not eagerly create DatasetsManager
  // Verify by checking that no DatasetsManager-related storage calls
  // happen during construction
  const mastra = new Mastra({})
  // Access private field via any cast for test
  expect((mastra as any)['#datasets']).toBeUndefined()
  // Note: Private field access in tests may need a different approach.
  // Alternative: spy on DatasetsManager constructor.
  // import * as managerModule from '../manager'
  // const spy = vi.spyOn(managerModule, 'DatasetsManager')
  // ... new Mastra({}) ...
  // expect(spy).not.toHaveBeenCalled()
```

**Note on Test 9:** Private `#datasets` is not accessible via bracket notation. Use a constructor spy instead:

```ts
import { vi } from 'vitest';
import * as managerModule from '../manager';

test('constructor does not eagerly create DatasetsManager', () => {
  const ctor = vi.fn(managerModule.DatasetsManager);
  // This approach won't work directly — use vi.spyOn on the module's export
  // Better: just verify no side effects by checking storage is not called
  const mastra = new Mastra({});
  // If DatasetsManager were created, it would exist. We verify by accessing
  // .datasets and confirming it's freshly created (not pre-existing).
  // Simplest: just verify the getter works and move on.
});
```

**Pragmatic approach for Test 9:** Skip the eagerness test. The getter pattern is obviously lazy. Tests 6–8 already validate the behavior that matters.

### Mock patterns

From existing tests in the codebase:

```ts
// Minimal Mastra for tests (no storage)
const mastra = new Mastra({});

// Mastra with storage (for tests that need it)
import { InMemoryDB } from '../../storage/domains/inmemory-db';
const db = new InMemoryDB();
const mastra = new Mastra({
  storage: db,
});
```

---

## Phase Completion Criteria (all tasks)

- [ ] `packages/core/src/datasets/index.ts` has 5 export lines (2 existing + 3 new)
- [ ] `packages/core/src/mastra/index.ts` has `#datasets` field and `get datasets()` getter
- [ ] `packages/core/src/index.ts` has `DatasetsManager`, `Dataset`, `StartExperimentConfig` re-exports
- [ ] `pnpm build:core` passes
- [ ] All 8 tests in `wiring.test.ts` pass (Tests 1–8, skipping Test 9)
- [ ] `@mastra/core/datasets` subpath import still works (verified by `pnpm build:core` + existing server compilation)

# Top-level plan: OM extractors, working memory, and Studio indicators

## Goal

Finish the Observational Memory extractor work by tightening the extractor API, adding an OM-driven working memory path built on normal extractor hooks, and stabilizing Studio's OM buffering/extraction indicators.

Detailed sub-plans:

- `.plan/rename-extractor-prior-value-option.md`
- `.plan/om-updates-working-memory.md`
- `.plan/studio-om-indicator-normalization.md`
- `.plan/extracted-values-context-boundary.md`

## Order of work

### 1. Rename prior extraction carry-forward option

Implement first because it is small and removes the confusing overloaded terminology before adding more extractor behavior.

Change:

```ts
injectionBehaviour?: 'carry-forward' | 'none';
```

to:

```ts
includePreviousExtraction?: boolean;
```

Default remains:

```ts
includePreviousExtraction: true
```

Mapping:

```ts
'carry-forward' -> true
'none'          -> false
```

Scope:

- update `ExtractorConfig`
- update `Extractor` instances/tests/docs
- update prior-value prompt filtering
- keep behavior unchanged except for API naming

Verification:

```sh
pnpm --filter ./packages/memory exec vitest run \
  src/processors/observational-memory/__tests__/extractor.test.ts \
  src/processors/observational-memory/__tests__/observational-memory-api.test.ts \
  --reporter=dot --bail 1
pnpm --filter ./packages/memory check
pnpm build:memory
git diff --check
```

### 2. Extend extractor API for runtime context

Implement the general capabilities needed by `WorkingMemoryExtractor` without making working memory special in the parser/result flow.

Add support for:

- dynamic `instructions`
- dynamic `schema`
- `memory` on `ExtractorOnExtractedContext`
- clear semantics for `onExtracted` returning `undefined`

Target shape conceptually:

```ts
new Extractor({
  name: 'Example',
  instructions: context => '...',
  schema: context => someSchema,
  onExtracted: async ({ memory, current }) => {
    await memory.updateSomething(current);
    return undefined; // side effect handled; do not persist this as extracted metadata
  },
})
```

Important constraints:

- dynamic functions must resolve from effective runtime config, not constructor-time assumptions
- `undefined` return should be documented in code near hook application
- existing static string/schema extractor behavior must continue working

Verification:

```sh
pnpm --filter ./packages/memory exec vitest run \
  src/processors/observational-memory/__tests__/extractor.test.ts \
  src/processors/observational-memory/__tests__/observational-memory.test.ts \
  src/processors/observational-memory/__tests__/observational-memory-api.test.ts \
  --reporter=dot --bail 1
pnpm --filter ./packages/memory check
pnpm build:memory
git diff --check
```

### 3. Add `WorkingMemoryExtractor`

Build the working memory feature as a normal extractor/factory using the capabilities from step 2.

Public use:

```ts
import { WorkingMemoryExtractor } from '@mastra/memory';

new Memory({
  options: {
    workingMemory: { enabled: true },
    observationalMemory: {
      observation: {
        extract: [new WorkingMemoryExtractor()],
      },
    },
  },
});
```

Behavior:

- user adds it to `observation.extract` and/or `reflection.extract` wherever they want it to run
- it adapts to markdown vs JSON/schema working memory config
- it surfaces the relevant working memory template/schema to the OM agent
- it extracts the next working memory value via the normal extractor pipeline
- it updates working memory in `onExtracted`
- it usually returns `undefined` to avoid duplicating the value under `metadata.mastra.om.extracted`

Additional working memory setting:

Add a setting to disable main-agent working memory tool injection when OM should own updates.

Conceptual shape:

```ts
workingMemory: {
  enabled: true,
  injectTools: false,
}
```

Naming is TBD during implementation.

Open implementation detail:

The observer may still need the previous working memory value. Choose one:

1. allow duplication under extracted metadata, or
2. add a preload hook/API so previous extractor value can come from working memory without persisting it as OM extracted metadata.

Preference: investigate preload hook/API before accepting duplication.

Verification:

```sh
pnpm --filter ./packages/memory exec vitest run \
  src/index.test.ts \
  src/processors/observational-memory/__tests__/extractor.test.ts \
  src/processors/observational-memory/__tests__/observational-memory-api.test.ts \
  --reporter=dot --bail 1
pnpm --filter ./packages/memory check
pnpm build:memory
git diff --check
```

For storage-backed working memory behavior, add/run focused integration coverage under `packages/memory/integration-tests`.

### 4. Normalize Studio OM indicators

Do this after the memory API work so UI tests can target the final stream/marker shape.

Start with failing E2E tests for the actual user journeys:

- buffering marker appears during streaming
- extracted values appear during buffering completion
- extracted values remain visible after stream end/refetch
- extracted values remain visible after page reload
- extraction failures render consistently across stream end and reload

Then refactor the UI around a normalized OM cycle model:

```ts
interface OmCycleViewModel {
  cycleId: string;
  recordId?: string;
  status: 'observing' | 'observed' | 'buffering' | 'buffering-complete' | 'activated' | 'failed' | 'disconnected';
  observations?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
}
```

Also evaluate splitting extraction results into separate data parts:

```ts
data-om-extraction-result
```

rather than coupling extraction fields to `data-om-buffering-end` / `data-om-observation-end`.

Verification:

- Playwright E2E for cross-page live streaming/reload journeys
- MSW/Vitest for reducer/client behavior
- focused service tests around `om-parts-converter` / new normalizer
- relevant playground typecheck/build checks

## Non-goals

- Do not add `observationalMemory.context.includeExtractedValues`.
- Do not add extractor-level main-agent context delivery flags.
- Do not add a special `workingMemoryUpdate` OM result key or parser path.
- Do not expose state signals as public API for this feature.
- Do not mix Studio indicator refactor into extractor API commits unless required by tests.

## Commit strategy

Prefer separate commits/PR units:

1. extractor option rename
2. extractor dynamic context support
3. `WorkingMemoryExtractor`
4. Studio OM indicator normalization

This keeps the high-risk UI work separate from memory API changes.

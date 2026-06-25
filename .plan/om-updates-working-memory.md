# OM-updated working memory

## Context

The desired product behavior is not generic extractor-to-context injection. The goal is:

> Let the observer or reflector update working memory over time, because the main agent often forgets to call the working memory tool.

This is different from a normal extractor.

Normal extractors:

- collect focused metadata
- persist under OM metadata
- optionally receive their previous value during the next OM extraction prompt

Working memory updates:

- write to the working memory store/resource/thread
- must respect working memory scope
- must respect templates/schema
- should use existing working memory update paths where possible
- represent durable agent memory, not arbitrary extracted metadata

## Recommended direction

Expose this as a prebuilt extractor that uses the normal extractor extension points:

```ts
import { WorkingMemoryExtractor } from '@mastra/memory';

memory: new Memory({
  options: {
    workingMemory: {
      enabled: true,
    },
    observationalMemory: {
      observation: {
        extract: [new WorkingMemoryExtractor()],
      },
    },
  },
});
```

`WorkingMemoryExtractor` should be a regular extractor, or a thin subclass/factory around `Extractor`, that:

- exposes the current working memory template/schema through normal extractor `instructions`/`schema`
- can resolve `instructions` and `schema` dynamically from runtime memory config values
- extracts the next working memory value through the same inline/structured extraction pipeline
- updates working memory from `onExtracted`
- returns `undefined` from `onExtracted` if we do not want to also persist the working memory payload under OM extracted metadata

The important point: no special `workingMemoryUpdate` result key, no separate parser path, and no one-off OM side channel. The existing extractor API should be powerful enough.

## Possible architecture

1. `WorkingMemoryExtractor` builds an `Extractor` whose schema/instructions can be derived from the effective working memory config at runtime.
2. The observer/reflector extracts a normal value for that extractor.
3. The extractor's `onExtracted` hook receives enough context to access the active `Memory` instance, either directly or through `mainAgent`.
4. The hook calls the existing working memory update path.
5. The hook returns `undefined` if the value should only update working memory, or returns the value if we also want it visible as extracted metadata.
6. Studio can show the extracted value/update using normal extractor marker fields unless we decide working-memory updates need special UI treatment later.

## Decisions

- `WorkingMemoryExtractor` does not need separate observer/reflector config. Extractors already work in observation and reflection configs, so users add it wherever they want it to run.
- It must adapt to the user's working memory config:
  - markdown working memory should surface the markdown/template format
  - JSON/schema working memory should surface the JSON schema format
- `ExtractorConfig.instructions` and `ExtractorConfig.schema` should support dynamic functions so built-in extractors can resolve runtime memory config before prompting.
- `ExtractorOnExtractedContext` should expose the active `Memory` instance directly.
- `WorkingMemoryExtractor.onExtracted` should usually return `undefined` so the working memory payload is not duplicated under `metadata.mastra.om.extracted`.
- Add a code comment explaining that `undefined` means "side effect handled; do not persist this value as extracted metadata."
- Because the observer may still need to see the previous working memory value, we need either:
  - allow duplication under extracted metadata, or
  - add a hook/API for preloading previous extractor value from working memory without persisting it as OM extracted metadata.
- Conflict handling between main-agent working memory tool calls and OM-driven working memory updates is up to the agents/model behavior.
- Add a working memory setting that can disable injecting working memory tools into the main agent, so OM can own updates when desired.
- Studio should render this normally as extractor output for now.

## Main-agent working memory tools

Add a separate working memory setting to control whether the main agent gets working memory update tools/instructions.

Naming TBD, but conceptually:

```ts
workingMemory: {
  enabled: true,
  injectTools: false,
}
```

This lets a project use OM-driven working memory updates without also expecting the main agent to remember to call the working memory tool.

## Non-goals

- Do not add a special `workingMemoryUpdate` result key or parser path.
- Do not overload `includePreviousExtraction` / prior-value behavior for main-agent context delivery.
- Do not add public state-signal controls unless we decide state signals are the product surface.
- Do not make users configure OM working-memory updates through an unrelated memory-level boolean if the extractor-list mental model works better.

## Verification

Likely requires both unit and integration coverage:

```sh
pnpm --filter ./packages/memory exec vitest run \
  src/index.test.ts \
  src/processors/observational-memory/__tests__/observational-memory-api.test.ts \
  --reporter=dot --bail 1

pnpm --filter ./packages/memory check
pnpm build:memory
```

For storage-backed behavior, also add/run focused integration tests under `packages/memory/integration-tests`.

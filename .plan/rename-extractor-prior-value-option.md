# Rename extractor prior-value option

## Context

`injectionBehaviour` is currently used on `Extractor` to decide whether the previous extracted value is shown back to the observer/reflector during the next extraction run.

That name is misleading. It sounds like it controls whether extracted values are injected into the main agent context, Studio UI, state signals, or working memory. It should only describe prior extraction carry-forward inside OM extraction prompts.

Current behavior:

- `injectionBehaviour: 'carry-forward'` is the default.
- `injectionBehaviour: 'none'` suppresses prior-value prompt context.

## Proposed change

Replace the string option with a boolean:

```ts
includePreviousExtraction?: boolean;
```

Mapping:

```ts
injectionBehaviour: 'carry-forward' -> includePreviousExtraction: true
injectionBehaviour: 'none'          -> includePreviousExtraction: false
```

Default:

```ts
includePreviousExtraction: true
```

## Why this name

`includePreviousExtraction` says exactly what the option does:

- it includes the previous value
- the previous value is an extraction result
- it does not imply main-agent context injection
- it does not imply state signal delivery
- it does not imply working memory updates

## Implementation notes

- Update `ExtractorConfig` in `packages/memory/src/processors/observational-memory/extractor.ts`.
- Replace `extractor.injectionBehaviour === 'none'` checks with `extractor.includePreviousExtraction === false`.
- Update docs/examples to remove `injectionBehaviour`.
- Since this is an in-flight feature branch, no compatibility shim is required unless we decide otherwise.

## Verification

Run focused memory checks:

```sh
pnpm --filter ./packages/memory exec vitest run \
  src/processors/observational-memory/__tests__/extractor.test.ts \
  src/processors/observational-memory/__tests__/observational-memory-api.test.ts \
  --reporter=dot --bail 1

pnpm --filter ./packages/memory check
pnpm build:memory
git diff --check
```

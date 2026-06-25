# Extracted values and main-agent context boundary

## Context

Extracted values currently persist in OM metadata and can be included in the main agent's OM context.

Current path:

1. Observer/reflector extracts values.
2. Built-ins persist as dedicated OM metadata fields:
   - `currentTask`
   - `suggestedResponse`
   - `threadTitle`
3. Custom values persist under `metadata.mastra.om.extracted`.
4. `ObservationalMemory.formatObservationsForContext()` builds the main-agent context.
5. `buildExtractedValueContextSections()` injects custom extracted values unless prior-value injection is disabled under the current overloaded option.

Relevant files:

- `packages/memory/src/processors/observational-memory/observational-memory.ts`
- `packages/memory/src/processors/observational-memory/extracted-values.ts`

## Problem

The system currently conflates multiple concepts:

- showing previous values to the OM extraction prompt
- exposing extracted values to the main agent
- updating working memory
- showing extracted values in Studio

The immediate naming fix should narrow prior-value behavior, but the larger product boundary still needs to stay clean.

## Proposed boundary

Extractors should own:

- what to extract
- how to parse/validate it
- whether the previous extraction is included in the next OM prompt
- lifecycle hooks for side effects after extraction

Extractors should not own:

- whether ordinary extracted metadata is injected into the main agent context
- whether extracted values become state signals
- Studio display policy

A `WorkingMemoryExtractor` can still update working memory through `onExtracted`; that is a deliberate extractor side effect, not generic extracted metadata context injection.

Memory/OM should own default context surfacing for ordinary extracted metadata.

## Near-term action

Rename `injectionBehaviour` to `includePreviousExtraction` and keep its meaning narrow.

Do not add a new extractor-level API for main-agent context delivery.

## Decision

The user-facing key remains on the extractor and should be only about previous extraction carry-forward:

```ts
new Extractor({
  name: 'User info',
  instructions: 'Stable user info',
  includePreviousExtraction: true,
})
```

Do not add a public `observationalMemory.context.includeExtractedValues` API.

Do not add extractor-level context-delivery flags.

For durable agent memory, use the dedicated `WorkingMemoryExtractor` plan. That extractor still uses the regular extractor pipeline and `onExtracted`; it should not require a special OM parser/result key.

## Recommendation

Do the naming cleanup now. Keep context-delivery API out of this feature.

If the product need is "the agent should remember this," use `WorkingMemoryExtractor` rather than generic extracted-value context flags.

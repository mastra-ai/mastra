# Observability Playground Filter Redesign

Status: design draft
Scope: Playground observability UI (`traces`, `observability`, `logs`)
Audience: internal implementation/design note

## Summary

The current observability filter UI is too tightly coupled to backend filter schema discovery and to preloaded dropdown value sets. That model breaks down for high-cardinality fields such as IDs and creates UI ambiguity around what is a facet, what is a search, and what is just client-side filtering of already loaded rows.

The target model is:

- dedicated controls for a very small number of bounded enum filters
- tokenized property filtering for everything else
- no generic facet dropdown
- no generic search box that implies full-text search
- no eager loading of large option sets

This is closer to AWS-style property filtering and should scale better for production datasets.

## Core Decisions

### 1. Remove generic filter-menu-driven faceting

Do not continue investing in the current nested `Filter` dropdown model for observability.

Reasons:

- it encourages schema-mirroring instead of good UX
- it hides important filters behind submenu hierarchy
- it does not scale for high-cardinality fields
- it encourages preloading option sets that can grow without bound
- it makes metadata and promoted fields confusing and duplicative

### 2. Remove the current generic search field

Observability pages should not present a generic search field like:

- `Search name, ID, content...`

We do not support true server-side full-text search, and a client-side-only filter over already loaded rows will be misleading in observability views.

Decision:

- remove client-side search from observability traces/logs UIs
- do not replace it with another fake free-text search

### 3. Use dedicated bounded controls plus tokenized property filters

Top-level controls should be limited to:

- date range / preset
- a few true bounded enums
- one tokenized `Filter` control for all other fields

### 4. No synthetic `All` options

For bounded controls like `Root Entity Type`, `Status`, and `Log Level`:

- default state is unset
- unset means no filter
- clearing removes the filter from state and URL
- use an explicit clear affordance (`x`) on the control
- do not encode “no filter” as an `All` option

This should match the semantics of removing a token/chip.

## Target UI Model

## Traces

Top row:

- Date control
- `Root Entity Type` control
- `Status` control
- `Filter` property-token control
- `Reset` button when any filter is active
- `Group by thread` remains as a view toggle, not a filter

### Dedicated controls

#### Root Entity Type

- type: single-select bounded control
- values: `Agent`, `Workflow`, `Scorer`, `Ingest`
- unset by default
- clearable via `x`
- maps to `listTraces({ filters: { entityType } })`

#### Status

- type: single-select bounded control
- values: `Running`, `Success`, `Error`
- unset by default
- clearable via `x`
- maps to trace status filtering

#### Date

- preserve the current preset + custom range model
- remains a dedicated control

### Tokenized property fields for traces

These appear via the shared `Filter` property-token control:

- `Tags` -> `filters.tags` (special multi-value token field; all selected tags must be present)
- `Root Entity Name` -> `filters.entityName`
- `Trace ID` -> `filters.traceId`
- `Run ID` -> `filters.runId`
- `Thread ID` -> `filters.threadId`
- `Session ID` -> `filters.sessionId`
- `Request ID` -> `filters.requestId`
- `Resource ID` -> `filters.resourceId`
- `User ID` -> `filters.userId`
- `Organization ID` -> `filters.organizationId`
- `Service Name` -> `filters.serviceName`
- `Environment` -> `filters.environment`
- `Experiment ID` -> `filters.experimentId`
- `Target Trace ID` -> `filters.metadata.targetTraceId`
- `Target Span ID` -> `filters.metadata.targetSpanId`

### Fields intentionally not exposed in v1 traces UI

- `parentEntityType`
- `parentEntityId`
- `parentEntityName`
- `rootEntityId`
- `scope`
- arbitrary metadata browsing

These can be revisited later if a real operator workflow needs them.

## Logs

Top row:

- Date control
- `Root Entity Type` control
- `Log Level` control
- `Filter` property-token control
- `Reset` button when any filter is active

### Dedicated controls

#### Root Entity Type

- type: single-select bounded control
- values: `Agent`, `Workflow`, `Scorer`, `Ingest`
- unset by default
- clearable via `x`
- maps to `listLogs({ filters: { rootEntityType } })`

#### Log Level

- type: single-select bounded control
- values: `Debug`, `Info`, `Warn`, `Error`, `Fatal`
- unset by default
- clearable via `x`
- maps to `listLogs({ filters: { level } })`

#### Date

- preserve the current preset + custom range model

### Tokenized property fields for logs

- `Tags` -> `filters.tags` (special multi-value token field; all selected tags must be present)
- `Entity Type` -> `filters.entityType`
- `Entity Name` -> `filters.entityName`
- `Root Entity Name` -> `filters.rootEntityName`
- `Trace ID` -> `filters.traceId`
- `Span ID` -> `filters.spanId`
- `Run ID` -> `filters.runId`
- `Thread ID` -> `filters.threadId`
- `Session ID` -> `filters.sessionId`
- `Request ID` -> `filters.requestId`
- `Resource ID` -> `filters.resourceId`
- `User ID` -> `filters.userId`
- `Organization ID` -> `filters.organizationId`
- `Service Name` -> `filters.serviceName`
- `Environment` -> `filters.environment`
- `Experiment ID` -> `filters.experimentId`
- `Target Trace ID` -> `filters.metadata.targetTraceId`
- `Target Span ID` -> `filters.metadata.targetSpanId`

### Important backend note for logs

As of this design, logs do not have first-class `targetTraceId` / `targetSpanId` filter fields in `logsFilterSchema`.

Confirmed in:

- [logs.ts](/Users/epinzur/src/github.com/mastra-ai/mastra/packages/_internal-core/src/storage/domains/observability/logs.ts)

So in v1:

- `Target Trace ID` and `Target Span ID` remain metadata-backed tokens for logs

## Property Filter UX

The replacement for the old search field should be labeled simply:

- `Filter`

This control should implement tokenized fielded search / property filtering.

### Intended interaction

1. user activates `Filter`
2. user chooses a field
3. user enters a value
4. user confirms
5. a token/chip appears inline
6. token can be removed via `x`

### v1 constraints

- one active token per field
- adding the same field again replaces the previous token
- avoid query-language parsing in v1
- avoid repeated same-field predicates in v1

This keeps URL mapping and backend mapping simple.

Exception:

- `Tags` is allowed to be a special multi-value token field in v1

### Token value modes

#### Plain text entry

Use plain text entry for:

- all ID-like fields
- most context fields
- metadata-backed target IDs

#### Special multi-value token entry

Use a dedicated multi-value token experience for:

- `Tags`

Semantics:

- user adds one `Tags` token
- token can hold multiple selected tag values
- backend behavior remains existing AND semantics
- a record must contain all selected tags to match

#### Text entry with optional suggestions

Use lazy, debounced suggestions for human-scale fields only:

- `Root Entity Name`
- `Entity Name`
- maybe `Service Name`
- maybe `Environment`

Do not preload suggestion lists for ID-like fields.

## Suggested Design-System Component

Add a reusable DS-level component in `packages/playground-ui`, likely under:

- `src/ds/components/PropertyFilter/`

Working name:

- `PropertyFilterBar`

### Proposed controlled API

```ts
type PropertyFilterField = {
  id: string;
  label: string;
  kind: 'text' | 'suggested-text';
  placeholder?: string;
};

type PropertyFilterToken = {
  field: string;
  label: string;
  value: string;
};

type PropertyFilterBarProps = {
  fields: PropertyFilterField[];
  tokens: PropertyFilterToken[];
  onTokensChange: (tokens: PropertyFilterToken[]) => void;
  getSuggestions?: (field: string, query: string) => Promise<Array<{ label: string; value: string }>>;
};
```

### Existing DS primitives to reuse

- [combobox.tsx](/Users/epinzur/src/github.com/mastra-ai/mastra/packages/playground-ui/src/ds/components/Combobox/combobox.tsx)
- [chip.tsx](/Users/epinzur/src/github.com/mastra-ai/mastra/packages/playground-ui/src/ds/components/Chip/chip.tsx)
- [chips-group.tsx](/Users/epinzur/src/github.com/mastra-ai/mastra/packages/playground-ui/src/ds/components/Chip/chips-group.tsx)

The current `SelectDataFilter` component should not be the long-term observability filter surface.

## URL and State Model

Do not invent a new query language in v1.

### Dedicated controls

Persist as normal query params:

- `rootEntityType=scorer`
- `status=error`
- `level=warn`

### Property tokens

Persist as one query param per supported field:

- `traceId=...`
- `threadId=...`
- `entityName=...`
- `rootEntityName=...`
- `userId=...`
- `organizationId=...`

For `Tags`, persist as repeated query params or an equivalent stable multi-value encoding at the page layer, then map to `filters.tags: string[]`.

### Metadata-backed target IDs

Expose as explicit query params at page level:

- `targetTraceId=...`
- `targetSpanId=...`

Then map those into:

- `filters.metadata.targetTraceId`
- `filters.metadata.targetSpanId`

before calling storage/client APIs.

This gives stable URLs without inventing a parser.

## Suggestions and Discovery

### v1

- no eager loading for IDs
- lazy suggestions only for selected human-readable fields
- debounce requests
- small result limits

### Known backend limitation

`getEntityNames()` does not currently support:

- `rootOnly`
- `query`
- `limit`

So root-only name suggestions currently require multiple queries. This is acceptable for now and can be improved later.

## Non-Goals for v1

- full-text search
- arbitrary query parsing
- repeated same-field predicates
- large preloaded dropdown value sets
- full metadata browser
- exposing every filterable backend field in the UI

Note:

- `Tags` is the one intentional exception to the “one token per field” simplification because storage APIs already support multi-tag filtering cleanly.

## Implementation Plan

### Phase 1: shared DS/component work

1. Create `PropertyFilterBar` in `packages/playground-ui`
2. Build it from existing DS primitives (`Combobox`, `Chip`, button/popover primitives)
3. Support:
   - choosing a field
   - entering a value
   - committing a token
   - removing a token
   - optional async suggestions

### Phase 2: traces migration

1. Remove current generic search field from traces and observability pages
2. Remove generic filter-dropdown-driven UI from traces and observability pages
3. Add dedicated controls:
   - `Root Entity Type`
   - `Status`
4. Add traces property-token field registry
5. Map tokens into `listTraces().filters`
6. Keep `Group by thread` as a separate non-filter toggle

### Phase 3: logs migration

1. Remove current search field and generic filter dropdown from logs
2. Add dedicated controls:
   - `Root Entity Type`
   - `Log Level`
3. Add logs property-token field registry
4. Map tokens into `listLogs().filters`
5. Map `target*Id` tokens through `filters.metadata`

### Phase 4: refinement

1. Add lazy suggestions for:
   - `Root Entity Name`
   - `Entity Name`
   - maybe `Service Name`
   - maybe `Environment`
2. Polish control clear behavior so all dedicated controls match token removal semantics
3. Evaluate whether any remaining promoted filters should be removed from UI entirely

## Verification Plan

After implementation review is complete:

1. `pnpm build:core`
2. `pnpm build:playground-ui`
3. `pnpm --filter ./packages/playground build`
4. targeted UI validation / frontend e2e validation

## Current Conclusion

The target observability filter UX should be:

- no generic search box
- no schema-mirroring facet tree
- no eager loading of high-cardinality filter values
- explicit top-level enum controls for a tiny set of bounded fields
- tokenized property filtering for everything else

This is the design target for implementation.

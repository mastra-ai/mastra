# `@mastra/meilisearch` - agent notes

Vector-store adapter (`MeilisearchVector extends MastraVector`). Modelled on `stores/opensearch` + `stores/qdrant`.
Run the narrowest suite: `pnpm --filter ./stores/meilisearch test` (`pretest` starts docker Meilisearch and waits on `/health`; `posttest` tears it down).

## Non-obvious Meilisearch constraints baked into this adapter

- **Everything mutating is async.** `createIndex`, `updateEmbedders`, `updateFilterableAttributes`, `addDocuments`, `updateDocuments`, `deleteDocument(s)`, `deleteIndex` all return a task and complete later. Always `await ....waitTask()` (see `awaitTask`) or read-after-write tests flake. This is the analogue of OpenSearch's `refresh: true`.
- **You can only filter on declared `filterableAttributes`.** Recall keys (`metadata.thread_id`, `metadata.resource_id`, `metadata.message_id`) are registered at `createIndex`; arbitrary metadata keys are registered on `upsert`/filtered mutations via `ensureFilterable` (diffs against a per-index cache, then `updateFilterableAttributes([...union])`). Filtering an undeclared attribute errors.
- **`userProvided` embedder only.** Mastra hands us ready vectors - never embed here. Vectors live under `_vectors.default.embeddings` with `regenerate: false`. Index dimension is read back from the embedder config (`getEmbedders`).
- **Cosine only.** Non-cosine `metric` warns and is treated as cosine; `describeIndex` always reports `cosine`. Zero-magnitude vectors are rejected (cosine normalization) - the conformance suite runs with `supportsZeroVectors: false`.
- **Score is `_rankingScore`** (pure-vector; `semanticRatio: 1.0`). Mastra's `query()` passes no query text, so native hybrid keyword search is not wired (possible future opt-in).
- **Primary keys must match `^[A-Za-z0-9_-]+$`.** Caller ids are base64url-encoded into a `pk` field; the original id stays in `id`.

## Filter translation gotcha (the one the conformance suite catches)

A missing attribute makes an inner predicate **false**, so a bare `NOT (field < x)` _also matches documents lacking the field_. Field-level `$not` over a positive predicate therefore emits `(field EXISTS) AND NOT (...)` so negation only matches documents that have the field. Skip the `EXISTS` guard when the inner is `$exists` (it would be self-contradictory). `EXISTS` matches null-valued fields, so `$ne: null` negations are unaffected.

## Disabled conformance domains (genuine limitations, not shortcuts)

`supportsRegex: false` (no regex), `supportsContains: false` (`CONTAINS` needs the experimental `containsFilter` flag), `supportsElemMatch: false` (no per-element matching), `supportsSize: false` (no array-length filter), `supportsZeroVectors: false` (cosine).

## Versions

Server `getmeili/meilisearch:v1.13` (vector store is GA - no experimental flag). Client `meilisearch@^0.58.0`.

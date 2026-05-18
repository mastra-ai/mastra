# Phase 1.5 — Storage column for `toolIntegrations`

## Goal

Phase 1 added `toolIntegrations` to TypeScript types (`StorageStoredAgent`, server schemas, client SDK) but did **not** add the corresponding storage column. As a result, agents created with `toolIntegrations` have the field silently dropped at the storage layer, which blocks Phase 4 runtime fan-out.

Phase 1.5 closes that gap. Additive, no behavior change beyond persistence.

## Why this is its own phase

- Keeps the original Phase 1 commit untouched.
- Storage adapter changes touch a different package (`stores/libsql`) and the shared schema constants; cleaner as a focused diff.
- Phase 4 depends on this landing first.

## Scope

### Core

- `packages/core/src/storage/constants.ts`
  - Add `toolIntegrations: { type: 'jsonb', nullable: true }` to `AGENT_VERSIONS_SCHEMA`.
  - Mirror placement next to existing `integrationTools` entry.
- `packages/core/src/storage/domains/agents/filesystem.ts`
  - Add `'toolIntegrations'` to `PERSISTED_SNAPSHOT_FIELDS`.

### LibSQL adapter

- `stores/libsql/src/storage/domains/agents/index.ts`
  - Three sites mirror `integrationTools`:
    1. Legacy table migration insert (~line 135).
    2. `createVersion` insert (~line 679).
    3. `getVersion` / row mapper (~line 985), with `parseJson(row.toolIntegrations, 'toolIntegrations')`.

### InMemory adapter

- Verify round-trip works without changes (in-memory passes the whole object). Add a regression test if missing.

## Out of scope

- No changes to the `ToolIntegration` interface or `BaseToolIntegration`.
- No changes to Phase 4 hydration code (already wired correctly).
- Other storage adapters (`@mastra/pg`, `@mastra/mongo`, etc.) are **not** updated in this phase — they will be tracked separately. V1 only needs libsql + filesystem + inmemory to pass.

## Acceptance criteria

- `toolIntegrations` field round-trips through libsql, filesystem, and inmemory adapters.
- Phase 4 hydration test (`editor-tool-integrations-hydration.test.ts`) passes on libsql.
- Existing `integrationTools` behavior is unchanged.

## Verification

```bash
pnpm --filter ./packages/core build
pnpm --filter ./stores/libsql build
pnpm --filter ./packages/editor test -- editor-tool-integrations-hydration
pnpm --filter ./packages/core test
```

## Migration

- For existing libsql databases, the new column is added on next `init()` via the schema diff path. `nullable: true` means no backfill needed.
- No agent data needs re-saving.

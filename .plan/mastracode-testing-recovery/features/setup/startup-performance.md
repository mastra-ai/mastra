# Startup performance

## Origin PR / commit

- PR: [#16513](https://github.com/mastra-ai/mastra/pull/16513) — speeds up Mastra Code startup and local LibSQL access without changing startup UX.
- Later changes: none known.

## User-visible behavior

- What the user can do: start Mastra Code normally with local LibSQL, remote LibSQL, PostgreSQL, or local tracing settings.
- Success looks like: the TUI reaches the editor faster, gateway sync no longer blocks startup, local LibSQL reads/writes use safer high-performance PRAGMAs, and regular startup warnings still appear when storage or tracing fallback happens.
- Must preserve: storage backend selection, PostgreSQL fallback warnings, local tracing lock warnings, thread/OM restoration, and no unsafe SQLite `synchronous=OFF` mode.

## Entry points / commands

- Commands / shortcuts / flags: normal `mastracode` startup, headless startup, and `createMastraCode()` consumers.
- Automatic triggers: `createMastraCode()` initializes gateway registry, storage, vector store, Harness, thread-state restoration, and heartbeat handlers.

## TUI states

- Idle: faster initialization should still produce the same initial thread, mode, model, warning, and status-line state.
- Active / modal / error: not a modal feature; startup errors/warnings still flow through `main.ts` before the TUI renders or through fatal PostgreSQL repair guidance.

## Headless / non-TUI behavior

- Supported: headless startup uses the same storage factory, background gateway sync, and Harness construction path.
- Not supported / unknown: no benchmark guardrail currently enforces a maximum startup time.

## Streaming / loading / interrupted states

- Streaming / loading: startup completes before agent streaming begins; background gateway sync and heartbeat refresh run independently after API keys are loaded.
- Abort / retry / resume: LibSQL initialization is cached/coalesced after success for local files, but in-memory DBs still reinitialize so transient test/session schemas are present.

## Streaming vs loaded-from-history behavior

- While actively streaming: startup optimizations are already applied; storage domains and message indexes are fixed for the process.
- After reload / history reconstruction: message history reads benefit from LibSQL message indexes and local PRAGMA tuning; persisted signal/thread history semantics do not change.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Gateway registry sync | `GatewayRegistry.syncGateways(true)` fired in the background plus heartbeat `syncGateways()` | provider/model registry cache and model auth checks |
| Main storage backend | `createStorage()` result | Harness, memory, thread history, warning output |
| Local LibSQL PRAGMAs | `LibSQLStore` defaults or Mastra Code local overrides | local thread/history reads, writes, and schema init |
| LibSQL init cache | `LibSQLStore.hasInitialized` / `shouldCacheInit` | repeated startup/domain initialization and concurrent init callers |
| Message indexes | LibSQL memory-domain DDL | startup history and thread message reads |
| Column metadata cache | `LibSQLDB.tableColumnsCache` | insert/update/batch operations against migrated schemas |

## Key files

- `mastracode/src/index.ts` — starts gateway sync in the background, builds storage/vector/Harness, and wires heartbeat sync.
- `mastracode/src/main.ts` — displays storage/observability warnings after `createMastraCode()` returns and before TUI startup.
- `mastracode/src/utils/storage-factory.ts` — applies Mastra Code local LibSQL PRAGMA overrides and PG fallback behavior.
- `stores/libsql/src/storage/index.ts` — local PRAGMAs, local-vs-remote init strategy, cached/coalesced init, and close-time WAL cleanup.
- `stores/libsql/src/storage/db/index.ts` — caches table-column lookups and filters records for forward-compatible migrations.
- `stores/libsql/src/storage/domains/memory/index.ts` — message-table indexes used by thread/history reads.

## Dependencies / related features

- [Storage backend configuration](../settings/storage-backend.md) — selects the backend optimized during startup.
- [Persistent conversations](../threads/persistent-conversations.md) — history reads benefit from message indexes and local DB tuning.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — background gateway sync keeps registry refresh from delaying startup.

## Existing tests

- `stores/libsql/src/storage/local-performance.test.ts` — local PRAGMAs, safe synchronous mode, custom cache/mmap overrides, message indexes, cached init, in-memory reinit, and concurrent init coalescing.
- `stores/libsql/src/storage/db/migration-columns.test.ts` — span column migration inspects table columns once while adding missing columns.
- `mastracode/src/__tests__/index.test.ts` — background gateway sync starts without blocking `createMastraCode()`, plus startup restoration and Harness wiring.

## Missing tests

- End-to-end startup timing benchmark on a realistic local Mastra Code database.
- Regression test that startup warnings still render correctly when gateway sync is slow but storage initialization succeeds.
- Integration test for local LibSQL message index impact on large thread-history reads.

## Known risks / regressions

- Cached local file DB init must not hide migration failures; rejected init promises need to leave future retries possible.
- Aggressive local cache/mmap settings help local startup but should not apply to remote LibSQL/Turso connections.
- Background gateway sync errors are intentionally swallowed, so registry freshness problems need separate observability.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.

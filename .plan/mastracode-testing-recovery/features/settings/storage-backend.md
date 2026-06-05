# Storage backend configuration

## Origin PR / commit

- PR: [#13435](https://github.com/mastra-ai/mastra/pull/13435) — added opt-in PostgreSQL storage alongside default LibSQL, plus `/settings` backend selection.
- Later changes: [#13815](https://github.com/mastra-ai/mastra/pull/13815) — database config files can also carry `omScope` for observational-memory scope selection; [#14567](https://github.com/mastra-ai/mastra/pull/14567) — pairs the selected storage backend with a vector store used by OM recall search/indexing; [#16135](https://github.com/mastra-ai/mastra/pull/16135) — normalizes Enter/Escape handling in the storage connection submenu using pi-tui `matchesKey()` plus raw-byte fallbacks; [#16513](https://github.com/mastra-ai/mastra/pull/16513) — tunes local LibSQL startup with safe PRAGMAs, cached/coalesced init, message indexes, and non-blocking gateway sync.

## User-visible behavior

- What the user can do: use default local LibSQL, configure remote LibSQL/Turso, or switch to PostgreSQL from `/settings` or environment variables.
- Success looks like: threads, memory, approvals, and agent data use the selected backend after restart; failed PostgreSQL startup falls back to LibSQL with a warning so `/settings` remains reachable; local LibSQL startup/history reads stay fast; Enter saves and Escape cancels the storage connection prompt across terminal emulators.
- Must preserve: backend precedence, connection-string persistence, restart-required UX, LibSQL fallback, vector-store pairing, and safe local SQLite PRAGMAs.

## Entry points / commands

- Commands / shortcuts / flags: `/settings` → Storage backend; env vars `MASTRA_STORAGE_BACKEND`, `MASTRA_DB_URL`, `MASTRA_DB_AUTH_TOKEN`, `MASTRA_PG_CONNECTION_STRING`, `MASTRA_PG_HOST`, `MASTRA_PG_PORT`, `MASTRA_PG_DATABASE`, `MASTRA_PG_USER`, `MASTRA_PG_PASSWORD`, `MASTRA_PG_SCHEMA_NAME`.
- Automatic triggers: `createMastraCode()` resolves storage config during startup before Harness/memory construction.

## TUI states

- Idle: settings overlay opens a backend picker, then a masked connection input for PostgreSQL or LibSQL URL; the connection input accepts normalized Enter/Escape events and raw `\r`/`\n`/`\x1b` fallbacks.
- Active / modal / error: saving a storage change writes `settings.json`, hides the overlay, stops the TUI, prints a restart-required notice, and exits.

## Headless / non-TUI behavior

- Supported: headless startup uses the same env/settings/legacy/default resolution path.
- Not supported / unknown: no interactive repair flow in headless; PostgreSQL misconfiguration falls back only if storage initialization reaches `createStorage()` successfully.

## Streaming / loading / interrupted states

- Streaming / loading: backend is selected before streaming starts; it is not a mid-stream setting.
- Abort / retry / resume: PostgreSQL connection failures fall back to LibSQL and emit `storageWarning`; fatal uncaught `ECONNREFUSED` still prints PostgreSQL repair guidance.

## Streaming vs loaded-from-history behavior

- While actively streaming: storage backend is fixed for the process; changing it requires restart.
- After reload / history reconstruction: history/session/OM retrieval come from the backend selected at startup, so switching backends can look like missing history unless data was migrated separately.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Backend selection | Env vars first, then `settings.json` `storage.backend`, then legacy `.mastracode/database.json`, then local LibSQL default | `getStorageConfig()` |
| OM scope in database config | `MASTRA_OM_SCOPE`, project/global `.mastracode/database.json` `omScope`, or `createMastraCode({ omScope })` | `getOmScope()`, memory factory |
| LibSQL URL/token | `MASTRA_DB_URL`/`MASTRA_DB_AUTH_TOKEN` or `settings.storage.libsql` | `LibSQLStore`, `LibSQLVector` |
| PostgreSQL connection | `MASTRA_PG_*` vars or `settings.storage.pg` | `PostgresStore`, `PgVector` |
| Effective backend after fallback | `createStorage()` result | Vector-store selection, startup warnings |
| Local LibSQL performance settings | `LibSQLStore` local PRAGMAs plus Mastra Code overrides in `storage-factory.ts` | local thread/message history, schema init, startup latency |
| Recall vector store | `createVectorStore()` uses `PgVector` for effective PG or separate local `LibSQLVector` file for LibSQL | OM observation indexing, `Memory.searchMessages()`, agent `recall` search mode |

## Key files

- `mastracode/src/utils/project.ts` — storage config precedence, `omScope` precedence, and env/settings/legacy parsing.
- `mastracode/src/utils/storage-factory.ts` — creates LibSQL/PostgreSQL stores, tests PG startup, applies Mastra Code local LibSQL PRAGMA overrides, and falls back to LibSQL with warnings.
- `stores/libsql/src/storage/index.ts` and `stores/libsql/src/storage/db/index.ts` — local PRAGMAs, cached/coalesced init, message indexes, and table-column cache for migration-compatible writes.
- `mastracode/src/onboarding/settings.ts` — persisted `StorageSettings` schema/defaults.
- `mastracode/src/tui/components/settings.ts` — storage backend submenu and connection input, including normalized `matchesKey(data, 'enter'|'escape')` plus raw-byte fallbacks.
- `mastracode/src/tui/commands/settings.ts` — saves backend settings and forces restart.
- `mastracode/src/index.ts` — startup wires storage, vector store, memory, and warnings.
- `mastracode/src/main.ts` — displays storage warnings and fatal PG repair guidance.

## Dependencies / related features

- [Onboarding and global settings](./onboarding-and-global-settings.md) — stores backend choice in global settings.
- [Persistent conversations](../threads/persistent-conversations.md) — thread/session history depends on selected storage.
- [Observational memory](../memory/observational-memory.md) — OM and recall vector storage depend on selected backend.
- [Startup performance](../setup/startup-performance.md) — documents the LibSQL/startup optimization layer that keeps this backend responsive.

## Existing tests

- `mastracode/src/utils/__tests__/storage-config.test.ts` — config precedence, env/settings parsing, LibSQL creation, PG fallback, vector-store fallback, and PG option construction.
- `mastracode/src/onboarding/__tests__/settings.test.ts` — settings schema/default parsing includes storage defaults.
- `stores/libsql/src/storage/local-performance.test.ts` — local PRAGMAs, message indexes, cached/coalesced init, and in-memory reinit behavior.
- `stores/libsql/src/storage/db/migration-columns.test.ts` — table-column cache keeps migration column inspection bounded.

## Missing tests

- `/settings` storage backend overlay interaction, masked input behavior, normalized Enter/Escape handling, saved settings, and forced restart.
- Restart after switching backend: selected backend, footer/runtime warning, and history visibility.
- Successful PostgreSQL integration against a real test database, including `PgVector` usage and schema/index flags.
- Data migration story when switching LibSQL ↔ PostgreSQL.
- `getOmScope()` precedence tests for env/project/global database config and invalid values.

## Known risks / regressions

- Backend switching does not migrate existing history, so users can interpret an empty new backend as lost conversations.
- PostgreSQL fallback means the process may keep running on LibSQL while settings still say `pg`; UI/status needs to make that clear enough.
- `/settings` accepts only connection strings for PostgreSQL even though env/settings types also support host/port fields.
- Env vars override settings, so `/settings` changes may appear ignored until env vars are removed.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.

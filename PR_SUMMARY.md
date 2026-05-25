# PR #16560 Summary: `/debug-chat-export`

## What changed

This PR adds a `/debug-chat-export` slash command to `mastracode` and a supporting Harness API in `@mastra/core`.

The command exports the active thread, persisted messages, current observational memory (OM) record, prior OM generations, and diagnostic metadata to a timestamped directory under the mastracode app data directory.

Generated files:

- `manifest.json` — top-level export summary
- `thread.json` — active thread metadata
- `messages.json` — all persisted messages in the active thread
- `om-current.json` — currently active OM record, or `null`
- `om-history.json` — previous OM generations, newest first
- `meta.json` — mastracode version, model IDs, thresholds, platform, and harness state
- `README.md` — export layout and privacy warning

## Hardening completed

1. **Sensitive export permissions**
   - Export directories are created with `0o700`.
   - Export files are written with `0o600`.
   - Tests assert POSIX permissions on non-Windows platforms.

2. **Atomic export writes**
   - Writes now go to a temporary sibling directory first.
   - The temp directory is renamed to the final timestamped export directory only after all files are written successfully.
   - Failures clean up the temp directory and surface a TUI error instead of leaving a partial export.

3. **Failure-safe thread lookup and filesystem writes**
   - `harness.listThreads({ allResources: true })` is wrapped in `try/catch`.
   - Export root creation and all file writes are guarded.
   - Failures call `ctx.showError(...)` and return early.

4. **OM history semantics**
   - `Harness.getObservationalMemoryHistory({ limit? })` now returns previous OM generations only.
   - The current active record returned by `getObservationalMemoryRecord()` is filtered out by ID.
   - The requested `limit` is applied after filtering out the current record.

5. **Package-specific release notes**
   - Split the combined changeset into separate entries:
     - `.changeset/debug-chat-export-mastracode.md`
     - `.changeset/debug-chat-export-core.md`

## Local verification

All commands were run from the repo root after `pnpm install`.

### Focused mastracode command tests

```bash
pnpm --filter mastracode exec vitest run src/tui/commands/__tests__/debug-chat-export.test.ts src/tui/__tests__/command-dispatch.test.ts --bail 1 --reporter=dot
```

Result: **pass**

- 2 test files passed
- 25 tests passed
- `debug-chat-export.test.ts`: 8/8 pass
- `command-dispatch.test.ts`: 17/17 pass

Note: the originally suggested `pnpm --filter mastracode test -- --run ...` forwards args as `vitest -- --run ...` in this package and runs the broader suite; the focused command above is the exact passing command used for targeted verification.

### Focused core Harness tests

```bash
pnpm --filter ./packages/core test -- --run src/harness/get-om-history.test.ts src/harness/get-om-record.test.ts --bail 1 --reporter=dot
```

Result: **pass**

- `get-om-history.test.ts`: 7/7 pass
- `get-om-record.test.ts`: 4/4 pass

### Broader core harness test suite

```bash
pnpm test:core -- --run src/harness --bail 1 --reporter=dot
```

Result: **pass**

- 22 test files passed
- 267 tests passed
- Type errors: none

### Typechecks

```bash
pnpm --filter ./packages/core check
```

Result: **pass** — `tsc --noEmit` exits cleanly.

```bash
pnpm --filter mastracode check
```

Result: **fails with pre-existing unrelated module-resolution errors**

- 15 errors in 7 files
- All are `Cannot find module '@mastra/...'` errors for packages not built locally, including `@mastra/schema-compat`, `@mastra/libsql`, and `@mastra/pg`.
- The changed files do not appear in the error list.

Error files:

- `src/agents/memory.ts`
- `src/index.ts`
- `src/mcp/manager.ts`
- `src/onboarding/settings.ts`
- `src/tools/web-search.ts`
- `src/tui/commands/browser.ts`
- `src/utils/storage-factory.ts`

### Broader mastracode test suite

```bash
pnpm --filter mastracode test -- --run --bail 1 --reporter=dot
```

Result: **fails with pre-existing unrelated module-resolution errors**

- 20 failed files / 64 passed files
- 598 total tests reported
- Failures are caused by unresolvable packages such as `@mastra/schema-compat`, `@mastra/libsql`, `@mastra/pg`, and `@mastra/firecrawl`.
- The focused tests for this PR still pass: 8 export tests + 17 dispatch tests.

## CI status

Checked via `gh pr view 16560 --json statusCheckRollup`.

Required checks pass:

- Lint
- Unit and E2E Tests / Merge Test Reports
- Lint docs

Non-required failures are pre-existing and unrelated to this PR:

- `E2E Tests` — `No test files found, exiting with code 1` for the CommonJS E2E runner.
- `Memory Tests` — stale MSW LLM recording hashes: `No exact match for hash... Consider re-recording with UPDATE_RECORDINGS=true`.

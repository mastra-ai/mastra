# LSP Subsystem — Status & Roadmap

## Architecture

An LSP server (e.g. typescript-language-server, pyright, gopls) is a process that:

1. Receives a `rootUri` during initialization — "here's the project root"
2. **Reads from disk**: `tsconfig.json`/`pyproject.toml`/`go.mod` at the root, `node_modules` for type resolution, source files for cross-file intelligence
3. **Receives via protocol**: content of open/changed files via `textDocument/didOpen` / `textDocument/didChange`
4. Returns diagnostics, completions, hover info, etc.

The LSP pipeline has 5 steps:

1. **Root resolution** — `walkUp()` / `walkUpAsync()` finds project markers
2. **Binary resolution** — `command()` finds the language server executable
3. **Process spawning** — `processManager.spawn(command, { cwd: root })`
4. **Server disk access** — server reads config, types, source from its filesystem
5. **Diagnostics flow** — file content sent via protocol, server responds

## What's Done

### Core architecture
- Per-file root resolution via `walkUpAsync` with language-specific markers
- Client caching keyed by `${serverDef.name}:${projectRoot}`
- Default root fallback: `lspConfig.root ?? findProjectRoot(cwd) ?? cwd`
- Path resolution in helpers.ts (absolute pass-through, relative resolved against root)

### Hardening
- **Crash recovery**: `isAlive` getter on LSPClient, dead client eviction in `getClient`
- **Per-file mutex**: `acquireFileLock` serializes concurrent `getDiagnostics` for same file
- **Multi-server**: `getDiagnosticsMulti` queries all matching servers, deduplicates by `(line, character, message)`
- **Remote tsconfig materialization**: `materializeConfig` reads marker files from remote FS, writes to local temp dir; handles recursive `extends` (depth limit 5)
- **Diagnostic settle window**: `waitForDiagnostics` waits 500ms after empty results before returning, preventing premature return when TS server publishes a clearing notification
- **EPIPE/stream handling**: `ERR_STREAM_DESTROYED` and `EPIPE` swallowed in process stdin writes during shutdown

### Test coverage

**Unit tests** (`packages/core`):
- `servers.test.ts` (44): walkUp, walkUpAsync, findProjectRoot, findProjectRootAsync, getServersForFile, per-server markers, command resolution, binary-not-found
- `manager.test.ts` (52): client creation, caching, per-file root, diagnostics, shutdown, error recovery, concurrent diagnostics, crash detection, per-file mutex, getDiagnosticsMulti, materializeConfig
- `language.test.ts` (17): language ID detection
- `helpers.test.ts` (25): getEditDiagnosticsText formatting, deduplication, truncation, path resolution (relative + absolute), timeout

**Integration tests** — all passing:
- Local (contained: true, contained: false, mounts): 100 tests
- S3 (composite + direct): 127 tests
- GCS (composite + direct): 125 tests
- Scenarios: basic diagnostics, per-file root resolution, large file (~500 lines), Python/Pyright, tsconfig strict settings

### Scenario support

| Scenario | Status |
|----------|--------|
| Local Sandbox + Local FS (contained: true) | Works, tested |
| Local Sandbox + Local FS (contained: false) | Works, tested |
| Local Sandbox + Mounts (local FS) | Works, tested |
| Local Sandbox + Remote FS (S3/GCS direct) | Works — walkUpAsync + materializeConfig, tested |
| Local Sandbox + Mounts (remote FS) | Works — same as remote FS, tested |
| Remote Sandbox + any FS | Not implemented |

---

## 1. Testable but not yet tested

These can be implemented with existing infrastructure — no new production code needed.

### Cross-file import diagnostics

Two TypeScript files where one imports from the other. Verify the TS server detects cross-file type errors (e.g. passing wrong argument type to an imported function). This validates that the TS server reads surrounding source files from disk, not just the file sent via protocol.

**Where**: new scenario in `_test-utils/src/integration/scenarios/lsp-cross-file.ts`

### Per-server marker isolation

Verify that `resolveRoot` for a `.ts` file in a directory containing only `pyproject.toml` does NOT resolve to that directory (falls through to default root). The unit tests verify markers are correct per-server and that walkUp finds the right ones, but don't test the end-to-end isolation when markers from different ecosystems coexist.

**Where**: `manager.test.ts`

### Local FS — contained: true with subdirectory basePath

Current tests use `basePath = tempDir` where `tempDir` is also the project root. Untested: `basePath` is a subdirectory of the project (e.g. `basePath = /project/src`), so walkUp from a file inside basePath finds the project root *above* basePath. Verifies that per-file root resolution correctly escapes the basePath boundary.

**Where**: new config in `_test-utils/src/index.test.ts`

### Local FS — contained: false with file in a different project

Current `contained: false` tests use files within the basePath project. Untested: a file that lives in a completely separate project directory. Verifies that walkUp resolves to that other project's root, not the workspace default.

**Where**: new scenario or config in `_test-utils/src/index.test.ts`

### Go integration test

Same graceful-skip pattern as Python/Pyright. When `gopls` is installed, verify diagnostics for a Go type error (e.g. `var x int = "hello"`). Write `go.mod` as the project marker.

**Where**: new scenario `lsp-go.ts`, same pattern as `lsp-python.ts`

### Rust integration test

Same pattern. When `rust-analyzer` is installed, verify diagnostics for a Rust type error. Write `Cargo.toml` as the project marker.

**Where**: new scenario `lsp-rust.ts`

### ESLint integration test

When `vscode-eslint-language-server` is available, verify it reports linting errors for a `.ts` file. Also serves as an integration test for `getDiagnosticsMulti` (TS + ESLint for the same file).

**Where**: new scenario `lsp-eslint.ts`, also tests `getDiagnosticsMulti` end-to-end

---

## 2. Needs consideration

### node_modules / type definition sync for remote FS

`materializeConfig` currently syncs only marker files (tsconfig.json, package.json, etc.) to the local temp dir. The TS server can read project config but can't resolve types from `node_modules` since those aren't synced. This means:
- Single-file type errors (wrong assignment, syntax) — **work**
- Errors involving library types (wrong React prop, missing argument) — **don't work on remote FS**

Options:
1. **Sync `node_modules/@types` + `.d.ts` files** — correct but potentially slow/large
2. **Sync on demand** — track what the TS server requests and materialize lazily
3. **Accept the limitation** — document that remote FS diagnostics are single-file only

### Materialization cache invalidation

The materialized temp dir is created once per `(serverDef, projectRoot)` and reused for the LSPManager's lifetime. If the remote tsconfig changes, the local copy goes stale. Options:
1. **TTL-based invalidation** — re-materialize after N minutes
2. **Watch for changes** — use filesystem change events if available
3. **Per-session** — current approach, stale until workspace is destroyed

### waitForDiagnostics settle tuning

The 500ms settle window was chosen empirically. Too short → still hits the race on slow machines. Too long → adds 500ms latency to every valid-code diagnostic check. Could be made configurable via `LSPConfig.settleMs`, or the settle could be smarter (e.g. only settle on the first call to a freshly initialized server).

---

## 3. Future work (not yet implemented)

### Remote sandbox support (E2B, Docker, etc.)

Currently broken for all scenarios involving a remote sandbox. The fundamental issues:

1. **Binary resolution runs on the host** — `command()` uses `existsSync` and `createRequire` on the host filesystem, producing host-local paths (e.g. `/Users/me/project/node_modules/.bin/typescript-language-server`) that don't exist inside the remote sandbox.

2. **Process spawning uses host paths** — `processManager.spawn(command, { cwd: root })` passes the host-resolved command and root to the remote sandbox, which can't find them.

3. **Server disk access** — even if spawning worked, the TS server runs inside the sandbox and can't read host filesystem files (tsconfig, node_modules, source).

**What needs to change:**
- Binary resolution must run inside the sandbox (check sandbox filesystem, not host)
- Command strings must use sandbox-local paths
- Project files must exist in the sandbox (pre-loaded image, or synced before LSP starts)
- Root resolution must use the sandbox's filesystem for walkup

**Approach**: Add a `SandboxLSPResolver` that runs walkup and binary checks inside the sandbox via process commands (e.g. `sandbox.exec('test -f /project/tsconfig.json')`), then constructs commands using sandbox-local paths.

### Cross-file intelligence for remote FS

Currently, remote FS diagnostics are single-file only — the TS server can't read imports from disk since only marker files are materialized. For full cross-file resolution:

1. **Source file sync** — materialize `.ts`/`.js` files from the remote FS to the local temp dir. Expensive for large projects.
2. **Incremental sync** — watch TS server's file-read requests and materialize on demand.
3. **Proxy filesystem** — mount the remote FS locally (FUSE-style) so the TS server reads through it transparently.

This is the most impactful improvement for remote FS users but also the highest complexity.

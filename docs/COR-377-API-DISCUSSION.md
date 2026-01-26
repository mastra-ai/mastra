# COR-377: API Surface Discussion Items

This document tracks workspace API surface items that need discussion before deciding whether to keep or remove them.

## Items Requiring Discussion

### 1. Lifecycle Methods: `pause()` / `resume()` / `keepAlive()`

**Current Status**: Implemented in workspace.ts

**Question**: Are these methods needed for the initial release?

**Considerations**:
- `pause()` and `resume()` are useful for cloud sandboxes that have billing implications
- `keepAlive()` is a no-op currently (just updates lastAccessedAt)
- May be premature without concrete cloud sandbox provider implementations

**Options**:
1. Keep - they're simple and may be useful for future providers
2. Remove - no current use case, can add when needed

---

### 2. State Getter: `state` + `WorkspaceState`

**Current Status**: Implemented, backed by FilesystemState

**Question**: Is the KV state abstraction valuable, or should users just use the filesystem directly?

**Considerations**:
- Provides structured JSON storage via `/.mastra/state/*.json` files
- Simple key-value interface (`get`, `set`, `delete`, `has`, `keys`, `clear`)
- May overlap with memory/storage in the broader Mastra ecosystem

**Options**:
1. Keep - useful for simple agent state persistence
2. Remove - let users manage their own state files

---

### 3. Search Index Methods: `indexMany()` / `unindex()` / `rebuildIndex()`

**Current Status**: Implemented in workspace.ts

**Question**: Should these be exposed on Workspace or only via SearchEngine directly?

**Considerations**:
- `index()` is kept as it's the primary indexing method
- `indexMany()` is batch optimization
- `unindex()` removes documents from index
- `rebuildIndex()` re-indexes all files from autoIndexPaths

**Options**:
1. Keep all - they're useful for managing the search index
2. Keep only `index()` - expose others only if needed
3. Make search engine accessible directly for advanced operations

---

### 4. Additional File Operations: `appendFile` / `copyFile` / `moveFile` / `rmdir` / `isDirectory`

**Current Status**: On WorkspaceFilesystem interface, not exposed on Workspace class

**Question**: Should Workspace expose these as convenience methods like `readFile`/`writeFile`?

**Considerations**:
- Currently users must access `workspace.filesystem.appendFile()` etc.
- Could add wrapper methods on Workspace for consistency
- Adds API surface area

**Options**:
1. Keep on filesystem only - Workspace exposes minimal core ops
2. Add Workspace wrappers - consistent experience
3. Remove from filesystem interface - not needed for MVP

---

### 5. Watch Interface Types: `WatchEvent`, `WatchCallback`, `WatchOptions`, `WatchHandle`

**Current Status**: On filesystem interface as optional `watch()` method

**Question**: Is watch functionality needed for initial release?

**Considerations**:
- Only LocalFilesystem would support it initially
- Useful for reactive workflows
- Adds complexity

**Options**:
1. Keep - useful for advanced use cases
2. Remove - can add when there's demand

---

### 6. Scope Types: `WorkspaceScope` / `WorkspaceOwner`

**Current Status**: Types defined but not actively used

**Question**: Are these types needed now, or should we add them when implementing multi-tenant workspaces?

**Considerations**:
- Defines global/agent/thread scoping for workspaces
- Part of the multi-tenancy story
- Currently no implementation uses them

**Options**:
1. Keep - documents the intended scoping model
2. Remove - add when implementing multi-tenant workspaces

---

## Completed Removals (COR-377)

The following were removed as "easy removals":

### Workspace Class
- `snapshot()` / `restore()` / `SnapshotOptions` / `WorkspaceSnapshot` / `RestoreOptions`
- `syncToSandbox()` / `syncFromSandbox()` / `SyncResult`

### Sandbox Interface
- `installPackage()` / `installPackages()` / `InstallPackageOptions` / `InstallPackageResult`
- `syncFromFilesystem()` / `syncToFilesystem()` / `SandboxSyncResult`
- Internal FS methods: `writeFile()` / `readFile()` / `listFiles()` / `getFilesystem()`

### Filesystem Interface
- `WorkspaceFilesystemAudit` / `FilesystemAuditEntry` / `FilesystemAuditOptions`

### Tools
- `workspace_install_package` tool

### Types
- `WorkspaceScope` / `WorkspaceOwner` (unused scoping types)

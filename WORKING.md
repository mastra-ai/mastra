# Working Document - E2B, S3, and Mounts PR

This document tracks implementation progress for review.

---

## Task List

| # | Task | Ticket | Status | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Fix readOnly enforcement in CompositeFilesystem and S3Filesystem | COR-385, COR-484 | **Done** | `composite-filesystem.ts` |
| 2 | Extract startPromise pattern to MastraSandbox base class | COR-380 | **Done** | `mastra-sandbox.ts` |
| 3 | Add processPending() call in base class start() | COR-380 | **Done** | `mastra-sandbox.ts` |
| 4 | Add status management wrappers to base classes | COR-380 | **Done** | `mastra-sandbox.ts`, `e2b-sandbox.ts` |
| 5 | Update S3Filesystem status on lifecycle methods | COR-484 | **Done** | `s3-filesystem.ts` |
| 6 | Clean up E2B sandbox comments | COR-380 | **Done** | `e2b-sandbox.ts` |
| 7 | S3Filesystem lazy init pattern (`ensureReady()`) | COR-484 | **Done** | `s3-filesystem.ts` |
| 8 | Extract ensureSandbox/lazy init to MastraSandbox base class | COR-380 | **Done** | `mastra-sandbox.ts`, `e2b-sandbox.ts` |
| 9 | Mount Manager extraction (marker file helpers) | COR-380, COR-385 | **Done** | `mount-manager.ts`, `e2b-sandbox.ts` |
| 10 | Implement pathContext with mounts (agent instructions, mount awareness) | COR-385, COR-491 | Pending | `workspace.ts`, `composite-filesystem.ts` |
| 11 | General cleanup checklist (imports, error handling, hardcoded values, logging) | COR-380 | Pending | Multiple files |
| 12 | Create shared test suite with factory patterns | COR-385 | Pending | (see stores/server-adapters pattern) |
| 13 | Manual testing (E2B + S3/GCS mounts, readOnly, reconnection, GCS compatibility) | COR-380, COR-385, COR-484 | Pending | |

---

## Task 1: Fix readOnly Enforcement

### Problem
CompositeFilesystem routes write operations to underlying filesystems without checking their `readOnly` property. This could allow agents to accidentally write to read-only mounts.

### Solution
Add `assertWritable()` helper method that throws `PermissionError` before any write operation on a read-only filesystem.

### Changes Made

#### `packages/core/src/workspace/filesystem/composite-filesystem.ts`

**1. Added import for PermissionError:**
```typescript
import { PermissionError } from '../errors';
```

**2. Added assertWritable() helper method:**
```typescript
/**
 * Assert that a filesystem is writable (not read-only).
 * @throws {PermissionError} if the filesystem is read-only
 */
private assertWritable(fs: WorkspaceFilesystem, path: string, operation: string): void {
  if (fs.readOnly) {
    throw new PermissionError(path, `${operation} (filesystem is read-only)`);
  }
}
```

**3. Added readOnly checks to write operations:**
- [x] `writeFile` - check destination filesystem
- [x] `appendFile` - check destination filesystem
- [x] `deleteFile` - check target filesystem
- [x] `copyFile` - check destination filesystem
- [x] `moveFile` - check destination filesystem AND source filesystem (for delete)
- [x] `mkdir` - check target filesystem
- [x] `rmdir` - check target filesystem

### S3 FUSE Mount (Already Working)
The S3 FUSE mount in `workspaces/e2b/src/mounts/s3.ts` already handles `readOnly` correctly:
```typescript
if (config.readOnly) {
  mountOptions.push('ro');
  logger.debug(`${LOG_PREFIX} Mounting as read-only`);
}
```

---

## Task 2: Extract startPromise Pattern to Base Class

### Problem
E2BSandbox has a race-condition-safe `start()` pattern using `_startPromise`. Other sandbox providers would benefit from this.

### Solution
Move the pattern to `MastraSandbox` base class with an abstract `_doStart()` method.

### Changes Made

#### `packages/core/src/workspace/sandbox/mastra-sandbox.ts`
- Added `_startPromise`, `_stopPromise`, `_destroyPromise` protected properties
- Implemented `start()`, `stop()`, `destroy()` with race-condition-safe wrappers
- Added `_doStart()`, `_doStop()`, `_doDestroy()` protected methods for subclasses to override
- Updated JSDoc with lifecycle management documentation

#### `workspaces/e2b/src/e2b-sandbox.ts`
- Changed `private _status` to `status: ProviderStatus = 'pending'` (direct property)
- Removed `get status()` getter
- Removed `_startPromise` (now in base class)
- Changed `_doStart()` from private to `protected override`
- Changed `stop()` to `protected override _doStop()`
- Changed `destroy()` to `protected override _doDestroy()`
- Removed manual status management (base class handles it)
- Removed `mounts.processPending()` calls (base class handles it)
- Updated `isReady()`, `getInfo()`, `handleSandboxTimeout()` to use `this.status`

---

## Task 3: Add processPending() in Base Class start()

### Problem
Each sandbox must remember to call `this.mounts.processPending()` after starting.

### Solution
Base class `start()` wrapper automatically calls `this.mounts?.processPending()` after `_doStart()`.

### Changes Made
Included in Task 2 changes - the `_executeStart()` method calls `await this.mounts?.processPending()` after successful `_doStart()`.

---

## Task 4: Add Status Management Wrappers

### Problem
Each provider manually manages status transitions, which is error-prone.

### Solution
Base class wrappers handle status: `starting`→`running`, `stopping`→`stopped`, `destroying`→`destroyed`.

### Changes Made
Included in Task 2 changes:
- `_executeStart()`: Sets `'starting'` before, `'running'` after success, `'error'` on failure
- `_executeStop()`: Sets `'stopping'` before, `'stopped'` after success, `'error'` on failure
- `_executeDestroy()`: Sets `'destroying'` before, `'destroyed'` after success, `'error'` on failure

**Note**: MastraFilesystem base class was NOT updated - filesystems typically don't need the same lifecycle management as sandboxes. Can add later if needed.

---

## Task 5: Update S3Filesystem Status on Lifecycle

### Problem
S3Filesystem sets `status = 'ready'` in property declaration and never updates it.

### Solution
Align with ProviderStatus: `pending` → `initializing` → `ready`, and `destroying` → `destroyed`.

### Changes Made

#### `workspaces/s3/src/s3-filesystem.ts`
- Changed initial status from `'ready'` to `'pending'`
- Updated `init()`: Sets `'initializing'` → `'ready'` (or `'error'` on failure)
- Updated `destroy()`: Sets `'destroying'` → `'destroyed'`

---

## Task 6: Clean Up E2B Sandbox Comments

### Problem
Some comments may be outdated after refactoring.

### Solution
Review and update JSDoc, remove outdated TODOs, ensure consistency.

### Changes Made

#### `workspaces/e2b/src/e2b-sandbox.ts`
- Added JSDoc to `isReady()` method
- Added JSDoc to `getInfo()` method
- Added JSDoc to `ensureSandbox()` method
- Added JSDoc to `handleSandboxTimeout()` method
- Added JSDoc to `executeCommand()` method
- Updated existing JSDoc for `isSandboxDeadError()` (minor formatting)

**Note**: The file was already well-documented. Changes focused on adding missing JSDoc for completeness.

---

## Task 7: S3Filesystem Lazy Init Pattern

### Problem
S3Filesystem's `getClient()` lazily creates the S3Client but doesn't update status. If `init()` is never called, status remains `'pending'` even when the filesystem is being used.

### Solution
Add `ensureReady()` method that calls `init()` if status is pending.

### Changes Made

#### `workspaces/s3/src/s3-filesystem.ts`
- Added `ensureReady()` method:
```typescript
private async ensureReady(): Promise<S3Client> {
  if (this.status === 'pending') {
    await this.init();
  }
  return this.getClient();
}
```
- Updated all file operations to use `ensureReady()` instead of `getClient()`:
  - `readFile`, `writeFile`, `deleteFile`, `copyFile`
  - `rmdir`, `readdir`
  - `exists`, `stat`, `isFile`, `isDirectory`

Now if someone uses the filesystem without calling `init()`, the first operation will automatically initialize it with proper status transitions (`pending` → `initializing` → `ready`).

---

## Task 8: Extract ensureSandbox to Base Class

### Problem
E2BSandbox has `ensureSandbox()` pattern that lazily starts the sandbox. Other sandbox providers would benefit from this.

### Solution
Add to MastraSandbox base class:
- `protected async ensureRunning(): Promise<void>` that calls `start()` if not running
- Throws `SandboxNotReadyError` if status isn't 'running' after start()
- Subclasses can use this in their typed instance getters

### Changes Made

#### `packages/core/src/workspace/sandbox/mastra-sandbox.ts`
- Added import for `SandboxNotReadyError`
- Added `ensureRunning()` protected method:
```typescript
/**
 * Ensure the sandbox is running.
 * Calls `start()` if status is not 'running'.
 * @throws {SandboxNotReadyError} if the sandbox fails to reach 'running' status
 */
protected async ensureRunning(): Promise<void> {
  if (this.status !== 'running') {
    await this.start();
  }
  if (this.status !== 'running') {
    throw new SandboxNotReadyError(this.id);
  }
}
```

#### `workspaces/e2b/src/e2b-sandbox.ts`
- Simplified `ensureSandbox()` to use base class method:
```typescript
private async ensureSandbox(): Promise<Sandbox> {
  await this.ensureRunning();
  return this._sandbox!;
}
```

---

## Task 9: Mount Manager Extraction

### Problem
E2B's `mount()` has marker file logic for reconnection detection. Some of this can be moved to MountManager.

### Solution
Extract pure functions (no sandbox execution required) to MountManager:
- `markerFilename()` - generates marker filename from mount path hash
- `getMarkerContent()` - generates marker content string (`path|configHash`)
- `parseMarkerContent()` - parses marker content back to components
- `isConfigMatching()` - checks if stored hash matches expected

Keep sandbox-specific operations in E2BSandbox:
- Actual file I/O (`writeMarkerFile`, reading markers)
- Mount point detection (`checkExistingMount`)
- Stale mount cleanup (`reconcileMounts`)
- These require sandbox commands/file APIs

### Changes Made

#### `packages/core/src/workspace/sandbox/mount-manager.ts`
Added marker file helpers:
```typescript
markerFilename(mountPath: string): string
getMarkerContent(mountPath: string): string | null
parseMarkerContent(content: string): { path: string; configHash: string } | null
isConfigMatching(mountPath: string, storedHash: string): boolean
```

#### `workspaces/e2b/src/e2b-sandbox.ts`
- Removed duplicate `markerFilename()` method
- Updated `writeMarkerFile()` to use `this.mounts.getMarkerContent()` and `this.mounts.markerFilename()`
- Updated `unmount()` to use `this.mounts.markerFilename()`
- Updated `reconcileMounts()` to use `this.mounts.markerFilename()` and `this.mounts.parseMarkerContent()`
- Updated `checkExistingMount()` to use `this.mounts.markerFilename()`, `this.mounts.parseMarkerContent()`, and `this.mounts.isConfigMatching()`

---

## Task 10: Implement pathContext with Mounts

### Problem
Agents need to be aware of mounted filesystems for better path handling and understanding what storage is available.

### Current State
**PathContext** (`workspace.ts`):
```typescript
interface PathContext {
  filesystem?: { provider: string; basePath?: string };
  sandbox?: { provider: string; workingDirectory?: string };
  instructions: string;  // Combined from providers' getInstructions()
}
```

### Implementation Plan

1. **Add `mounts` to PathContext:**
```typescript
interface PathContext {
  // ... existing fields ...
  mounts?: Array<{
    path: string;          // e.g., "/data"
    provider: string;      // e.g., "s3"
    icon?: FilesystemIcon;
    displayName?: string;  // e.g., "AWS S3"
    description?: string;  // e.g., "Persistent storage for outputs"
    readOnly?: boolean;
  }>;
}
```

2. **Implement CompositeFilesystem.getInstructions():**
```typescript
getInstructions(): string {
  const mountInfo = Array.from(this._mounts.entries())
    .map(([path, fs]) => {
      const ro = fs.readOnly ? ' (read-only)' : '';
      return `- ${path}: ${fs.displayName || fs.provider}${ro}`;
    })
    .join('\n');
  return `Mounted filesystems:\n${mountInfo}`;
}
```

3. **Update `getPathContext()` in workspace.ts** to include mount information

4. **Consider adding mount info to filesystem tool descriptions**

### Changes Planned
- `packages/core/src/workspace/workspace.ts` - Update PathContext interface, getPathContext()
- `packages/core/src/workspace/filesystem/composite-filesystem.ts` - Add getInstructions()

---

## Task 11: General Cleanup Checklist

### Items to Check
- [ ] Unused imports in modified files
- [ ] Error handling consistency across files
- [ ] Hardcoded values that should be configurable
- [ ] Logging consistency (all use appropriate LOG_PREFIX)
- [ ] JSDoc completeness on public methods

### Files to Review
- `packages/core/src/workspace/sandbox/mastra-sandbox.ts`
- `packages/core/src/workspace/filesystem/composite-filesystem.ts`
- `workspaces/e2b/src/e2b-sandbox.ts`
- `workspaces/s3/src/s3-filesystem.ts`

---

## Task 12: Create Shared Test Suite

### Problem
No shared tests ensure consistent behavior across filesystem providers.

### Solution
Create shared test suite similar to the patterns used in `stores/` or `server-adapters/` directories.

### TODO
- [ ] Review `stores/` test patterns
- [ ] Review `server-adapters/` test patterns
- [ ] Create filesystem test suite following same conventions
- [ ] Apply to LocalFilesystem, S3Filesystem, CompositeFilesystem

---

## Task 13: Manual Testing

### Purpose
Verify end-to-end functionality of the E2B + S3/GCS mount integration before release.

### Test Scenarios

#### E2B + S3 Mount
- [ ] Create workspace with S3Filesystem mounted at `/data`
- [ ] Write file via `workspace_write_file('/data/test.txt', 'content')`
- [ ] Read same file via `workspace_execute_command('cat /data/test.txt')`
- [ ] Verify file appears in S3 bucket
- [ ] Test `readdir('/data')` returns S3 bucket contents

#### readOnly Enforcement
- [ ] Mount S3Filesystem with `readOnly: true`
- [ ] Verify `workspace_write_file` throws PermissionError
- [ ] Verify FUSE mount has `-o ro` flag (check via `mount` command in sandbox)
- [ ] Verify read operations still work

#### Sandbox Reconnection
- [ ] Create workspace, write files, let sandbox pause
- [ ] Reconnect to same sandbox (via `mastra-sandbox-id` metadata)
- [ ] Verify mounts are still accessible
- [ ] Verify marker file detection works (no remount if config unchanged)

#### Multi-Mount Setup
- [ ] Mount multiple filesystems at different paths (`/data`, `/models`, etc.)
- [ ] Verify path routing works correctly
- [ ] Test cross-mount operations (copy from one mount to another)

#### Error Handling
- [ ] Test with invalid S3 credentials
- [ ] Test with non-existent bucket
- [ ] Test mount failure recovery

#### GCS Compatibility (via S3Filesystem)
- [ ] Create HMAC credentials in GCP Console
- [ ] Test S3Filesystem with GCS endpoint (`https://storage.googleapis.com`)
- [ ] Test `readFile()` on existing GCS file
- [ ] Test `writeFile()` with new file
- [ ] Test `readdir()` on bucket/prefix
- [ ] Test `deleteFile()`
- [ ] Document any compatibility issues

#### GCS Native Mount (gcsfuse in E2B)
- [ ] Test with service account credentials
- [ ] Test public bucket access (read-only)
- [ ] Verify mount appears in sandbox at correct path
- [ ] Test file operations through FUSE mount

### Environment Setup
```bash
# Required environment variables
E2B_API_KEY=<your-e2b-api-key>

# For S3
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
S3_TEST_BUCKET=<your-test-bucket>

# For GCS (S3-compatible)
GCS_HMAC_ACCESS_KEY=<your-hmac-access-key>
GCS_HMAC_SECRET_KEY=<your-hmac-secret-key>
GCS_TEST_BUCKET=<your-gcs-test-bucket>

# For GCS (native gcsfuse)
GCS_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

---

## Review Checklist

- [x] Task 1: readOnly enforcement
- [x] Task 2: startPromise extraction
- [x] Task 3: processPending in base
- [x] Task 4: Status management
- [x] Task 5: S3Filesystem status
- [x] Task 6: E2B comments cleanup
- [x] Task 7: S3Filesystem lazy init
- [x] Task 8: ensureSandbox extraction
- [x] Task 9: Mount Manager extraction
- [ ] Task 10: pathContext implementation
- [ ] Task 11: General cleanup
- [ ] Task 12: Shared test suite
- [ ] Task 13: Manual testing (incl. GCS compatibility)

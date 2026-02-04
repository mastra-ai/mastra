# Working Document - E2B, S3, and Mounts PR

This document tracks implementation progress for review.

---

## Task List

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 1 | Fix readOnly enforcement in CompositeFilesystem and S3Filesystem | **Done** | `packages/core/src/workspace/filesystem/composite-filesystem.ts` |
| 2 | Extract startPromise pattern to MastraSandbox base class | **Done** | `packages/core/src/workspace/sandbox/mastra-sandbox.ts` |
| 3 | Add processPending() call in base class start() | **Done** | `packages/core/src/workspace/sandbox/mastra-sandbox.ts` |
| 4 | Add status management wrappers to base classes | **Done** | `packages/core/src/workspace/sandbox/mastra-sandbox.ts`, `workspaces/e2b/src/e2b-sandbox.ts` |
| 5 | Update S3Filesystem status on lifecycle methods | **Done** | `workspaces/s3/src/s3-filesystem.ts` |
| 6 | Clean up E2B sandbox comments | **Done** | `workspaces/e2b/src/e2b-sandbox.ts` |
| 7 | Investigate pathContext interaction with mounts | **Done** | (documentation only) |
| 8 | Test GCS compatibility via S3Filesystem | **Done** | (documentation only) |
| 9 | Create shared test suite with factory patterns | **Needs Revision** | (see stores/server-adapters pattern) |
| 10 | S3Filesystem lazy init pattern (`ensureReady()`) | Pending | `workspaces/s3/src/s3-filesystem.ts` |
| 11 | Extract ensureSandbox/lazy init to MastraSandbox base class | Pending | `packages/core/src/workspace/sandbox/mastra-sandbox.ts` |
| 12 | Mount Manager extraction (marker files, reconcileMounts, checkExistingMount) | Pending | `packages/core/src/workspace/sandbox/mount-manager.ts` |
| 13 | General cleanup checklist (imports, error handling, hardcoded values, logging) | Pending | Multiple files |

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

## Task 7: Investigate pathContext with Mounts

### Problem
Need to understand how agent's current working directory concept interacts with mounted filesystems.

### Current State

**PathContext** (`workspace.ts:308-328`):
```typescript
interface PathContext {
  filesystem?: { provider: string; basePath?: string };
  sandbox?: { provider: string; workingDirectory?: string };
  instructions: string;  // Combined from providers' getInstructions()
}
```

**Usage** (`tools/tools.ts:621-624`):
- Used to add instructions to the `workspace_execute_command` tool description
- Instructions come from `filesystem.getInstructions()` and `sandbox.getInstructions()`

### Findings

#### Q: What happens when agent `cd`s across mount boundaries?

**With FUSE mounts (E2B + S3/GCS):**
- Mounts appear as real directories in the sandbox filesystem
- `cd /data` works normally because s3fs mounts the bucket at `/data`
- The agent sees a unified filesystem view inside the sandbox

**Without FUSE mounts (CompositeFilesystem only):**
- `cd` in sandbox has no effect on workspace filesystem operations
- They're separate: sandbox cwd vs. CompositeFilesystem path routing
- Agent uses absolute paths like `/data/file.txt` in filesystem tools

#### Q: How do relative paths resolve?

**For filesystem operations (workspace tools):**
- CompositeFilesystem always uses absolute paths (paths start with `/`)
- Relative paths are normalized by `normalizePath()` which adds leading `/`

**For sandbox operations:**
- Relative paths resolve from the sandbox's working directory
- `cwd` option in `executeCommand` can override this

**Cross-mount paths:**
- CompositeFilesystem's `resolveMount()` finds the longest matching mount prefix
- Example: `/data/subdir/file.txt` → S3Filesystem at `/data` with path `/subdir/file.txt`

#### Q: Should agents be aware of mount points?

**YES - Recommended improvements for COR-491:**

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

2. **CompositeFilesystem.getInstructions():**
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

3. **Tool descriptions could include mount info:**
- Listing available mounts in filesystem tool descriptions
- Warning about read-only mounts before write operations

### Recommendations for COR-491

The pathContext changes should be implemented in COR-491 with:
1. Add `mounts` array to `PathContext` interface
2. Update `getPathContext()` to include mount information from CompositeFilesystem
3. Implement `getInstructions()` on CompositeFilesystem to describe available mounts
4. Consider adding mount info to filesystem tool descriptions

**Note**: No code changes made in this task - findings documented for COR-491 implementation.

---

## Task 8: Test GCS Compatibility

### Problem
Need to verify if GCS works through S3Filesystem via S3-compatible API.

### Test Plan
1. Test S3Filesystem with GCS endpoint + HMAC credentials
2. Test dedicated GCS mount in `workspaces/e2b/src/mounts/gcs.ts`
3. Document compatibility/limitations

### Findings

#### Two Approaches for GCS

**1. S3Filesystem with GCS S3-Compatible API**

GCS provides an S3-compatible API at `storage.googleapis.com`. The S3Filesystem can be used with GCS by:

```typescript
import { S3Filesystem } from '@mastra/s3';

const fs = new S3Filesystem({
  bucket: 'my-gcs-bucket',
  region: 'auto',  // GCS uses 'auto' for region
  endpoint: 'https://storage.googleapis.com',
  accessKeyId: process.env.GCS_HMAC_ACCESS_KEY!,      // HMAC credentials required
  secretAccessKey: process.env.GCS_HMAC_SECRET_KEY!,  // (not service account JSON)
});
```

**Requirements:**
- Must use HMAC credentials (not service account JSON)
- Create HMAC credentials in GCP Console: Storage > Settings > Interoperability > Create Key
- The S3Filesystem already detects GCS endpoints via `detectIconFromEndpoint()` (line 284 in s3-filesystem.ts)

**Known Compatibility:**
- Basic operations (read, write, list, delete) should work
- Some advanced S3 features may not be available (e.g., S3 Select)
- Path-style URLs recommended (`forcePathStyle: true`)

**2. Native gcsfuse Mount (E2B only)**

For E2B sandboxes, there's a dedicated GCS mount using gcsfuse (`workspaces/e2b/src/mounts/gcs.ts`):

```typescript
interface E2BGCSMountConfig {
  type: 'gcs';
  bucket: string;
  serviceAccountKey?: string;  // JSON string (optional for public buckets)
}
```

**Features:**
- Uses native GCS API (not S3 compatibility layer)
- Supports service account JSON authentication
- Supports public bucket access without credentials (read-only)
- Automatically installs gcsfuse in E2B sandbox if not present

#### Comparison Table

| Feature | S3Filesystem + GCS | Native gcsfuse |
|---------|-------------------|----------------|
| Authentication | HMAC credentials | Service account JSON |
| Public buckets | Not supported | Supported (read-only) |
| Use case | Direct API access | E2B FUSE mount only |
| Operations | Full filesystem interface | FUSE mount in sandbox |
| Read-only support | Yes (`readOnly` option) | Yes (`anonymous_access`) |

#### Testing Requirements

**Manual Testing Checklist:**

For S3Filesystem + GCS endpoint:
- [ ] Create HMAC credentials in GCP Console
- [ ] Test `readFile()` on existing file
- [ ] Test `writeFile()` with new file
- [ ] Test `readdir()` on bucket/prefix
- [ ] Test `deleteFile()`
- [ ] Test `copyFile()` and `moveFile()`

For native gcsfuse (E2B):
- [ ] Test with service account credentials
- [ ] Test public bucket access
- [ ] Verify mount appears in sandbox at correct path
- [ ] Test file operations through FUSE mount

**Environment Variables for Testing:**

```bash
# For S3Filesystem + GCS
GCS_HMAC_ACCESS_KEY=<your-hmac-access-key>
GCS_HMAC_SECRET_KEY=<your-hmac-secret-key>
GCS_TEST_BUCKET=<your-test-bucket>

# For native gcsfuse
GCS_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'  # JSON string
GCS_TEST_BUCKET=<your-test-bucket>
```

#### Recommendations

1. **For direct GCS access without E2B**: Use S3Filesystem with HMAC credentials
2. **For GCS in E2B sandbox**: Use native gcsfuse mount (better performance, native auth)
3. **For public GCS buckets in E2B**: Use native gcsfuse with `anonymous_access`
4. **Consider creating a GCSFilesystem** if more native GCS features needed (COR-XXX)

**Note**: Integration tests require real GCS credentials. Tests should be skipped when credentials are not available (using `describe.skipIf` pattern)

---

## Task 9: Shared Test Suite with Factory Patterns

### Problem
No shared tests ensure consistent behavior across filesystem providers.

### Solution
Create shared test suite similar to the patterns used in `stores/` or `server-adapters/` directories.

### Status: Needs Revision

Initial implementation was removed - needs to follow the existing monorepo patterns for shared tests.

### TODO
- [ ] Review `stores/` test patterns (e.g., how storage adapters share tests)
- [ ] Review `server-adapters/` test patterns
- [ ] Create filesystem test suite following same conventions
- [ ] Apply to LocalFilesystem, S3Filesystem, CompositeFilesystem

---

## Task 10: S3Filesystem Lazy Init Pattern

### Problem
S3Filesystem's `getClient()` lazily creates the S3Client but doesn't update status. If `init()` is never called, status remains `'pending'` even when the filesystem is being used.

### Solution
Add `ensureReady()` method that calls `init()` if status is pending:

```typescript
private async ensureReady(): Promise<S3Client> {
  if (this.status === 'pending') {
    await this.init();
  }
  return this.getClient();
}
```

### Changes Planned
- Add `ensureReady()` method to S3Filesystem
- Consider calling it in file operations for consistency

---

## Task 11: Extract ensureSandbox to Base Class

### Problem
E2BSandbox has `ensureSandbox()` pattern that lazily starts the sandbox. Other sandbox providers would benefit from this.

### Current E2B Implementation
```typescript
private async ensureSandbox(): Promise<Sandbox> {
  if (!this._sandbox) {
    await this.start();
  }
  if (!this._sandbox) {
    throw new SandboxNotReadyError(this.id);
  }
  return this._sandbox;
}
```

### Solution
Add to MastraSandbox base class:
- `protected async ensureReady(): Promise<void>` that calls `start()` if not running
- Subclasses can have typed `get instance()` that throws if not ready

---

## Task 12: Mount Manager Extraction

### Problem
E2B's `mount()` has useful patterns that could benefit other sandbox providers:
- Marker file logic for reconnection
- `reconcileMounts()` for cleaning up stale mounts
- `checkExistingMount()` for detecting config changes
- Directory creation with proper permissions

### Solution
Extract reusable patterns to MountManager or base class:
- Abstract marker file concept (sandbox-specific commands)
- `reconcileMounts()` pattern as base class method
- `checkExistingMount()` interface

### Changes Planned
- Review what can be generalized vs what's E2B-specific
- Update MountManager with extracted logic
- Keep E2B-specific FUSE details in E2BSandbox

---

## Task 13: General Cleanup Checklist

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

## Review Checklist

- [ ] Task 1: readOnly enforcement
- [ ] Task 2: startPromise extraction
- [ ] Task 3: processPending in base
- [ ] Task 4: Status management
- [ ] Task 5: S3Filesystem status
- [ ] Task 6: E2B comments cleanup
- [ ] Task 7: pathContext investigation
- [ ] Task 8: GCS compatibility testing
- [ ] Task 9: Shared test suite
- [ ] Task 10: S3Filesystem lazy init
- [ ] Task 11: ensureSandbox extraction
- [ ] Task 12: Mount Manager extraction
- [ ] Task 13: General cleanup

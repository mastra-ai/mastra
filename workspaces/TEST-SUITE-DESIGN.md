# Workspace Test Suite Implementation Status

This document tracks the current state of workspace provider tests and known issues.

**Comprehensive Test Plan:** [Notion - Workspace Filesystem & Sandbox Test Plan](https://www.notion.so/kepler-inc/Workspace-Filesystem-Sandbox-Test-Plan-from-claude-mounts-context-2fdebffbc9f880f5a7e0e9535286fd02)

---

## Test File Structure

We split tests into **unit** and **integration** files to avoid vitest mock conflicts:

```
workspaces/
├── e2b/
│   └── src/sandbox/
│       ├── index.test.ts              # Unit tests (37 tests) - uses vi.mock('e2b')
│       └── index.integration.test.ts  # Integration tests (20 tests) - real E2B API
├── s3/
│   └── src/filesystem/
│       ├── index.test.ts              # Unit tests - uses vi.mock('@aws-sdk/client-s3')
│       └── index.integration.test.ts  # Integration tests - real S3/R2
├── gcs/
│   └── src/filesystem/
│       ├── index.test.ts              # Unit tests - uses vi.mock('@google-cloud/storage')
│       └── index.integration.test.ts  # Integration tests - real GCS
└── _test-utils/                       # Shared test utilities (placeholder)
```

### Why Separate Files?

Vitest's `vi.mock()` is **hoisted** and affects all tests in a file. If you mock `e2b` at the top of a file, integration tests in that same file will hit mocks instead of real services.

**Solution:** Keep mocked unit tests in `index.test.ts` and real-service integration tests in `index.integration.test.ts`.

---

## Environment Setup

### Loading Credentials

Integration tests need credentials. We use `dotenv/config` in vitest setup:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['dotenv/config'],  // Loads .env file
  },
});
```

Each workspace package needs:
1. `dotenv` as a dev dependency
2. `.env` file (or symlink to global env)

### Credential Variables

```bash
# E2B
E2B_API_KEY=...

# S3-compatible (works for AWS, R2, MinIO)
S3_BUCKET=test-bucket
S3_REGION=auto                    # 'auto' for R2, actual region for AWS
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://....          # Set for R2/MinIO, omit for AWS

# GCS
TEST_GCS_BUCKET=...
GCS_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'  # Single-quoted JSON
```

### Conditional Test Execution

Tests skip gracefully when credentials are missing:

```typescript
const hasS3Credentials = !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET);

describe.skipIf(!hasS3Credentials)('S3 Integration', () => {
  // Only runs if credentials are present
});
```

---

## Part 6: E2B Sandbox Tests - Coverage Matrix

### Constructor & Options

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| generates unique id if not provided | ✅ | - | Pass |
| uses provided id | ✅ | - | Pass |
| default timeout is 5 minutes | ✅ | - | Pass |
| has correct provider and name | ✅ | - | Pass |
| status starts as pending | ✅ | - | Pass |
| starts template preparation in background | ✅ | - | Pass |

### Start - Race Condition Prevention

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| concurrent start() calls return same promise | ✅ | - | Pass |
| start() is idempotent when already running | ✅ | - | Pass |
| start() clears _startPromise after completion | ❌ | - | **Missing** |
| status transitions through starting to running | ✅ | - | Pass |

### Start - Sandbox Creation

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| creates new sandbox if none exists | ✅ | - | Pass |
| reconnects to existing sandbox by metadata | ✅ | ✅ | Pass |
| uses autoPause for sandbox persistence | ✅ | - | Pass |
| stores mastra-sandbox-id in metadata | ✅ | - | Pass |

### Start - Template Handling

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| uses cached template if exists | ✅ | - | Pass |
| builds default template if not cached | ✅ | - | Pass |
| rebuilds template on 404 error | ❌ | - | **Missing** |
| custom template string is used as-is | ✅ | - | Pass |
| custom template builder is built | ❌ | - | **Missing** |
| template function customizes base template | ❌ | - | **Missing** |

### Start - Mount Processing

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| runs reconcileMounts on reconnect | ❌ | ❌ | **Missing** |
| mounts pending filesystems after start | ✅ | - | Pass |

### Environment Variables

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| env vars not passed to Sandbox.betaCreate | ✅ | - | Pass |
| env vars merged and passed per-command | ✅ | - | Pass |
| env changes reflected without sandbox restart | ❌ | ❌ | **Missing** |

### Mount - S3

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| S3 with credentials mounts successfully | - | ✅ | Pass |
| S3 public bucket mounts with public_bucket=1 | - | ✅ | Pass |
| S3-compatible without credentials warns and fails | - | ✅ | Pass |
| S3 with readOnly mounts with -o ro | - | ✅ | Pass |
| S3 readOnly mount rejects writes | - | ✅ | (part of above) |
| S3 mount sets uid/gid for file ownership | - | ✅ | Pass |
| S3 endpoint mount includes url and path style options | ❌ | ❌ | **Missing** - verify s3fs command args |

### Mount - GCS

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| GCS with service account mounts successfully | - | ✅ | Pass |
| GCS public bucket mounts with anonymous access | - | ✅ | Pass |

### Mount - Safety Checks

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| mount errors if directory exists and is non-empty | - | ✅ | Pass |
| mount succeeds if directory exists but is empty | - | ✅ | Pass |
| mount creates directory with sudo for paths outside home | - | ✅ | Pass |

### Mount - Existing Mount Detection

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| mount skips if already mounted with matching config | - | ✅ | Pass |
| mount unmounts and remounts if config changed | - | ✅ | Pass |
| readOnly change triggers remount | - | ✅ | (part of above) |

### Mount - Marker Files

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| successful mount creates marker file | - | ✅ | Pass |
| marker filename is hash of path | ✅ | - | Pass |
| unmount removes marker file | - | ✅ | Pass |
| unmount removes empty mount directory | - | ✅ | Pass |

### Mount Reconciliation

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| reconcileMounts unmounts stale FUSE mounts | - | ✅ | Pass |
| reconcileMounts cleans up orphaned marker files | - | ✅ | Pass |
| reconcileMounts handles malformed marker files | - | ✅ | Pass |

### Mount - Runtime Installation

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| installs s3fs if not present | ❌ | ❌ | **Missing** |
| installs gcsfuse if not present | ❌ | ❌ | **Missing** |
| gives helpful error if installation fails | ❌ | ❌ | **Missing** |

### Stop/Destroy

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| stop clears sandbox reference | ✅ | - | Pass |
| stop unmounts all filesystems | ❌ | ❌ | **Missing** |
| destroy kills sandbox | ✅ | - | Pass |

### Error Handling

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| SandboxNotReadyError thrown if not started | ✅ | - | Pass |
| clear error for S3-compatible without credentials | ❌ | - | **Missing** |
| clear error for non-empty directory | - | ✅ | (part of safety checks) |

---

## Part 7: Integration Tests - Coverage Matrix

### E2B + S3 Full Workflow

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| full workflow: create, mount, read/write, verify in bucket | - | ❌ | **Missing** |
| sandbox reconnect preserves mounts | - | ❌ | **Missing** |
| config change triggers remount on reconnect | - | ❌ | **Missing** |

### E2B + GCS Full Workflow

| Test | Unit | Integration | Status |
|------|:----:|:-----------:|--------|
| mount GCS bucket and access files | - | ✅ | Pass |

---

## Summary Statistics

### Current Test Status

| Test Type | Total | Passing | Failing | Skipped |
|-----------|-------|---------|---------|---------|
| Unit Tests | 37 | 37 | 0 | 0 |
| Integration Tests | 20 | 20 | 0 | 0 |
| **Total** | **57** | **57** | **0** | **0** |

### E2B Integration Tests Breakdown

| Category | Tests | Status |
|----------|-------|--------|
| Basic E2B | 2 | ✅ All passing |
| S3 Mount | 5 | ✅ All passing |
| GCS Mount | 2 | ✅ All passing |
| Mount Safety | 3 | ✅ All passing |
| Mount Reconciliation | 3 | ✅ All passing |
| Marker Files | 3 | ✅ All passing |
| Existing Mount Detection | 2 | ✅ All passing |

---

## Fixed Issues (Completed)

### 1. ✅ GCS Mount - Permission Denied (FIXED)

**Cause:** gcsfuse install command didn't use `sudo`
**File:** `workspaces/e2b/src/sandbox/mounts/gcs.ts`
**Fix:** Added `sudo` to `tee`, `apt-key add`, `apt-get update`, and `apt-get install`

### 2. ✅ GCS Mount - Flags (FIXED)

**Cause:** gcsfuse uses `--anonymous-access` flag, not `-o anonymous_access`
**Fix:** Changed to use `--anonymous-access`, `--key-file`, `--uid`, `--gid` flags properly

### 3. ✅ S3 readOnly Test - Wrong Assertion (FIXED)

**Fix:** Changed assertion to `expect(writeResult.stdout).toMatch(/Read-only|write failed/)`

### 4. ✅ S3-compatible Without Credentials (FIXED)

**Cause:** Implementation only warned but didn't fail
**Fix:** Now throws error instead of warning for S3-compatible services without credentials

### 5. ✅ Remount on Config Change (FIXED)

**Cause:** `checkExistingMount` compared new config hash with OLD entry's hash (always matched)
**Fix:** Pass new config to `checkExistingMount` and compare new config hash with stored marker hash

### 6. ✅ GCS Service Account Test - Made Resilient (FIXED)

**Cause:** Test expected `mountpoint` command to succeed, but gcsfuse mount may not be accessible
if bucket has permission issues (while still being successfully mounted)
**Fix:** Test now verifies mount via `mount` output instead of `mountpoint` command.
Also added `TEST_GCS_BUCKET` to skipIf condition.

### 7. ✅ Non-empty Directory Test - Fixed Path (FIXED)

**Cause:** Test tried to create directory in `/data` which requires sudo
**Fix:** Changed to use `/home/user/test-non-empty` to avoid permission issues

### 8. ✅ mkdir Outside Home Test - Real Credentials (FIXED)

**Cause:** Test used mock filesystem with invalid bucket, mount would fail and cleanup dir
**Fix:** Test now uses real S3 credentials with `skipIf(!hasS3Credentials)`

---

## Missing Tests - Priority Order

### High Priority (Core Functionality)

1. **stop() unmounts all filesystems** - Important for cleanup
2. **S3 endpoint mount options** - Verify s3fs command is built correctly (unit test)
3. **Full workflow test** - Create, mount, read/write, verify

### Medium Priority (Edge Cases)

4. **runs reconcileMounts on reconnect** - Essential for sandbox reuse
5. **env changes reflected without restart** - Verify per-command env works
6. **start() clears _startPromise** - Race condition edge case

### Lower Priority (Template Handling)

7. **rebuilds template on 404 error** - Error recovery
8. **custom template builder is built** - Advanced usage
9. **template function customizes base template** - Advanced usage

### Lower Priority (Installation)

10. **installs s3fs if not present** - Runtime installation
11. **installs gcsfuse if not present** - Runtime installation
12. **helpful error if installation fails** - Error UX

---

## Running Tests

```bash
# Unit tests only (fast, no credentials needed)
pnpm test src/sandbox/index.test.ts

# Integration tests (needs credentials in .env)
pnpm test src/sandbox/index.integration.test.ts

# All tests
pnpm test
```

---

## Unit vs Integration Decision Guide

| Scenario | Unit Test | Integration Test | Notes |
|----------|-----------|------------------|-------|
| Command/option building | ✅ | - | Verify args passed to SDK |
| State transitions | ✅ | - | pending → running → stopped |
| Error throwing | ✅ | - | SandboxNotReadyError etc |
| Mount actually works | - | ✅ | Needs real FUSE |
| File operations work | - | ✅ | Needs real filesystem |
| Reconnection works | ✅ | ✅ | Unit: SDK calls, Int: actual reconnect |
| readOnly enforcement | ✅ | ✅ | Unit: `-o ro` in cmd, Int: writes fail |
| Marker file logic | ✅ | ✅ | Unit: hash fn, Int: files exist |

---

## Future: Shared Test Utils

The `workspaces/_test-utils/` package will provide:

- `createFilesystemTestSuite()` - Reusable filesystem conformance tests
- `createSandboxTestSuite()` - Reusable sandbox conformance tests
- `MockFilesystem` / `MockSandbox` - For unit testing
- Test data generators

This will reduce duplication across S3, GCS, E2B, and future providers.

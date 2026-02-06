# Workspace Test Suite - Known Issues

**Full Test Plan:** [Notion - Workspace Filesystem & Sandbox Test Plan](https://www.notion.so/kepler-inc/Workspace-Filesystem-Sandbox-Test-Plan-from-claude-mounts-context-2fdebffbc9f880f5a7e0e9535286fd02)

---

## Expected Failures (Not Bugs)

S3 and GCS are object stores that simulate directories via key prefixes. Empty directories don't truly exist, causing predictable test failures:

| Provider | Failures | Tests |
|----------|----------|-------|
| S3 (MinIO) | 9/69 | 3 mkdir, 2 readdir, 3 stat/exists, 1 deleteFile |
| GCS (fake-gcs) | 8/67 | 3 mkdir, 2 readdir, 3 stat/exists |

These fail because:
- `mkdir()` without files creates nothing durable
- `readdir()` can't list empty "directories"
- `stat()` on empty directory paths returns "not found"
- S3 `deleteFile()` is idempotent (doesn't throw for missing files)

---

## Running Tests

```bash
# Unit tests (mocked, fast)
cd workspaces/s3 && pnpm test
cd workspaces/gcs && pnpm test
cd workspaces/e2b && pnpm test

# Integration tests with Docker (no credentials needed)
cd workspaces/s3 && pnpm test:integration:docker
cd workspaces/gcs && pnpm test:integration:docker

# Integration tests with cloud credentials
cd workspaces/s3 && pnpm test:integration:cloud
cd workspaces/gcs && pnpm test:integration:cloud
cd workspaces/e2b && pnpm test:integration  # E2B is cloud-only
```

---

## Fixed Issues (Historical)

1. **GCS Mount - Permission Denied** - Added `sudo` to gcsfuse install commands
2. **GCS Mount - Flags** - Changed to `--anonymous-access`, `--key-file` format
3. **S3 readOnly Test** - Fixed assertion to match actual error output
4. **S3-compatible Without Credentials** - Now throws instead of warning
5. **Remount on Config Change** - Fixed hash comparison logic
6. **GCS Service Account Test** - Made resilient to bucket permission issues
7. **Non-empty Directory Test** - Changed path to avoid sudo requirement
8. **mkdir Outside Home Test** - Now uses real credentials with skipIf

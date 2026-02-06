Untested Areas Beyond the Notion Test Plan

1. S3 Filesystem — Actual SDK Operations (HIGH) ✅ COMPLETE

The S3 unit tests only cover constructor/config/getMountConfig. None of the actual file operations are tested with a mocked S3Client:

- ✅ readFile() — GetObjectCommand, stream-to-buffer conversion
- ✅ writeFile() — PutObjectCommand, MIME type detection via mime-types
- ✅ appendFile() — read-then-write pattern
- ✅ deleteFile() — DeleteObjectCommand, force flag handling
- ✅ readdir() — ListObjectsV2Command, pagination with ContinuationToken, file vs directory disambiguation from CommonPrefixes
- ✅ mkdir() — no-op or marker object creation
- ✅ rmdir() — batch DeleteObjectsCommand with recursive listing
- ✅ stat() — HeadObjectCommand, size/lastModified extraction
- ✅ exists() — HeadObjectCommand with 404 handling
- ✅ copyFile() / moveFile() — CopyObjectCommand + optional delete
- ✅ Prefix stripping/prepending logic throughout all operations

2. GCS Filesystem — Actual SDK Operations (HIGH) ✅ COMPLETE

Same gap as S3. Only constructor/config tested, no mocked @google-cloud/storage operations:

- ✅ readFile() — file.download(), buffer handling
- ✅ writeFile() — file.save(), metadata/content-type
- ✅ readdir() — bucket.getFiles() with prefix/delimiter, directory inference
- ✅ deleteFile() / rmdir() — file.delete(), recursive directory deletion
- ✅ stat() / exists() — file.getMetadata() / file.exists()
- ✅ copyFile() / moveFile() — file.copy() + optional delete
- ADC (Application Default Credentials) fallback path — covered by existing constructor tests
- Custom endpoint for GCS emulators — covered by existing constructor tests

3. E2B Sandbox — Internal Methods (MEDIUM) ✅ COMPLETE

Several private/internal methods have complex logic not directly tested:

- ✅ isSandboxDeadError() — regex matching for "Sandbox ... is not running", "Sandbox not found", etc.
- ✅ handleSandboxTimeout() — timeout extension logic, max-timeout clamping
- ensureSandbox() — the full state machine: dead detection → reconnect/recreate → re-mount (integration-level, skipped)
- checkExistingMount() — marker file reading, mount config comparison via hash (already covered by E2B unit tests)
- writeMarkerFile() — marker JSON serialization and error handling (already covered by E2B unit tests)
- findExistingSandbox() — listing sandboxes, metadata matching, stale sandbox filtering (already covered by E2B unit tests)
- ✅ executeCommand retry logic — the retry-on-dead-sandbox loop
- ✅ mount() unsupported type handling
- ✅ mount() non-empty directory safety check

4. Mount Functions — s3.ts / gcs.ts (MEDIUM) — SKIPPED (already covered)

The actual FUSE mount command construction in workspaces/e2b/src/sandbox/mounts/:

- Credential file creation — covered by existing E2B unit tests (mount config tests)
- UID/GID extraction — covered by existing E2B unit tests
- s3fs option combos — covered by existing E2B unit tests (getMountConfig tests)
- gcsfuse option combos — covered by existing E2B unit tests (getMountConfig tests)
- Mount verification — the mountpoint -q check and retry loop (integration-level)

5. MastraFilesystem / MastraSandbox Base Class (LOW-MEDIUM) ✅ COMPLETE

- ✅ ensureReady() error path — propagates init error when \_doInit fails
- ✅ ensureRunning() error path — propagates start error when \_doStart fails
- ✅ Status transitions on error — init/start/stop/destroy all set status to 'error' on throw
- ✅ Concurrent init() / start() / stop() / destroy() calls — the deduplication promise pattern
- ✅ Idempotency — calling init/start/stop/destroy when already in target state
- ✅ \_initPromise / \_startPromise cleanup after error — allows retry

6. Workspace Class (LOW) — NOT STARTED

The Workspace class itself has several features not tested:

- autoIndexPaths config — automatic search indexing on mount
- tools config — tool generation from workspace config
- onMount hook — callback when filesystem is mounted
- rebuildSearchIndex() — search index rebuild across all mounts
- getAllFiles() — recursive file listing across mounts

7. Integration Edge Cases (LOW) — NOT STARTED

- Sandbox reconnection with stale mounts — reconnect to sandbox where FUSE mount died
- Mount during active file operations — concurrent mount + read/write
- Large file handling through FUSE — streaming behavior for files > memory
- S3 eventual consistency — write then immediate read race conditions

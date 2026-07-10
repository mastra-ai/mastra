---
'@mastra/platform': patch
---

Address code review feedback on the initial `@mastra/platform` release:

- **`PlatformSandbox.destroy()`** now clears `_sandboxId` and `_createdAt` after the DELETE succeeds. Previous behavior left the stale ID in place, so a follow-up `getInfo()` would still try to GET a deleted resource.
- **`PlatformSandbox.executeCommand()`** now uses a nullish check when deriving `timeoutSec`, so `{ timeout: 0 }` is sent as `0` instead of being silently dropped by the previous truthy check.
- **`PlatformProcessHandle.kill()`** now throws (matching `sendStdin`) instead of returning `false`. The workspace proxy has no cancel-exec endpoint; `executeCommand` is a synchronous round-trip that has already resolved by the time a handle exists to kill. Silently returning `false` implied a cancel had been attempted.
- **`PlatformFilesystem.readFile()` and `stat()`** now map proxy 404 responses to `FileNotFoundError` (matching `deleteFile`). `exists()` correctly returns `false` for missing paths as a result.
- **`PlatformFilesystem.copyFile()` / `moveFile()`** now throw when called with `overwrite: false`. The `?op=copy` and `?op=rename` proxy routes always overwrite the destination; silently ignoring `overwrite: false` would let callers believe they had a no-clobber guarantee.
- **`PlatformFilesystem.appendFile()`** is now documented as non-atomic (read-modify-write over object storage). Concurrent appenders on the same key can overwrite each other.

---
'@mastra/core': patch
---

Fixed read-only filesystems mounted into a natively isolated `LocalSandbox` being writable from shell commands.

`LocalSandbox.mount()` added every mount target to the isolation read-write allowlist regardless of the filesystem's `readOnly` flag, so a `readOnly: true` `LocalFilesystem` was read-only for file tools but writable via `execute_command` under `seatbelt` or `bwrap`. Read-only mounts are now write-denied at the OS level while remaining readable.

Added `nativeSandbox.denyWritePaths`: paths that commands can read but never write, applied after every write grant so it also covers paths nested inside the workspace or `readWritePaths`. Read-only mounts use it automatically (including when a path is re-mounted with a different `readOnly` flag); it can also be set directly. Because the field is part of the isolation config, generated seatbelt profiles are regenerated once after upgrading.

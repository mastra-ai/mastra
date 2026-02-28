---
'@mastra/daytona': patch
---

Improved S3/GCS FUSE mounting reliability and sandbox reconnection.

**Mounting improvements**

- Replaced direct SDK coupling in mount helpers with callback-based context, making mount operations more testable and resilient
- Added tmpfs overlay to handle FUSE-on-FUSE remount scenarios that previously failed with ENOENT
- Added `mount --move` fallback when standard FUSE unmount fails on stuck mounts
- `stop()` now unmounts all filesystems before stopping the sandbox
- Added early connectivity check for GCS mounting that detects Daytona's restricted internet tiers and fails fast with an actionable error message instead of hanging
- Improved gcsfuse installation with distro-aware codename detection (bookworm for Debian, jammy for Ubuntu)
- Added input validation for bucket names, endpoints, and credentials before interpolating into shell commands

**Reconnection improvements**

- `findExistingSandbox` now looks up sandboxes by name first (works for stopped sandboxes), then falls back to label search
- Added transitional state handling that polls and waits when a sandbox is starting/stopping/restoring before attempting to start it, avoiding "State change in progress" errors

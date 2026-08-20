---
'@mastra/platform-workspace': minor
---

Added provider-selectable Platform Workspace routing through `SANDBOX_PROVIDER`, with direct E2B command execution and snapshot restore support.

Set `SANDBOX_PROVIDER=e2b` before constructing `PlatformSandbox` or `PlatformFilesystem`; omit it to continue using Railway.

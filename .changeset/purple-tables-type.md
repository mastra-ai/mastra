---
'@mastra/platform-workspace': minor
---

Added provider-selectable Platform Workspace routing through `SANDBOX_PROVIDER`, with direct E2B command execution and snapshot restore support.

Set `SANDBOX_PROVIDER=e2b` before constructing `PlatformSandbox` or `PlatformFilesystem` to use provider-prefixed E2B routes. Set it to `railway` for provider-prefixed Railway routes, or leave it unset to preserve the legacy `/v1/projects/...` Railway API.

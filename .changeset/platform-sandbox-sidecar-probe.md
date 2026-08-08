---
'@mastra/platform-workspace': patch
---

Defer address registry population until sidecar /health probe succeeds.

Previously, `PlatformSandbox.start()` immediately populated the address registry with the `instanceUrl` from the workspace-proxy response, causing early execs to race the sidecar's boot window and fail with transport errors (~20-30 per fresh sandbox).

Now, `start()` fires a detached probe that polls the sidecar's `/health` endpoint before populating the registry. Early execs fall back to the lease path until the probe succeeds, eliminating the transport error burst during sandbox warmup.

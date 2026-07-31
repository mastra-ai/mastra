---
'@mastra/vercel': patch
'@mastra/factory': patch
---

`VercelSandbox` (MicroVM) now participates correctly in fleet reuse pools. Two changes:

- `clone({ sandboxId })` now maps `sandboxId` to `sandboxName`, so a sandbox pulled from a pool resumes via `Sandbox.getOrCreate({ name })` instead of provisioning a fresh one.
- `getInfo().metadata.sandboxId` now publishes the Vercel-assigned sandbox name, so the fleet has a reattach handle to persist on release.

Every other pool-compatible provider (`docker`, `e2b`, `modal`, `daytona`, `blaxel`, `apple-container`) already reattaches through its logical `id` inside `start()`; no changes were needed there. `readProviderSandboxId`'s jsdoc has been updated to reflect that id-fallback is the norm, not an edge case.

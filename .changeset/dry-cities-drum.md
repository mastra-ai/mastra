---
'@mastra/platform-workspace': patch
---

**Added:** Direct exec data plane for `PlatformSandbox`.

Commands now execute against Railway's WebSocket endpoint directly using a short-lived JWT lease minted by the workspace proxy, instead of proxying every exec through the HTTP proxy. This removes the workspace proxy from the exec hot path — cutting latency for large-payload commands (e.g. `pnpm install`) and eliminating duplicated observability spans.

The change is transparent: `executeCommand` still returns the same `CommandResult` shape. If the proxy's `/exec-lease` endpoint is unavailable (older deployments), the client automatically falls back to the legacy `POST /sandbox/:id/exec` route for the lifetime of the sandbox.

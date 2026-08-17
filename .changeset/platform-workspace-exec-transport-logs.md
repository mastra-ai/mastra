---
'@mastra/platform-workspace': patch
---

Added two lifecycle-level observability signals to `PlatformSandbox` so cold-start transport degradation is inferrable from logs without per-exec instrumentation.

- `platform-workspace instance url missing` warn when the workspace-proxy create/reattach response omits `instanceUrl`. Without a URL the sidecar probe never fires and every exec for the sandbox's lifetime goes via the lease/proxy path — this log makes that root cause visible in one line instead of leaving it as a silent "why is this sandbox slow forever" mystery.
- `platform-workspace address registry evicted` warn (with reason: `connection-refused`, `no-exit-frame`, `timeout-before-headers`, `unexpected-error`) when `_invalidateAddress` actually evicts a live entry. No-op deletes stay silent to avoid noise.

Joined with the existing `platform-workspace probe ok` / `platform-workspace probe timed out` signals, the pair fully describes any sandbox's transport state at time T. No per-exec logging is needed to answer "why did this exec go slow" — cross-reference the sandboxId with these lifecycle events.

No behavior changes — logging additions only.

---
'@mastra/platform-workspace': minor
---

Split `PlatformSandbox.stop()` from `PlatformSandbox.destroy()` so the two lifecycle exits mirror `@mastra/railway` `RailwaySandbox`

**Before:** `stop()` was an alias for `destroy()`, and `destroy()` only released the sandbox VM — the on-provider recovery checkpoint was never actively deleted. There was no way to end a hosted sandbox while preserving its checkpoint for a later resume, and destroyed sandboxes accumulated stray checkpoints until the upstream provider's own GC.

**After:**

- **`stop()`** — releases the VM but **preserves the recovery checkpoint**. Any in-flight capture is awaited first so the preserved checkpoint reflects the caller's latest state. Corresponds to `DELETE /v1/projects/:pid/sandbox/:sandboxId` on workspace-proxy, which by contract does not touch the checkpoint.
- **`destroy()`** — releases the VM **and deletes the recovery checkpoint**. Cancels any in-flight capture (no reason to burn a capture on state we're releasing), asks the proxy to delete the checkpoint via `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`, then releases the VM. Both remote operations are best-effort — an already-absent checkpoint or a transient checkpoint-delete failure does not block the VM teardown, since a half-torn-down sandbox is worse than a lingering checkpoint alone.

Callers constructed without a recovery `id` skip the checkpoint DELETE and behave identically to `stop()`, because they have no on-provider checkpoint to release.

This restores the "providers move in lockstep" invariant that broke after `@mastra/railway` gained its own `stop()`/`destroy()` split.

**Requires** a matching workspace-proxy release that exposes `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`. Callers on older workspace-proxy versions will see the checkpoint DELETE 404 and fall through to the VM DELETE — same net effect as the pre-split behavior.

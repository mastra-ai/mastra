---
'@mastra/platform-workspace': minor
---

Add a client-side checkpoint refresh safety-net timer to `PlatformSandbox`, mirroring `@mastra/railway` `RailwaySandbox`

Previously the workspace-proxy ran this timer server-side. That worked for the persistent staging deploy but was unreliable on serverless: Cloud Run kills the process during idle scale-to-zero and cold-start recycles, so the timer that was supposed to protect the upstream idle-destroy window couldn't fire during exactly the window it was there to guard. The safety net looked present but couldn't be counted on.

`PlatformSandbox` now arms a `.unref()`d `setTimeout` in the caller's own process — the persistent factory runtime that already owns the sandbox handle — same layer where `RailwaySandbox` runs its equivalent timer. Both providers now race the same 3-minute (`CHECKPOINT_REFRESH_MARGIN_MS = 180_000`) window before the upstream idle destroy, so a caller holding a `WorkspaceSandbox` gets the same idle-window behavior on both providers and can stop reasoning about which one it has.

**Schedule.** `delayMs = Math.max(1_000, idleTimeoutMinutes * 60_000 - 180_000)`. If the caller's idle timeout is shorter than the 3-minute margin the timer clamps to a 1-second floor and fires almost immediately after `start()` — surfacing the misconfiguration rather than silently skipping.

**No-op when.**

- The caller supplied no recovery `id` (an auto-generated id is not a meaningful recovery key — capturing under a name no future boot would look for produces dead data).
- No `idleTimeoutMinutes` was configured (no upstream destroy to race).
- The sandbox is not started.

**Re-arm.** After every successful `captureCheckpoint()` (busy sandbox keeps pushing the timer out — only a genuinely idle sandbox ever fires it). The timer coalesces onto the existing in-flight capture slot, so a fire that lands during a caller-driven capture joins the same round-trip rather than starting a competing one.

**Cancel.** On `stop()`, `destroy()`, or any 410 that marks the sandbox destroyed locally — no stray refresh ever fires against a torn-down or reused sandbox id.

**Rollout.** Pairs with the workspace-proxy release that removes the server-side timer; the two changes ship as a unit and callers see continuous coverage across the swap.

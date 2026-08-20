---
'@mastra/factory': minor
---

Factory sandbox management is reduced to intent. Sessions construct sandboxes through a `sandbox.create(ctx)` config callback — sandbox identity is the session id, the provider resolves it with id-keyed getOrCreate on `start()`, workdirs are computed deterministically (never read from persisted state), and session repo setup runs inside the start lifecycle via `ctx.onStart`, so any lazy start heals a replaced VM. `SandboxFleet`, the base-checkpoint subsystem, pooled-sandbox claiming, and the reattach/revival ladder are deleted; `session.sandboxId`/`sandboxWorkdir` writes remain for observability only.

BREAKING: configure `sandbox.create` instead of `sandbox.machine`. The deprecated `machine` field still works through a clone-based compat shim; `workdir` and `maxSandboxes` are now no-ops. Deliberately dropped with the fleet: the per-replica sandbox budget (`SandboxBudgetError`), transient git-failure retry classification, and cross-session sandbox pooling.

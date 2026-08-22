# @mastra/factory

The factory runs agent sessions on remote sandboxes. It is provider-agnostic — it holds a sandbox as `WorkspaceSandbox` and does not know whether that sandbox talks to Railway directly or via the hosted platform's proxy.

## Language

### Runtime shape

**Session**:
One conversation with one agent on one `AgentController`. Emits lifecycle events (`agent_start`, `agent_end`, …). Keyed by `(resourceId, scope)`.
_Avoid_: conversation, chat, run, request.

**Turn**:
One user message and the agent's full response to it, delimited by `agent_start` and `agent_end` events on the Session.
_Avoid_: request, exchange, round.

**Turn-end**:
The `agent_end` event on a Session. The moment a turn's work is complete.
_Avoid_: completion, response-end.

**Session-idle**:
N minutes elapsed on a Session with no incoming `sendMessage`. Not yet implemented.
_Avoid_: quiet, dormant.

**Workspace**:
The factory's per-session bundle of git materialization state plus the sandbox it runs in. Cached per session, materialized lazily.
_Avoid_: environment, project, workdir.

**Materialization**:
The act of building a fresh Workspace for a Session (as opposed to a cache hit). Per-session subscriptions attach on materialization only.
_Avoid_: initialization, setup, hydration.

### Sandbox layer

**Sandbox**:
A remote VM where the agent's code and tools run. Typed as `WorkspaceSandbox` inside the factory.
_Avoid_: VM, container, machine (except when referring to the config field below), runner.

**Machine**:
The template sandbox passed into `MastraFactorySandboxConfig.machine`. Never started; each Session gets a Sandbox `clone()`d from it.
_Avoid_: template, prototype.

**Provider**:
A concrete implementation of `WorkspaceSandbox` — currently `RailwaySandbox` (OSS) or `PlatformSandbox` (hosted).
_Avoid_: backend, driver, adapter.

**OSS path**:
Factory → `@mastra/railway` `RailwaySandbox` → Railway. Talks to Railway directly with the user's own Railway token. Used when self-hosting.
_Avoid_: local path, direct path.

**Hosted path**:
Factory → `@mastra/platform-workspace` `PlatformSandbox` → workspace-proxy → `@platform/workspaces` `RailwaySandboxProvisioner` → Railway. Exists because the platform's Railway token cannot be injected into user servers.
_Avoid_: platform path, cloud path, proxied path.

**Why two providers**:
Users self-hosting the factory own their Railway account and pass their own Railway token; the hosted platform runs the factory with the platform's Railway token. Because the platform's token cannot be injected into user servers, the two deployments cannot share a provisioning path. The two `WorkspaceSandbox` implementations must stay behaviourally interchangeable from the factory's point of view — the factory holds either as `WorkspaceSandbox` and never branches on which is present. Any new provider capability must land on both implementations with identical shape.

**SandboxFleet**:
Owns sandbox provisioning, reattachment, and teardown. Does not hold session-id → sandbox bindings; those live in the workspace layer via `SandboxBindingStore`.
_Avoid_: pool, manager, registry.

**MaterializationSandbox**:
The minimal sandbox surface fleet consumers depend on: `id`, `start`, `executeCommand`, `getInfo`, optional `stop`, optional `captureCheckpoint`. Built by `toMaterializationSandbox()` which duck-types optional methods off the underlying provider.
_Avoid_: LiveSandbox, ActiveSandbox.

**RailwaySandboxProvisioner**:
The platform-side class in `@platform/workspaces` that calls Railway with the platform's token on behalf of `PlatformSandbox`. **Exists only on the platform side.** The OSS `RailwaySandbox` calls Railway inline; there is no OSS "provisioner".
_Avoid_: using "provisioner" as a generic term for anything that provisions sandboxes.

### Checkpoint mechanics

**Checkpoint**:
Railway's mechanism for preserving a sandbox's filesystem so it can be recovered after idle-destroy.
_Avoid_: snapshot, backup, save.

**Capture**:
An on-demand, one-shot checkpoint write triggered explicitly via `sandbox.captureCheckpoint()`. Both providers expose this identically.
_Avoid_: save, write, snapshot.

**Refresh**:
The provider's internal timer-driven checkpoint write, scheduled shortly before Railway's idle-destroy window. Providers own refresh; the factory never schedules one.
_Avoid_: renewal, tick.

**Safety-net margin**:
The seconds before Railway's idle-destroy that Refresh fires. Currently 180s.
_Avoid_: window, buffer, lead-time.

**CaptureCheckpointResult**:
Discriminated union returned by `captureCheckpoint()`: `{ status: 'captured' | 'coalesced' | 'skipped', … }`. Identical shape on both providers so the factory logs it uniformly without provider-awareness.
_Avoid_: CheckpointOutcome, CaptureResult.

**Coalesce**:
Merge concurrent capture attempts into one upstream Railway call. Handled inside each provider; the factory never coalesces at its own layer.
_Avoid_: dedupe, batch, join.

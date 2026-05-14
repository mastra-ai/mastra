### 9.4 Workspace Configuration

```ts
// Harness workspace configuration. This is distinct from the core
// `WorkspaceConfig` constructor shape on `Workspace` itself
// (`../packages/core/src/workspace/workspace.ts:79` for `WorkspaceConfig`,
// `:465` for the `Workspace` class); it chooses Harness ownership and wraps
// already-configured core `Workspace` instances/providers.
// Three discriminated shapes. `per-session` uses the `WorkspaceProvider`
// contract (see §2.7) so the harness can validate resumability at startup
// without provisioning a real sandbox. `shared` and `per-resource` workspaces
// aren't tied to a specific session record and don't carry a `providerId`.
type HarnessWorkspaceConfig =
  | { kind: 'shared'; instance: Workspace }
  | {
      kind: 'per-resource';
      create: (ctx: { resourceId: string }) => Workspace | Promise<Workspace>;
      eager?: boolean;                                // Provision on first session(); default false
    }
  | {
      kind: 'per-session';
      provider: WorkspaceProvider;                    // see below
      eager?: boolean;                                // Provision on harness.session(); default false
    };

// The contract a per-session workspace provider must satisfy. The harness
// reads `providerId` and `resumable` at config time — without calling
// `create` — so the provider's per-session durability mode is explicit before
// any sandbox is provisioned.
interface WorkspaceProvider {
  // Stable, human-readable identity. Persisted into
  // `SessionRecord.workspace.providerId` and matched on durable rehydration. A
  // mismatch surfaces `HarnessWorkspaceProviderMismatchError` rather than
  // silently handing the record to the wrong provider.
  readonly providerId: string;

  // Static capability declaration. `true` providers are durable and must
  // implement `resume`; `false` providers are ephemeral. Once an active
  // session has materialised an ephemeral workspace, restart/eviction loss is
  // surfaced as `HarnessWorkspaceLostError` and the harness must not call
  // `create` to replace that workspace for the same active session.
  readonly resumable: boolean;

  // Called the first time a session needs a workspace, or eagerly at
  // session creation if `eager: true`. For `resumable: true`, the returned
  // workspace must expose opaque provider state to feed the harness's
  // persistence loop.
  create(ctx: WorkspaceCreateContext): Workspace | Promise<Workspace>;

  // Required when `resumable: true`. Called after a server restart with
  // whatever blob the harness stored in `SessionRecord.workspace.state`
  // before the restart. Must return a live Workspace equivalent to the
  // pre-restart instance from the agent's perspective. If the provider uses
  // a generation/fencing token, it is carried in `WorkspaceResumeContext`.
  resume?(ctx: WorkspaceResumeContext): Workspace | Promise<Workspace>;
}

interface WorkspaceStateUpdate {
  // Replacement provider-owned recovery state for
  // `SessionRecord.workspace.state`. It must satisfy the SessionRecord
  // serialization contract; it is not file contents, memory, tool output, or
  // core Workspace configuration.
  state: JsonValue;

  // Optional provider fencing token stored atomically with `state`. Providers
  // that use generation fencing include the current token on every update;
  // providers without fencing omit it.
  generation?: string;
}

interface WorkspaceCreateContext {
  sessionId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;

  // Harness-supplied durable recovery-state handoff. For `resumable: true`,
  // providers call and await this after initial create state is known and after
  // every later durable provider-state change. The promise resolves only after
  // `SessionRecord.workspace.state` and `generation` are saved under the owning
  // session lease and version CAS. If it rejects, the provider must not treat
  // the new state as safely recoverable. `resumable: false` providers may
  // ignore it; calling it does not change their ephemeral recovery contract.
  onStateChange(update: WorkspaceStateUpdate): Promise<void>;
}

interface WorkspaceResumeContext extends WorkspaceCreateContext {
  // The opaque blob the provider previously reported via
  // `SessionRecord.workspace.state`. Opaque to the harness but JSON-safe;
  // providers own its shape.
  state: JsonValue;
  generation?: string;
}

// Factory-shorthand sugar. Equivalent to:
//   { kind: 'per-session', provider: nonDurableProvider(fn) }
// where `nonDurableProvider(fn)` returns a `WorkspaceProvider` with
// `resumable: false`, no `resume` implementation, and a reserved non-durable
// `providerId` used only for diagnostics/loss reporting. It must not derive
// persisted provider identity from the function reference, and that identity
// is never used for durable rehydration matching; stored
// `durability: 'ephemeral'` drives the fail-closed recovery path.
// Sessions provisioned through this path do not get workspace continuity across
// server restarts. If the workspace was already materialised, recovery fails
// closed with `HarnessWorkspaceLostError` instead of creating a fresh workspace
// for the same active session — see §2.7.
type WorkspaceFactoryFn = (ctx: WorkspaceCreateContext) => Workspace | Promise<Workspace>;
```

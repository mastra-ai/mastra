## 9. Configuration

```ts
interface HarnessConfig<TState = Record<string, unknown>> {
  // Required
  agents: Record<string, Agent>;                      // Mastra agents keyed by ID
  modes: HarnessMode[];                               // Available modes
  resolveModel: (modelId: string) => LanguageModel;   // Model resolver
  storage: HarnessStorage;                            // Thread + message persistence

  // Sessions
  defaultResourceId?: string;                         // Default tenant
  defaultModelId?: string;                            // Fallback when session has none selected
  sessions?: {
    maxLive?: number;                                 // Cap on hydrated sessions. Default: Infinity (no cap).
    idleTimeoutMs?: number;                           // Auto-evict after this idle period. Default: 2 * 60 * 60 * 1000 (2 hours).
                                                      //   Sessions with a pending approval/suspension/question/plan
                                                      //   are exempt from this check — see §5.4.
    flushDebounceMs?: number;                         // Debounce window for writing dirty state. Default: 500
    maxFlushFailures?: number;                        // Consecutive debounced-flush failures tolerated
                                                      //   before the session goes into storage-error mode.
                                                      //   Default: 5. See §5.7.
    eventBufferSize?: number;                         // Per-session ring buffer size for event replay
                                                      //   on SSE reconnect (`Last-Event-ID`).
                                                      //   Default: 1000. See §13.3.

    maxQueueDepth?: number;                           // Cap on `SessionRecord.pendingQueue` length.
                                                      //   When at the cap, `session.queue(...)` rejects
                                                      //   with `HarnessQueueFullError` *before* mutating
                                                      //   storage. The capacity check + durable append
                                                      //   are atomic under the session's write lease
                                                      //   (§5.8). Default: Infinity (unbounded).
                                                      //   Cap deliberately does *not* trigger
                                                      //   `HarnessBusyError` — busy state is what queue
                                                      //   exists for. See §3 and §5.7.

    // Write-concurrency — see §5.8.
    lockMode?: 'fail' | 'wait' | 'steal';             // Behaviour when another instance owns the lease.
                                                      //   Default: 'fail'. 'wait' is recommended for
                                                      //   browser/SSE deployments. 'steal' is for
                                                      //   operator tools and tests.
    lockTtlMs?: number;                               // Lease TTL. The owner renews on every flush
                                                      //   and on a `lockRenewMs` interval. After TTL
                                                      //   without renewal the lease is reclaimable.
                                                      //   Default: 30_000.
    lockRenewMs?: number;                             // Keep-alive interval for lease renewal even
                                                      //   when no flush has happened. Default: 10_000.
    lockWaitMs?: number;                              // Maximum time `harness.session(...)` blocks
                                                      //   when `lockMode = 'wait'` before throwing
                                                      //   `HarnessSessionLockedError`. Default: 5_000.
  };

  // Skills
  skills?: HarnessSkill[];                            // Code-registered skills (precedence over filesystem)

  // Subagents
  subagents?: {
    maxDepth?: number;                                // Default: 1
  };

  // File attachments
  files?: {
    maxInlineBytes?: number;                          // Inline attachments larger than this are rejected.
                                                      //   Default: 10 * 1024 * 1024 (10 MiB).
                                                      //   Larger files must use the `kind: 'url'` form
                                                      //   or be pre-uploaded via the wire protocol's
                                                      //   file route (see §13).
  };

  // Goals — see §4.7
  goals?: {
    defaultJudgeModel?: string;                       // Used when `setGoal({ judgeModel })` omits the field.
                                                      //   No default — `setGoal` throws if the goal has no
                                                      //   judge model and no default is configured.
    defaultMaxTurns?: number;                         // Default: 50
  };

  // Workspace — see §2.7 for ownership models and the provider contract.
  // Sugar: passing a `Workspace` is equivalent to `{ kind: 'shared', instance }`.
  // Sugar: passing a function is equivalent to `{ kind: 'per-session', provider:
  //   nonDurableProvider(fn) }` (resumable: false; sessions cannot survive
  //   restarts).
  workspace?: WorkspaceConfig | Workspace | WorkspaceFactoryFn;

  // Observational Memory
  observationalMemory?: ObservationalMemoryConfig;

  // Tooling
  tools?: ToolsetInput;                               // Available tools
  toolCategories?: Record<string, ToolCategory>;      // Category mapping
  defaultPermissionPolicy?: PermissionPolicy;         // Default approval behaviour

  // Lifecycle hooks
  intervals?: IntervalHandler[];                      // Registered at init via `onInterval`

  // State
  initialState?: TState;
}

interface IntervalHandler {
  id: string;
  ms: number;                                         // Tick interval
  handler: () => void | Promise<void>;
  immediate?: boolean;                                // Fire once on registration. Default: false
  shutdown?: () => void | Promise<void>;              // Called when the interval is removed
}

// Workspace configuration. Three discriminated shapes. `per-session` uses
// the `WorkspaceProvider` contract (see §2.7) so the harness can validate
// resumability at startup without provisioning a real sandbox. `shared` and
// `per-resource` workspaces aren't tied to a specific session record and
// don't carry a `providerId`.
type WorkspaceConfig =
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
// `create` — so that a misconfigured combination (e.g. `per-session` against
// a non-resumable provider that the operator expected to survive restarts)
// is rejected at `harness.init()` rather than discovered after a crash.
interface WorkspaceProvider {
  // Stable, human-readable identity. Persisted into
  // `SessionRecord.workspace.providerId` and matched on rehydration. A
  // mismatch surfaces `HarnessWorkspaceProviderMismatchError` rather than
  // silently handing the record to the wrong provider.
  readonly providerId: string;

  // Static capability declaration. `false` providers are accepted only as
  // sugar (factory shorthand) and the harness will not persist or attempt
  // to resume their workspaces — see the factory-shorthand note below.
  readonly resumable: boolean;

  // Called the first time a session needs a workspace, or eagerly at
  // session creation if `eager: true`. The returned Workspace must offer
  // an opaque `getState()` to feed the harness's persistence loop when
  // `resumable: true`.
  create(ctx: WorkspaceCreateContext): Workspace | Promise<Workspace>;

  // Required when `resumable: true`. Called after a server restart with
  // whatever blob the harness stored in `SessionRecord.workspace.state`
  // before the restart. Must return a live Workspace equivalent to the
  // pre-restart instance from the agent's perspective.
  resume?(ctx: WorkspaceResumeContext): Workspace | Promise<Workspace>;
}

interface WorkspaceCreateContext {
  sessionId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
}

interface WorkspaceResumeContext extends WorkspaceCreateContext {
  // The opaque blob the provider previously reported via
  // `SessionRecord.workspace.state`. Type-erased on purpose — providers
  // own its shape.
  state: unknown;
}

// Factory-shorthand sugar. Equivalent to:
//   { kind: 'per-session', provider: nonDurableProvider(fn) }
// where `nonDurableProvider(fn)` returns a `WorkspaceProvider` with
// `resumable: false`, an auto-generated `providerId` (e.g. an opaque
// hash of the function reference), and no `resume` implementation.
// Sessions provisioned through this path are NOT durable across server
// restarts — see §2.7.
type WorkspaceFactoryFn = (ctx: WorkspaceCreateContext) => Workspace | Promise<Workspace>;
```

---

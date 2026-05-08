### 4.1 Harness

```ts
class Harness<TState = Record<string, unknown>> {
  constructor(config: HarnessConfig<TState>);

  // Lifecycle
  init(): Promise<void>;
  shutdown(): Promise<void>;

  // Sessions — find-or-create across memory + storage. See §5.
  //
  // `session` resolves a session from any of three lookup shapes:
  //   - by sessionId (must already exist in memory or storage)
  //   - by (threadId, resourceId)  — find or create a session bound to that thread
  //   - by resourceId alone        — bootstrap: most-recent-or-create
  //
  // The returned `Session` is always live in memory. Storage is consulted
  // transparently when the session isn't already hydrated.
  //
  // All overloads enforce single-tenant scoping (see §2.3): if `resourceId` is
  // supplied, it is cross-checked against the stored record and a mismatch is
  // surfaced as `HarnessSessionNotFoundError` (sessions) or treated as
  // "doesn't exist" (threads). The ID-only overload is allowed for
  // single-tenant deployments; multi-tenant callers should always pass
  // `resourceId`.
  session(opts: { sessionId: string }): Promise<Session<TState>>;
  session(opts: { sessionId: string; resourceId: string }): Promise<Session<TState>>;
  session(opts: {
    threadId: string | { fresh: true };
    resourceId: string;
    sessionId?: string;
    parentSessionId?: string;       // mark this session as a child of another
  }): Promise<Session<TState>>;
  session(opts: { resourceId: string }): Promise<Session<TState>>;

  listSessions(opts: {
    resourceId: string;
    includeClosed?: boolean;
  }): Promise<SessionSummary[]>;

  closeSession(opts: { sessionId: string }): Promise<void>;

  // Threads (persistent storage primitive)
  threads: {
    create(opts: CreateThreadOptions): Promise<HarnessThread>;
    clone(opts: CloneThreadOptions): Promise<HarnessThread>;
    get(threadId: string): Promise<HarnessThread | null>;
    list(opts?: ListThreadsOptions): Promise<HarnessThread[]>;
    rename(threadId: string, title: string): Promise<void>;
    delete(threadId: string): Promise<void>;
    listMessages(threadId: string, opts?: ListMessagesOptions): Promise<HarnessMessage[]>;
    getFirstUserMessage(threadId: string): Promise<HarnessMessage | null>;
    getFirstUserMessages(threadIds: string[]): Promise<Record<string, HarnessMessage | null>>;
  };

  // Catalogs
  listModes(): HarnessMode[];
  listAvailableModels(): Promise<AvailableModel[]>;
  listSkills(): HarnessSkill[];
  getSkill(name: string): HarnessSkill | undefined;
  getToolCategory(opts: { toolName: string }): ToolCategory | null;
  getDefaultResourceId(): string;
  getKnownResourceIds(): Promise<string[]>;
  setDefaultModel(opts: { model: string }): void;

  // Intervals
  onInterval(handler: IntervalHandler): () => void;       // returns unsubscribe
  stopIntervals(): Promise<void>;

  // Cross-session events
  subscribe(listener: HarnessListener): () => void;

  // Workspace — out-of-session contexts only (init scripts, admin tooling, batch jobs).
  // Returns the shared workspace when the harness is configured with `kind: 'shared'`;
  // returns `undefined` for `per-resource` and `per-session` shapes.
  // Tools always go through `session.getWorkspace()` instead. See §2.7.
  getWorkspace(): Workspace | undefined;
  resolveWorkspace(): Promise<Workspace | undefined>;
  hasWorkspace(): boolean;
  isWorkspaceReady(): boolean;

  // Per-resource teardown. Throws if any session for `resourceId` is still live.
  // No-op for `shared` and `per-session` shapes. See §2.7.
  destroyResourceWorkspace(opts: { resourceId: string }): Promise<void>;

  // Infrastructure
  getMastra(): Mastra | undefined;
}
```

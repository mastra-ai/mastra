### 4.2 Session

```ts
class Session<TState = Record<string, unknown>> {
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly createdAt: number;
  readonly lastActivityAt: number;

  // State.
  // In-process, `getState()` is a sync memory read served from the live
  // session under the lease. The remote variant (`RemoteSession`) exposes
  // the same name but returns `Promise<Readonly<TState>>`; portable code
  // using `RemoteSafeSession` should await it. See §2.6 and §13.5.
  // `setState` has two forms; the functional form is local-only.
  getState(): Readonly<TState>;
  setState(updates: Partial<TState>): Promise<void>;
  setState(updater: (prev: Readonly<TState>) => TState): Promise<void>;

  // Mode
  getCurrentModeId(): string;
  getCurrentMode(): HarnessMode;
  switchMode(opts: { mode: string }): Promise<void>;

  // Model
  getCurrentModelId(): string;
  hasModelSelected(): boolean;
  getCurrentModelAuthStatus(): Promise<ModelAuthStatus>;
  switchModel(opts: { model: string }): Promise<void>;
  setSubagentModel(opts: { agentType: string; model: string }): Promise<void>;
  getSubagentModel(opts: { agentType: string }): string | null;

  // Operations
  //
  // `message` — busy-independent. Delegates to the agent's `sendSignal()`.
  //   Idle thread → starts a new run. Active run → drains into the live loop
  //   as new user input. Multiple concurrent `message()` calls all deliver
  //   (Slack semantics). The returned promise resolves when the assistant
  //   turn answering *this* signal completes.
  //
  //   Never throws `HarnessBusyError`, but admission can still fail for
  //   reasons unrelated to busy-ness: `HarnessValidationError` (invalid
  //   options), `HarnessSessionClosedError`, `HarnessStorageError` (signal
  //   write failed), or `HarnessOverrideConflictError` when `model`, `mode`,
  //   or `addTools` are set on a signal that would drain into an
  //   already-active run (the run's surface is committed at start; a signal
  //   cannot mutate it mid-flight). See §4.3.
  //
  //   `stream: true` returns `AgentStream` synchronously (chunks of the
  //     turn that answers this signal).
  //   `output: schema` requires `sync: true`. The pair calls `agent.generate()`
  //     directly on a fresh `runId` and is the only `message` form that can
  //     throw `HarnessBusyError` (typed structured output needs a committed
  //     turn boundary, so it cannot interleave via signals).
  //
  // `queue` — busy-independent, defers delivery. Items append to a per-session
  //   FIFO held durably in `SessionRecord.pendingQueue`. When the thread
  //   reaches an idle boundary, head of queue is drained as a fresh
  //   standalone turn. Items run sequentially, one full turn each.
  //
  //   Never throws `HarnessBusyError`, but admission can fail with
  //   `HarnessValidationError` (including a runtime reject if `addTools` is
  //   present — queued items are durable and tool implementations are not
  //   serialisable; see §4.3 and §5.7), `HarnessSessionClosedError`,
  //   `HarnessStorageError`, or `HarnessQueueFullError` (when
  //   `sessions.maxQueueDepth` would be exceeded — see §9). The capacity
  //   check + durable append are atomic per session: two concurrent
  //   `queue()` calls cannot both commit past the cap.
  //
  // `useSkill` — fail-fast skill execution. Resolves the skill, builds the
  //   prompt with args injected, and delegates to `message`. Throws
  //   `HarnessBusyError` if the thread is busy.
  message(opts: MessageOptions & { stream: true }): AgentStream;
  message<S extends ZodSchema>(
    opts: MessageOptions<S> & { sync: true; output: S },
  ): Promise<z.infer<S>>;
  message(opts: MessageOptions): Promise<AgentResult>;

  queue(opts: QueueOptions): Promise<AgentResult>;

  useSkill<S extends ZodSchema | undefined = undefined>(
    name: string,
    opts?: UseSkillOptions<S>,
  ): Promise<S extends ZodSchema ? z.infer<S> : AgentResult>;

  // Skill discovery — applies the full resolution chain (code-registered,
  // then workspace-discovered). See §4.6.
  listSkills(): HarnessSkill[];
  getSkill(name: string): HarnessSkill | undefined;

  // Drop the cached workspace-discovery result. The next listSkills /
  // getSkill / useSkill call re-scans the workspace. Code-registered
  // skills are unaffected — they live on the harness and don't need
  // refreshing. Local-only: workspace discovery requires server-side
  // filesystem access, so refreshSkills is absent from RemoteSession.
  // See §4.6 and §13.5.
  refreshSkills(): Promise<void>;

  // Concurrency / inspection (read-only). Cancellation is not a session
  // concern in v1 — see §3.
  isBusy(): boolean;
  waitForIdle(opts?: { timeout?: number }): Promise<void>;
  getQueueDepth(): number;
  getCurrentRunId(): string | null;
  getCurrentTraceId(): string | null;

  // Messages
  listMessages(opts?: ListMessagesOptions): Promise<HarnessMessage[]>;
  setThreadSetting(opts: { key: string; value: unknown }): Promise<void>;

  // Display state
  getDisplayState(): Readonly<HarnessDisplayState>;
  subscribe(listener: HarnessListener): () => void;
  subscribeDisplayState(
    listener: (state: HarnessDisplayState) => void,
    opts?: { windowMs?: number },
  ): () => void;

  // Question / plan / tool resolution. Each `respond...` method consumes
  // the corresponding pending shape on `SessionRecord` (§5.1) — clears
  // the field, emits the matching display-state event, and resumes the
  // underlying Mastra workflow with the appropriate payload:
  //   respondToToolApproval   → consumes pendingApproval,    resumes with { approved, reason? }
  //   respondToToolSuspension → consumes pendingSuspension,  resumes with opaque resumeData
  //   respondToQuestion       → consumes pendingQuestion,    resumes with { answer }
  //   respondToPlanApproval   → consumes pendingPlan,        resumes with { approved, reason? }
  respondToToolApproval(opts: ToolApprovalResponse): void;
  respondToToolSuspension(opts: ToolSuspensionResponse): Promise<void>;
  registerQuestion(opts: RegisterQuestionOptions): void;
  respondToQuestion(opts: { answer: string | string[] }): void;
  registerPlanApproval(opts: RegisterPlanApprovalOptions): void;
  respondToPlanApproval(opts: { approved: boolean; reason?: string }): Promise<void>;

  // Permissions
  permissions: {
    grantCategory(opts: { category: ToolCategory }): void;
    grantTool(opts: { toolName: string }): void;
    revokeCategory(opts: { category: ToolCategory }): void;
    revokeTool(opts: { toolName: string }): void;
    getGrants(): Readonly<SessionGrants>;
    setPolicy(opts: { category: ToolCategory; policy: PermissionPolicy }): void;
    setPolicy(opts: { toolName: string; policy: PermissionPolicy }): void;
    getRules(): Readonly<PermissionRules>;
  };

  // Observational Memory
  om: {
    getObserverModelId(): string | null;
    getReflectorModelId(): string | null;
    getObservationThreshold(): number;
    getReflectionThreshold(): number;
    switchObserverModel(opts: { model: string }): Promise<void>;
    switchReflectorModel(opts: { model: string }): Promise<void>;
    getRecord(): Promise<ObservationalMemoryRecord | null>;
    loadProgress(): Promise<void>;
  };

  // Workspace — canonical access path for tools. Returns the workspace
  // belonging to this session under the harness's configured ownership model
  // (`shared` | `per-resource` | `per-session`). See §2.7.
  //
  // `getWorkspace()` is non-blocking; returns `undefined` if the workspace
  // hasn't been materialised yet (lazy mode). Use `resolveWorkspace()` to
  // force provisioning.
  getWorkspace(): Workspace | undefined;
  resolveWorkspace(): Promise<Workspace>;
  hasWorkspace(): boolean;
  isWorkspaceReady(): boolean;

  // Attachments — pre-upload bytes that can later be referenced by ID from
  // any message on this session. Useful for browser drag-drop with progress
  // UIs and large files. Inline attachments on `message`/`queue`/`useSkill`
  // are flushed here implicitly; this method just exposes the pre-upload path.
  // See §13.7.
  uploadAttachment(opts: {
    name: string;
    mimeType: string;
    data: Uint8Array;
    onProgress?: (loaded: number, total: number) => void;
  }): Promise<{ attachmentId: string }>;
  deleteAttachment(opts: { attachmentId: string }): Promise<void>;

  // Goals — persistent cross-turn objective with a judge model. After every
  // assistant turn that runs against this session, the configured judge
  // evaluates progress and decides `done`, `continue`, or `waiting`. A
  // `continue` decision auto-enqueues a continuation message via `queue(...)`,
  // so user follow-ups posted while the goal is running still preempt the
  // continuation cleanly. See §4.7.
  setGoal(opts: SetGoalOptions): GoalState;
  getGoal(): GoalState | null;
  pauseGoal(): GoalState | null;
  resumeGoal(): GoalState | null;
  clearGoal(): void;

  // Token usage
  getTokenUsage(): TokenUsage;

  // Lifecycle
  //
  // `close` is the ergonomic instance method for the common case where the
  // caller already has a `Session` reference. It delegates to
  // `harness.closeSession({ sessionId: this.id })`, which remains the
  // canonical implementation — call that form when you only have the ID
  // (e.g. iterating over `harness.listSessions(...)` summaries).
  close(): Promise<void>;
}
```

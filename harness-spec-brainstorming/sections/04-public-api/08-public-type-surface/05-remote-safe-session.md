### 4.8e RemoteSafeSession

```ts
// Typed intersection that both in-process Session and SDK RemoteSession satisfy.
// Methods excluded by §13.5 are absent. Question/plan registration is
// tool-context-only through `HarnessRequestContext` (§6.1) and is intentionally
// absent from both public Session and RemoteSafeSession; only the corresponding
// response methods are portable.
interface RemoteSafeSession<TState = Record<string, unknown>> {
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly createdAt: number;
  readonly lastActivityAt: number;

  getState(): Awaitable<ReadonlyState<TState>>;
  setState(updates: Partial<TState>): Promise<void>;

  getCurrentModeId(): Awaitable<string>;
  getCurrentMode(): Awaitable<HarnessMode>;
  switchMode(opts: { mode: string }): Promise<void>;

  getCurrentModelId(): Awaitable<string>;
  hasModelSelected(): Awaitable<boolean>;
  getCurrentModelAuthStatus(): Promise<ModelAuthStatus>;
  switchModel(opts: { model: string }): Promise<void>;
  setSubagentModel(opts: { agentType: string; model: string }): Promise<void>;
  getSubagentModel(opts: { agentType: string }): Awaitable<string | null>;

  message(opts: RemoteMessageOptions & { stream: true }): Promise<AgentStream>;
  message<S extends PublicSchema>(
    opts: RemoteMessageOptions<S> & { sync: true; output: S },
  ): Promise<InferPublicSchema<S>>;
  message(opts: RemoteMessageOptions): Promise<AgentResult>;

  queue(opts: QueueOptions): Promise<AgentResult>;
  useSkill<S extends PublicSchema | undefined = undefined>(
    name: string,
    opts?: RemoteUseSkillOptions<S>,
  ): Promise<S extends PublicSchema ? InferPublicSchema<S> : AgentResult>;

  listSkills(): Promise<RemoteSafeSkillDescriptor[]>;
  getSkill(name: string): Promise<RemoteSafeSkillDescriptor | undefined>;

  isBusy(): Awaitable<boolean>;
  waitForIdle(opts?: { timeout?: number }): Promise<void>;
  getQueueDepth(): Awaitable<number>;
  getCurrentRunId(): Awaitable<string | null>;
  getCurrentTraceId(): Awaitable<string | null>;

  listMessages(opts?: ListMessagesOptions): Promise<ListPage<HarnessMessage>>;
  getActivityTimeline(opts?: ActivityTimelineOptions): Promise<SessionActivityTimeline>;
  setThreadSetting(opts: { key: string; value: JsonValue }): Promise<void>;

  getDisplayState(): Awaitable<Readonly<HarnessDisplayStateSnapshotV1>>;
  subscribe(listener: HarnessListener): () => void;

  respondToToolApproval(opts: ToolApprovalResponse & InboxResponseOptions): Promise<InboxResponseResult>;
  respondToToolSuspension(opts: ToolSuspensionResponse & InboxResponseOptions): Promise<InboxResponseResult>;
  respondToQuestion(opts: { answer: string | string[] } & InboxResponseOptions): Promise<InboxResponseResult>;
  respondToPlanApproval(opts: { approved: boolean; reason?: string } & InboxResponseOptions): Promise<InboxResponseResult>;

  permissions: RemoteSafePermissions;
  om: RemoteSafeObservationalMemory;

  uploadAttachment(opts: {
    name: string;
    mimeType: string;
    data: Uint8Array;
    onProgress?: (loaded: number, total: number) => void;
  }): Promise<{ attachmentId: string }>;
  deleteAttachment(opts: { attachmentId: string }): Promise<void>;

  setGoal(opts: SetGoalOptions): Promise<GoalState>;
  getGoal(): Awaitable<GoalState | null>;
  pauseGoal(): Promise<GoalState | null>;
  resumeGoal(): Promise<GoalState | null>;
  clearGoal(): Promise<void>;

  getTokenUsage(): Awaitable<TokenUsage>;
  close(): Promise<void>;
}

interface RemoteSession<TState = Record<string, unknown>>
  extends RemoteSafeSession<TState> {}
```

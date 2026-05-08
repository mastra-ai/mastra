### 6.1 `HarnessRequestContext`

```ts
interface HarnessRequestContext<TState = unknown> {
  // Identity — always populated.
  harnessId: string;
  sessionId: string;
  threadId: string;
  resourceId: string;

  // Current per-turn defaults (resolved with overrides applied).
  modeId: string;

  // User-defined session state.
  state: TState;
  getState: () => TState;
  setState: SetStateFn<TState>;

  // Lifecycle.
  abortSignal: AbortSignal;

  // Eventing and suspension.
  emitEvent: (event: HarnessEvent) => void;
  registerQuestion: (params: RegisterQuestionParams) => void;
  registerPlanApproval: (params: RegisterPlanApprovalParams) => void;

  // Subagent linkage. For the parent session: `subagentDepth: 0`,
  // `source: 'parent'`, `parentSessionId` and `subagentToolCallId` undefined.
  // For a subagent: depth ≥ 1, `source: 'subagent'`, parent linkage populated.
  subagentDepth: number;
  source: 'parent' | 'subagent';
  parentSessionId?: string;
  subagentToolCallId?: string;

  // Subagent model resolver — returns the configured model ID for a given
  // agent type, or `null` to fall back to the session's default model.
  getSubagentModel: (params?: { agentType?: string }) => string | null;

  // Workspace handle — only present when the harness is configured with a
  // workspace. Tools that need filesystem / sandbox access should always
  // null-check this and degrade gracefully when it's missing.
  workspace?: Workspace;
}

// `setState` is overloaded:
//  - Object form does a shallow merge into the current state.
//  - Function form runs an atomic read-modify-write — the harness reads the
//    live state at call time, passes it to the updater, persists the return.
//    The updater MUST be synchronous; async work should happen first, then
//    the resolved value goes into a fresh setState call.
type SetStateFn<TState> = {
  (updates: Partial<TState>): Promise<void>;
  (updater: (prev: TState) => TState): Promise<void>;
};
```

### 4.2a State, Mode, and Model

```ts
class Session<TState = Record<string, unknown>> {
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly createdAt: number;
  readonly lastActivityAt: number;

  // State.
  // In-process, `getState()` is a sync memory read served from the live session
  // under the lease, but it returns a detached read-only snapshot, not the live
  // object. The remote variant (`RemoteSession`) exposes the same name but
  // returns `Promise<ReadonlyState<TState>>`; portable code using
  // `RemoteSafeSession` should await it. See §2.6 and §13.5.
  // `setState` has two forms. Object-form writes use the shared top-level
  // merge algorithm in §5.1. The functional form is local-only and commits the
  // returned object as a full-state replacement after the same JSON validation.
  getState(): ReadonlyState<TState>;
  setState(updates: Partial<TState>): Promise<void>;
  setState(updater: (prev: ReadonlyState<TState>) => TState): Promise<void>;

  // Mode
  getCurrentModeId(): string;
  getCurrentMode(): HarnessMode;
  // Persists the session's default mode for future run starts. The new mode's
  // `agentId` becomes the default agent selection for subsequent turns, but it
  // does not mutate any already committed run surface.
  switchMode(opts: { mode: string }): Promise<void>;

  // Model
  getCurrentModelId(): string;
  hasModelSelected(): boolean;
  getCurrentModelAuthStatus(): Promise<ModelAuthStatus>;
  switchModel(opts: { model: string }): Promise<void>;
  setSubagentModel(opts: { agentType: string; model: string }): Promise<void>;
  getSubagentModel(opts: { agentType: string }): string | null;

```

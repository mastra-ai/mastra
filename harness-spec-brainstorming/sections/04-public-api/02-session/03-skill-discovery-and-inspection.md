### 4.2c Skill Discovery and Inspection

```ts
  // Skill discovery — applies the full resolution chain (code-registered,
  // then workspace-discovered). See §4.6.
  listSkills(): Promise<HarnessSkill[]>;
  getSkill(name: string): Promise<HarnessSkill | undefined>;

  // Drop the cached workspace-discovery result. The next listSkills /
  // getSkill / useSkill call re-runs async workspace discovery.
  // Code-registered skills are unaffected — they live on the harness and
  // don't need refreshing. Local-only: workspace discovery requires
  // server-side access to the configured workspace skill source, so
  // refreshSkills is absent from RemoteSession.  See §4.6 and §13.5.
  refreshSkills(): Promise<void>;

  // Concurrency / inspection (read-only). These methods read the owning
  // session's live projection when resident, otherwise the reconciled
  // `SessionRecord` projection after hydration. `isBusy()` and
  // `waitForIdle(...)` use the session-owned idle boundary: no non-terminal
  // `currentRun` (`starting`, `running`, `waiting`, or `resuming`), no
  // canonical pending approval/suspension/question/plan item, and an empty
  // `SessionRecord.pendingQueue`. They do not wait for upstream channel inbox
  // retry, downstream outbox delivery, or unrelated background diagnostics.
  // `waitForIdle({ timeout })` rejects if the timeout elapses before that
  // boundary is reached and does not mutate session state; the rejection is not
  // operation settlement evidence. Calling it from work that itself keeps the
  // same session busy can wait until that work reaches a terminal or pending
  // idle boundary.
  //
  // `getQueueDepth()` reports `SessionRecord.pendingQueue.length` under the
  // active session owner or from the hydrated record; it never counts the
  // legacy in-memory follow-up buffer.
  //
  // `getCurrentRunId()` and `getCurrentTraceId()` read the live agent state
  // when present, otherwise the reconciled `SessionRecord.currentRun` snapshot
  // (§5.1/§5.7). After a process restart they return `null` for interrupted
  // non-resumable direct messages unless a pending item or agent-layer run
  // proves the run is still active. Cancellation is not a session concern in
  // v1 — see §3.
  isBusy(): boolean;
  waitForIdle(opts?: { timeout?: number }): Promise<void>;
  getQueueDepth(): number;
  getCurrentRunId(): string | null;
  getCurrentTraceId(): string | null;

```

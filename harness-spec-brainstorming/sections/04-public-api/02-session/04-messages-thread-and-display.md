### 4.2d Messages, Thread, and Display

```ts
  // Messages
  listMessages(opts?: ListMessagesOptions): Promise<ListPage<HarnessMessage>>;
  // Chronological UX read model. This is reconstructed from existing durable
  // sources and redacted read models; it is not SSE replay, operation
  // settlement, or read-state.
  getActivityTimeline(opts?: ActivityTimelineOptions): Promise<SessionActivityTimeline>;

  // Thread app metadata. This is the only public thread-metadata extension
  // point. It writes `HarnessThread.metadata.app[key]`, never a raw top-level
  // thread metadata key. `key` must use the storage-safe metadata-key grammar
  // (`^[A-Za-z_][A-Za-z0-9_]{0,127}$`) and must not be `__proto__`,
  // `prototype`, `constructor`, or a reserved Harness, Mastra, Memory,
  // channel, or legacy metadata name; invalid or reserved keys reject with
  // `HarnessValidationError`. `value` must be canonical JSON (`JsonValue` —
  // see §4.4 / §6.1); non-JSON or lossy values reject before storage is
  // touched. The harness never reads `metadata.app` for mode/model,
  // permissions, token usage, OM config, channel state, subagent ownership,
  // thread title/list labels, or any other runtime decision. Use typed Session
  // or thread APIs for those fields.
  setThreadSetting(opts: { key: string; value: JsonValue }): Promise<void>;

  // Display state. This public shape is the wire/persistence-safe
  // `HarnessDisplayStateSnapshotV1` from §5.1: plain JSON only, with arrays or
  // records instead of Map/Set and epoch milliseconds instead of Date objects.
  // An implementation may keep a richer in-process render model internally,
  // but public reads, display-state subscriptions, storage snapshots, and HTTP
  // responses all normalize to the snapshot shape. On hydration this is rebuilt
  // from the persisted display snapshot when usable, plus durable
  // queue/pending/currentRun/thread/message state. It is renderable state only,
  // not durable SSE replay.
  getDisplayState(): Readonly<HarnessDisplayStateSnapshotV1>;
  subscribe(listener: HarnessListener): () => void;
  subscribeDisplayState(
    listener: (state: HarnessDisplayStateSnapshotV1) => void,
    opts?: { windowMs?: number },
  ): () => void;

```

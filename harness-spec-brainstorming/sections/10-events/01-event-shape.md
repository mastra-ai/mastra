### 10.1 Event shape

Every event has the same four base fields plus a discriminated payload keyed by `type`:

```ts
interface HarnessEventBase {
  id: string;                        // Epoch-prefixed, per-session monotonic event ID, of the form
                                     // `<epoch>-<seq>`. `epoch` is regenerated on every cold start
                                     // of the in-memory Session instance (initial hydration, or
                                     // re-hydration after eviction), and `seq` is a monotonic int
                                     // within that epoch. Harness-scoped events use a parallel
                                     // harness-scoped epoch+seq. See §10.5 for the replay contract
                                     // and how stale IDs from a previous epoch are detected.
  type: string;                      // Discriminator. Built-in types listed below;
                                     // custom types use a dotted prefix (e.g. `myorg.foo`).
  sessionId?: string;                // Set for session-scoped events; absent for harness-scoped.
  timestamp: number;                 // ms epoch.
}

type HarnessEvent = HarnessEventBase & (
  | LifecycleEvent
  | StateEvent
  | TurnEvent
  | ToolEvent
  | SubagentEvent
  | SuspensionEvent
  | AttachmentEvent
  | StorageErrorEvent
  | CustomEvent
);
```

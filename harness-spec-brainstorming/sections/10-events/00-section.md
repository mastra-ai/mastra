## 10. Events

Events are how the harness reports what's happening to subscribers. They fan out two ways:

- **Session-scoped** — emitted on a specific session and delivered to every subscriber of that session (`session.subscribe(...)`). All turn-level activity flows here.
- **Harness-scoped** — emitted at the harness level for things that don't belong to any one session (session lifecycle, intervals, storage errors). Delivered to harness subscribers (`harness.subscribe(...)`).

Both surfaces use the same listener shape: `(event: HarnessEvent) => void`, returning an unsubscribe function.

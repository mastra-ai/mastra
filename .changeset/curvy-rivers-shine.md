---
'@mastra/core': minor
'mastracode': patch
---

The Harness event bus now lives on the Session. Each `Session` owns its own listeners and emit pipeline (`session.subscribe()` / internal `session.emit()`), so events emitted on one session are delivered only to that session's subscribers — never to another session's. This is the isolation foundation for serving a single Harness to multiple concurrent sessions (e.g. one Harness backing many channel threads).

Breaking (Harness is under active development): `Harness.subscribe()` is removed. Subscribe on the session instead:

```diff
- harness.subscribe(listener)
+ harness.session.subscribe(listener)
```

Session subsystems (mode/model/om/permissions/subagents/state) no longer receive an injected `emit` callback — they emit directly to their session's bus. `mastracode` is updated to subscribe via `harness.session.subscribe()`.

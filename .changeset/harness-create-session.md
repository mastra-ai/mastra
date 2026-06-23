---
'@mastra/core': minor
'mastracode': patch
---

Made the Harness a pure factory + shared-resource owner and removed its singleton session. The Harness no longer holds a `#session` field or exposes a `harness.session` getter; instead, callers create fully isolated sessions via `harness.createSession()`. Each session owns its own mode, model, state, thread, run-control, event bus, and stream engine, so a single Harness can now serve many concurrent sessions (e.g. one per user/thread in a server or channel adapter) without cross-session state or event leakage.

`harness.createSession({ resourceId? })` constructs and wires a new `Session`, replays the current workspace status onto it, and selects or creates its thread before returning. Harness methods that previously read the singleton session are now parameterized by an explicit `session` argument (`setResourceId`, `getKnownResourceIds`, `getCurrentModelAuthStatus`, `loadOMProgress`, `getObservationalMemoryRecord`, `destroy`). `harness.init()` is now idempotent, so repeated calls reuse the same initialization instead of rebuilding internal state.

**Before**

```typescript
const harness = new Harness(config);
await harness.init();
const session = harness.session; // singleton
await session.sendMessage({ content: 'hello' });
```

**After**

```typescript
const harness = new Harness(config);
await harness.init();
const session = await harness.createSession({ resourceId });
await session.sendMessage({ content: 'hello' });

// A second, fully isolated session from the same Harness:
const other = await harness.createSession({ resourceId: otherUser });
```

Removed `harness.session`, `harness.getSession()`, the singleton `#session` field, and the deprecated `harness.subscribe`/`harness.emit`/`harness.memory` delegators.

`mastracode` is updated to consume the new API: composition roots call `createSession()` once at startup and store the result on `state.session`, and all per-session operations flow through that session object.

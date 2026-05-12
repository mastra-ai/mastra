### 13.4m Type Compatibility

**Type compatibility.** Both `Session` (in-process) and `RemoteSession`
implement `RemoteSafeSession`. Portable code should accept `RemoteSafeSession`.
Code that needs local session-only powers such as workspace handles or
function-valued tools should accept `Session`. Code that needs local
harness-only powers such as interval handlers or cross-session subscriptions
should accept the in-process `Harness`. Neither shape is deployable as-is to a
remote SDK consumer.

`RemoteSafeSession` uses `Awaitable<T>` for methods whose local implementation
is synchronous but whose remote implementation must cross HTTP, such as
`getState`, `getDisplayState`, mode/model/O.M. reads, concurrency/inspection
reads, and goal state reads. `getDisplayState` returns
`HarnessDisplayStateSnapshotV1` on both local and remote sessions; local
implementations may normalize from richer internal render state before
returning. Portable code should still `await` these reads; `await` is a no-op
for the in-process return value.

```ts
import type { RemoteSafeSession } from '@mastra/core/harness/v1';

// Portable: works against an in-process Session or a remote SDK session.
async function summarize(session: RemoteSafeSession) {
  return session.message({ content: 'Summarize the diff', output: SummarySchema, sync: true });
}

summarize(localSession);   // ✅
summarize(remoteSession);  // ✅

// Local-only: requires direct workspace access.
async function tarball(session: Session) {
  const ws = session.getWorkspace();           // not on RemoteSession
  return ws?.exec('tar', ['-czf', 'out.tgz', '.']);
}
```

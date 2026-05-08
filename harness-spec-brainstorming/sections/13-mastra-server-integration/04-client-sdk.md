### 13.4 Client SDK

`@mastra/client-js` exposes a `HarnessClient` with the same surface as the in-process `Harness` — minus the parts that don't translate over the wire (workspace direct access, in-process subscriptions to non-session events, etc., see §13.5).

```ts
import { MastraClient } from '@mastra/client-js';

const mastra = new MastraClient({ baseUrl: 'https://mastra.example.com' });
const harness = mastra.getHarness('coding');

// Same shape as in-process. `session` is a `RemoteSession` that proxies
// every call to the server.
const session = await harness.session({ sessionId });

session.subscribe(event => render(event));
await session.queue({ content: 'Refactor auth' });
```

**`RemoteSession`** implements the wire-safe subset of `Session`'s methods (the `RemoteSafeSession` interface — §2.6, §13.5). Each method either:

- POSTs/PATCHes to the corresponding route and returns the deserialized result, or
- (for `subscribe`) opens an SSE connection to `/events`, dispatches events to the listener, and returns an unsubscribe function.

Methods listed in §13.5 (raw `getWorkspace`, function-valued `addTools`, `onInterval`, cross-session subscriptions, the functional form of `setState`, and `refreshSkills`) are absent from the `RemoteSession` type. Reaching for them on a remote session fails to type-check.

**Reconnection** is automatic. If the SSE stream drops, the client reconnects with `Last-Event-ID` and replays events newer than the last seen ID. If the supplied ID is from a previous epoch (server restart or session eviction) or older than the live buffer, the server returns `412 Precondition Failed`; the client transparently re-fetches state via `GET /sessions/:sessionId` and resumes from the new tail. See §10.5 for the full contract.

**Type compatibility.** Both `Session` (in-process) and `RemoteSession` implement `RemoteSafeSession`. Portable code should accept `RemoteSafeSession`. Code that needs the full local surface (workspace handles, interval handlers, function-valued tools) should accept `Session` and is not deployable as-is to a remote SDK consumer.

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

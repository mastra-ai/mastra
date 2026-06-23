---
'@mastra/client-js': minor
---

Add a `harness` resource to the client SDK.

`MastraClient` now exposes `listHarnesses()` and `getHarness(id)`. A
`Harness` scopes to a harness registered on the connected Mastra instance, and
`harness.session(resourceId)` returns a `HarnessSession` that can create/resume
a session, send messages, steer, abort, approve/decline tool calls, respond to
tool suspensions, switch mode/model, manage threads, send notifications, read
state, and subscribe to the session's event stream over SSE.

```ts
const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
const harness = client.getHarness('code');
const session = harness.session('user-1');

const subscription = await session.subscribe({ onEvent: event => console.log(event) });

await session.create();
await session.sendMessage('Summarize this PR');

// later
subscription.unsubscribe();
```

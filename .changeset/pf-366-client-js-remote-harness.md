---
"@mastra/client-js": minor
---

Added first-party client-js RemoteHarness and RemoteSession resources for Harness v1 server routes.

`MastraClient#getHarness(name)` now exposes remote Harness sessions:

- Added remote session management: list, create, load, and close sessions.
- Added snapshot, state, mode, model, permissions, inbox, and goal APIs.
- Added durable message admission and queued work admission.
- Added event subscription with Last-Event-ID replay and result lookup for interrupted operations.
- Improved remote skill APIs so they fail clearly until matching server routes exist.

**Usage**

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
const session = await client.getHarness('default').session({ threadId: { fresh: true } });

const unsubscribe = session.subscribe(event => {
  console.log(event.type);
});

const result = await session.message({
  content: 'Summarize the workspace status',
  admissionId: 'workspace-summary-1',
});

unsubscribe();
```

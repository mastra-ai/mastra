---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/server': patch
---

User messages are stored as written. Before a message reaches the model, turn tags are escaped unless your server built the message with `asUserTurn`. A client cannot set that mark over HTTP.

```ts
import { asUserTurn } from '@mastra/core/memory';

// Take speaker fields from the authenticated session, not from the request body.
const message = asUserTurn({ id: session.user.id, name: session.user.name, role: session.user.role }, body.text);
await agent.generate([message]);
```

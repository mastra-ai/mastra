---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Fixed Knowledge companion scopes:

- Records placed in a companion scope are found the same way on every store.
- Search results no longer reveal a record's parent node when the caller can see the record but not the node.
- Companion scopes are never created for you. Declare one under `scopes` when you want a holding area for provisional findings:

```ts
import { Knowledge } from '@mastra/core/knowledge';

const knowledge = new Knowledge({
  scopes: {
    'thread:$threadId:uncurated': {
      access: [{ principal: 'thread:$threadId', role: 'mirror' }],
      description: 'Provisional session findings awaiting review.',
    },
  },
});
```

---
'@mastra/core': minor
---

Added keyed Knowledge instances. Register each instance under a stable key on `Mastra` and look it up with `mastra.getKnowledge()`. An instance without its own storage uses the Mastra storage. Each instance's tables are created the first time it is used.

```ts
import { Mastra } from '@mastra/core';
import { Knowledge } from '@mastra/core/knowledge';
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'app', url: 'file:./mastra.db' }),
  knowledge: {
    team: new Knowledge({ id: 'team' }),
    research: new Knowledge({
      id: 'research',
      storage: new LibSQLStore({ id: 'research', url: 'file:./research.db' }),
    }),
  },
});

const team = mastra.getKnowledge('team');
```

Two instances can never share a database, because Knowledge rows from one would be readable through the other. Registering `research` without its own storage, or pointing it at `file:./mastra.db`, throws `MASTRA_ADD_KNOWLEDGE_SHARED_STORAGE`.

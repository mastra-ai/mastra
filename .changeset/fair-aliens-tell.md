---
'@mastra/memory': minor
---

Added a `knowledge` option to `Memory` that picks which Knowledge store the experimental Subconscious reads and writes. Curation, Knowledge tools, semantic search, and pinned context all use that one store, so a Mastra app with several Knowledge stores never mixes them up.

```ts
import { Mastra } from '@mastra/core';
import { Knowledge } from '@mastra/core/knowledge';
import { Memory } from '@mastra/memory';

const mastra = new Mastra({
  storage,
  knowledge: { team: new Knowledge({ storage: teamStorage }) },
});

// Use the Knowledge store registered under the `team` key.
const memory = new Memory({ storage, knowledge: 'team' });
```

Pass a `Knowledge` instance directly when you don't use `Mastra` registration, or `false` to turn Knowledge off. If you leave `knowledge` out, Memory uses the Knowledge domain of its own storage. A key that can't be found, or `false`, never falls back to another store. The curator also receives the descriptions of the scopes it can see, to help it place new knowledge.

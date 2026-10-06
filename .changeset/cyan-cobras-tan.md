---
'@mastra/code-sdk': minor
---

Added a `knowledge` option to `createMastraCode` for a Knowledge instance your app owns. Mastra Code registers it on its Mastra runtime under `key`, and memory, observation-time curation, and the Knowledge inspector all use that one instance.

```ts
import { createMastraCode } from '@mastra/code-sdk';
import { Knowledge } from '@mastra/core/knowledge';

const knowledge = new Knowledge({ id: 'acme', storage });

const { knowledgeInspector } = await createMastraCode({
  storage,
  knowledge: { key: 'acme', instance: knowledge },
});
```

`knowledgeInspector` browses scoped nodes, records, activity, and relationships. It is `undefined` when storage has no Knowledge domain; `knowledgeInspectorUnavailableReason` explains why.

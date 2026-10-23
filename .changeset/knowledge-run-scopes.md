---
'@mastra/core': minor
---

Knowledge no longer ships built-in scope types. Hosts configure the scope types they use, and Memory's org → resource → thread chain is an opt-in preset:

```ts
import { Knowledge, memoryScopeTypes } from '@mastra/core/knowledge';

const knowledge = new Knowledge({
  storage,
  scopes: { ...memoryScopeTypes, 'team:$teamId': { access: [{ principal: 'self', role: 'append' }] } },
});
```

A scope type can name the type it nests under with `parent`, and mark itself `identity` so child templates and importers can never create it. `knowledge.materializeRunScopes({ scopes })` turns a run's trusted scopes (for example `getRunAgentScopes(requestContext)`) into Knowledge scopes, parent-first, and refuses to move an existing scope under a different parent.

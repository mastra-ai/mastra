---
'@mastra/code-sdk': patch
---

Added a `skills` option to `MastraCodeConfig`. Agent-level skills passed here are forwarded to the coding agent and are available in every session, independent of the request-scoped workspace.

```ts
import { createSkill } from '@mastra/core/skills';
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

const { controller } = await mountAgentControllerOnMastra({
  cwd: process.cwd(),
  skills: [
    createSkill({
      name: 'triage',
      description: 'Triage an incoming issue',
      instructions: '...',
    }),
  ],
});
```

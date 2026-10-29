---
'@mastra/code-sdk': patch
---

Export `CODE_AGENT_ID` from `@mastra/code-sdk/constants`, the id of the coding agent Mastra Code registers.

```ts
import { CODE_AGENT_ID } from '@mastra/code-sdk/constants';

const isCodeAgent = (agentId: string) => agentId === CODE_AGENT_ID;
```

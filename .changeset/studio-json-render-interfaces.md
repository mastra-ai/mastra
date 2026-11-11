---
'@mastra/playground-ui': minor
---

Studio now shows interfaces from agents that use `@mastra/json-render`. Replies render their interface below the prose with Studio's own cards, metrics, badges and notices, both while streaming and after a thread is reopened.

Use `studioCatalog` to let an agent compose interfaces from those components. It has no React imports, so a server can load it:

```ts
import { Agent } from '@mastra/core/agent';
import { JsonRenderProcessor } from '@mastra/json-render';
import { studioCatalog } from '@mastra/playground-ui/domains/json-render/catalog';

const jsonRender = new JsonRenderProcessor({ catalog: studioCatalog });

export const uiAgent = new Agent({
  id: 'ui-agent',
  name: 'UI Agent',
  instructions: studioCatalog.prompt({ mode: 'inline', editModes: ['patch'] }),
  model: 'openai/gpt-6.1-sol',
  inputProcessors: [jsonRender],
  outputProcessors: [jsonRender],
});
```

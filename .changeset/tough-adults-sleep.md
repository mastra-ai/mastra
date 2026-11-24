---
'@mastra/json-render': minor
---

Added `studioCatalog` at `@mastra/json-render/studio`. Agents that compose with it get their interfaces drawn in Studio's chat with Studio's own components, without writing any client code. The catalog covers layout, content, and form controls, and its `sendMessage` action sends the values the user entered back to the agent.

```typescript
import { JsonRenderProcessor } from '@mastra/json-render';
import { studioCatalog } from '@mastra/json-render/studio';

const ui = new JsonRenderProcessor({ catalog: studioCatalog });

const agent = new Agent({
  // ...
  instructions: studioCatalog.prompt({ mode: 'inline', editModes: ['patch'] }),
  inputProcessors: [ui],
  outputProcessors: [ui],
});
```

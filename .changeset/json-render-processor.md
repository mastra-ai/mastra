---
'@mastra/json-render': minor
---

Added `@mastra/json-render`, which lets agents compose [json-render](https://json-render.dev) interfaces from your component catalog.

```ts
import { JsonRenderProcessor } from '@mastra/json-render';

const ui = new JsonRenderProcessor({ catalog });

const agent = new Agent({
  id: 'ui-agent',
  name: 'UI Agent',
  model: 'openai/gpt-6.1-sol',
  instructions: catalog.prompt({ mode: 'inline', editModes: ['patch'] }),
  inputProcessors: [ui],
  outputProcessors: [ui],
  maxProcessorRetries: 2,
  memory: new Memory(),
});
```

- Interfaces the model writes stream to the client as `data-spec` parts, and the reply's text keeps only the prose. Render them with `useJsonRenderMessage()` from `@json-render/react`.
- Interfaces are saved with the message, so they render again after a reload.
- Later turns can edit the latest interface with a few patches. Send the interface's state under the `JSON_RENDER_STATE` request context key, and the model sees what the user set and the edit keeps it.
- Interfaces that don't match the catalog are sent back to the model to fix before they're saved.

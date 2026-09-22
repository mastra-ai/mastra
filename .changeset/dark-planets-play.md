---
'@mastra/playground-ui': patch
---

Processor spans in Studio traces now open with a readable Preview instead of JSON only. The preview shows the messages a processor received, the messages and system messages it changed (or "No changes"), and tool, step and chunk details where the phase records them.

The Attributes section also gains a Preview for processor spans: processor name, pipeline phase, executor, pipeline position, hook duration, message-list changes as readable actions (added, removed, cleared), and a tripwire as a blocked run with its reason and retry state. Attributes the preview does not explain stay in JSON, so no value is shown twice.

The Preview / JSON toggle still keeps the exact stored payload one click away, and processor spans recorded before the phase was tracked keep their JSON view. Both the full span panel and the compact span details use the same presentation.

With tracing enabled, an agent using this processor now shows the added system message in its processor span Preview:

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'Help the user.',
  model: 'openai/gpt-5-mini',
  inputProcessors: [{
    id: 'brief-answers',
    processInput: async ({ messageList }) => {
      messageList.addSystem('Answer briefly.');
      return messageList;
    },
  }],
});
```

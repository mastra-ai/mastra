# @mastra/json-render

Let Mastra agents compose [json-render](https://json-render.dev) interfaces from your component catalog. The interfaces stream to the client, are saved with the message, and can be edited in later turns.

## Installation

```bash
npm install @mastra/json-render @json-render/core @json-render/react
```

## Usage

Register the processor as both an input and an output processor, and build the instructions from your catalog:

```typescript
import { Agent } from '@mastra/core/agent';
import { JsonRenderProcessor } from '@mastra/json-render';
import { Memory } from '@mastra/memory';
import { catalog } from './catalog';

const ui = new JsonRenderProcessor({ catalog });

export const uiAgent = new Agent({
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

On the client, render each message's `data-spec` parts with `useJsonRenderMessage()` from `@json-render/react`. Send the interface's state under the `JSON_RENDER_STATE` request context key so the model sees what the user set.

## Documentation

- [json-render](https://mastra.ai/integrations/agentic-ui/json-render)

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

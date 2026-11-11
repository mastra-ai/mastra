# @mastra/json-render

Let Mastra agents compose [json-render](https://json-render.dev) interfaces from your component catalog. The interfaces stream to the client, are saved with the message, and can be edited in later turns.

## Installation

```bash
npm install @mastra/json-render
```

It needs `@json-render/core` on the server and `@json-render/react` to render on the client:

```bash
npm install @json-render/core @json-render/react
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
  instructions: catalog.prompt({
    mode: 'inline',
    editModes: ['patch'],
    system: 'You are a travel assistant. Prefer showing an interface over describing it.',
  }),
  inputProcessors: [ui],
  outputProcessors: [ui],
  maxProcessorRetries: 2,
  memory: new Memory(),
});
```

On the client, render each message's `data-spec` parts with `useJsonRenderMessage()` from `@json-render/react`. Send the interface's state under the `JSON_RENDER_STATE` request context key so the model sees what the user set.

json-render 0.22's `buildSpecFromParts()` writes patch values into the spec by reference, so building the same parts again (on every streamed chunk) repeats list items. Pass `useJsonRenderMessage()` a copy of the parts:

```tsx
import { useJsonRenderMessage } from '@json-render/react';
import { useMemo } from 'react';

function Reply({ message }) {
  const parts = useMemo(() => structuredClone(message.content.parts), [message.content.parts]);
  const { spec } = useJsonRenderMessage(parts);
  // Render `spec` with your registry.
}
```

### Show interfaces in Mastra Studio

Studio renders interfaces built from `studioCatalog` with its own cards, metrics, badges and notices. Use it as the agent's catalog. It needs `@json-render/react` installed, but loads only its schema, not React:

```typescript
import { JsonRenderProcessor } from '@mastra/json-render';
import { studioCatalog } from '@mastra/json-render/studio';

const ui = new JsonRenderProcessor({ catalog: studioCatalog });
```

Studio skips interfaces that use components outside `studioCatalog`.

## Documentation

- [Processors](https://mastra.ai/docs/agents/processors)
- [json-render](https://json-render.dev)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/json-render/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

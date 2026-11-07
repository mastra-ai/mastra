---
'@mastra/react': minor
---

Added Generative UI to `@mastra/react/gen-ui` (beta). Agents can now show your React components in chat:

- **Tool renderers**: custom views for backend tool calls, with streamed arguments, validated output, and built-in approve/decline and suspend/resume controls.
- **Component tools**: the model calls a catalog component as a frontend tool, either to display it or to wait for the user's answer.
- **Spec tool**: the model composes catalog components into a [json-render](https://github.com/vercel-labs/json-render) spec, rendered inline where the tool call appears and element by element while it streams.

Components and actions are declared once in a json-render catalog (`defineCatalog`), and `createGenUI` takes one React implementation per catalog component. Specs render with json-render's `Renderer`, so state bindings (`$state`, `$bindState`) and events bound to actions through `on` work as in json-render. Action handlers passed to `useGenUIChat` get params typed and validated from the catalog, plus the chat and the spec's state. Specs with unknown components, invalid props or cycles are rejected so the model can retry, specs from a stopped run show as interrupted, and everything rebuilds from thread history after a reload. The spec tool works with strict structured-output models. Plain `useChat` is unchanged.

Requires `@mastra/core` 1.83.0 or later on the server, and `@json-render/core` and `@json-render/react` 0.22 with React 19.2.3 and zod 4 in your app.

```tsx
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { MessageFactory } from '@mastra/react/ui';
import { createGenUI, useGenUIChat } from '@mastra/react/gen-ui';
import type { GenUIActionHandlers } from '@mastra/react/gen-ui';
import { z } from 'zod';

const catalog = defineCatalog(schema, {
  components: {
    WeatherCard: {
      description: 'Current weather for a city',
      props: z.object({ city: z.string(), temp: z.number() }),
    },
    FollowUp: {
      description: 'Suggested follow-up. Bind `press` to the `ask` action.',
      props: z.object({ label: z.string() }),
      events: ['press'],
    },
  },
  actions: {
    ask: { description: 'Send a prompt to the agent', params: z.object({ prompt: z.string() }) },
  },
});

const genUI = createGenUI({
  catalog,
  components: {
    WeatherCard: ({ props }) => (
      <p>
        {props.city}: {props.temp}°
      </p>
    ),
    FollowUp: ({ props, emit }) => <button onClick={() => emit('press')}>{props.label}</button>,
  },
  // The model may call WeatherCard directly as a tool.
  componentTools: { WeatherCard: true },
  // The model may compose catalog components into a spec with the `ui_spec` tool.
  specTool: true,
});

const actions: GenUIActionHandlers<typeof catalog> = {
  ask: ({ prompt }, { chat }) => chat.sendMessage(prompt),
};

function Chat() {
  const chat = useGenUIChat({ agentId: 'weather-agent', genUI, actions });
  return chat.messages.map(m => <MessageFactory key={m.id} message={m} {...chat.genUI.renderers} />);
}
```

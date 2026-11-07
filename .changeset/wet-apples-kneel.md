---
'@mastra/react': minor
---

Added Generative UI to `@mastra/react/gen-ui` (beta). Agents can now show your React components in chat: custom views for backend tool calls, components the model calls as frontend tools (display or waiting for the user's answer), and [json-render](https://github.com/vercel-labs/json-render) specs streamed from tools or composed by the model.

Components and actions are declared once in a json-render catalog (`defineCatalog`), and `createGenUI` takes one React implementation per catalog component, as json-render's `defineRegistry` does. Surfaces render with json-render's `Renderer`, so state bindings (`$state`, `$bindState`), events bound to actions through `on`, visibility, and repeats work as in json-render. Action handlers passed to `useGenUIChat` get params typed and validated from the catalog's action schemas, plus the chat, the surface state, and a state setter. Model-composed surfaces render element by element while the model is still writing them, and work with strict structured-output models. User edits to surface state stay local and are flagged as conflicts when the agent changes the same path. Props are validated against the catalog schemas, unknown components show a fallback, and surfaces rebuild from thread history after a reload. Plain `useChat` is unchanged.

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
  // The model may also call WeatherCard directly as a tool.
  componentTools: { WeatherCard: true },
  // The model may compose catalog components into a surface.
  surfaceTool: true,
});

const actions: GenUIActionHandlers<typeof catalog> = {
  ask: ({ prompt }, { chat }) => chat.sendMessage(prompt),
};

function Chat() {
  const chat = useGenUIChat({ agentId: 'weather-agent', genUI, actions });
  return chat.messages.map(m => <MessageFactory key={m.id} message={m} {...chat.genUI.renderers} />);
}
```

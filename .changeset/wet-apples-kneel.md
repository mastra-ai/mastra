---
'@mastra/react': minor
---

Added Generative UI to `@mastra/react/gen-ui` (beta). Agents can now show your React components in chat: custom views for backend tool calls, components the model calls as frontend tools (display or waiting for the user's answer), and [json-render](https://github.com/vercel-labs/json-render) specs streamed from tools or composed by the model. Surfaces render with json-render's `Renderer`, so state bindings (`$state`, `$bindState`), events bound to your app's actions through `on`, visibility, and repeats work as in json-render. Model-composed surfaces render element by element while the model is still writing them, and work with strict structured-output models: the `ui_surface` tool takes events as a list and initial state as a JSON string, and lets every prop take a state binding. Declare the events a component raises with `events` so the model can bind actions to them. User edits to surface state stay local and are flagged as conflicts when the agent changes the same path. Props are validated against your schemas, unknown components show a fallback, and surfaces rebuild from thread history after a reload. Plain `useChat` is unchanged.

Requires `@mastra/core` 1.83.0 or later on the server, and `@json-render/core` and `@json-render/react` 0.22 with React 19.2.3 and zod 4 in your app. Older servers offer the model an empty input for the `ui_surface` tool and save answers to interactive components twice.

```tsx
import { MessageFactory } from '@mastra/react/ui';
import { createGenUI, defineGenUIComponent, useGenUIChat } from '@mastra/react/gen-ui';
import { z } from 'zod';

const WeatherCard = defineGenUIComponent({
  description: 'Current weather for a city',
  schema: z.object({ city: z.string(), temp: z.number() }),
  component: ({ props }) => (
    <p>
      {props.city}: {props.temp}°
    </p>
  ),
  tool: true,
});

const genUI = createGenUI({ components: { WeatherCard } });

function Chat() {
  const chat = useGenUIChat({ agentId: 'weather-agent', genUI });
  return chat.messages.map(m => <MessageFactory key={m.id} message={m} {...chat.genUI.renderers} />);
}
```

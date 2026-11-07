---
'@mastra/react': minor
---

Added Generative UI to `@mastra/react/gen-ui` (beta). Agents can now show your React components in chat: custom views for backend tool calls, components the model calls as frontend tools (display or waiting for the user's answer), and component trees streamed from tools or composed by the model. Model-composed surfaces render node by node while the model is still writing them. Props are validated against your schemas, unknown components show a fallback, and surfaces rebuild from thread history after a reload. Plain `useChat` is unchanged.

Requires `@mastra/core` 1.83.0 or later on the server. Older servers offer the model an empty input for the `ui_surface` tool and save answers to interactive components twice.

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

---
'@mastra/core': minor
---

Added `ui.studioComponent` to `createTool`, so you can render calls to a tool with your own React component in the Studio chat instead of the default tool card. The component's props are typed from the tool's `inputSchema` and `outputSchema`.

```tsx
// src/mastra/tools/weather-card.tsx
import type { ToolStudioComponentProps } from '@mastra/core/tools';

export function WeatherCard({ input, output }: ToolStudioComponentProps<{ city: string }, { temperature: number }>) {
  return output ? <p>{output.temperature}°C</p> : <p>Checking {input?.city}…</p>;
}
```

```ts
// src/mastra/tools/weather.ts
import { WeatherCard } from './weather-card';

export const weatherTool = createTool({
  id: 'get-weather',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temperature: z.number() }),
  ui: { studioComponent: WeatherCard },
  execute: async ({ city }) => ({ temperature: 21 }),
});
```

Import the component from a separate file. The component never loads on the server, and it can use hooks from `@mastra/react` to talk to the same server as Studio. See the [`createTool` reference](https://mastra.ai/reference/tools/create-tool#custom-studio-component) for details.

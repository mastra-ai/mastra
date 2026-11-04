---
'@mastra/client-js': minor
---

Added `@mastra/client-js/gen-ui` (beta), the framework-agnostic core of Generative UI. Use `createGenUIEmitter` in a tool or workflow step to stream validated UI updates that are saved with the message and replay safely after reloads and reconnects.

```ts
import { createGenUIEmitter } from '@mastra/client-js/gen-ui';

execute: async ({ city }, { writer }) => {
  const ui = createGenUIEmitter(writer).surface(`weather-${city}`);
  await ui.create({ nodes: [{ id: 'card', component: 'WeatherCard', props: { city, temp: 0 } }] });
  await ui.updateProps('card', { temp: await getTemperature(city) });
  await ui.setStatus('ready');
};
```

The subpath also exports the state reducer, session, action dispatcher, state and context stores, and a streaming JSON parser for building Generative UI bindings for other frameworks.

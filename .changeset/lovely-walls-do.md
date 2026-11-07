---
'@mastra/client-js': minor
---

Added `@mastra/client-js/gen-ui` (beta), the framework-agnostic core of Generative UI. Surfaces are [json-render](https://github.com/vercel-labs/json-render) specs: a tool or workflow step uses `createGenUIEmitter` to stream a spec and RFC 6902 patches to it. Updates are validated, saved with the message, and replay safely after reloads and reconnects.

```ts
import { createGenUIEmitter } from '@mastra/client-js/gen-ui';

execute: async ({ city }, context) => {
  const ui = createGenUIEmitter(context).surface();
  await ui.create({
    spec: {
      root: 'card',
      state: { temp: 0 },
      elements: { card: { type: 'WeatherCard', props: { city, temp: { $state: '/temp' } } } },
    },
  });
  await ui.setState('/temp', await getTemperature(city));
  await ui.setStatus('ready');
};
```

Requires `@mastra/core` 1.83.0 or later on the server, and `@json-render/core` 0.22 with zod 4 in your app.

The subpath also exports the state reducer, session, action dispatcher, state and context stores, and a streaming JSON parser for building Generative UI bindings for other frameworks.

---
'@mastra/core': minor
---

Added `toModelOutput` support to the agent loop. Tool definitions can now include a `toModelOutput` function that transforms the raw tool result before it's sent to the model, while preserving the raw result in storage. This matches the AI SDK `toModelOutput` convention — the function receives the raw output directly and returns `{ type: 'text', value: string }` or `{ type: 'content', value: ContentPart[] }`.

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const weatherTool = createTool({
  id: 'weather',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({
    city,
    temperature: 72,
    conditions: 'sunny',
    humidity: 45,
    raw_sensor_data: [0.12, 0.45, 0.78],
  }),
  // The model sees a concise summary instead of the full JSON
  toModelOutput: (output) => ({
    type: 'text',
    value: `${output.city}: ${output.temperature}°F, ${output.conditions}`,
  }),
});
```

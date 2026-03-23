---
'@mastra/client-js': minor
'@mastra/server': minor
---

**Added Responses API support for local Mastra apps**

You can now call Mastra through a Responses API flow and continue stored turns with
`previous_response_id`, while keeping `model` as a Mastra model string and using
`agent_id` for optional agent-backed execution. Advanced provider-native settings can
also be passed through with `providerOptions`, and provider-returned continuation state
is surfaced back on the response under the same `providerOptions` field. Stored
response IDs now map directly to the persisted assistant turn ID in Mastra memory.

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

const first = await client.responses.create({
  model: 'openai/gpt-5',
  agent_id: 'support-agent',
  input: 'Write a short bedtime story.',
  store: true,
});

const second = await client.responses.create({
  model: 'openai/gpt-5',
  agent_id: 'support-agent',
  input: 'Make it funnier.',
  store: true,
  previous_response_id: first.id,
});
```

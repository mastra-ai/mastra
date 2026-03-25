---
'@mastra/client-js': minor
'@mastra/server': minor
---

**Added Responses API support for local Mastra apps**

You can now call Mastra through a Responses API flow and continue stored turns with
`previous_response_id`, while keeping `model` as a Mastra model string and using
`agent_id` to target the registered Mastra agent that handles the request. This API acts as an agent-backed
adapter layer on top of Mastra memory and storage. Advanced provider-native settings can
also be passed through with `providerOptions`, and provider-returned continuation state
is surfaced back on the response under the same `providerOptions` field. Stored
response IDs now map directly to the persisted assistant turn ID in Mastra memory.
Configured tool definitions are returned under `tools`, while executed tool activity
is surfaced through `output` items such as `function_call`, `function_call_output`,
and the final assistant message. Stored responses also return `conversation_id`, which
maps directly to the underlying Mastra memory thread ID. You can create a conversation
explicitly with `client.conversations.create()` or let the first stored response create
it implicitly, then inspect the stored item history with `client.conversations.items.list()`.

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

const items = await client.conversations.items.list(first.conversation_id!);
```

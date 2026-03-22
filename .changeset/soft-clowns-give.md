---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added OpenAI-compatible `/v1/responses` support to Mastra Server and the client SDK.

**What changed**

Mastra Server now exposes `POST /v1/responses`, `GET /v1/responses/:responseId`, and `DELETE /v1/responses/:responseId`. The client SDK now exposes matching `client.responses.create()`, `client.responses.retrieve()`, `client.responses.stream()`, and `client.responses.delete()` helpers. Use the agent ID as `model`, set `store: true` to persist a response when the agent has memory configured, and use `previous_response_id` to continue the same memory thread.


```ts
const response = await client.responses.create({
  model: 'support-agent',
  input: 'Summarize this ticket',
  store: true,
});

console.log(response.output_text);
```

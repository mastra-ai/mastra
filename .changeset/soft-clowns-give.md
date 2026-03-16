---
'@mastra/server': minor
---

Added OpenAI-compatible `/v1/responses` routes to Mastra Server.

**What changed**

Mastra Server now exposes `POST /v1/responses`, `GET /v1/responses/:responseId`, and `DELETE /v1/responses/:responseId`. Use the agent ID as `model`, set `store: true` to persist a response when the agent has memory configured, and use `previous_response_id` to continue the same memory thread.

```ts
await fetch('http://localhost:4111/api/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'support-agent',
    input: 'Summarize this ticket',
    store: true,
  }),
});
```

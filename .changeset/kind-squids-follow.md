---
'@mastra/factory': minor
---

Replaced the Factory web model-pack preferences API with one personal default model. New interactive chats start with that model, while existing chats keep their selected model.

API consumers must replace calls to `/web/config/model-packs` with the new default-model routes:

```ts
await fetch('/web/config/default-model', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelId: 'openai/gpt-5.6' }),
});
```

Use `GET /web/config/default-model` to read the preference and `DELETE /web/config/default-model` to clear it.

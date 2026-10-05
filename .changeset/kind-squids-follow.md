---
'@mastra/factory': minor
---

Replaced web model-pack preferences with one personal default model. Added GET, PUT, and DELETE /web/config/default-model routes, and Factory sessions now persist that choice as currentModelId.

**Before**

```ts
await fetch('/web/config/model-packs');
```

**After**

```ts
await fetch('/web/config/default-model', {
  method: 'PUT',
  body: JSON.stringify({ modelId: 'openai/gpt-5.6' }),
});
```

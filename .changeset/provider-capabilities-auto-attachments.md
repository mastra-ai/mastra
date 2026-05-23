---
'@mastra/core': minor
'@mastra/memory': minor
---

Add per-provider capability files and `auto` mode for `observeAttachments`

- Generate per-provider capability files (e.g. `capabilities/openai.json`) alongside the model router registry, sourced from models.dev API
- Export `modelSupportsAttachments(modelRouterId)` from `@mastra/core/llm` to check whether a model supports image/file attachments
- Extend `observeAttachments` config to accept `'auto'` in addition to `boolean | string[]`
- When set to `'auto'`, the observer resolves the model (including function-based models) and checks the capability registry before deciding to forward or drop attachment parts

```typescript
const memory = new Memory({
  observeAttachments: 'auto', // Resolve model support through modelSupportsAttachments
});
```

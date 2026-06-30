---
'@mastra/editor': patch
---

Agent Builder agents now default observational memory to `__GATEWAY_OPENAI_MODEL_MINI__` instead of `__GATEWAY_GOOGLE_MODEL__`. Set `OPENAI_API_KEY` in any environment where Builder agents run. Core (non-builder) agents are unaffected and keep the framework default. Admins can still override the model:

```typescript
new MastraEditor({
  builder: {
    enabled: true,
    configuration: {
      agent: {
        memory: { observationalMemory: { model: '__GATEWAY_OPENAI_MODEL_MINI__' } },
      },
    },
  },
});
```

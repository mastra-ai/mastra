---
'@mastra/core': minor
---

Added `reasoning` option to `modelSettings` for controlling model reasoning effort level. This option accepts standardized levels ('provider-default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh') and is effective with LanguageModelV4 (AI SDK v7) providers that support reasoning. When used with older model providers (V2/V3), the option is a no-op.

**Usage:**

```typescript
const result = await agent.stream('Solve this problem', {
  modelSettings: { reasoning: 'high' },
});
```

Also upgraded the model router to support LanguageModelV4, enabling native V4 model resolution alongside existing V2 and V3 models without regressions.

---
'@mastra/core': patch
---

Built-in processors that use internal agents (PromptInjectionDetector, ModerationProcessor, PIIDetector, LanguageDetector, StructuredOutputProcessor) now accept `providerOptions` to control model behavior.

This lets you pass provider-specific settings like `reasoningEffort` for OpenAI thinking models:

```typescript
const processor = new PromptInjectionDetector({
  model: 'openai/o1-mini',
  threshold: 0.7,
  strategy: 'block',
  providerOptions: {
    openai: {
      reasoningEffort: 'low',
    },
  },
});
```

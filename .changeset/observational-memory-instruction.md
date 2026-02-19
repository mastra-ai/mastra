---
'@mastra/memory': minor
---

Add `instruction` property to observational memory configs

Adds optional `instruction` field to `ObservationConfig` and `ReflectionConfig` that allows users to extend the built-in observer/reflector system prompts with custom guidance.

Example:
```typescript
const memory = new ObservationalMemory({
  model: openai('gpt-4'),
  observation: {
    instruction: 'Focus on user preferences about food and dietary restrictions.',
  },
  reflection: {
    instruction: 'Prioritize consolidating health-related observations together.',
  },
});
```
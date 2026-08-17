---
'@mastra/evals': minor
---

Add opt-in conversation context to the Prompt Alignment scorer for multi-turn Agent evaluations.

Usage example:

```ts
createPromptAlignmentScorerLLM({
  model,
  options: {
    contextMode: 'conversation',
    maxRememberedMessages: 10,
  },
});
```

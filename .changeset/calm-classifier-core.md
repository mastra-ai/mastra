---
'@mastra/core': minor
---

Added configured classifiers as typed workflow steps with fluent and dynamic graph support. Classifier steps expose complete typed answers and token usage for existing branch and conditional control flow.

```ts
workflow
  .map({ message: { initData: true, path: 'message' } })
  .classifier(router)
  .branch([
    [async ({ inputData }) => inputData.answers.route.choice === 'billing', billingStep],
    [async ({ inputData }) => inputData.answers.route.choice === 'support', supportStep],
  ]);
```

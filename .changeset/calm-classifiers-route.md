---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Added configured classifiers as typed workflow steps with fluent and dynamic graph support. Classifier steps expose routing values, complete answers, and token usage for existing branch and conditional control flow.

```ts
workflow
  .classifier(router, { state: { path: 'inputData.message' } })
  .branch([
    [async ({ inputData }) => inputData.values.route === 'billing', billingStep],
    [async ({ inputData }) => inputData.values.route === 'support', supportStep],
  ]);
```

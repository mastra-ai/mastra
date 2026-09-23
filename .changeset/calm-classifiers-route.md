---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/playground-ui': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
---

Added configured classifiers as typed workflow steps with fluent and dynamic graph support. Classifier steps expose complete typed answers and token usage for existing branch and conditional control flow. The server schema accepts serialized classifier entries, and the code SDK exposes configured classifiers to workflow authoring tools.

```ts
workflow
  .map({ message: { initData: true, path: 'message' } })
  .classifier(router)
  .branch([
    [async ({ inputData }) => inputData.answers.route.choice === 'billing', billingStep],
    [async ({ inputData }) => inputData.answers.route.choice === 'support', supportStep],
  ]);
```

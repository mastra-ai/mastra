---
'@mastra/inngest': patch
'@mastra/core': patch
---

Deprecate `runCount` parameter in favor of `retryCount` for better naming clarity. The name `runCount` was misleading as it doesn't represent the total number of times a step has run, but rather the number of retry attempts made for a step.

`runCount` is available in `execute()` functions and methods that interact with the step execution. This also applies to condition functions and loop condition functions that use this parameter. If your code uses `runCount`, change the name to `retryCount`.

Here's an example migration:

```diff
const myStep = createStep({
  // Rest of step...
-  execute: async ({ runCount, ...params }) => {
+  execute: async ({ retryCount, ...params }) => {
    // ... rest of your logic
  }
});
```

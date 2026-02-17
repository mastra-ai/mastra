---
'@mastra/core': patch
---

Fixed `inputData` in `dowhile` and `dountil` loop condition functions to be properly typed as the step's output schema instead of `any`. This means you no longer need to manually cast `inputData` in your loop conditions — TypeScript will now correctly infer the type from your step's `outputSchema`.

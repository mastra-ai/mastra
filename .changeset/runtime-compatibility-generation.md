---
"@mastra/core": patch
---

Added runtime compatibility protection for Harness recovery. When you update agent code, prompts, tools, model settings, protocol bindings, or other runtime dependencies, queued or suspended work from an older generation will be rejected during recovery instead of running against mismatched runtime state.

```ts
const harness = new Harness({
  runtimeCompatibilityGeneration: "agents-2026-05-21",
  // ...other Harness config
});
```

Change the `runtimeCompatibilityGeneration` value whenever in-progress queued or suspended work should not resume on the updated runtime.

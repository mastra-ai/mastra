---
'@mastra/inngest': patch
'@mastra/core': patch
---

Deprecate `runCount` parameter in favor of `retryCount` for better naming clarity.

## What is deprecated

The `runCount` parameter in the `ExecuteFunctionParams` type is now deprecated. This parameter is available in:
- Step `execute` functions
- `ConditionFunction` 
- `LoopConditionFunction`
- All methods in the `StepExecutor` class that interact with step execution

## Why the change

The name `runCount` was misleading as it doesn't represent the total number of times a step has run, but rather the number of retry attempts made for a step. The new name `retryCount` more accurately reflects this behavior.

## Migration guide

Update your step execute functions to use `retryCount` instead of `runCount`. Both parameters will be available during the deprecation period (until November 4th, 2025), but you should migrate to `retryCount` as soon as possible.

### Before

```typescript
const myStep = new Step({
  id: 'myStep',
  execute: async ({ runCount, ...params }) => {
    console.log(`Retry attempt: ${runCount}`);
    // ... rest of your logic
  }
});
```

### After

```typescript
const myStep = new Step({
  id: 'myStep',
  execute: async ({ retryCount, ...params }) => {
    console.log(`Retry attempt: ${retryCount}`);
    // ... rest of your logic
  }
});
```

This also applies to condition functions and loop condition functions that use this parameter.

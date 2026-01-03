---
"@mastra/core": patch
---

Workflow lifecycle callbacks (`onFinish` and `onError`) now receive additional context for improved debugging and observability.

**What's new:**
- `getInitData()`: Function that returns the initial workflow input data
- `mastra`: Reference to the Mastra instance
- `requestContext`: The current request context

**Example usage:**

```typescript
const workflow = new Workflow({
  onFinish: async (result) => {
    // Access initial input for logging
    const initData = result.getInitData?.();
    console.log('Workflow completed', {
      status: result.status,
      initialInput: initData,
    });
    
    // Use mastra instance to trigger other workflows
    await result.mastra?.getWorkflow('notify').execute({ ... });
  },
  onError: async (error) => {
    // Access request context for error tracking
    const userId = error.requestContext?.get('userId');
    console.error('Workflow failed for user:', userId, error.error);
  },
});
```
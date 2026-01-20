---
'@mastra/inngest': patch
'@mastra/core': patch
---

Add `onFinish` and `onError` lifecycle callbacks to workflow options

Workflows now support lifecycle callbacks for server-side handling of workflow completion and errors:

- `onFinish`: Called when workflow completes with any status (success, failed, suspended, tripwire)
- `onError`: Called only when workflow fails (failed or tripwire status)

```typescript
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ ... }),
  outputSchema: z.object({ ... }),
  options: {
    onFinish: async (result) => {
      // Handle any workflow completion
      await updateJobStatus(result.status);
    },
    onError: async (errorInfo) => {
      // Handle workflow failures
      await logError(errorInfo.error);
    },
  },
});
```

Both callbacks support sync and async functions. Callback errors are caught and logged, not propagated to the workflow result.

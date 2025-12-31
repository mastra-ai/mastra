---
'@mastra/inngest': patch
---

Add cron scheduling support to Inngest workflows. Workflows can now be automatically triggered on a schedule by adding a `cron` property along with optional `inputData` and `initialState`:

```typescript
const workflow = createWorkflow({
  id: 'scheduled-workflow',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  steps: [step1],
  cron: '0 0 * * *', // Run daily at midnight
  inputData: { value: 'scheduled-run' }, // Optional
  initialState: { count: 0 }, // Optional
});
```

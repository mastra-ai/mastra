---
'@mastra/core': minor
---

Added a `beforeApproval` hook to tools that require approval. It runs before the agent pauses for approval and can reject the call by returning `{ proceed: false, output }`. The agent then skips the approval pause and does not execute the tool, and `output` goes back to the model as the tool result. Invalid calls are returned to the model to fix, and people are only asked to approve valid ones.

```ts
const issueRefund = createTool({
  id: 'issue-refund',
  inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
  requireApproval: true,
  beforeApproval: async ({ orderId, amount }) => {
    const order = await orders.find(orderId);
    if (!order) return { proceed: false, output: { error: `Order ${orderId} not found` } };
    if (amount > order.paid) return { proceed: false, output: { error: `Amount exceeds ${order.paid}` } };
  },
  execute: async ({ orderId, amount }) => refunds.issue(orderId, amount),
});
```

The hook does not run again when the call resumes after an approval decision. If the hook throws, the error is logged and the call proceeds to the approval gate. Keep validating inside `execute` too, because state can change while the call is waiting for approval.

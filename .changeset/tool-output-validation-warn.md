---
'@mastra/core': minor
---

Added an `outputValidation` option to `createTool` ([#23799](https://github.com/mastra-ai/mastra/issues/23799)). When a tool's result fails `outputSchema` validation, Mastra replaces the result with a validation error, so the model is told the call failed. That happens even when the tool's side effect (an order placed, a message sent) has already happened, which invites a retry. Set `outputValidation: 'warn'` to return the tool's actual result unchanged instead. `'strict'` is the default and keeps the existing behavior.

```ts
export const placeOrderTool = createTool({
  id: 'place-order',
  description: 'Places an order',
  inputSchema: z.object({ sku: z.string(), quantity: z.number() }),
  outputSchema: z.object({ orderId: z.string(), total: z.number() }),
  outputValidation: 'warn',
  execute: async ({ sku, quantity }) => orders.create({ sku, quantity }),
});
```

Also improved how output validation failures are reported:

- Every output validation failure now writes a warning to the Mastra logger. Previously, a failure from a `createTool` tool left no trace in the logs.
- The tool call trace span is now marked as failed when a `createTool` tool returns a validation error. Previously it was recorded as successful.
- Sensitive fields such as `apiKey`, `token`, and `password` are now redacted from the tool output shown in the validation error message.

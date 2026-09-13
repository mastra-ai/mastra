---
'@mastra/core': minor
---

Added an `outputValidation` option to `createTool`. When a tool's result fails `outputSchema` validation, the result is replaced with a validation error object and the model is told the call failed — even when the tool's side effect (an order placed, a message sent) has already happened, which invites a retry. With `outputValidation: 'warn'` the failure is logged and the tool's actual result is returned unchanged; `'strict'` (the default) keeps the existing behavior.

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

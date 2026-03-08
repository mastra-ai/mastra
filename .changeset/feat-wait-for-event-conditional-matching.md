---
'@mastra/core': minor
---

Added conditional event matching for workflow suspend/resume. Workflows can now use `waitForEvent` in suspend options to wait for a specific named event with optional `match` (field-path comparison) and `if` (expression-based) conditions. This enables Inngest-style event-driven patterns where multiple workflows wait for the same event type but only the correct one resumes based on payload data.

**Example:**

```ts
// In your step's execute function:
return await suspend(
  { invoiceId: '123' },
  {
    waitForEvent: {
      event: 'invoice.approved',
      match: 'invoiceId',
    },
  },
);

// With expression-based conditions:
return await suspend(
  { userId: 'u-1' },
  {
    waitForEvent: {
      event: 'subscription.created',
      if: "event.userId == async.userId && event.plan == 'pro'",
    },
  },
);
```

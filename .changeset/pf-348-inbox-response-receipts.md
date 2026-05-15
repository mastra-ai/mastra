---
"@mastra/core": minor
---

Added durable Harness v1 inbox response receipts for retry-safe `respondTo*` calls with `responseId`.

Pass `responseId` to receive an idempotent receipt result instead of replaying a response when a caller retries the same inbox action.

```ts
const receipt = await session.respondToQuestion({
  itemId: 'question:approve-plan',
  responseId: 'inbox-response-123',
  answer: 'Yes, continue',
});
```

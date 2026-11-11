---
'@mastra/client-js': patch
---

Fixed `deleteTraces`, `deleteScores`, and `deleteFeedback` return types to include `{ accepted: true }` from supporting Platform backends. Acceptance means cleanup is queued, not completed. OSS deletion responses remain unchanged.

Callers that read `result.success` must first narrow the response:

```typescript
const result = await client.deleteFeedback({ feedbackIds: ['feedback-1'] });

// Before
console.log(result.success);

// After
if ('accepted' in result) {
  console.log('Deletion requested');
} else {
  console.log(result.success);
}
```

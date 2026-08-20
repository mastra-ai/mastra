---
'@mastra/client-js': patch
---

Added optional plan content fields to `PlanResume` so hosts can preserve submitted plans in approval history.

```typescript
const response: PlanResume = {
  action: 'rejected',
  title: 'Add authentication',
  path: '.artifacts/plans/authentication.md',
  plan: '# Add authentication\n\n1. Configure the provider.',
  feedback: 'Use the existing session middleware.',
};
```

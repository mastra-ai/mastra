---
'@mastra/factory': minor
---

Added a hands-off start for work items: pick "Investigate hands-off" or "Build hands-off" in the card menu and the run's parked plans are approved on your behalf, even while the project's Auto-approve plans switch stays off. The grant sticks to the item, so the Factory's own follow-up runs on it stay hands-off too. Other cards keep waiting for plan review.

The run-start endpoint carries the grant as one flag:

```ts
await fetch(`/web/factory/projects/${projectId}/runs/start`, {
  method: 'POST',
  body: JSON.stringify({ ...startRequest, preapprovePlans: true }),
});
```

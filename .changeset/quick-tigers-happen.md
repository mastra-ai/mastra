---
'@mastra/factory': minor
---

**Automatic agent runs are now opt-in per Factory**

Factory rules no longer start agent runs on their own. When a rule wants to start one — reviewing a new pull request, triaging an issue, planning work — it is parked as a `proposed` decision, and clicking the card starts it. Rules that only mirror external facts are untouched: a merged pull request still moves its card to Done, a closed issue still lands in Done or Canceled.

Automatic runs are switched on and off from the top of the Work and Review boards, and they start off — including for Factories that exist today, so rules stop starting runs on upgrade until someone turns them back on.

A proposal that nobody wants can be turned down from the card menu or the Rules page, and both actions are recorded in the audit log. Through the API:

```ts
// Turn automatic runs back on for a Factory.
await fetch(`/web/factory/projects/${factoryProjectId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ autoRunEnabled: true }),
});

// Release a parked run, or drop it for good.
await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/approve`, { method: 'POST' });
await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/dismiss`, { method: 'POST' });
```

**Why:** opening a pull request used to start an agent that checks out and runs its code, with no way to say no. That consent now belongs to the Factory owner, while the board keeps reflecting what happens in GitHub and Linear either way.

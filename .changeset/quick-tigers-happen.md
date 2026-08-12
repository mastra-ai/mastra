---
'@mastra/factory': minor
---

**Automatic agent runs are now opt-in per Factory**

Factory rules no longer start agent runs on their own. When a rule wants to start one — reviewing a new pull request, triaging an issue, planning work — it is parked as a `proposed` decision that shows up on the board card with a Run button, and a person releases it. Rules that only mirror external facts are untouched: a merged pull request still moves its card to Done, a closed issue still lands in Done or Canceled.

Existing Factories start with automatic runs off. Turn them on in Settings › Factory, or through the project API:

```ts
await fetch(`/web/factory/projects/${factoryProjectId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ autoRunEnabled: true }),
});
```

A parked run can also be released directly:

```ts
await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/approve`, { method: 'POST' });
```

**Why:** opening a pull request used to start an agent that checks out and runs its code, with no way to say no. That consent now belongs to the Factory owner, while the board keeps reflecting what happens in GitHub and Linear either way.

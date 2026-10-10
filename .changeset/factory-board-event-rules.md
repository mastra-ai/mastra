---
'@mastra/factory': minor
---

Added board-owned integration event rules: pass `events` to `defineBoard`, keyed by integration (`github`, `gitlab`, `linear`, `jira`, `incidentio`) and event name. A board handler runs for events bound to a card on that board; `null` switches the event off for that board only, so Work and Review keep their behavior.

```ts
defineBoard({
  id: 'delivery',
  // ...
  events: {
    github: { pullRequestMerged: verifyCompletion, pullRequestCommentCreated: null },
    linear: { issueClosed: moveToCanceled },
  },
});
```

Added `phase` to integration rule contexts bound to a card: `phase: { id, kind, role?, outcomes }`, so handlers can act on what the card's phase means without checking board ids. Handlers set explicitly in an integration's `rules` still take precedence, so existing deployments behave as before.

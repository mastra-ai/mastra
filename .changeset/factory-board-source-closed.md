---
'@mastra/factory': minor
---

Closing a tracked issue now closes its card on custom boards too. Boards declare where closed sources go with `sourceClosed` in `defineBoard()`:

```ts
defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  sourceClosed: { completed: 'shipped', canceled: 'dropped' },
  phases: {
    /* ... */
  },
});
```

The stock close rules for GitHub, GitLab, Linear, Jira, and incident.io move the card to that phase on its own board. Before, they only acted on Work cards and silently left cards on other boards in place. Work behaves as before, and boards that don't declare `sourceClosed` still leave their cards alone. Custom rule overrides can read the targets from `context.boardClosure`.

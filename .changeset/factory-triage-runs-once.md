---
'@mastra/factory': patch
---

Factory Triage now runs once per card. Editing a GitHub or GitLab issue, or commenting on it, no longer starts Triage again on its card. Triage still runs when a person moves the card into Triage or starts the run.

To keep re-running Triage on comments, add your own rule for the event:

```ts
new GithubIntegration({
  rules: {
    issueCommentCreated: context =>
      context.item?.stages.includes('triage')
        ? {
            type: 'invokeSkill',
            role: 'triage',
            skillName: 'factory-triage',
            idempotencyKey: `${context.ingress.id}:factory-triage`,
          }
        : undefined,
  },
});
```

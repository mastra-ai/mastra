---
'@mastra/factory': patch
---

Factory Triage now runs once per card. Editing a GitHub or GitLab issue, or commenting on it, no longer starts Triage again on its card. Triage still runs when a person moves the card into Triage or starts the run.

To restore the previous re-triage on new comments (Work cards in Triage or Planning), add your own rule for the event:

```ts
import { GithubIntegration } from '@mastra/factory/integrations/github/integration';

new GithubIntegration({
  appId,
  privateKey,
  clientId,
  clientSecret,
  slug,
  rules: {
    issueCommentCreated: context => {
      if (context.board !== 'work' || !context.item?.url) return;
      // Factory's own comments must not restart the run that wrote them.
      if (context.actor.type === 'github' && context.actor.factoryAuthored) return;
      const stage = context.item.stages.length === 1 ? context.item.stages[0] : undefined;
      if (stage !== 'triage' && stage !== 'planning') return;
      return {
        type: 'invokeSkill',
        role: 'triage',
        skillName: 'factory-triage',
        idempotencyKey: `${context.ingress.id}:factory-triage`,
        arguments: `Re-triage GitHub issue (${context.item.url}) after a new comment.`,
      };
    },
  },
});
```

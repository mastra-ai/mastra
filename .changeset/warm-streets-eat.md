---
'@mastra/factory': minor
---

Added cross-factory routing for Slack requests. A mention or DM that starts a new session now lands in the factory the message is about instead of always using the sender's default factory:

- **Explicit name**: `factory: Web fix the header`, `[Web] fix the header`, or `fix the header in the Web factory` routes to the factory named Web.
- **Linear issues**: an issue key or link (`PROD-35`, `linear.app/.../issue/PROD-35`) in the message or in the root message of the thread being replied to routes to the factory whose Linear intake binding covers that issue's project or team.
- **GitHub repositories**: a `github.com/owner/repo` link routes to the factory that repository is linked to.

When nothing matches, or references point at different factories, the sender's default factory is used as before. Follow-up messages in an existing thread never re-route. The "New session started" card now names the factory the session landed in.

**Handing off from inside a session.** When a request lands in a factory that doesn't have what it's about, the agent can now find it elsewhere and move the conversation:

- `factory_locate` searches the repositories linked to the organization's other factories (GitHub code search, no clone) and returns matches grouped by factory.
- `factory_handoff` moves the Slack thread to a repo-backed session in that factory. Slack posts an approval card first; the handoff runs only after someone in the thread accepts it. The thread posts a `Continuing in <factory>` card, the new session starts with the original request and what was found, and every later reply in the thread goes to the new session. If the previous thread had a Work card it gets a "Handed off" comment; the target factory gets its own card when it files Slack cards.

Integrations can contribute their own routing by implementing `referenceResolver(ctx)` on `FactoryIntegration`; the factory hands every ready integration's resolver to the channel integration as `ctx.referenceResolvers`. Declare the storage domains the resolver reads in `referenceResolverDomains` so it is skipped when one of them failed to initialize.

```ts
const jiraIntegration: FactoryIntegration = {
  id: 'jira',
  diagnostics: () => ({}),
  referenceResolverDomains: ['intake'],
  referenceResolver: ctx => async ({ orgId, text }) =>
    findFactoriesForIssueKeys({ intake: ctx.storage.intake, orgId, text }),
};
```

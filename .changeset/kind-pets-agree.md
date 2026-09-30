---
'@mastra/factory': minor
'@mastra/connect': patch
---

Added an Identity capability to integrations. On the Connections settings page, users can now claim which external accounts on each integration are theirs (GitHub, Linear, Jira, IncidentIO, Slack — standalone and platform variants). Claims are keyed per org+user, so joining a new organization starts a fresh claim set.

Once claimed, a global `@me` filter is available on the board filter chip and in the Cmd+K search palette. It resolves against every claimed external identity across every integration and matches records whose author, assignee, requester, or comment-author field matches any claimed id.

Candidate accounts are discovered from each provider's member APIs (org members, workspace users, site rosters) as well as external comment authors already observed on your work items.

Claims are managed through the Factory web API:

```ts
// List candidate accounts across integrations, each with your claim state:
const { identities } = await fetch('/web/identity').then(r => r.json());

// Claim an account as yours (idempotent):
await fetch('/web/identity', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ integrationId: 'github', externalUserId: 'octocat', label: 'octocat' }),
});

// Board filters and Cmd+K search now resolve `@me` against every claimed identity.
```

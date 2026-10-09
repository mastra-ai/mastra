---
'@mastra/connect': patch
---

Added search tools so agents can find records directly instead of paging through full listings: `slack_search_channels` (find channels by name), `github_search_issues`, `github_search_repositories`, `github_search_code`, `hubspot_search_contacts`, `discord_search_members`, and `stripe_search_customers`.

```ts
const tools = await mastra.tools();
// Find a channel without paging conversations.list manually
await tools.slack_search_channels.execute({ query: 'eng-platform' }, { requestContext });
// Search issues and PRs with GitHub's query syntax
await tools.github_search_issues.execute({ q: 'repo:mastra-ai/mastra is:open label:bug' }, { requestContext });
```

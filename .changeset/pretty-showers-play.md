---
'@mastra/factory': patch
---

Added support for scoped Jira API tokens by allowing API requests to use a separate Atlassian gateway URL while issue links keep using the Jira site URL.

```ts
new JiraIntegration({
  baseUrl: 'https://acme.atlassian.net',
  apiBaseUrl: 'https://api.atlassian.com/ex/jira/cloud-id',
  email: 'developer@example.com',
  apiToken: process.env.JIRA_API_TOKEN!,
});
```

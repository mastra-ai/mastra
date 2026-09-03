---
'@mastra/connect': minor
---

Added Linear, Notion, Jira, and Snowflake toolsets. These OAuth-connected integrations let agents work with Linear issues, Notion pages and databases, Jira issues, and Snowflake SQL over platform-managed connections — no provider credentials in your app:

```ts
import { Agent } from '@mastra/core/agent';
import { createLinearTools, createNotionTools, createJiraTools, createSnowflakeTools } from '@mastra/connect';

const agent = new Agent({
  name: 'ops',
  instructions: 'You manage our workspaces.',
  model: 'openai/gpt-5-mini',
  toolsets: {
    linear: createLinearTools({ allowTools: ['linear_search_issues', 'linear_list_issues'] }),
    notion: createNotionTools({ allowTools: ['notion_search', 'notion_get_page'] }),
    jira: createJiraTools(),
    snowflake: createSnowflakeTools(),
  },
});
```

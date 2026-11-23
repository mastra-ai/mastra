---
'@mastra/connect': minor
---

Added a Zendesk toolset with 36 tools. Agents can create, update, search, and delete tickets and add public replies or internal notes, manage users and organizations, read groups, ticket fields, ticket forms, views, and macros, and write Help Center content: categories, sections, and articles, including editing an article's text per language and archiving it.

Connect a Zendesk account to your project first (`mastra connect add zendesk`). When running locally, set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` in the app's environment so `tools()` can find the connection. Then add the tools to an agent:

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support agent',
  instructions: 'Use the connected Zendesk tools to triage tickets and keep Help Center articles current.',
  model: 'openai/gpt-6.1-sol',
  tools: tools({ providers: ['zendesk'] }),
});
```

`zendesk_delete_section` and `zendesk_delete_category` also delete every article inside them, so consider listing them in the agent's `requireApproval`. New articles don't email section subscribers unless `notify_subscribers` is set.

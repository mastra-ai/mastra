---
'@mastra/connect': minor
---

Added a Confluence toolset with 36 tools. Agents can read and search spaces, create, update, and delete pages and blog posts, manage page properties, footer comments, and inline comments, and read attachments and labeled content.

Connect a Confluence account to your project first (`mastra connect add confluence`). When running locally, set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` in the app's environment so `tools()` can find the connection. Then add the tools to an agent:

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const wikiAgent = new Agent({
  id: 'wiki-agent',
  name: 'Wiki agent',
  instructions: 'Use the connected Confluence tools to find and update team documentation.',
  model: 'openai/gpt-6.1-sol',
  tools: tools({ providers: ['confluence'] }),
});
```

Tools work against the Confluence site chosen when the account was connected, including `confluence_search_content`.

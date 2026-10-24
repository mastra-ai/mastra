---
'@mastra/connect': minor
---

Added a SharePoint Online toolset with 53 tools for sites, lists, list items, columns, content types, pages, permissions, drives, and drive items with binary content download.

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const sharepointAgent = new Agent({
  id: 'sharepoint-agent',
  name: 'SharePoint agent',
  instructions: 'Use the connected SharePoint Online tools to manage sites and lists.',
  model: 'openai/gpt-5-mini',
  tools: tools({ providers: ['sharepoint-online'] }),
});
```

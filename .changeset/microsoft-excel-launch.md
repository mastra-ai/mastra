---
'@mastra/connect': minor
---

Added a Microsoft Excel toolset with 27 tools for drive discovery, workbook files, worksheets, ranges, tables, names, charts, and search.

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const excelAgent = new Agent({
  id: 'excel-agent',
  name: 'Excel agent',
  instructions: 'Use the connected Microsoft Excel tools to manage workbooks.',
  model: 'openai/gpt-5-mini',
  tools: tools({ providers: ['microsoft-excel'] }),
});
```

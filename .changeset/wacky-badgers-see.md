---
'@mastra/acp': minor
---

Added `createACPTool` to run ACP-compatible coding agents as Mastra tools.

Example:

```ts
import { createACPTool } from '@mastra/acp';

const claudeTool = createACPTool({
  id: 'claude-code',
  description: 'Build anything with Claude Code',
  command: 'claude',
  args: ['--acp'],
});
```

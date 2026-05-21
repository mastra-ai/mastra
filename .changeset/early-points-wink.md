---
'@mastra/core': minor
---

Added SDK agent wrappers for Claude and Cursor. Developers can wrap initialized SDK clients and call `generate` or `stream` through Mastra-compatible outputs.
SDK agent runs create Mastra agent/model observability spans and attach vendor usage metadata from Cursor turn updates and Claude result messages. Claude SDK agent runs also preserve the SDK's estimated `total_cost_usd` value as Mastra cost context.

```ts
const claudeAgent = new ClaudeSDKAgent({
  id: 'claude-agent',
  description: 'Use Claude Agent SDK through Mastra.',
  agent: query,
});

const cursorAgent = new CursorSDKAgent({
  id: 'cursor-agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  agent: cursorSdkAgent,
});
```

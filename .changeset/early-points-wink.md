---
'@mastra/core': minor
---

Added SDK agent wrappers for Claude and Cursor. Developers can wrap initialized SDK clients and call `generate` or `stream` through Mastra-compatible outputs.

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
  model: { id: 'gpt-5.5' },
});
```

---
'@mastra/claude': minor
---

Added `@mastra/claude`, a package for running Claude Agent SDK agents through Mastra.

Create a Claude SDK agent with the vendor `query` function, register it with Mastra, and call `generate()` or `stream()` with Mastra-compatible outputs. Runs keep Claude SDK usage, cost estimates, and observability data available to Mastra.

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeSDKAgent } from '@mastra/claude';

export const claudeAgent = new ClaudeSDKAgent({
  id: 'claude-sdk-agent',
  description: 'Use Claude Agent SDK through Mastra.',
  query,
  options: {
    model: 'claude-sonnet-4-5',
    cwd: process.cwd(),
  },
});
```

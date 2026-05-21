---
'@mastra/core': minor
---

Added Mastra SDK agent wrappers for Claude Agent SDK and Cursor Agent SDK.

These wrappers let developers initialize the vendor SDK client themselves, pass it into Mastra, and call `generate` or `stream` through Mastra-compatible outputs. The wrappers bypass Mastra's model loop so each SDK can run its own agent implementation while still behaving like registered Mastra agents.

SDK agent runs now create Mastra agent and model observability spans. Cursor usage is collected from turn updates, Claude usage is collected from result messages, and Claude SDK runs preserve the SDK's estimated `total_cost_usd` value as Mastra cost context.

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Agent as CursorAgent } from '@cursor/sdk';
import { ClaudeSDKAgent, CursorSDKAgent } from '@mastra/core/sdk-agents';

const claudeAgent = new ClaudeSDKAgent({
  id: 'claude-agent',
  description: 'Use Claude Agent SDK through Mastra.',
  agent: query,
  model: 'claude-sonnet-4-6',
});

const cursorSdkAgent = await CursorAgent.create({
  apiKey: process.env.CURSOR_API_KEY,
  model: { id: 'gpt-5.5' },
  local: {
    cwd: process.cwd(),
  },
});

const cursorAgent = new CursorSDKAgent({
  id: 'cursor-agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  agent: cursorSdkAgent,
});
```

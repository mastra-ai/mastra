---
'@mastra/core': minor
---

Added Mastra SDK agent wrappers for Claude Agent SDK and Cursor Agent SDK.

Developers can now use Claude Agent SDK and Cursor Agent SDK agents inside Mastra. They can initialize the vendor SDK client themselves or let Mastra create the Cursor SDK agent from Cursor options.

These agents support `generate` and `stream` with Mastra-compatible outputs, so they can be registered and called like other Mastra agents. Their runs also show up in Mastra observability with usage data, and Claude SDK cost estimates are preserved for cost reporting.

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeSDKAgent, CursorSDKAgent } from '@mastra/core/sdk-agents';

const claudeAgent = new ClaudeSDKAgent({
  id: 'claude-agent',
  description: 'Use Claude Agent SDK through Mastra.',
  agent: query,
  model: 'claude-sonnet-4-6',
});

const cursorAgent = new CursorSDKAgent({
  id: 'cursor-agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  model: { id: 'gpt-5.5' },
  local: {
    cwd: process.cwd(),
  },
});
```

`CursorSDKAgent` can also receive a pre-created Cursor SDK agent through `agent`. When `apiKey` is not passed to the wrapper, it falls back to `process.env.CURSOR_API_KEY`.

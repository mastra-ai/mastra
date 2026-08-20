---
'@mastra/opencode-sdk': minor
---

Added @mastra/opencode-sdk, a wrapper that lets you register an OpenCode agent and call it through Mastra's `generate()` and `stream()`. Supports session resume, structured output, and full telemetry (tool calls, permissions, cost, and token usage) via the OpenCode v2 client.

```typescript
import { OpenCodeSDKAgent } from '@mastra/opencode-sdk';

const agent = new OpenCodeSDKAgent({
  id: 'opencode-agent',
  description: 'Runs coding tasks through OpenCode.',
  serverOptions: { config: { model: 'openai/gpt-5.6-sol' } },
});

const result = await agent.generate('List the files in this directory.');
```

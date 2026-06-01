# @mastra/claude

`@mastra/claude` connects Mastra to the Claude Agent SDK. Use it when you want to register a Claude SDK agent with Mastra and call it through Mastra-compatible `generate()` and `stream()` methods.

## Installation

```bash
npm install @mastra/claude @anthropic-ai/claude-agent-sdk
```

## Overview

The package exports `ClaudeSDKAgent`, a Mastra `Agent` wrapper around the Claude Agent SDK run loop.

`ClaudeSDKAgent` keeps the Claude SDK run loop in charge. Mastra receives compatible outputs, usage, cost estimates, and tracing data for the run.

## Create a Claude SDK agent

Pass Claude SDK configuration through `sdkOptions`.

```typescript
import { ClaudeSDKAgent } from '@mastra/claude';

export const claudeAgent = new ClaudeSDKAgent({
  id: 'claude-sdk-agent',
  name: 'Claude SDK Agent',
  description: 'Use Claude Agent SDK through Mastra.',
  sdkOptions: {
    model: process.env.CLAUDE_CODE_MODEL,
    cwd: process.cwd(),
  },
});
```

You can register the wrapper anywhere Mastra accepts an `Agent`.

```typescript
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  agents: {
    claudeAgent,
  },
});
```

## Run the agent

```typescript
const result = await claudeAgent.generate('Summarize the latest changes in this repository.', {
  runId: 'claude-run',
});

console.log(result.text);
```

```typescript
const stream = await claudeAgent.stream('Review this package for test gaps.');

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') {
    process.stdout.write(chunk.payload.text);
  }
}
```

## Configure Claude

`ClaudeSDKAgent` forwards `sdkOptions` to the Claude SDK `query()` call on every run.

For custom tools, create a Claude SDK MCP server and pass it with `mcpServers`.

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeSDKAgent } from '@mastra/claude';
import { z } from 'zod';

const weatherServer = createSdkMcpServer({
  name: 'weather',
  version: '1.0.0',
  tools: [
    tool(
      'get_temperature',
      'Get the current temperature.',
      {
        location: z.string(),
      },
      async ({ location }) => ({
        content: [{ type: 'text', text: `Temperature for ${location}: 72F` }],
      }),
    ),
  ],
});

export const claudeAgent = new ClaudeSDKAgent({
  id: 'claude-sdk-agent',
  description: 'Use Claude with weather tools.',
  sdkOptions: {
    mcpServers: {
      weather: weatherServer,
    },
    allowedTools: ['mcp__weather__get_temperature'],
  },
});
```

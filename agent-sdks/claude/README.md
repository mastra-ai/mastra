# @mastra/claude

`@mastra/claude` connects Mastra to the Claude Agent SDK. Use it when you want Claude Code's agent loop, tools, permissions, and runtime configuration while exposing the agent through Mastra-compatible `generate()` and `stream()` methods.

## Installation

```bash
npm install @mastra/claude
npm install @anthropic-ai/claude-agent-sdk
```

## Usage

Set `ANTHROPIC_API_KEY` before creating the agent.

```typescript
import { ClaudeSDKAgent } from '@mastra/claude';
import { Mastra } from '@mastra/core/mastra';

export const claudeAgent = new ClaudeSDKAgent({
  id: 'claude-sdk-agent',
  name: 'Claude SDK Agent',
  description: 'Use Claude Agent SDK through Mastra.',
  sdkOptions: {
    cwd: process.cwd(),
  },
});

export const mastra = new Mastra({
  agents: { claudeAgent },
});
```

## Documentation

- [Claude Agent SDK integration](https://mastra.ai/docs/connections/sdk-agents#claude-agent-sdk)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/claude/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

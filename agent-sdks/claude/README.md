# @mastra/claude

Claude SDK package for Mastra. Use `@mastra/claude` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/claude
```

## Usage

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

## Documentation

- [@mastra/claude documentation](https://mastra.ai/reference/acp/acp-agent)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/claude/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

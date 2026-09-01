# @mastra/acp

Agent Client Protocol (ACP) package for Mastra. Use `@mastra/acp` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/acp
```

## Usage

```typescript
import { AcpAgent } from '@mastra/acp';

const codeAgent = new AcpAgent({
  id: 'code-agent',
  description: 'An ACP-compatible coding agent',
  command: 'claude',
  args: ['--acp'],
  model: 'claude-sonnet-4-6',
});
```

## Documentation

- [ACP agent reference](https://mastra.ai/reference/acp/acp-agent)
- [Create an ACP tool](https://mastra.ai/reference/acp/create-acp-tool)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/acp/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

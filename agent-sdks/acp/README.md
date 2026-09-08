# @mastra/acp

`@mastra/acp` connects Mastra to coding agents that implement the Agent Client Protocol (ACP). Use it to run an ACP-compatible agent from a Mastra tool or as a Mastra sub-agent.

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

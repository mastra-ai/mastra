# @mastra/acp

ACP package for Mastra. Use `@mastra/acp` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/acp
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { AcpAgent } from '@mastra/acp';

const codeAgent = new AcpAgent({
  id: 'code-agent',
  description: 'An ACP-compatible coding agent',
  command: 'claude',
  args: ['--acp'],
  model: 'claude-sonnet-4-20250514',
});
```

## Documentation

- [@mastra/acp documentation](https://mastra.ai/reference/acp/acp-agent)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/acp/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

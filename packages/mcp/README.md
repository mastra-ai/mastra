# @mastra/mcp

Utilities for using @mastra/mcp with Mastra. Install `@mastra/mcp` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/mcp
```

## Usage

Provide an MCP server URL or stdio command.

```typescript
import { MCPClient } from '@mastra/mcp';

const client = new MCPClient({
  servers: { docs: { url: new URL('https://example.com/mcp') } },
});
const tools = await client.listTools();
```

## Documentation

- [@mastra/mcp documentation](https://mastra.ai/reference/tools/mcp-client)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

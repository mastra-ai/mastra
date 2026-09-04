# @mastra/mcp

Mastra supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro), an open standard for connecting AI agents to external tools and resources. It serves as a universal plugin system, enabling agents to call tools regardless of language or hosting environment.

Mastra can also be used to author MCP servers, exposing agents, tools, and other structured resources via the MCP interface. These can then be accessed by any system or agent that supports the protocol.

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

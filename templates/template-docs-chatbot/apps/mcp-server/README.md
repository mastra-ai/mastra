# MCP Server Template

A standalone MCP (Model Context Protocol) server that exposes documentation tools for consumption by any MCP client.

## What's included

- **MCP Server**: HTTP/SSE server that exposes documentation tools
- **Documentation Tool**: Tool for querying project function documentation
- **Sample Data**: Example function documentation for the Kepler project

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment file:

   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

The MCP server will be available at `http://localhost:4111/mcp`.

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests

## Configuration

Environment variables:

- `MCP_PORT` - Port for the MCP server (default: 4111)
- `SERVER_BASE_URL` - Base URL for the server (default: http://localhost:4111)

## Usage

This MCP server can be consumed by any MCP client. It exposes:

### Tools

- **docsTool** - Get detailed information about project functions
  - `functionName` (optional) - Specific function to query
  - `includeRandomTip` (optional) - Include random tips about the function

### Client Integration

To connect to this server from an MCP client:

```typescript
import { MCPClient } from '@mastra/mcp';

const client = new MCPClient({
  servers: {
    docs: {
      url: new URL('http://localhost:4111/mcp'),
    },
  },
});

// Get tools from the server
const tools = await client.getTools();
```

## Customization

- Replace `src/data/functions.json` with your own documentation data
- Modify `src/tools/docs-tool.ts` to change tool behavior
- Add new tools in the `src/tools/` directory and register them in `src/server.ts`

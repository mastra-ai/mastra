# @mastra/mcp

Model Context Protocol (MCP) client implementation for Mastra, providing seamless integration with MCP-compatible AI models and tools.

## Installation

```bash
npm install @mastra/mcp
```

## Overview

The `@mastra/mcp` package provides a client implementation for the Model Context Protocol (MCP), enabling Mastra to communicate with MCP-compatible AI models and tools. It wraps the official `@modelcontextprotocol/sdk` and provides Mastra-specific functionality.

## Usage

```typescript
import { MastraMCPClient } from '@mastra/mcp';

// Create a client
const client = new MastraMCPClient({
  name: 'my-mcp-client',
  version: '1.0.0', // optional
  server: {
    // StdioServerParameters
    command: 'your-mcp-server-command',
    args: ['--your', 'args'],
  },
  capabilities: {}, // optional ClientCapabilities
});

// Connect to the MCP server
await client.connect();

// List available resources
const resources = await client.resources();

// Get available tools
const tools = await client.tools();

// Disconnect when done
await client.disconnect();
```

## Configuration

### Required Parameters

- `name`: Name of the MCP client instance
- `server`: StdioServerParameters object containing:
  - `command`: Command to start the MCP server
  - `args`: Array of command arguments

### Optional Parameters

- `version`: Client version (default: '1.0.0')
- `capabilities`: ClientCapabilities object for specifying supported features

## Features

- Standard MCP client implementation
- Automatic tool conversion to Mastra format
- Resource discovery and management
- Stdio-based transport layer
- Automatic error handling and logging
- Tool execution with context

## Methods

### `connect()`

Establishes connection with the MCP server.

### `disconnect()`

Closes the connection with the MCP server.

### `resources()`

Lists available resources from the MCP server.

### `tools()`

Retrieves and converts MCP tools to Mastra-compatible format.

## Tool Conversion

The package automatically converts MCP tools to Mastra's format:

```typescript
const tools = await client.tools();
// Returns: { [toolName: string]: MastraTool }

// Each tool includes:
// - Converted JSON schema
// - Mastra-compatible execution wrapper
// - Error handling
// - Automatic context passing
```

## Error Handling

The client includes comprehensive error handling:

- Connection errors
- Tool execution errors
- Resource listing errors
- Schema conversion errors

## Related Links

- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/spec)
- [@modelcontextprotocol/sdk Documentation](https://github.com/modelcontextprotocol/sdk)

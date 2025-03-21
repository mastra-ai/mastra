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

// Create a client with stdio server
const stdioClient = new MastraMCPClient({
  name: 'my-stdio-client',
  version: '1.0.0', // optional
  server: {
    command: 'your-mcp-server-command',
    args: ['--your', 'args'],
  },
  capabilities: {}, // optional ClientCapabilities
});

// Or create a client with SSE server
const sseClient = new MastraMCPClient({
  name: 'my-sse-client',
  version: '1.0.0',
  server: {
    url: new URL('https://your-mcp-server.com/sse'),
    requestInit: {
      headers: { Authorization: 'Bearer your-token' },
    },
  },
  timeout: 60000, // optional timeout for tool calls in milliseconds
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

## Managing Multiple MCP Servers

For applications that need to interact with multiple MCP servers, the `MCPConfiguration` class provides a convenient way to manage multiple server connections and their tools:

```typescript
import { MCPConfiguration } from '@mastra/mcp';

const mcp = new MCPConfiguration({
  servers: {
    // Stdio-based server
    stockPrice: {
      command: 'npx',
      args: ['tsx', 'stock-price.ts'],
      env: {
        API_KEY: 'your-api-key',
      },
    },
    // SSE-based server
    weather: {
      url: new URL('http://localhost:8080/sse'),
    },
  },
});

// Get all tools from all configured servers namespaced with the server name
const tools = await mcp.getTools();

// Get tools grouped into a toolset object per-server
const toolsets = await mcp.getToolsets();
```

### Tools vs Toolsets

The MCPConfiguration class provides two ways to access MCP tools:

#### Tools (`getTools()`)

Use this when:

- You have a single MCP connection
- The tools are used by a single user/context (CLI tools, automation scripts, etc)
- Tool configuration (API keys, credentials) remains constant
- You want to initialize an Agent with a fixed set of tools

```typescript
const agent = new Agent({
  name: 'CLI Assistant',
  instructions: 'You help users with CLI tasks',
  model: openai('gpt-4'),
  tools: await mcp.getTools(), // Tools are fixed at agent creation
});
```

#### Toolsets (`getToolsets()`)

Use this when:

- You need per-request tool configuration
- Tools need different credentials per user
- Running in a multi-user environment (web app, API, etc)
- Tool configuration needs to change dynamically

```typescript
import { MCPConfiguration } from '@mastra/mcp';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// Configure MCP servers with user-specific settings before getting toolsets
const mcp = new MCPConfiguration({
  servers: {
    stockPrice: {
      command: 'npx',
      args: ['tsx', 'weather-mcp.ts'],
      env: {
        // These would be different per user
        API_KEY: 'user-1-api-key',
      },
    },
    weather: {
      url: new URL('http://localhost:8080/sse'),
      requestInit: {
        headers: {
          // These would be different per user
          Authorization: 'Bearer user-1-token',
        },
      },
    },
  },
});

// Get the current toolsets configured for this user
const toolsets = await mcp.getToolsets();

// Use the agent with user-specific tool configurations
const response = await agent.generate('What is the weather in London?', {
  toolsets,
});

console.log(response.text);
```

The `MCPConfiguration` class automatically:

- Manages connections to multiple MCP servers
- Namespaces tools to prevent naming conflicts
- Handles connection lifecycle and cleanup
- Provides both flat and grouped access to tools

## Configuration

### Required Parameters

- `name`: Name of the MCP client instance
- `server`: Either a StdioServerParameters or SSEClientParameters object:

  #### StdioServerParameters

  - `command`: Command to start the MCP server
  - `args`: Array of command arguments

  #### SSEClientParameters

  - `url`: URL instance pointing to the SSE server
  - `requestInit`: Optional fetch request configuration
  - `eventSourceInit`: Optional EventSource configuration

### Optional Parameters

- `version`: Client version (default: '1.0.0')
- `capabilities`: ClientCapabilities object for specifying supported features

## Features

- Standard MCP client implementation
- Automatic tool conversion to Mastra format
- Resource discovery and management
- Multiple transport layers:
  - Stdio-based for local servers
  - SSE-based for remote servers
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

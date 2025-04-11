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
    eventSourceInit: {
      fetch(input: Request | URL | string, init?: RequestInit) {
        const headers = new Headers(init?.headers || {});
        headers.set('Authorization', 'Bearer your-token');
        return fetch(input, {
          ...init,
          headers,
        });
      },
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

## Logging

The MCP client provides per-server logging capabilities, allowing you to monitor interactions with each MCP server separately:

```typescript
import { MCPConfiguration, LogMessage, LoggingLevel } from '@mastra/mcp';

// Define a custom log handler
const weatherLogger = (logMessage: LogMessage) => {
  console.log(`[${logMessage.level}] ${logMessage.serverName}: ${logMessage.message}`);

  // Log data contains valuable information
  console.log('Details:', logMessage.details);
  console.log('Timestamp:', logMessage.timestamp);
};

// Initialize MCP configuration with server-specific loggers
const mcp = new MCPConfiguration({
  servers: {
    weatherService: {
      command: 'npx',
      args: ['tsx', 'weather-mcp.ts'],
      // Attach the logger to this specific server
      log: weatherLogger,
    },

    stockPriceService: {
      command: 'npx',
      args: ['tsx', 'stock-mcp.ts'],
      // Different logger for this service
      log: logMessage => {
        // Just log errors and critical events for this service
        if (['error', 'critical', 'alert', 'emergency'].includes(logMessage.level)) {
          console.error(`Stock service ${logMessage.level}: ${logMessage.message}`);
        }
      },
    },
  },
});
```

### Log Message Structure

Each log message contains the following information:

```typescript
interface LogMessage {
  level: LoggingLevel; // MCP SDK standard log levels
  message: string;
  timestamp: Date;
  serverName: string;
  details?: Record<string, any>;
}
```

The `LoggingLevel` type is directly imported from the MCP SDK, ensuring compatibility with all standard MCP log levels: `'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'`.

### Creating Reusable Loggers

You can create reusable logger factories for common patterns:

```typescript
// File logger factory with color coded output for different severity levels
const createFileLogger = filePath => {
  return logMessage => {
    // Format the message based on level
    const prefix =
      logMessage.level === 'emergency' ? '!!! EMERGENCY !!! ' : logMessage.level === 'alert' ? '! ALERT ! ' : '';

    // Write to file with timestamp, level, etc.
    fs.appendFileSync(
      filePath,
      `[${logMessage.timestamp.toISOString()}] [${logMessage.level.toUpperCase()}] ${prefix}${logMessage.message}\n`,
    );
  };
};

// Use the factory in configuration
const mcp = new MCPConfiguration({
  servers: {
    weatherService: {
      command: 'npx',
      args: ['tsx', 'weather-mcp.ts'],
      log: createFileLogger('./logs/weather.log'),
    },
  },
});
```

See the `examples/server-logging.ts` file for comprehensive examples of various logging strategies.

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
      eventSourceInit: {
        fetch(input: Request | URL | string, init?: RequestInit) {
          const headers = new Headers(init?.headers || {});
          headers.set('Authorization', 'Bearer user-1-token');
          return fetch(input, {
            ...init,
            headers,
          });
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

## SSE Authentication and Headers

When using SSE (Server-Sent Events) connections with authentication or custom headers, you need to configure headers in a specific way. The standard `requestInit` headers won't work alone because SSE connections use the browser's `EventSource` API, which doesn't support custom headers directly.

The `eventSourceInit` configuration allows you to customize the underlying fetch request used for the SSE connection, ensuring your authentication headers are properly included.

To properly include authentication headers or other custom headers in SSE connections, you need to use both `requestInit` and `eventSourceInit`:

```typescript
const sseClient = new MastraMCPClient({
  name: 'authenticated-sse-client',
  server: {
    url: new URL('https://your-mcp-server.com/sse'),
    // requestInit alone isn't enough for SSE connections
    requestInit: {
      headers: { Authorization: 'Bearer your-token' },
    },
    // eventSourceInit is required to include headers in the SSE connection
    eventSourceInit: {
      fetch(input: Request | URL | string, init?: RequestInit) {
        const headers = new Headers(init?.headers || {});
        headers.set('Authorization', 'Bearer your-token');
        return fetch(input, {
          ...init,
          headers,
        });
      },
    },
  },
});
```

This configuration ensures that:

1. The authentication headers are properly included in the SSE connection request
2. The connection can be established with the required credentials
3. Subsequent messages can be received through the authenticated connection

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
- `log`: Function that receives and processes log messages

## Features

- Standard MCP client implementation
- Automatic tool conversion to Mastra format
- Resource discovery and management
- Multiple transport layers:
  - Stdio-based for local servers
  - SSE-based for remote servers
- Per-server logging capability using all standard MCP log levels
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

# Custom Transport Example

This example demonstrates how to use a custom `StreamableHTTPClientTransport` instance with the Mastra MCP client, allowing you to fully customize the transport layer.

## Features

- **Custom Transport Configuration**: Pass your own `StreamableHTTPClientTransport` instance
- **Advanced Customization**: Extend the transport class to add custom behavior
- **Full Control**: Customize headers, authentication, reconnection logic, and more

## Usage

### Basic Custom Transport

```typescript
import { MCPClient } from '@mastra/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Create a custom transport with your configuration
const customTransport = new StreamableHTTPClientTransport(new URL('http://localhost:8080'), {
  requestInit: {
    headers: {
      'X-Custom-Header': 'custom-value',
      Authorization: 'Bearer your-token',
    },
  },
  reconnectionOptions: {
    maxRetries: 5,
    retryDelay: 1000,
  },
  sessionId: 'my-custom-session',
});

// Use the custom transport in your MCP client
const mcp = new MCPClient({
  servers: {
    myServer: {
      customTransport,
      logger: logMessage => {
        console.log(`[${logMessage.serverName}] ${logMessage.message}`);
      },
    },
  },
});
```

### Advanced Custom Transport

```typescript
class CustomStreamableHTTPClientTransport extends StreamableHTTPClientTransport {
  constructor(url: URL, options?: any) {
    super(url, options);
  }

  // Override methods to add custom behavior
  async open(): Promise<void> {
    console.log('Custom transport: Opening connection...');
    await super.open();
    console.log('Custom transport: Connection opened successfully');
  }

  async close(): Promise<void> {
    console.log('Custom transport: Closing connection...');
    await super.close();
    console.log('Custom transport: Connection closed successfully');
  }

  // Add custom methods
  async customMethod(): Promise<void> {
    console.log('Executing custom method');
    // Your custom logic here
  }
}

const advancedTransport = new CustomStreamableHTTPClientTransport(new URL('http://localhost:8080'), {
  /* your options */
});

const mcp = new MCPClient({
  servers: {
    advancedServer: {
      customTransport: advancedTransport,
    },
  },
});
```

## Configuration Options

When using a custom transport, you can configure:

- **Custom Headers**: Add authentication, API keys, or custom headers
- **Reconnection Logic**: Customize retry behavior and backoff strategies
- **Session Management**: Control session IDs and connection lifecycle
- **Request Options**: Customize fetch options like cache, mode, etc.
- **Custom Methods**: Extend the transport class with your own methods

## Benefits

1. **Full Control**: Customize every aspect of the transport layer
2. **Advanced Authentication**: Implement custom auth flows
3. **Custom Logging**: Add detailed logging and monitoring
4. **Error Handling**: Implement custom error handling and recovery
5. **Performance Optimization**: Optimize for your specific use case

## Running the Example

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start your MCP server (e.g., on localhost:8080)

3. Run the example:
   ```bash
   pnpm start
   ```

## Type Safety

The custom transport feature is fully type-safe. TypeScript will ensure that:

- Only `StreamableHTTPClientTransport` instances can be used
- All required properties are provided
- Type conflicts between different server definition types are prevented

## Migration from Standard Configuration

If you're currently using the standard HTTP configuration:

```typescript
// Before
const mcp = new MCPClient({
  servers: {
    myServer: {
      url: new URL('http://localhost:8080'),
      requestInit: {
        /* options */
      },
    },
  },
});

// After - with custom transport
const customTransport = new StreamableHTTPClientTransport(new URL('http://localhost:8080'), {
  requestInit: {
    /* options */
  },
});

const mcp = new MCPClient({
  servers: {
    myServer: {
      customTransport,
    },
  },
});
```

This gives you the same functionality but with full control over the transport layer.

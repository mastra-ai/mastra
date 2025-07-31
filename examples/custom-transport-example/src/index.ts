import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import chalk from 'chalk';

// Example 1: Basic custom transport usage
console.log(chalk.blue('=== Example 1: Basic Custom Transport ==='));

// Create a custom transport with custom configuration
const customTransport = new StreamableHTTPClientTransport(
  new URL('http://localhost:8080'), // Your MCP server URL
  {
    requestInit: {
      headers: {
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer your-custom-token',
      },
      // Add any custom fetch options
      cache: 'no-cache',
      mode: 'cors',
    },
    reconnectionOptions: {
      maxRetries: 5,
      retryDelay: 1000,
      backoffMultiplier: 2,
    },
    sessionId: 'my-custom-session-id',
  },
);

// Create MCP client with custom transport
const mcpWithCustomTransport = new MCPClient({
  servers: {
    customServer: {
      customTransport,
      // Other options like logger, timeout, etc.
      logger: logMessage => {
        console.log(chalk.gray(`[${logMessage.serverName}] ${logMessage.level}: ${logMessage.message}`));
      },
      timeout: 10000,
    },
  },
});

// Example 2: Advanced custom transport with custom logic
console.log(chalk.blue('\n=== Example 2: Advanced Custom Transport ==='));

class CustomStreamableHTTPClientTransport extends StreamableHTTPClientTransport {
  constructor(url: URL, options?: any) {
    super(url, options);
  }

  // Override methods to add custom behavior
  async open(): Promise<void> {
    console.log(chalk.yellow('Custom transport: Opening connection...'));
    await super.open();
    console.log(chalk.green('Custom transport: Connection opened successfully'));
  }

  async close(): Promise<void> {
    console.log(chalk.yellow('Custom transport: Closing connection...'));
    await super.close();
    console.log(chalk.green('Custom transport: Connection closed successfully'));
  }

  // Add custom methods
  async customMethod(): Promise<void> {
    console.log(chalk.cyan('Custom transport: Executing custom method'));
    // Your custom logic here
  }
}

// Create advanced custom transport
const advancedCustomTransport = new CustomStreamableHTTPClientTransport(new URL('http://localhost:8080'), {
  requestInit: {
    headers: {
      'X-Advanced-Header': 'advanced-value',
    },
  },
});

// Create MCP client with advanced custom transport
const mcpWithAdvancedTransport = new MCPClient({
  servers: {
    advancedServer: {
      customTransport: advancedCustomTransport,
      logger: logMessage => {
        console.log(chalk.magenta(`[ADVANCED-${logMessage.serverName}] ${logMessage.level}: ${logMessage.message}`));
      },
    },
  },
});

// Example 3: Using with an agent
console.log(chalk.blue('\n=== Example 3: Using Custom Transport with Agent ==='));

const agent = new Agent({
  name: 'Custom Transport Agent',
  instructions: 'You are a helpful assistant that uses custom transport to connect to MCP servers.',
  model: openai('gpt-4o'),
});

// Example usage function
async function demonstrateCustomTransport() {
  try {
    console.log(chalk.blue('Connecting to MCP server with custom transport...'));

    // Get tools from the custom transport server
    const toolsets = await mcpWithCustomTransport.getToolsets();
    console.log(chalk.green('Successfully connected and retrieved toolsets:'), toolsets);

    // Use the agent with the custom transport
    const response = await agent.stream('Hello! What tools are available?', {
      toolsets,
    });

    for await (const part of response.fullStream) {
      switch (part.type) {
        case 'error':
          console.error(chalk.red('Error:'), part.error);
          break;
        case 'text-delta':
          process.stdout.write(chalk.green(part.textDelta));
          break;
        case 'tool-call':
          console.log(chalk.yellow(`Calling tool ${part.toolName} with args:`), part.args);
          break;
        case 'tool-result':
          console.log(chalk.cyan(`Tool result:`), part.result);
          break;
      }
    }
  } catch (error) {
    console.error(chalk.red('Error using custom transport:'), error);
  } finally {
    // Clean up
    await mcpWithCustomTransport.disconnect();
    await mcpWithAdvancedTransport.disconnect();
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateCustomTransport().catch(console.error);
}

export { customTransport, advancedCustomTransport, mcpWithCustomTransport, mcpWithAdvancedTransport };

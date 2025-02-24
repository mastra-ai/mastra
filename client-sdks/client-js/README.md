# Mastra Client

JavaScript/TypeScript client library for the [Mastra AI](https://mastra.ai) framework. This client provides a simple interface to interact with Mastra AI's APIs for agents, vectors, memory, tools, and workflows.

## Installation

```bash
npm install @mastra/client-js
```

## Quick Start

```typescript
import { MastraClient } from '@mastra/client';

// Initialize the client
const client = new MastraClient({
  baseUrl: 'http://localhost:4111', // Your Mastra API endpoint
});

// Example: Working with an Agent
async function main() {
  // Get an agent instance
  const agent = client.getAgent('your-agent-id');

  // Generate a response
  const response = await agent.generate({
    messages: [{ role: 'user', content: "What's the weather like today?" }],
  });

  console.log(response);
}
```

## Client Configuration

The client can be configured with several options:

```typescript
const client = new MastraClient({
    baseUrl: string;           // Base URL for the Mastra API
    retries?: number;          // Number of retry attempts (default: 3)
    backoffMs?: number;        // Initial backoff time in ms (default: 300)
    maxBackoffMs?: number;     // Maximum backoff time in ms (default: 5000)
    headers?: Record<string, string>; // Custom headers
});
```

## Available Methods

### Agents

- `getAgents()`: Get all available agents
- `getAgent(agentId)`: Get a specific agent instance
  - `agent.details()`: Get agent details
  - `agent.generate(params)`: Generate a response
  - `agent.stream(params)`: Stream a response
  - `agent.getTool(toolId)`: Get agent tool details
  - `agent.evals()`: Get agent evaluations
  - `agent.liveEvals()`: Get live evaluations

### Memory

- `getMemoryThreads(params)`: Get memory threads
- `createMemoryThread(params)`: Create a new memory thread
- `getMemoryThread(threadId)`: Get a memory thread instance
- `saveMessageToMemory(params)`: Save messages to memory
- `getMemoryStatus()`: Get memory system status

### Tools

- `getTools()`: Get all available tools
- `getTool(toolId)`: Get a tool instance
  - `tool.details()`: Get tool details
  - `tool.execute(params)`: Execute the tool

### Workflows

- `getWorkflows()`: Get all workflows
- `getWorkflow(workflowId)`: Get a workflow instance
  - `workflow.details()`: Get workflow details
  - `workflow.execute(params)`: Execute the workflow
  - `workflow.watch(params)`: Watch the workflow
  - `workflow.resume(params)`: Resume the workflow

### Vectors

- `getVector(vectorName)`: Get a vector instance
  - `vector.details(indexName)`: Get vector index details
  - `vector.delete(indexName)`: Delete a vector index
  - `vector.getIndexes()`: Get all indexes
  - `vector.createIndex(params)`: Create a new index
  - `vector.upsert(params)`: Upsert vectors
  - `vector.query(params)`: Query vectors

### Logs

- `getLogs(params)`: Get system logs
- `getLog(params)`: Get specific log entry
- `getLogTransports()`: Get configured Log transports

### Telemetry

- `getTelemetry(params)`: Get telemetry data

## Error Handling

The client includes built-in retry logic for failed requests:

- Automatically retries failed requests with exponential backoff
- Configurable retry count and backoff timing
- Throws error after max retries reached

## Internal Implementation

The client uses the native `fetch` API internally for making HTTP requests. All requests are automatically handled with:

- JSON serialization/deserialization
- Retry logic with exponential backoff
- Custom header management
- Error handling

## License

MIT

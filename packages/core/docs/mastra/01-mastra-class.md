> Documentation for the `Mastra` class in Mastra, the core entry point for managing agents, workflows, MCP servers, and server endpoints.

# Mastra Class

The `Mastra` class is the central orchestrator in any Mastra application, managing agents, workflows, storage, logging, telemetry, and more. Typically, you create a single instance of `Mastra` to coordinate your application.

Think of `Mastra` as a top-level registry:

- Registering **integrations** makes them accessible to **agents**, **workflows**, and **tools** alike.
- **tools** aren’t registered on `Mastra` directly but are associated with agents and discovered automatically.

## Usage example

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

## Constructor parameters

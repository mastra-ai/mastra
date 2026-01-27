import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { Observability, ConsoleExporter, DefaultExporter } from '@mastra/observability';
import { LibSQLStore } from '@mastra/libsql';

import { researchAgent, researchAgentRegular } from './agents/research-agent';
import { fileManagerAgent } from './agents/file-manager-agent';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

// Configure observability with tracing exporters
// ConsoleExporter logs spans to console for debugging
// DefaultExporter persists traces to storage for later analysis
const observability = new Observability({
  configs: {
    default: {
      serviceName: 'evented-agent-example',
      exporters: [
        new ConsoleExporter(), // Logs trace events to console
        new DefaultExporter(), // Persists traces to storage
      ],
    },
  },
});

// Create and configure the main Mastra instance
export const mastra = new Mastra({
  agents: {
    // Durable agents using built-in evented workflow engine
    researchAgent,
    fileManagerAgent,
    // Regular version of research agent for comparison
    researchAgentRegular,
  },
  storage,
  observability,
  server: {
    host: '0.0.0.0',
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

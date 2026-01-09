import { Mastra } from '@mastra/core';
import { serve as inngestServe } from '@mastra/inngest';
import { PinoLogger } from '@mastra/loggers';
import { Observability, ConsoleExporter, DefaultExporter } from '@mastra/observability';
import { activityPlanningWorkflow, inngest } from './workflows/inngest-workflow';
import { planningAgent } from './agents/planning-agent';
import { LibSQLStore } from '@mastra/libsql';

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
      serviceName: 'inngest-workflow-example',
      exporters: [
        new ConsoleExporter(), // Logs trace events to console
        new DefaultExporter(), // Persists traces to storage
      ],
    },
  },
});

// Create and configure the main Mastra instance
export const mastra = new Mastra({
  workflows: {
    activityPlanningWorkflow,
  },
  agents: {
    planningAgent,
  },
  storage,
  observability,
  server: {
    host: '0.0.0.0',
    apiRoutes: [
      {
        path: '/api/inngest', // API endpoint for Inngest to send events to
        method: 'ALL',
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
      },
    ],
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

// Import agents
import { adCopyAgent } from './agents/ad-copy-agent';
import { contentSummarizerAgent } from './agents/content-summarizer-agent';
import { copywritingAgent } from './agents/copywriting-agent';
import { webContentAgent } from './agents/web-content-agent';

// Import workflows
import { adCopyGenerationWorkflow } from './workflows/ad-copy-generation-workflow';

export const mastra = new Mastra({
  workflows: {
    adCopyGenerationWorkflow,
  },
  agents: {
    adCopyAgent,
    contentSummarizerAgent,
    copywritingAgent,
    webContentAgent,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra Ad Copy Template',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});

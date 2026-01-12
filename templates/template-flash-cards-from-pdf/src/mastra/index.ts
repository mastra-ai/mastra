import { Observability, LocalExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

// Import agents
import { pdfProcessorAgent } from './agents/pdf-processor-agent';
import { contentAnalyzerAgent } from './agents/content-analyzer-agent';
import { flashCardCreatorAgent } from './agents/flash-card-creator-agent';
import { educationalImageAgent } from './agents/educational-image-agent';

// Import workflows
import { flashCardsGenerationWorkflow } from './workflows/flash-cards-generation-workflow';

export const mastra = new Mastra({
  workflows: {
    flashCardsGenerationWorkflow,
  },
  agents: {
    pdfProcessorAgent,
    contentAnalyzerAgent,
    flashCardCreatorAgent,
    educationalImageAgent,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra Flash Cards Template',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new LocalExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});

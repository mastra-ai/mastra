import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { csvToQuestionsWorkflow } from './workflows/csv-to-questions-workflow';
import { textQuestionAgent } from './agents/text-question-agent';
import { csvQuestionAgent } from './agents/csv-question-agent';
import { csvSummarizationAgent } from './agents/csv-summarization-agent';

export const mastra = new Mastra({
  workflows: { csvToQuestionsWorkflow },
  agents: {
    textQuestionAgent,
    csvQuestionAgent,
    csvSummarizationAgent,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    // stores observability, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
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

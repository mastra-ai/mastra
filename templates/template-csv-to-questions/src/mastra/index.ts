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
  observability: {
    default: {
      enabled: true,
    },
  },
});

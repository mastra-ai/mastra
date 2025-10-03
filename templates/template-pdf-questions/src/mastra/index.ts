import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { pdfToQuestionsWorkflow } from './workflows/generate-questions-from-pdf-workflow';
import { textQuestionAgent } from './agents/text-question-agent';
import { pdfQuestionAgent } from './agents/pdf-question-agent';
import { pdfSummarizationAgent } from './agents/pdf-summarization-agent';

export const mastra = new Mastra({
  workflows: { pdfToQuestionsWorkflow },
  agents: {
    textQuestionAgent,
    pdfQuestionAgent,
    pdfSummarizationAgent,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
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

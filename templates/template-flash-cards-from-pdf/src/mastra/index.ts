import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

// Import agents
import { flashCardsAgent } from './agents/flash-cards-agent';
import { contentAnalyzerAgent } from './agents/content-analyzer-agent';
import { flashCardsGeneratorAgent } from './agents/flash-cards-generator-agent';
import { pdfContentAgent } from './agents/pdf-content-agent';
import { pdfSummarizationAgent } from './agents/pdf-summarization-agent';

// Import workflows
import { flashCardsGenerationWorkflow } from './workflows/flash-cards-generation-workflow';

export const mastra = new Mastra({
  workflows: {
    flashCardsGenerationWorkflow,
  },
  agents: {
    flashCardsAgent,
    contentAnalyzerAgent,
    flashCardsGeneratorAgent,
    pdfContentAgent,
    pdfSummarizationAgent,
  },
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra Flash Cards Template',
    level: 'info',
  }),
});

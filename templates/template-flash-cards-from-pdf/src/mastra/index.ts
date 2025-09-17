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
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra Flash Cards Template',
    level: 'info',
  }),
});

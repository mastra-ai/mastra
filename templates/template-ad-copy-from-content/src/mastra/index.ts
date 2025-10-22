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
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra Ad Copy Template',
    level: 'info',
  }),
  observability: {
    default: {
      enabled: true,
    },
  },
});

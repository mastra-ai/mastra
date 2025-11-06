import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { pdfToAudioWorkflow } from './workflows/pdf-to-audio-workflow';
import { textNaturalizerAgent } from './agents/text-naturalizer-agent';
import { pdfToAudioAgent } from './agents/pdf-to-audio-agent';
import { pdfSummarizationAgent } from './agents/pdf-summarization-agent';

export const mastra = new Mastra({
  workflows: { pdfToAudioWorkflow },
  agents: {
    pdfToAudioAgent,
    textNaturalizerAgent,
    pdfSummarizationAgent,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
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

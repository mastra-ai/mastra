import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { pdfToAudioWorkflow } from './workflows/generate-audio-from-pdf-workflow';
import { textToAudioAgent } from './agents/text-to-audio-agent';
import { pdfToAudioAgent } from './agents/pdf-to-audio-agent';
import { pdfSummarizationAgent } from './agents/pdf-summarization-agent';

export const mastra = new Mastra({
  workflows: { pdfToAudioWorkflow },
  agents: {
    textToAudioAgent,
    pdfToAudioAgent,
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
});

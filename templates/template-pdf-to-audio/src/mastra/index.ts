import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { pdfToAudioWorkflow } from './workflows/pdf-to-audio-workflow';
import { pdfSummarizationAgent } from './agents/pdf-summarization-agent';
import { audioGenerationAgent } from './agents/audio-generation-agent';
import { pdfToAudioChatAgent } from './agents/pdf-to-audio-chat-agent';

export const mastra = new Mastra({
  workflows: { pdfToAudioWorkflow },
  agents: {
    pdfSummarizationAgent,
    audioGenerationAgent,
    pdfToAudioChatAgent,
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

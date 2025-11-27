import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Observability } from '@mastra/observability';
import { englishSpeakingAgentRaw } from './agent-as-tool-raw';
import { englishSpeakingAgentMastra } from './agent-as-tool-mastra';
import { languageTriageAgent } from './agent-handoff';
import { supervisorLoopWorkflow } from './agent-network-raw';
import { researchNetworkAgent } from './agent-network-mastra';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: ':memory:',
});

export const mastra = new Mastra({
  agents: {
    englishSpeakingAgentRaw,
    englishSpeakingAgentMastra,
    languageTriageAgent,
    researchNetworkAgent,
  },
  workflows: {
    supervisorLoopWorkflow,
  },
  storage,
  observability: new Observability({
    default: {
      enabled: true,
    },
  }),
});

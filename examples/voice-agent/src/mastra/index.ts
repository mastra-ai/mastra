import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { liveKitConnectionRoute } from '@mastra/livekit';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';
import { callCenterAgent } from './agents/call-center-agent';
import { triageAgent } from './agents/triage-agent';
import { voiceAgentDbUrl } from './db';
import { phoneConversationWorkflow } from './workflows/phone-conversation';

export const mastra = new Mastra({
  // `callCenter` answers the agent worker; `triage` is the classifier used by the workflow
  // worker's per-turn workflow.
  agents: { callCenter: callCenterAgent, triage: triageAgent },
  workflows: { phoneConversation: phoneConversationWorkflow },
  // One LibSQL file for memory, threads, traces, and the semantic-recall vector index
  // (see ./db). SQLite handles concurrent access from the server and the voice worker;
  // single-writer stores (e.g. DuckDB) do not — the worker is a separate process writing
  // spans for every voice turn.
  storage: new LibSQLStore({
    id: 'voice-agent-storage',
    url: voiceAgentDbUrl,
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'voice-agent',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: {
    // Number.parseInt over Number() so a non-numeric PORT falls back to 4111 instead of NaN.
    port: Number.parseInt(process.env.PORT ?? '', 10) || 4111,
    apiRoutes: [
      liveKitConnectionRoute({
        agentName: 'mastra-voice',
        // Local demo only — protect this route in production.
        requiresAuth: false,
      }),
    ],
  },
});

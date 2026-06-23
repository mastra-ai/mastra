import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { liveKitConnectionRoute } from '@mastra/livekit';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';
import { callCenterAgent } from './agents/call-center-agent';

export const mastra = new Mastra({
  agents: { callCenter: callCenterAgent },
  // One LibSQL file for memory, threads, and traces. SQLite handles concurrent access
  // from the server and the voice worker; single-writer stores (e.g. DuckDB) do not —
  // the worker is a separate process writing spans for every voice turn.
  //
  // The path is anchored to this module instead of the working directory: the dev
  // server (bundled into .mastra/output) and the voice worker (running src/mastra)
  // both sit two directories below the project root, but run with different working
  // directories — a plain relative path would give each process its own database.
  storage: new LibSQLStore({
    id: 'voice-agent-storage',
    url: new URL('../../voice-agent.db', import.meta.url).href,
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

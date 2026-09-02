import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import { circlePaymentAgent } from './agents/circle-payment-agent';
import { controlPlaneRoutes } from './control-plane';

export const mastra = new Mastra({
  agents: { circlePaymentAgent },
  server: {
    // Terms acceptance and OTP login: the two steps the agent is blocked from
    // running and a deployed user has no shell to run. Mounted at the root
    // rather than under the `/api` prefix Mastra's own routes use — so
    // `/circle/status`, not `/api/circle/status` — and gated on
    // `CONTROL_PLANE_TOKEN` rather than the wide-open default. See
    // `./control-plane`.
    apiRoutes: controlPlaneRoutes,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    // Observability events and scores live in memory only. Point this at a
    // hosted LibSQL/Postgres URL if they need to survive a restart.
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new MastraStorageExporter(), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});

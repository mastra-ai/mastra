import { channels } from '@mastra/connect';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import { PostgresStore } from '@mastra/pg';
import { connectAgent } from './agents/connect-agent';
import { activityDigestWorkflow } from './workflows/activity-digest';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (Postgres connection string).');
}

// Channel providers derive OAuth redirect and webhook URLs from the server
// config, and the bind address of a deployed container (e.g. 0.0.0.0:3000)
// is not publicly reachable. MASTRA_SERVER_URL carries the server's public
// URL — Mastra Cloud injects it on every deploy; set it yourself on other
// hosts. Once channel providers read the variable directly, this block can
// be removed.
const serverUrl = process.env.MASTRA_SERVER_URL ? new URL(process.env.MASTRA_SERVER_URL) : undefined;

export const mastra = new Mastra({
  ...(serverUrl && {
    server: {
      studioProtocol: serverUrl.protocol === 'https:' ? ('https' as const) : ('http' as const),
      studioHost: serverUrl.hostname,
      studioPort: serverUrl.port ? Number(serverUrl.port) : serverUrl.protocol === 'https:' ? 443 : 80,
    },
  }),
  storage: new PostgresStore({
    id: 'mastra-storage',
    connectionString: process.env.DATABASE_URL,
  }),
  agents: { connectAgent },
  workflows: { activityDigestWorkflow },
  // Live channel resolver over the project's platform connections: connect
  // Slack, Discord, or Telegram on the platform and the webhook/OAuth routes
  // mounted here start serving that channel — no redeploy. Channels without
  // an active connection are simply absent from the resolved map.
  channels: await channels(),
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'connect-agent',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});

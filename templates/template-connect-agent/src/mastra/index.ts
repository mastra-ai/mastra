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
// config. When deployed, the bind address (e.g. 0.0.0.0:3000) is not publicly
// reachable — set MASTRA_PUBLIC_URL to the deployment's public HTTPS URL
// (e.g. https://my-app.mastra.cloud) so Slack OAuth callbacks and Telegram
// webhooks point at the real domain.
const publicUrl = process.env.MASTRA_PUBLIC_URL ? new URL(process.env.MASTRA_PUBLIC_URL) : undefined;

export const mastra = new Mastra({
  ...(publicUrl && {
    server: {
      studioProtocol: publicUrl.protocol === 'https:' ? ('https' as const) : ('http' as const),
      studioHost: publicUrl.hostname,
      studioPort: publicUrl.port ? Number(publicUrl.port) : publicUrl.protocol === 'https:' ? 443 : 80,
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

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

export const mastra = new Mastra({
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

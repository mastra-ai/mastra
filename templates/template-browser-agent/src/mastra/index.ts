import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import { browserAgent } from './agents/browser-agent';

const tursoUrl = process.env.TURSO_DATABASE_URL;
if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL is not set. Provide a Turso libSQL URL.');
}

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: tursoUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  agents: { browserAgent },
  editor: new MastraEditor({ source: 'code' }),
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'browser-agent',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});

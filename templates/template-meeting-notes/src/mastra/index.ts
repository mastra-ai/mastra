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
import { meetingNotesAgent } from './agents/meeting-notes';
import { ingestMeetingWorkflow } from './workflows/ingest-meeting';
import { meetingsUploadRoute } from './server/routes';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  agents: { meetingNotesAgent },
  workflows: { ingestMeetingWorkflow },
  editor: new MastraEditor({ source: 'code' }),
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  server: {
    apiRoutes: [meetingsUploadRoute],
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'meeting-notes',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  bundler: {
    // Resolved dynamically via require.resolve in src/mastra/mcp.ts, so static
    // analysis can't see it. Listing it here makes sure the deploy install
    // includes the Notion MCP server binary.
    dynamicPackages: ['@notionhq/notion-mcp-server'],
  },
});

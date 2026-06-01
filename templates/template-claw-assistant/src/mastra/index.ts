import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { claw } from './agents/claw';

const workspaceDir = process.env.CLAW_WORKSPACE_DIR
  ? resolve(process.env.CLAW_WORKSPACE_DIR)
  : resolve(import.meta.dirname, '../../workspace');

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: workspaceDir }),
  sandbox: new LocalSandbox({ workingDirectory: workspaceDir }),
  skills: ['/skills'],
});

const tursoUrl = process.env.TURSO_DATABASE_URL;
if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL is not set. Use `file:./mastra.db` for local dev or a Turso libSQL URL.');
}

export const mastra = new Mastra({
  workspace,
  agents: { claw },
  storage: new LibSQLStore({
    id: 'claw-storage',
    url: tursoUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  logger: new PinoLogger({ name: 'claw', level: 'info' }),
});

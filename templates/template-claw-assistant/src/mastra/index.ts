import path from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { claw } from './agents/claw';

function getProjectRoot() {
  const cwd = process.cwd();
  const devRuntimePath = `${path.sep}src${path.sep}mastra${path.sep}public`;
  const buildRuntimePath = `${path.sep}.mastra${path.sep}output`;

  if (cwd.includes(devRuntimePath)) {
    return cwd.slice(0, cwd.indexOf(devRuntimePath));
  }
  if (cwd.includes(buildRuntimePath)) {
    return cwd.slice(0, cwd.indexOf(buildRuntimePath));
  }
  return cwd;
}

const workspaceDir = path.resolve(getProjectRoot(), process.env.CLAW_WORKSPACE_DIR || './workspace');

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: workspaceDir }),
  sandbox: new LocalSandbox({ workingDirectory: workspaceDir }),
  skills: ['skills'],
});

const tursoUrl = process.env.TURSO_DATABASE_URL;
if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL is not set. Provide a Turso libSQL URL.');
}

export const mastra = new Mastra({
  workspace,
  agents: { claw },
  storage: new LibSQLStore({
    id: 'claw-storage',
    url: tursoUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  editor: new MastraEditor({ source: 'code' }),
  logger: new PinoLogger({ name: 'claw', level: 'info' }),
});

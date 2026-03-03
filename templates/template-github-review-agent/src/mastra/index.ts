import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { codeReviewAgent } from './agents/code-review-agent';
import { workflowReviewAgent } from './agents/workflow-review-agent';
import { prReviewWorkflow } from './workflows/pr-review-workflow';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: resolve(import.meta.dirname, '../../workspace'),
  }),
  skills: ['/skills'],
});

export const mastra = new Mastra({
  workspace,
  agents: { codeReviewAgent, workflowReviewAgent },
  workflows: { prReviewWorkflow },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

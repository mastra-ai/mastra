import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { sreAgent } from './agents/sre-agent';
import { workflowDiagnosisAgent } from './agents/workflow-diagnosis-agent';
import { diagnosisWorkflow } from './workflows/diagnosis-workflow';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: resolve(import.meta.dirname, '../../workspace'),
  }),
  skills: ['/skills'],
});

export const mastra = new Mastra({
  workspace,
  agents: { sreAgent, workflowDiagnosisAgent },
  workflows: { diagnosisWorkflow },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

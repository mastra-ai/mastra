import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { supportAgent } from './agents';
import { addNumbers, lookupCustomer, createSupportTicket } from './tools';
import { greetingWorkflow } from './workflows';

const storage = new LibSQLStore({
  id: 'workflow-builder-storage',
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  storage,
  logger: new PinoLogger({ name: 'Workflow Builder Example', level: 'info' }),
  agents: { supportAgent },
  tools: { addNumbers, lookupCustomer, createSupportTicket },
  workflows: { greetingWorkflow },
  editor: new MastraEditor({
    source: 'db',
    workflowBuilder: { enabled: true, model: 'anthropic/claude-opus-4-8' },
  }),
});

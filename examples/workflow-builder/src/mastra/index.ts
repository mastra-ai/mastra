import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
// TEMP: Agent Builder is registered here only to reproduce the shared
// StreamChatProvider instruction-replacement bug. Remove before merge.
import { createBuilderAgent } from '@mastra/editor/ee';
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
  agents: { supportAgent, builderAgent: createBuilderAgent() },
  tools: { addNumbers, lookupCustomer, createSupportTicket },
  workflows: { greetingWorkflow },
  editor: new MastraEditor({
    source: 'db',
    workflowBuilder: { enabled: true, model: 'anthropic/claude-opus-4-8' },
    // TEMP: minimal Agent Builder surface for the instruction-replacement
    // repro. Remove before merge.
    builder: {
      enabled: true,
      features: {
        agent: {
          tools: true,
          agents: true,
          workflows: true,
          model: true,
        },
      },
    },
  }),
});

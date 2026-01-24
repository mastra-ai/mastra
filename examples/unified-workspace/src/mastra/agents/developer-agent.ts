import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

/**
 * Developer agent - inherits globalWorkspace from Mastra instance.
 *
 * Workspace: Inherits from Mastra (no agent-specific workspace)
 * Safety: None
 */
export const developerAgent = new Agent({
  id: 'developer-agent',
  name: 'Developer Agent',
  description: 'An agent that helps with code reviews and API design.',
  instructions: `You are a helpful developer assistant.`,
  model: 'anthropic/claude-opus-4-5',
  defaultOptions: {
    modelSettings: {
      temperature: 1,
      topP: undefined,
    },
  },
  memory: new Memory({
    vector: new LibSQLVector({
      id: 'developer-agent-vector',
      url: "file:./mastra.db",
    }),
    embedder: fastembed,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 5,
        messageRange: 2,
        scope: 'thread' // Search within the current thread only
      },
    },
  }),
});

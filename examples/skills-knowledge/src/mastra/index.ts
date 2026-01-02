import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { docsAgent, supportAgent } from './agents';
import { supportKnowledge } from './knowledge';
import { ingestKnowledgeWorkflow } from './workflows';

/**
 * Storage for Mastra (threads, memory, etc.)
 */
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

/**
 * Mastra instance configured with both Skills and Knowledge.
 */
export const mastra = new Mastra({
  agents: {
    docsAgent, // Uses SkillsProcessor for brand guidelines
    supportAgent, // Uses RetrievedKnowledge for FAQ search
  },
  knowledge: supportKnowledge, // Register knowledge with Mastra
  workflows: {
    ingestKnowledgeWorkflow, // Workflow for ingesting knowledge programmatically
  },
  storage,
});

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Skills } from '@mastra/skills';

import { docsAgent, supportAgent } from './agents/index';
import { supportKnowledge } from './knowledge/index';
import { ingestKnowledgeWorkflow } from './workflows/index';

/**
 * Skills instance - discovers skills from the skills/ directory.
 */
export const skills = new Skills({
  id: 'demo-skills',
  paths: ['./skills'],
});

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

// Re-export for convenience
export { skills, supportKnowledge };

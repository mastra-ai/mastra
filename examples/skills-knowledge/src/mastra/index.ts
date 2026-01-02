import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { docsAgent, supportAgent, developerAgent } from './agents';
import { supportKnowledge } from './knowledge';
import { skills } from './skills';
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
 *
 * Skills registered here are:
 * - Visible in the Skills UI (/skills page)
 * - Available to agents via SkillsProcessor (when no skillsPaths provided)
 *
 * Skills include:
 * - brand-guidelines: Writing style and brand colors
 * - code-review: Code review guidelines
 * - api-design: API design patterns
 * - customer-support: Support interaction guidelines
 */
export const mastra = new Mastra({
  agents: {
    docsAgent, // Uses SkillsProcessor with own skillsPaths (agent-specific skills)
    supportAgent, // Uses RetrievedKnowledge for FAQ search
    developerAgent, // Uses SkillsProcessor with no config (inherits from Mastra)
  },
  skills, // Register skills globally (visible in UI, available to agents)
  knowledge: supportKnowledge, // Register knowledge with Mastra
  workflows: {
    ingestKnowledgeWorkflow, // Workflow for ingesting knowledge programmatically
  },
  storage,
});

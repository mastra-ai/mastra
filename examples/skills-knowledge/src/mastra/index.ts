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
 * - Inherited by all agents by default (unless they provide their own or disable)
 *
 * Global skills (in ./skills/):
 * - code-review: Code review guidelines
 * - api-design: API design patterns
 * - customer-support: Support interaction guidelines
 *
 * Agent-specific skills (in ./docs-skills/):
 * - brand-guidelines: Writing style (only used by docsAgent)
 */
export const mastra = new Mastra({
  agents: {
    docsAgent, // Has its own skills (brand-guidelines in docs-skills/)
    supportAgent, // Inherits global skills + uses RetrievedKnowledge for FAQ
    developerAgent, // Inherits global skills (code-review, api-design, customer-support)
  },
  skills, // Register skills globally (inherited by agents by default)
  knowledge: supportKnowledge, // Register knowledge with Mastra
  workflows: {
    ingestKnowledgeWorkflow, // Workflow for ingesting knowledge programmatically
  },
  storage,
});

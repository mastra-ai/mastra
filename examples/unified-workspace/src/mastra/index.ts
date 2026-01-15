import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { docsAgent, supportAgent, developerAgent } from './agents';
import { globalWorkspace } from './workspaces';

// Re-export workspaces for demo scripts
export { globalWorkspace, docsAgentWorkspace, isolatedDocsWorkspace } from './workspaces';

/**
 * Storage for Mastra (threads, memory, etc.)
 */
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

/**
 * Mastra instance configured with the unified Workspace.
 *
 * Workspace inheritance pattern:
 * - Global workspace: Registered with Mastra, has /skills (code-review, api-design, customer-support)
 * - docsAgent: Has own workspace with /skills + /docs-skills (inherits global + brand-guidelines)
 * - developerAgent: Uses global workspace (no agent-specific workspace)
 * - supportAgent: Uses global workspace + FAQ search
 *
 * Agents can access the workspace via:
 * - Agent's own workspace (if configured): agent.workspace
 * - Global workspace: mastra.getWorkspace()
 * - Workspace skills: workspace.skills.list(), workspace.skills.get(), workspace.skills.search()
 * - Workspace search: workspace.search()
 */
export const mastra = new Mastra({
  agents: {
    docsAgent, // Has own workspace (inherits global skills + brand-guidelines)
    supportAgent, // Uses global workspace (FAQ search)
    developerAgent, // Uses global workspace (code-review, api-design skills)
  },
  workspace: globalWorkspace, // Register global workspace with Mastra
  storage,
});

// Export workspace alias for convenience
export const workspace = globalWorkspace;

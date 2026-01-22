import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import {
  // developerAgent,
  // docsAgent,
  // supportAgent,
  // researchAgent,
  // editorAgent,
  // automationAgent,
  // scriptRunnerAgent,
  testAgent,
  // e2bAgent,
} from './agents';
import { globalWorkspace } from './workspaces';
import { cloudWorkspace } from './agents/e2b-agent';

// Re-export workspaces for demo scripts
export {
  globalWorkspace,
  docsAgentWorkspace,
  isolatedDocsWorkspace,
  readonlyWorkspace,
  safeWriteWorkspace,
  supervisedSandboxWorkspace,
  commandApprovalWorkspace,
  testAgentWorkspace,
} from './workspaces';
export { cloudWorkspace as e2bWorkspace } from './agents/e2b-agent';

/**
 * Storage for Mastra (threads, memory, etc.)
 */
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

/**
 * Mastra instance with agents demonstrating different workspace configurations.
 *
 * Agent Workspace Configurations:
 * - developerAgent: Inherits globalWorkspace from Mastra (no agent-specific workspace)
 * - docsAgent: docsAgentWorkspace (global + agent-specific skills)
 * - supportAgent: isolatedDocsWorkspace (agent-specific skills only)
 * - researchAgent: readonlyWorkspace (safety: readOnly)
 * - editorAgent: safeWriteWorkspace (safety: requireReadBeforeWrite)
 * - automationAgent: supervisedSandboxWorkspace (safety: requireSandboxApproval: 'all')
 * - scriptRunnerAgent: commandApprovalWorkspace (safety: requireSandboxApproval: 'commands')
 */
export const mastra = new Mastra({
  agents: {
    // developerAgent,
    // docsAgent,
    // supportAgent,
    // researchAgent,
    // editorAgent,
    // automationAgent,
    // scriptRunnerAgent,
    testAgent,
    // e2bAgent,
  },
  workspace: cloudWorkspace,
  // workspace: globalWorkspace,
  storage,
});

// Export workspace alias for convenience
export const workspace = globalWorkspace;

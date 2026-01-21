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
  cloudRunnerAgent,
} from './agents';
import { globalWorkspace } from './workspaces';

// Re-export workspaces for demo scripts
export {
  globalWorkspace,
  docsAgentWorkspace,
  isolatedDocsWorkspace,
  readonlyWorkspace,
  safeWriteWorkspace,
  supervisedSandboxWorkspace,
  commandApprovalWorkspace,
} from './workspaces';

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
 * - cloudRunnerAgent: cloudSandboxWorkspace (ComputeSDK cloud sandbox)
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
    cloudRunnerAgent,
  },
  // workspace: globalWorkspace,
  storage,
});

// Export workspace alias for convenience
export const workspace = globalWorkspace;

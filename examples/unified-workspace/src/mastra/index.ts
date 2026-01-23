import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import {
  developerAgent,
  docsAgent,
  supportAgent,
  researchAgent,
  editorAgent,
  automationAgent,
  scriptRunnerAgent,
  fsWriteApprovalAgent,
  fsAllApprovalAgent,
  testAgent,
  skillsOnlyAgent,
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
  fsWriteApprovalWorkspace,
  fsAllApprovalWorkspace,
  testAgentWorkspace,
  skillsOnlyWorkspace,
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
 * - skillsOnlyAgent: skillsOnlyWorkspace (skills only, no filesystem or sandbox)
 */
export const mastra = new Mastra({
  agents: {
    developerAgent,
    docsAgent,
    supportAgent,
    researchAgent,
    editorAgent,
    automationAgent,
    scriptRunnerAgent,
    fsWriteApprovalAgent,
    fsAllApprovalAgent,
    testAgent,
    skillsOnlyAgent,
  },
  workspace: globalWorkspace,
  storage,
});

// Export workspace alias for convenience
export const workspace = globalWorkspace;

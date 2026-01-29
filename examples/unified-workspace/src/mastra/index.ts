import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import {
  developerAgent,
  docsAgent,
  researchAgent,
  editorAgent,
  automationAgent,
  testAgent,
  skillsOnlyAgent,
  dynamicSkillsAgent,
} from './agents';
import { globalWorkspace } from './workspaces';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

// Re-export workspaces for demo scripts
export {
  globalWorkspace,
  docsAgentWorkspace,
  readonlyWorkspace,
  safeWriteWorkspace,
  supervisedSandboxWorkspace,
  testAgentWorkspace,
  skillsOnlyWorkspace,
  dynamicSkillsWorkspace,
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
 * - researchAgent: readonlyWorkspace (safety: readOnly)
 * - editorAgent: safeWriteWorkspace (safety: requireReadBeforeWrite)
 * - automationAgent: supervisedSandboxWorkspace (safety: requireApproval for all)
 * - testAgent: testAgentWorkspace (different basePath, different model)
 * - skillsOnlyAgent: skillsOnlyWorkspace (skills only, no filesystem or sandbox)
 * - dynamicSkillsAgent: dynamicSkillsWorkspace (skills resolve dynamically)
 */
export const mastra = new Mastra({
  agents: {
    developerAgent,
    docsAgent,
    researchAgent,
    editorAgent,
    automationAgent,
    testAgent,
    skillsOnlyAgent,
    dynamicSkillsAgent,
  },
  workspace: globalWorkspace,
  storage,
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});

// Export workspace alias for convenience
export const workspace = globalWorkspace;

// Initialize workspace on module load (ensures sandbox is ready)
globalWorkspace.init().catch(console.error);

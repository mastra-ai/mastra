import { join } from 'node:path';
import { Workspace, LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS } from '@mastra/core/workspace';

// For examples, we use the current directory as the project root.
// In production, set WORKSPACE_PATH environment variable to an absolute path.
const PROJECT_ROOT = process.env.WORKSPACE_PATH || process.cwd();

/**
 * Global Workspace with filesystem, skills, and search.
 *
 * The Workspace provides:
 * - Filesystem access (read/write files)
 * - Skills discovery from SKILL.md files
 * - BM25 search across indexed content
 *
 * Skills are discovered from the configured skills and are:
 * - Visible in the Workspace UI (/workspace page, Skills tab)
 * - Available to agents via workspace.skills
 * - Searchable via workspace.skills.search()
 *
 * Global skills (in ./skills/):
 * - code-review: Code review guidelines
 * - api-design: API design patterns
 * - customer-support: Support interaction guidelines
 */
export const globalWorkspace = new Workspace({
  id: 'global-workspace',
  name: 'Global Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  // Enable sandbox for command execution
  // Pass env vars explicitly - spread process.env for full access, or specific vars for security
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    isolation: LocalSandbox.detectIsolation().backend,
    env: {
      SOMETHING_ELSE: 'hello',
    },
    nativeSandbox: {
      allowNetwork: true,
      allowSystemBinaries: true,
    },
  }),
  // Tool configuration - full access for demo/development purposes
  // No approval required, no read-before-write enforcement
  tools: {
    requireApproval: false,
  },
  // Enable BM25 search for skills and files
  bm25: true,
  // Auto-index FAQ content for search
  autoIndexPaths: ['/content'],
  // Discover skills from these paths (global skills only)
  skills: ['/skills'],
});

/**
 * Docs agent workspace - inherits global skills AND has agent-specific skills.
 *
 * This demonstrates skill inheritance:
 * - Global skills (from /skills): code-review, api-design, customer-support
 * - Agent-specific skills (from /docs-skills): brand-guidelines
 *
 * The docs agent can use any of these skills, but brand-guidelines is
 * specifically designed for documentation writing.
 */
export const docsAgentWorkspace = new Workspace({
  id: 'docs-agent-workspace',
  name: 'Docs Agent Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  // Enable sandbox for command execution
  // Spread process.env to inherit all environment variables
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    env: { ...process.env },
  }),
  // Tool configuration - full access for documentation agent
  tools: {
    requireApproval: false,
  },
  // Enable BM25 search
  bm25: true,
  // Inherit global skills + add agent-specific skills
  skills: ['/skills', '/docs-skills'],
});

/**
 * Readonly workspace - blocks all write operations.
 *
 * Safety feature: readOnly: true
 * - Write tools (workspace_write_file, workspace_delete_file, workspace_mkdir) are excluded
 * - Direct write operations throw WorkspaceReadOnlyError
 */
export const readonlyWorkspace = new Workspace({
  id: 'readonly-workspace',
  name: 'Readonly Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
    readOnly: true,
  }),
  bm25: true,
  skills: ['/skills'],
});

/**
 * Safe write workspace - requires reading files before writing.
 *
 * Safety feature: requireReadBeforeWrite on write/edit tools
 * - Agent must read a file (via read_file tool) before writing to it
 * - If file was modified externally since last read, write fails
 * - Prevents accidental overwrites of changed content
 * - Note: Direct workspace.writeFile() calls are NOT restricted (only tool calls)
 */
export const safeWriteWorkspace = new Workspace({
  id: 'safe-write-workspace',
  name: 'Safe Write Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
  }),
  // Tool configuration - require read before write on write/edit tools
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
      requireReadBeforeWrite: true,
    },
  },
  bm25: true,
  skills: ['/skills'],
});

/**
 * Supervised workspace - requires approval for all operations.
 *
 * Safety feature: requireApproval: true (top-level default)
 * - All filesystem operations require approval
 * - All sandbox operations require approval
 * - Demonstrates the most restrictive safety configuration
 */
export const supervisedSandboxWorkspace = new Workspace({
  id: 'supervised-sandbox-workspace',
  name: 'Supervised Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
  }),
  // Tool configuration - require approval for all tools
  tools: {
    requireApproval: true,
  },
  bm25: true,
  skills: ['/skills'],
});

/**
 * Test workspace with a different filesystem basePath.
 * Used to verify the UI shows different files for different workspaces.
 */
export const testAgentWorkspace = new Workspace({
  id: 'test-agent-workspace',
  name: 'Test Agent Workspace',
  filesystem: new LocalFilesystem({
    basePath: join(PROJECT_ROOT, 'agent-files'),
  }),
  bm25: true,
  autoIndexPaths: ['/'],
});

/**
 * Skills-only workspace - no filesystem or sandbox, just skills.
 *
 * This demonstrates the minimal workspace configuration:
 * - Only skills is provided
 * - Skills are loaded read-only via LocalSkillSource (using Node.js fs/promises)
 * - No filesystem tools (workspace_read_file, workspace_write_file, etc.)
 * - No sandbox tools (execute_command)
 * - Only skills are available to the agent
 *
 * Use cases:
 * - Agents that only need behavioral guidelines (skills) without file access
 * - Lightweight agents focused on following instructions
 * - Security-conscious deployments where file/command access is not needed
 */
export const skillsOnlyWorkspace = new Workspace({
  id: 'skills-only-workspace',
  name: 'Skills Only Workspace',
  // No filesystem - skills loaded read-only from disk via LocalSkillSource
  // No sandbox - no code execution capability
  // Only skills from the configured paths
  skills: [join(PROJECT_ROOT, 'skills'), join(PROJECT_ROOT, 'docs-skills')],
  // Note: BM25/vector search not available without filesystem
  // Skills are still searchable via workspace.skills.search() using simple text matching
});

/**
 * Dynamic skills workspace - skills paths resolved based on request context.
 *
 * This demonstrates dynamic skill resolution:
 * - Skills are resolved at runtime based on the request context
 * - Different users/roles can see different skills
 * - The resolver function receives SkillsContext with requestContext
 *
 * Example: Premium users get additional skills beyond the base set.
 */
export const dynamicSkillsWorkspace = new Workspace({
  id: 'dynamic-skills-workspace',
  name: 'Dynamic Skills Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  bm25: true,
  // Dynamic skills resolver - returns different paths based on context
  skills: context => {
    // Only include docs-skills (brand-guidelines) - excludes base skills
    // This demonstrates that the filter is working differently than static workspaces
    return ['/docs-skills'];
  },
});

/**
 * All workspaces in this example.
 */
export const allWorkspaces = [
  globalWorkspace,
  docsAgentWorkspace,
  readonlyWorkspace,
  safeWriteWorkspace,
  supervisedSandboxWorkspace,
  testAgentWorkspace,
  skillsOnlyWorkspace,
  dynamicSkillsWorkspace,
];

/**
 * Initialize all workspaces.
 * Call this at application startup before using any workspace.
 */
export async function initializeWorkspaces(): Promise<void> {
  await Promise.all(allWorkspaces.map(ws => ws.init()));
}

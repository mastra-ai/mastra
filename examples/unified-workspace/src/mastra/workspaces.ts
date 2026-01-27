import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Workspace, LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS } from '@mastra/core/workspace';

/**
 * Get the project root directory.
 *
 * When running via `mastra dev`, cwd is src/mastra/public/ (3 levels deep).
 * When running demo scripts directly, cwd is the project root.
 */
function getProjectRoot(): string {
  const cwd = process.cwd();

  // Try project root first (for demo scripts)
  const fromRoot = resolve(cwd, 'skills');
  if (existsSync(fromRoot)) {
    return cwd;
  }

  // Try from src/mastra/public/ (for mastra dev - 3 levels up)
  const threeLevelsUp = resolve(cwd, '../../..');
  const fromOutput = resolve(threeLevelsUp, 'skills');
  if (existsSync(fromOutput)) {
    return threeLevelsUp;
  }

  // Fallback to cwd
  return cwd;
}

// Resolve project root once at module load time
const PROJECT_ROOT = getProjectRoot();

/**
 * Global Workspace with filesystem, skills, and search.
 *
 * The Workspace provides:
 * - Filesystem access (read/write files)
 * - Skills discovery from SKILL.md files
 * - BM25 search across indexed content
 *
 * Skills are discovered from the configured skillsPaths and are:
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
  // Auto-index support FAQ content for search
  autoIndexPaths: ['/.mastra-knowledge/knowledge/support/default'],
  // Discover skills from these paths (global skills only)
  skillsPaths: ['/skills'],
  // Auto-initialize on construction (needed for mastra dev)
  autoInit: true,
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
  // inheritEnv: true allows access to PATH and other system env vars
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    inheritEnv: true,
  }),
  // Tool configuration - full access for documentation agent
  tools: {
    requireApproval: false,
  },
  // Enable BM25 search
  bm25: true,
  // Inherit global skills + add agent-specific skills
  skillsPaths: ['/skills', '/docs-skills'],
  // Auto-initialize on construction
  autoInit: true,
});

/**
 * Example: Agent-only workspace (no inheritance from global).
 *
 * This demonstrates an agent that ONLY has its own skills,
 * without inheriting from the global workspace.
 */
export const isolatedDocsWorkspace = new Workspace({
  id: 'isolated-docs-workspace',
  name: 'Isolated Docs Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  // Enable sandbox for command execution
  // inheritEnv: true allows access to PATH and other system env vars
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    inheritEnv: true,
  }),
  // Tool configuration - full access
  tools: {
    requireApproval: false,
  },
  bm25: true,
  // Auto-index support FAQ content for search
  autoIndexPaths: ['/.mastra-knowledge/knowledge/support/default'],
  // Only agent-specific skills, no global skills
  skillsPaths: ['/docs-skills'],
  // Auto-initialize on construction
  autoInit: true,
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
    safety: {
      readOnly: true,
    },
  }),
  bm25: true,
  skillsPaths: ['/skills'],
  autoInit: true,
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
    inheritEnv: true,
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
  skillsPaths: ['/skills'],
  autoInit: true,
});

/**
 * Supervised sandbox workspace - requires approval for all sandbox operations.
 *
 * Safety feature: requireApproval on execute_command tool
 * - execute_command requires approval before execution
 * - Uses tools config for per-tool approval settings
 */
export const supervisedSandboxWorkspace = new Workspace({
  id: 'supervised-sandbox-workspace',
  name: 'Supervised Sandbox Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    inheritEnv: true,
  }),
  // Tool configuration - require approval for sandbox commands
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      requireApproval: true,
    },
  },
  bm25: true,
  skillsPaths: ['/skills'],
  autoInit: true,
});

/**
 * Filesystem write approval workspace - requires approval for write operations.
 *
 * Safety feature: requireApproval on write tools
 * - Read operations (read_file, list_files, file_exists, search) run without approval
 * - Write operations (write_file, edit_file, delete_file, mkdir, index) require approval
 */
export const fsWriteApprovalWorkspace = new Workspace({
  id: 'fs-write-approval-workspace',
  name: 'Filesystem Write Approval Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    inheritEnv: true,
  }),
  // Tool configuration - require approval for write operations
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireApproval: true },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireApproval: true },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE_FILE]: { requireApproval: true },
    [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { requireApproval: true },
    [WORKSPACE_TOOLS.SEARCH.INDEX]: { requireApproval: true },
  },
  bm25: true,
  skillsPaths: ['/skills'],
  autoInit: true,
});

/**
 * Filesystem all approval workspace - requires approval for all filesystem operations.
 *
 * Safety feature: requireApproval: true on all tools (top-level default)
 * - All filesystem operations require approval (read and write)
 * - Sandbox ops don't need approval (per-tool override)
 */
export const fsAllApprovalWorkspace = new Workspace({
  id: 'fs-all-approval-workspace',
  name: 'Filesystem All Approval Workspace',
  filesystem: new LocalFilesystem({
    basePath: PROJECT_ROOT,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    inheritEnv: true,
  }),
  // Tool configuration - require approval for all tools, except sandbox
  tools: {
    // Top-level default: all tools require approval
    requireApproval: true,
    // Override: sandbox commands don't require approval (testing FS approval only)
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval: false },
  },
  bm25: true,
  skillsPaths: ['/skills'],
  autoInit: true,
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
  autoInit: true,
});

/**
 * Skills-only workspace - no filesystem or sandbox, just skills.
 *
 * This demonstrates the minimal workspace configuration:
 * - Only skillsPaths is provided
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
  skillsPaths: [join(PROJECT_ROOT, 'skills'), join(PROJECT_ROOT, 'docs-skills')],
  // Note: BM25/vector search not available without filesystem
  // Skills are still searchable via workspace.skills.search() using simple text matching
});

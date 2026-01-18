import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

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
  // Enable sandbox for code execution
  // scriptDirectory enables __dirname to resolve within workspace
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    scriptDirectory: join(PROJECT_ROOT, '.mastra', 'sandbox'),
  }),
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
  // Enable sandbox for code execution
  // scriptDirectory enables __dirname to resolve within workspace
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    scriptDirectory: join(PROJECT_ROOT, '.mastra', 'sandbox'),
  }),
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
  // Enable sandbox for code execution
  // scriptDirectory enables __dirname to resolve within workspace
  sandbox: new LocalSandbox({
    workingDirectory: PROJECT_ROOT,
    scriptDirectory: join(PROJECT_ROOT, '.mastra', 'sandbox'),
  }),
  bm25: true,
  // Only agent-specific skills, no global skills
  skillsPaths: ['/docs-skills'],
  // Auto-initialize on construction
  autoInit: true,
});

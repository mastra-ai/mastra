import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';

/**
 * Resolve a path that works from both project root and src/mastra/public/
 */
function resolvePath(relativePath: string): string {
  const cwd = process.cwd();

  // Try project root first (for demo scripts)
  const fromRoot = resolve(cwd, relativePath);
  if (existsSync(fromRoot)) {
    return fromRoot;
  }

  // Try from src/mastra/public/ (for mastra dev - 3 levels up)
  const fromOutput = resolve(cwd, '../../../', relativePath);
  if (existsSync(fromOutput)) {
    return fromOutput;
  }

  // Fallback to project root path
  return fromRoot;
}

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
    basePath: resolvePath('.'),
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
    basePath: resolvePath('.'),
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
    basePath: resolvePath('.'),
  }),
  bm25: true,
  // Only agent-specific skills, no global skills
  skillsPaths: ['/docs-skills'],
  // Auto-initialize on construction
  autoInit: true,
});

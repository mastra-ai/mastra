/**
 * Types for agent-level skills — skills without a Workspace.
 *
 * These types let users attach skills directly to an Agent via `createSkill()`
 * or filesystem paths, without needing a full Workspace with filesystem/sandbox.
 */

import type { RequestContext } from '../request-context';
import type { Skill, SkillMetadata, SkillFormat, WorkspaceSkills } from '../workspace/skills/types';

// =============================================================================
// Inline Skill Definition
// =============================================================================

/**
 * Input for `createSkill()` — a code-defined skill with no filesystem dependency.
 */
export interface InlineSkillInput {
  /** Skill name (1-64 chars, lowercase letters/numbers/hyphens) */
  name: string;
  /** Description of what the skill does and when to use it (1-1024 chars) */
  description: string;
  /** Markdown instructions (the body of SKILL.md) */
  instructions: string;
  /** Optional license */
  license?: string;
  /** Optional compatibility requirements */
  compatibility?: unknown;
  /** Whether this skill should be directly invokable by users. Defaults to true. */
  'user-invocable'?: boolean;
  /** Optional arbitrary metadata */
  metadata?: Record<string, unknown>;
  /**
   * Optional bundled reference files, keyed by relative path.
   * These are served in-memory via skill_read without touching the filesystem.
   *
   * @example
   * ```typescript
   * references: {
   *   'checklist.md': '# Review Checklist\n- Check correctness\n...',
   *   'style-guide.md': '# Style Guide\n...',
   * }
   * ```
   */
  references?: Record<string, string>;
}

/**
 * A fully resolved inline skill — the output of `createSkill()`.
 * Implements the `Skill` interface so it can be used anywhere a Skill is expected.
 */
export interface InlineSkill extends Skill {
  /** Marker to distinguish inline skills from filesystem-discovered skills */
  readonly __inline: true;
  /** Bundled reference file contents (keyed by relative path) */
  readonly __referenceContents: Record<string, string>;
}

// =============================================================================
// Agent-Level Skills Config
// =============================================================================

/**
 * A single skill input: either a path string (resolved from disk) or an inline skill.
 */
export type SkillInput = string | InlineSkill;

/**
 * Context passed to a dynamic skills resolver.
 */
export interface AgentSkillsContext<TRequestContext extends Record<string, any> | unknown = unknown> {
  requestContext: RequestContext<TRequestContext>;
}

/**
 * Resolver for agent-level skills — static array or dynamic function.
 *
 * @example Static skills
 * ```typescript
 * skills: [
 *   './skills/review',
 *   createSkill({ name: 'faq', description: '...', instructions: '...' }),
 * ]
 * ```
 *
 * @example Dynamic skills
 * ```typescript
 * skills: ({ requestContext }) => {
 *   const tier = requestContext.get('tier');
 *   return tier === 'premium'
 *     ? ['./skills/basic', './skills/premium']
 *     : ['./skills/basic'];
 * }
 * ```
 */
export type AgentSkillsInput<TRequestContext extends Record<string, any> | unknown = unknown> =
  | SkillInput[]
  | ((context: AgentSkillsContext<TRequestContext>) => SkillInput[] | Promise<SkillInput[]>);

export type { Skill, SkillMetadata, SkillFormat, WorkspaceSkills };

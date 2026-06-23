/**
 * defineSkill() — factory for creating inline skills in code.
 *
 * Creates a Skill object that can be passed to an Agent's `skills` config
 * without requiring a Workspace or filesystem.
 *
 * @example
 * ```typescript
 * import { defineSkill } from '@mastra/core/skills';
 *
 * const reviewSkill = defineSkill({
 *   name: 'code-review',
 *   description: 'Use when reviewing code changes.',
 *   instructions: `
 *     When reviewing code:
 *     1. Check for correctness
 *     2. Check for style consistency
 *     3. Look for potential bugs
 *   `,
 *   references: {
 *     'checklist.md': '# Review Checklist\n...',
 *   },
 * });
 * ```
 */

import { validateSkillMetadata } from '../workspace/skills/schemas';
import type { InlineSkill, InlineSkillInput } from './types';

/**
 * Create an inline skill from code — no filesystem needed.
 *
 * The returned object implements the `Skill` interface and can be passed
 * directly to an Agent's `skills` config or used anywhere a `Skill` is expected.
 *
 * @throws Error if the skill metadata fails validation
 */
export function defineSkill(input: InlineSkillInput): InlineSkill {
  const { name, description, instructions, license, compatibility, metadata, references } = input;

  // Validate metadata (same checks as filesystem-discovered skills)
  const validation = validateSkillMetadata(
    { name, description, license, compatibility, 'user-invocable': input['user-invocable'], metadata },
    undefined,
    instructions,
  );

  if (!validation.valid) {
    throw new Error(`Invalid skill "${name}": ${validation.errors.join('; ')}`);
  }

  const referenceKeys = references ? Object.keys(references) : [];

  return {
    __inline: true as const,
    __referenceContents: references ?? {},
    name,
    description,
    instructions,
    license,
    compatibility,
    'user-invocable': input['user-invocable'],
    metadata,
    // Inline skills use a synthetic path: `inline/<name>`
    path: `inline/${name}`,
    source: { type: 'local', projectPath: `inline/${name}` },
    references: referenceKeys,
    scripts: [],
    assets: [],
  };
}

/**
 * Type guard: is this skill an inline skill (from defineSkill)?
 */
export function isInlineSkill(skill: unknown): skill is InlineSkill {
  return typeof skill === 'object' && skill !== null && '__inline' in skill && (skill as InlineSkill).__inline === true;
}

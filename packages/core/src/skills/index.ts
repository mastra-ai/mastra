/**
 * Agent-Level Skills Module
 *
 * Provides `createSkill()` and related utilities for attaching skills
 * directly to an Agent without requiring a full Workspace.
 *
 * @example
 * ```typescript
 * import { createSkill } from '@mastra/core/skills';
 * import { Agent } from '@mastra/core/agent';
 *
 * const reviewSkill = createSkill({
 *   name: 'code-review',
 *   description: 'Use when reviewing code changes.',
 *   instructions: 'When reviewing code...',
 * });
 *
 * const agent = new Agent({
 *   id: 'reviewer',
 *   model: 'openai/gpt-5',
 *   instructions: 'You are a code review assistant.',
 *   skills: [reviewSkill, './skills/testing'],
 * });
 * ```
 */

export { resolveAgentSkills, mergeWorkspaceSkills } from './agent-skills-resolver';
export { createSkill, isInlineSkill } from './create-skill';
export { InlineSkillSource } from './inline-skill-source';
export type {
  InlineSkillInput,
  InlineSkill,
  SkillInput,
  AgentSkillsInput,
  AgentSkillsContext,
  Skill,
  SkillMetadata,
  SkillFormat,
  WorkspaceSkills,
} from './types';

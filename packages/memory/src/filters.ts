/**
 * Prebuilt Observational Memory filters.
 *
 * These are ready-made `beforeObservation` hooks you can pass to
 * `observationalMemory.hooks`, so common filtering needs don't require writing
 * the hook yourself.
 *
 * @example
 * ```typescript
 * import { Memory } from '@mastra/memory';
 * import { skillResultFilter } from '@mastra/memory/filters';
 *
 * const memory = new Memory({
 *   options: {
 *     observationalMemory: {
 *       model: 'google/gemini-2.5-flash',
 *       hooks: { beforeObservation: skillResultFilter() },
 *     },
 *   },
 * });
 * ```
 */
export { skillResultFilter, SKILL_TOOL_NAMES } from './processors/observational-memory/filters';
export type { ObserverMessageFilter, SkillResultFilterOptions } from './processors/observational-memory/filters';

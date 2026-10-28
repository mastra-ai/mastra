/**
 * Prebuilt Observational Memory transform hooks.
 *
 * These are ready-made `beforeObservation` hooks you can pass to
 * `observationalMemory.hooks`, so common redaction needs don't require writing
 * the hook yourself.
 *
 * @example
 * ```typescript
 * import { Memory } from '@mastra/memory';
 * import { skillResultRedactor } from '@mastra/memory/hooks';
 *
 * const memory = new Memory({
 *   options: {
 *     observationalMemory: {
 *       model: 'google/gemini-2.5-flash',
 *       hooks: { beforeObservation: skillResultRedactor() },
 *     },
 *   },
 * });
 * ```
 */
export { skillResultRedactor, SKILL_TOOL_NAMES } from './processors/observational-memory/hooks';
export type { ObserverMessageTransform, SkillResultRedactorOptions } from './processors/observational-memory/hooks';

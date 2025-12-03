import type { Mastra } from '@mastra/core/mastra';

/**
 * Module-level singleton for the Mastra instance.
 * This must be set at module load time for Vercel workflows to work.
 */
let _mastra: Mastra | null = null;

/**
 * Register the Mastra instance for use in Vercel workflows.
 *
 * IMPORTANT: This MUST be called at module load time (top-level of a module),
 * not inside a function or async context. This ensures the Mastra instance
 * is available when Vercel's isolated step executions run.
 *
 * @example
 * ```typescript
 * // lib/mastra.ts
 * import { Mastra } from '@mastra/core';
 * import { registerMastra, VercelWorkflow } from '@mastra/vercel';
 *
 * export const mastra = new Mastra({
 *   workflows: { myWorkflow },
 * });
 *
 * // Register at module load time
 * registerMastra(mastra);
 * ```
 */
export function registerMastra(mastra: Mastra): void {
  _mastra = mastra;
}

/**
 * Get the registered Mastra instance.
 * Throws if registerMastra() was not called.
 *
 * This is used internally by the Vercel runtime to access workflows and steps.
 */
export function getMastra(): Mastra {
  if (!_mastra) {
    throw new Error(
      'Mastra instance not registered. ' +
        'Call registerMastra(mastra) at module load time before using Vercel workflows. ' +
        'See: https://mastra.ai/docs/vercel-workflows',
    );
  }
  return _mastra;
}

/**
 * Check if a Mastra instance has been registered.
 */
export function hasMastra(): boolean {
  return _mastra !== null;
}

/**
 * Clear the registered Mastra instance.
 * Primarily useful for testing.
 */
export function clearMastra(): void {
  _mastra = null;
}

/**
 * Vitest setup file that auto-registers the Mastra eval matchers.
 *
 * Usage in `vitest.config.ts`:
 *   test: { setupFiles: ['@mastra/evals/vitest/setup'] }
 */
import { registerEvalMatchers } from './matchers';

registerEvalMatchers();

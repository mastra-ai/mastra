/**
 * Vitest LLM Recorder Plugin
 *
 * A Vite plugin that automatically injects LLM recording/replay setup into test files.
 * This eliminates the need to manually call `useLLMRecording()` in every test file.
 *
 * The plugin transforms test files at build time, injecting the recording setup
 * code before any test definitions. Recording names are auto-derived from file paths.
 *
 * @example
 * ```typescript
 * // vitest.config.ts
 * import { llmRecorderPlugin } from '@internal/llm-recorder/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [llmRecorderPlugin()],
 *   test: { ... }
 * });
 * ```
 */

import type { Plugin } from 'vite';
import path from 'path';

export interface LLMRecorderPluginOptions {
  /** Glob patterns for test files to enable recording on (default: ['**\/*.test.ts']) */
  include?: string[];
  /** Glob patterns to exclude from auto-recording */
  exclude?: string[];
  /** Custom function to derive recording name from file path */
  nameGenerator?: (filepath: string) => string;
  /** Override the recordings directory */
  recordingsDir?: string;
}

/**
 * Default recording name generator.
 *
 * Derives a recording name from a test file path by:
 * 1. Making the path relative to the nearest package root (looks for package.json)
 * 2. Removing the file extension and `.test` suffix
 * 3. Replacing path separators with hyphens
 *
 * Examples:
 * - `packages/memory/src/index.test.ts` → `memory-src-index`
 * - `packages/core/src/agent/agent.test.ts` → `core-src-agent-agent`
 * - `stores/pg/src/storage.test.ts` → `pg-src-storage`
 */
export function defaultNameGenerator(filepath: string): string {
  // Normalize to forward slashes
  const normalized = filepath.replace(/\\/g, '/');

  // Try to find a meaningful root by looking for common monorepo directory patterns
  const patterns = [
    /(?:packages|stores|deployers|voice|server-adapters|client-sdks|auth|observability|communications|pubsub|workflows|e2e-tests)\/([^/]+)\/(.*)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const [, packageName, rest] = match;
      const name = `${packageName}-${rest}`
        .replace(/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/, '')
        .replace(/\.(ts|tsx|js|jsx|mts|cts)$/, '')
        .replace(/\//g, '-');
      return name;
    }
  }

  // Fallback: use the filename without extension
  const basename = path.basename(normalized);
  return basename
    .replace(/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/, '')
    .replace(/\.(ts|tsx|js|jsx|mts|cts)$/, '');
}

/**
 * Check if a file matches any of the given glob-like patterns.
 * Supports simple patterns: `*` (any chars), `**` (any path segments).
 */
function matchesPattern(filepath: string, patterns: string[]): boolean {
  const normalized = filepath.replace(/\\/g, '/');
  return patterns.some(pattern => {
    const regex = pattern
      .replace(/\./g, '\\.')
      // Replace **/ with a globstar that matches zero or more path segments (including the /)
      .replace(/\*\*\//g, '(?:.*/)?')
      // Replace remaining ** (at end of pattern) with match-all
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(regex).test(normalized);
  });
}

/**
 * Vite plugin that automatically injects LLM recording/replay into test files.
 *
 * @example
 * ```typescript
 * // vitest.config.ts
 * import { llmRecorderPlugin } from '@internal/llm-recorder/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [llmRecorderPlugin()],
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom options
 * export default defineConfig({
 *   plugins: [llmRecorderPlugin({
 *     include: ['src/**\/*.test.ts'],
 *     exclude: ['src/**\/*.unit.test.ts'],
 *     nameGenerator: (filepath) => `custom-${path.basename(filepath, '.test.ts')}`,
 *   })],
 * });
 * ```
 */
export function llmRecorderPlugin(options: LLMRecorderPluginOptions = {}): Plugin {
  const {
    include = ['**/*.test.ts', '**/*.test.tsx', '**/*.test.js', '**/*.test.jsx'],
    exclude = ['**/node_modules/**', '**/dist/**'],
    nameGenerator = defaultNameGenerator,
    recordingsDir,
  } = options;

  return {
    name: 'vitest-llm-recorder',
    enforce: 'pre',

    transform(code, id) {
      // Only transform files that match include patterns
      if (!matchesPattern(id, include)) {
        return null;
      }

      // Skip files that match exclude patterns
      if (matchesPattern(id, exclude)) {
        return null;
      }

      // Skip files that already use useLLMRecording or enableAutoRecording
      if (code.includes('useLLMRecording') || code.includes('enableAutoRecording')) {
        return null;
      }

      const recordingName = nameGenerator(id);
      const optionsArg = recordingsDir ? `, { recordingsDir: ${JSON.stringify(recordingsDir)} }` : '';

      // Inject the import and the auto-recording call at the top of the file
      const injection = [
        `import { useLLMRecording as __autoUseLLMRecording } from '@internal/llm-recorder';`,
        `__autoUseLLMRecording(${JSON.stringify(recordingName)}${optionsArg});`,
        '',
      ].join('\n');

      return {
        code: injection + code,
        map: null,
      };
    },
  };
}

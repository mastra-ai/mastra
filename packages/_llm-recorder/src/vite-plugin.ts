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

import path from 'node:path';
import type { Plugin } from 'vite';

export interface LLMRecorderPluginOptions {
  /** Glob patterns for test files to enable recording on (default: ['**\/*.test.ts']) */
  include?: string[];
  /** Glob patterns to exclude from auto-recording */
  exclude?: string[];
  /** Custom function to derive recording name from file path */
  nameGenerator?: (filepath: string) => string;
  /** Override the recordings directory */
  recordingsDir?: string;
  /**
   * Import path and export name of a `transformRequest` function to inject.
   *
   * Since the plugin generates code at build time, it can't accept a function
   * directly. Instead, provide the module that exports the transform and the
   * plugin will inject an import + wire it into the `useLLMRecording` options.
   *
   * @example
   * ```typescript
   * // my-transform.ts
   * export function normalizeRequest({ url, body }) {
   *   return { url, body: { ...body, timestamp: 'STABLE' } };
   * }
   *
   * // vitest.config.ts
   * llmRecorderPlugin({
   *   transformRequest: {
   *     importPath: './my-transform',
   *     exportName: 'normalizeRequest',
   *   },
   * })
   * ```
   */
  transformRequest?: {
    /** Module path to import from (e.g. './my-transform', '@internal/test-utils') */
    importPath: string;
    /** Named export to use (default: 'transformRequest') */
    exportName?: string;
  };
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
  return basename.replace(/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/, '').replace(/\.(ts|tsx|js|jsx|mts|cts)$/, '');
}

/**
 * Check if a file matches any of the given glob-like patterns.
 * Supports simple patterns: `*` (any chars), `**` (any path segments).
 */
function matchesPattern(filepath: string, patterns: string[]): boolean {
  const normalized = filepath.replace(/\\/g, '/');
  return patterns.some(pattern => {
    // Reject excessively long patterns to mitigate ReDoS
    if (pattern.length > 500) return false;

    try {
      const regex = pattern
        // Escape regex-special chars except * and /
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        // Replace **/ with a globstar that matches zero or more path segments (including the /)
        .replace(/\*\*\//g, '(?:.*/)?')
        // Replace remaining ** (at end of pattern) with match-all
        .replace(/\*\*/g, '.*')
        // Replace single * with segment matcher (no path separators)
        .replace(/\*/g, '[^/]*');
      return new RegExp(`^${regex}$`).test(normalized);
    } catch {
      // Invalid pattern — skip it
      return false;
    }
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
    transformRequest,
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

      // Build the options object for useLLMRecording
      const optionFields: string[] = [];
      if (recordingsDir) {
        optionFields.push(`recordingsDir: ${JSON.stringify(recordingsDir)}`);
      }
      if (transformRequest) {
        optionFields.push(`transformRequest: __autoTransformRequest`);
      }
      const optionsArg = optionFields.length > 0 ? `, { ${optionFields.join(', ')} }` : '';

      // Build the import lines
      const imports = [`import { useLLMRecording as __autoUseLLMRecording } from '@internal/llm-recorder';`];
      if (transformRequest) {
        const exportName = transformRequest.exportName || 'transformRequest';
        imports.push(
          `import { ${exportName} as __autoTransformRequest } from ${JSON.stringify(transformRequest.importPath)};`,
        );
      }

      // Inject the imports and the auto-recording call at the top of the file
      const injection = [...imports, `__autoUseLLMRecording(${JSON.stringify(recordingName)}${optionsArg});`, ''].join(
        '\n',
      );

      return {
        code: injection + code,
        map: null,
      };
    },
  };
}

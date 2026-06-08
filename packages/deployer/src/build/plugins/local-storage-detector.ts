import type { Plugin } from 'rollup';

/**
 * Connection-string-shaped patterns that resolve to the build host and will
 * never work inside the deploy container.
 */
const LOCAL_HOST_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\bfile:\.{1,2}\/[^\s'"`]+\.(?:db|sqlite)\b/gi,
    hint: 'LibSQL/SQLite file path relative to the build host',
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb|redis|libsql):\/\/[^/\s'"`]*localhost\b/gi,
    hint: 'localhost in a connection string',
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb|redis|libsql):\/\/[^/\s'"`]*127\.0\.0\.1\b/g,
    hint: '127.0.0.1 in a connection string',
  },
];

export interface LocalStorageDetection {
  value: string;
  hint: string;
  module: string;
}

/**
 * Rollup plugin that detects host-local storage URLs (e.g. `file:./mastra.db`,
 * `postgres://localhost`) in **user source modules** during bundling.
 *
 * Only modules outside `node_modules` are inspected, so library code (like
 * Agent Builder prompt templates) is naturally excluded.  Tree-shaken modules
 * are excluded via `generateBundle` — only modules that actually contribute
 * rendered code to the output are reported.
 *
 * Detected paths are emitted as `preflight-local-paths.json` in the output
 * directory for the CLI preflight check to consume.
 */
export function localStorageDetector(): Plugin {
  const userModuleMatches = new Map<string, Array<{ value: string; hint: string }>>();

  return {
    name: 'mastra-local-storage-detector',

    transform(_code, id) {
      if (id.includes('node_modules')) return null;
      // Skip intermediate bundle artifacts produced by the dependency
      // optimization step. These files are pre-bundled copies of library
      // modules (e.g. @mastra/core) and may contain JSDoc example strings
      // like `file:./data.db` that look like real connection URLs but are
      // just documentation.
      if (id.includes('/.mastra/.build/') || id.includes('\\.mastra\\.build\\')) return null;

      const matches: Array<{ value: string; hint: string }> = [];
      for (const { pattern, hint } of LOCAL_HOST_PATTERNS) {
        const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        for (const m of _code.matchAll(re)) {
          matches.push({ value: m[0], hint });
        }
      }

      if (matches.length > 0) {
        userModuleMatches.set(id, matches);
      }

      return null;
    },

    generateBundle(_, bundle) {
      const detections: LocalStorageDetection[] = [];
      const seen = new Set<string>();

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;

        for (const [moduleId, moduleInfo] of Object.entries(chunk.modules)) {
          if (moduleInfo.renderedLength === 0) continue;

          const matches = userModuleMatches.get(moduleId);
          if (!matches) continue;

          for (const { value, hint } of matches) {
            const key = `${hint}::${value}`;
            if (seen.has(key)) continue;
            seen.add(key);

            detections.push({ value, hint, module: moduleId });
          }
        }
      }

      this.emitFile({
        type: 'asset',
        fileName: 'preflight-local-paths.json',
        source: JSON.stringify(detections),
      });
    },
  };
}

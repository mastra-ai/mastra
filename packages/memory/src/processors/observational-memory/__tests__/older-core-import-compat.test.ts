import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Import-compat regression for the #26825 review finding: `@mastra/memory`
 * declares `@mastra/core >=1.4.1-0 <2.0.0-0`, which admits published cores
 * whose storage entry predates newer exports (1.76.0 lacks
 * `maxObservationCursor`). A named VALUE import of a missing export throws
 * `SyntaxError` at module load — before any older-core runtime fallback can
 * run — and the observation strategies load on every OM startup.
 *
 * Type-only imports are erased at compile time and are always safe. This
 * guard pins the strategy modules to type-only imports from
 * `@mastra/core/storage` so a new value import (like the one this PR review
 * caught) fails here instead of at startup on an older core.
 */
const strategiesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'observation-strategies');

describe('observation strategies stay loadable on older supported cores', () => {
  for (const file of readdirSync(strategiesDir).filter(f => f.endsWith('.ts'))) {
    it(`${file} has no value imports from @mastra/core/storage`, () => {
      const source = readFileSync(join(strategiesDir, file), 'utf8');
      // Match any import statement from '@mastra/core/storage' that is not `import type`.
      const imports = source.match(/import\s+(?:type\s+)?[^;]*?from\s+'@mastra\/core\/storage'/gs) ?? [];
      const valueImports = imports.filter(statement => !/^import\s+type\s/.test(statement));
      expect(valueImports).toEqual([]);
    });
  }
});

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Find the user's Mastra entry file (`index.ts` or `index.js`) under the given
 * mastra directory. Returns `undefined` when neither exists — in which case the
 * bundler auto-constructs a Mastra instance from file-based primitives instead.
 */
export function findMastraEntryFile(mastraDir: string): string | undefined {
  const candidateEntries = [join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')];
  return candidateEntries.find(f => existsSync(f));
}

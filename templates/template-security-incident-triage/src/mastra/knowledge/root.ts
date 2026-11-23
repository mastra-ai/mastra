import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Locate the application owning this module, not the server's mutable cwd.
 * Works for src/, dist/ and Studio's .mastra/output bundle. Studio generates
 * its own package.json (without @mastra/core), which is not the app root.
 * Missing runbooks still fail in the normal loader; never fall back to cwd.
 */
export function resolveRunbookRoot(moduleUrl: string = import.meta.url): string {
  let directory = dirname(fileURLToPath(moduleUrl));
  while (true) {
    const manifestPath = join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (typeof manifest.dependencies?.['@mastra/core'] === 'string') {
        return join(directory, 'runbooks');
      }
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error('RUNBOOK_APPLICATION_ROOT_NOT_FOUND');
    directory = parent;
  }
}

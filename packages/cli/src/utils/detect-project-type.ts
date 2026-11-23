import { join } from 'node:path';
import { analyzeEntryProjectType } from '@mastra/deployer/build';

import { findMastraEntryFile } from './find-mastra-entry.js';

/**
 * Detect the project type (e.g. `factory`) from the Mastra entry file under
 * `src/mastra`. Deploy commands run this before project resolution so a new
 * platform project can be created with the right flags. Detection failures
 * fall back to `undefined`; the build step reports entry-file problems with a
 * better error than this would.
 */
export async function detectProjectType(targetDir: string): Promise<string | undefined> {
  const mastraEntryFile = findMastraEntryFile(join(targetDir, 'src', 'mastra'));
  if (!mastraEntryFile) return undefined;
  try {
    return await analyzeEntryProjectType(mastraEntryFile);
  } catch {
    return undefined;
  }
}

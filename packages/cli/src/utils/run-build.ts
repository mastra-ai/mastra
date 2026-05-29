import * as p from '@clack/prompts';
import { build } from '../commands/build/build.js';
import { withBarPrefix } from './clack-bar.js';

export async function runBuild(projectDir: string, opts?: { debug?: boolean }): Promise<void> {
  p.log.step('Running mastra build...');
  await withBarPrefix(() =>
    build({
      root: projectDir,
      debug: opts?.debug ?? false,
    }),
  );
}

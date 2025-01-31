import { join } from 'node:path';

import { BuildBundler } from './BuildBundler';

export async function build({ dir }: { dir?: string }) {
  const mastraDir = dir ?? process.cwd();
  const outputDirectory = join(mastraDir, '.mastra');
  const deployer = new BuildBundler({
    mastraDir,
    outputDirectory,
  });

  await deployer.prepare();

  await deployer.bundle();
}

import { join } from 'node:path';

import { FileService } from '../../services/service.file';

import { BuildBundler } from './BuildBundler';

export async function build({ dir, port }: { dir?: string; port?: number }) {
  const mastraDir = dir ?? process.cwd();
  const outputDirectory = join(mastraDir, '.mastra');
  const deployer = new BuildBundler();
  const fs = new FileService();
  const mastraEntryFile = fs.getFirstExistingFile([
    join(mastraDir, 'src', 'mastra', 'index.ts'),
    join(mastraDir, 'src', 'mastra', 'index.js'),
  ]);

  console.log(join(mastraDir, 'index.ts'), join(mastraDir, 'index.js'));
  await deployer.prepare(outputDirectory);

  await deployer.bundle(mastraEntryFile, outputDirectory, { port });
}

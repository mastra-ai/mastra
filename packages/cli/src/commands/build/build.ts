import { join } from 'node:path';

import { FileService } from '../../services/service.file';

import { BuildBundler } from './BuildBundler';

export async function build({ dir }: { dir?: string }) {
  const mastraDir = dir ?? join(process.cwd(), 'src', 'mastra');
  const outputDirectory = join(process.cwd(), '.mastra');
  const deployer = new BuildBundler();
  const fs = new FileService();
  const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

  await deployer.prepare(outputDirectory);

  await deployer.bundle(mastraEntryFile, outputDirectory);
}

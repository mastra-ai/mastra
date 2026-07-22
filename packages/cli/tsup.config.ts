import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTypes } from '@internal/types-builder';
import { execa } from 'execa';
import { copy } from 'fs-extra';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/analytics/index.ts', 'src/commands/create/create.ts', 'src/internal/auth.ts'],
  treeshake: true,
  format: ['esm'],
  publicDir: './src/public',
  dts: false,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    const studioPath = dirname(fileURLToPath(import.meta.resolve('@internal/playground/package.json')));
    const factoryWebPath = join(dirname(fileURLToPath(import.meta.url)), '../../mastracode/web');
    const factoryUIPath = join(factoryWebPath, 'src/mastra/public/factory');

    // mastracode/web is an independent pnpm workspace and is not installed by the root workspace.
    await execa('pnpm', ['install', '--frozen-lockfile'], {
      cwd: factoryWebPath,
      stdio: 'inherit',
    });
    await execa('pnpm', ['run', 'build:ui:embedded'], {
      cwd: factoryWebPath,
      stdio: 'inherit',
    });
    await copy(join(studioPath, 'dist'), join('dist', 'studio'));
    await copy(factoryUIPath, join('dist', 'factory'));
    await generateTypes(process.cwd());
  },
});

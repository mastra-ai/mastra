import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTypes } from '@internal/types-builder';
import { execa } from 'execa';
import { copy } from 'fs-extra';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/analytics/index.ts',
    'src/commands/create/create.ts',
    'src/commands/factory/command.ts',
    'src/commands/experiment/runtime.ts',
    'src/internal/auth.ts',
  ],
  treeshake: true,
  format: ['esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  dts: false,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    const studioPath = dirname(fileURLToPath(import.meta.resolve('@internal/playground/package.json')));
    const factoryUIPath = join(dirname(fileURLToPath(import.meta.url)), '../../mastracode/factory-ui');

    // Factory UI is a root workspace package. Build its independent SPA and
    // copy the resulting artifact into the CLI distribution.
    await execa('pnpm', ['run', 'build'], {
      cwd: factoryUIPath,
      stdio: 'inherit',
    });
    await copy(join('src', 'public', 'starter-files'), join('dist', 'starter-files'));
    await copy(join('src', 'public', 'templates'), join('dist', 'templates'));
    await copy(join('src', 'commands', 'factory', 'generated', 'scaffold'), join('dist', 'generated', 'scaffold'));
    await copy(join(studioPath, 'dist'), join('dist', 'studio'));
    await copy(join(factoryUIPath, 'dist'), join('dist', 'factory'));
    await generateTypes(process.cwd());
  },
});

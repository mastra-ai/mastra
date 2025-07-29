import { spawn } from 'child_process';
import { promisify } from 'util';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';

type Plugin = NonNullable<Options['plugins']>[number];

const exec = promisify(spawn);

export default defineConfig({
  entry: ['src/index.ts', 'src/secrets-manager/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await exec('pnpm', ['tsc', '-p', 'tsconfig.build.json'], {
      stdio: 'inherit',
    });
  },
});

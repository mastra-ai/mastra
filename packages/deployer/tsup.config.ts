import { spawn } from 'child_process';
import { promisify } from 'util';
import { defineConfig } from 'tsup';

const exec = promisify(spawn);

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/build/index.ts',
    'src/server/index.ts',
    'src/services/index.ts',
    'src/bundler/index.ts',
    'src/build/analyze.ts',
    'src/validator/loader.ts',
    'src/build/bundler.ts',
    'src/validator/custom-resolver.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  publicDir: true,
  onSuccess: async () => {
    await exec('pnpm', ['tsc', '-p', 'tsconfig.build.json'], {
      stdio: 'inherit',
    });
  },
});

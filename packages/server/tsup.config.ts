import { spawn } from 'child_process';
import { promisify } from 'util';
import { defineConfig } from 'tsup';

const exec = promisify(spawn);

export default defineConfig({
  entry: ['src/index.ts', 'src/server/handlers.ts', 'src/server/handlers/*.ts', '!src/server/handlers/*.test.ts'],
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

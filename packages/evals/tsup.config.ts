import { spawn } from 'child_process';
import { promisify } from 'util';
import { defineConfig } from 'tsup';

const exec = promisify(spawn);

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/metrics/judge/index.ts',
    'src/metrics/llm/index.ts',
    'src/metrics/nlp/index.ts',
    'src/scorers/llm/index.ts',
    'src/scorers/code/index.ts',
  ],
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

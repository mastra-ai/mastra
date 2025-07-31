import { spawn } from 'child_process';
import { promisify } from 'util';
import { defineConfig } from 'tsup';

const exec = promisify(spawn);

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/analytics/index.ts',
    'src/commands/create/create.ts',
    'src/commands/dev/telemetry-loader.ts',
    'src/commands/dev/telemetry-resolver.ts',
  ],
  treeshake: true,
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    await exec('pnpm', ['tsc', '-p', 'tsconfig.build.json'], {
      stdio: 'inherit',
    });
  },
});

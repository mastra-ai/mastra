import { join } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    join('src', 'index.ts'),
    join('src', 'composio.ts'),
    join('src', 'arcade.ts'),
    join('src', 'storage', 'index.ts'),
    join('src', 'ee', 'index.ts'),
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});

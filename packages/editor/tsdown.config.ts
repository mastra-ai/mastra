import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'tsdown';

export default defineConfig({
  // Entry globs must use POSIX separators ('/'). Using path.join() here produced
  // backslash paths on Windows (e.g. 'src\\index.ts'), which glob treats as
  // escape sequences rather than separators, so no entry matched and the build failed.
  entry: ['src/index.ts', 'src/composio.ts', 'src/arcade.ts', 'src/storage/index.ts', 'src/ee/index.ts'],
  format: ['cjs', 'esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  dts: true,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    await cp(join('src', 'ee', 'workspace'), join('dist', 'ee', 'workspace'), { recursive: true });
  },
});

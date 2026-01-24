import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'license/index': 'src/license/index.ts',
    'rbac/index': 'src/rbac/index.ts',
    'storage/index': 'src/storage/index.ts',
    'billing/index': 'src/billing/index.ts',
    'email/index': 'src/email/index.ts',
    'encryption/index': 'src/encryption/index.ts',
    'file-storage/index': 'src/file-storage/index.ts',
    'observability/index': 'src/observability/index.ts',
    'runner/index': 'src/runner/index.ts',
    'router/index': 'src/router/index.ts',
    'source/index': 'src/source/index.ts',
  },
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});

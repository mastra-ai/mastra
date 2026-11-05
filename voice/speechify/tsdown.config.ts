import fs from 'node:fs';
import path from 'node:path';

import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  define: {
    // Sent as Speechify-Caller-Version so Speechify can see this package's traffic.
    __SPEECHIFY_VOICE_VERSION__: JSON.stringify(pkg.version),
  },
  deps: {
    alwaysBundle: ['@internal/voice'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/voice']));
  },
});

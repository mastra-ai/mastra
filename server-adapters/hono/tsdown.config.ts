import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  // Embed the workspace-patched fetch-to-node so published @mastra/hono
  // (and user .mastra/output bundles) do not depend on unpatched npm 2.1.0.
  // See #20332 / patches/fetch-to-node@2.1.0.patch.
  noExternal: ['fetch-to-node'],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});

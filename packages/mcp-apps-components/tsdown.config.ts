import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

// Builds the server-side helpers. The iframe apps are built afterwards by `scripts/build-apps.ts`
// into the same `dist/`, so this step owns cleaning it.
export default defineConfig({
  entry: ['src/dashboard-renderer.ts', 'src/mastra-api.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  // The helpers locate the built HTML from `import.meta.url`, which CJS needs shimmed.
  shims: true,
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  // Only the iframe apps import these, and `scripts/build-apps.ts` bundles them into the HTML.
  deps: {
    alwaysBundle: ['@mastra/playground-ui', '@mastra/react'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});

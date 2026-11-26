import { generateTypes } from '@internal/types-builder';
import { assertLatin1Dist } from '@internal/types-builder/check-ascii-output';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/hooks.ts', 'src/processors/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  // Escape non-ASCII in strings, templates, regex literals and identifiers, including bundled
  // third-party code. V8 stores a script at one byte per character only when every character is
  // Latin-1, so one wider character doubles the memory a Cloudflare Worker spends holding its own
  // source. `assertLatin1Dist` enforces it in `onSuccess`.
  outputOptions: {
    charset: 'ascii',
  },
  deps: {
    alwaysBundle: ['@internal/ai-sdk-v4', '@internal/ai-sdk-v5', '@internal/ai-v6', '@internal/ai-v7', 'tokenx'],
  },
  onSuccess: async () => {
    assertLatin1Dist(`${process.cwd()}/dist`);
    await generateTypes(process.cwd(), new Set(['@internal/ai-sdk-v4', '@internal/ai-sdk-v5', 'tokenx']));
  },
});

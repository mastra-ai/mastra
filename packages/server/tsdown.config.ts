import { generateTypes } from '@internal/types-builder';
import { assertLatin1Dist } from '@internal/types-builder/check-ascii-output';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/server/handlers.ts',
    'src/server/handlers/*.ts',
    'src/server/a2a/store.ts',
    'src/server/server-adapter/index.ts',
    'src/server/auth/index.ts',
    'src/server/schemas/index.ts',
    'src/server/browser-stream/index.ts',
    '!src/server/handlers/*.test.ts',
    '!src/server/auth/*.test.ts',
    '!src/server/schemas/*.test.ts',
  ],
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
  // The `@mastra/agent-builder` package has `typescript` as a peer dependency and we don't want to bundle it
  deps: {
    neverBundle: ['typescript'],
    alwaysBundle: ['@internal/core', '@internal/voice', '@mastra/schema-compat'],
  },
  onSuccess: async () => {
    assertLatin1Dist(`${process.cwd()}/dist`);
    await generateTypes(process.cwd(), new Set(['@internal/core', '@mastra/schema-compat', '@internal/voice']));
  },
});

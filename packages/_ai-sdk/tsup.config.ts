import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    // Main entry
    'src/index.ts',
    // V4 entries
    'src/v4/index.ts',
    'src/v4/model.ts',
    'src/v4/message.ts',
    'src/v4/tool.ts',
    'src/v4/embed.ts',
    'src/v4/schema.ts',
    'src/v4/test.ts',
    'src/v4/util.ts',
    // V5 entries
    'src/v5/index.ts',
    'src/v5/model.ts',
    'src/v5/provider.ts',
    'src/v5/provider-utils.ts',
    'src/v5/message.ts',
    'src/v5/tool.ts',
    'src/v5/embed.ts',
    'src/v5/voice.ts',
    'src/v5/stream.ts',
    'src/v5/schema.ts',
    'src/v5/test.ts',
    'src/v5/errors.ts',
  ],
  format: ['esm'],
  clean: true,
  dts: true,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  metafile: true,
  sourcemap: true,
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/schema.ts',
    'src/model.ts',
    'src/test.ts',
    'src/tool.ts',
    'src/embed.ts',
    'src/message.ts',
    'src/util.ts',
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

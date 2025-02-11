import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external: ['react', 'react-dom'],
  clean: true,
  treeshake: true,
  target: 'esnext',
  jsxFactory: 'React.createElement',
});

import { defineConfig } from 'tsdown';
import { libEntries } from './lib-entries.ts';

// Vite builds the JS; tsdown only emits the type declarations for the same entries.
export default defineConfig({
  entry: libEntries(),
  tsconfig: 'tsconfig.build.json',
  outDir: 'dist',
  clean: false,
  fixedExtension: false,
  dts: { emitDtsOnly: true },
  // Keep package imports as imports, so consumers resolve them from their own dependencies.
  deps: { neverBundle: /^(?![./]|@\/)/ },
});

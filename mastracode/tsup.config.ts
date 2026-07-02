import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/**
 * Native macOS STT assets that are read at runtime (not bundled into JS): the
 * Swift recognizer source and its embedded Info.plist. They are compiled with
 * `swiftc` on first use, so they must ship alongside the bundle. `compile.ts`
 * resolves them from `dist/native/` (with a `src/` fallback for dev).
 */
const NATIVE_VOICE_ASSETS = ['macos-stt.swift', 'macos-stt.plist'];

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/main.ts',
    tui: 'src/tui/index.ts',
    acp: 'src/acp.ts',
    headless: 'src/headless/index.ts',
    plugin: 'src/plugin.ts',
  },
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  define: {
    MASTRACODE_VERSION: JSON.stringify(pkg.version),
  },
  sourcemap: true,
  onSuccess: async () => {
    // Copy runtime-read native voice assets into dist/native so the compiled
    // recognizer can be built on the user's machine from the shipped sources.
    const destDir = join(process.cwd(), 'dist', 'native');
    mkdirSync(destDir, { recursive: true });
    for (const asset of NATIVE_VOICE_ASSETS) {
      copyFileSync(join(process.cwd(), 'src', 'tui', 'voice', 'native', asset), join(destDir, asset));
    }
    await generateTypes(process.cwd());
  },
});

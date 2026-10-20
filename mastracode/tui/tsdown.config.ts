import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

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
    headless: 'src/headless.ts',
    plugin: 'src/plugin.ts',
  },
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
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
    // @mastra/code-sdk is a regular dependency, so tsdown externalizes its
    // runtime JS and the generated d.ts references its published types.
    await generateTypes(process.cwd());
  },
});

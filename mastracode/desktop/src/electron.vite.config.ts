import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const packageSearchPaths = [
  resolve('node_modules/.pnpm/node_modules'),
  resolve('../../node_modules/.pnpm/node_modules'),
];
const libsqlNativePackage =
  process.arch === 'arm64' ? '@libsql/darwin-arm64' : process.arch === 'x64' ? '@libsql/darwin-x64' : undefined;
if (!libsqlNativePackage) {
  throw new Error(`Unsupported macOS architecture for the MastraCode Desktop alpha: ${process.arch}`);
}
const libsqlNativePackageJson = require.resolve(`${libsqlNativePackage}/package.json`, {
  paths: packageSearchPaths,
});
const libsqlNativeDir = dirname(libsqlNativePackageJson);
const libsqlNativeBinding = resolve(libsqlNativeDir, 'index.node');
const libsqlNativeBindingRequire = JSON.stringify(libsqlNativeBinding);
const duckdbNativeBinding = require.resolve(`@duckdb/node-bindings-darwin-${process.arch}/duckdb.node`, {
  paths: packageSearchPaths,
});
const duckdbNativeLibrary = resolve(dirname(duckdbNativeBinding), 'libduckdb.dylib');
const tokenizersNativeBinding = require.resolve('@anush008/tokenizers-darwin-universal', {
  paths: packageSearchPaths,
});
const onnxRuntimePackageJson = require.resolve('onnxruntime-node/package.json', { paths: packageSearchPaths });
const onnxRuntimeNativeDir = resolve(dirname(onnxRuntimePackageJson), 'bin', 'napi-v6', 'darwin', process.arch);
const onnxRuntimeNativeBinding = resolve(onnxRuntimeNativeDir, 'onnxruntime_binding.node');
const onnxRuntimeNativeLibrary = resolve(onnxRuntimeNativeDir, 'libonnxruntime.1.dylib');

function readTargetArchitecture(source: string): Buffer {
  const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'mastracode-native-'));
  const output = resolve(temporaryDirectory, 'binary');
  try {
    execFileSync('/usr/bin/lipo', [source, '-thin', process.arch, '-output', output]);
    return readFileSync(output);
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function targetNativeBindings(): Plugin {
  const duckdbId = '\0mastracode-duckdb-native';
  const tokenizersId = '\0mastracode-tokenizers-native';
  const duckdbFileName = 'chunks/duckdb.darwin.node';
  const tokenizersFileName = 'chunks/tokenizers.darwin-universal.node';

  return {
    name: 'target-native-bindings',
    enforce: 'pre',
    resolveId(source) {
      if (source === '@duckdb/node-bindings') return duckdbId;
      if (source === '@anush008/tokenizers') return tokenizersId;
      return null;
    },
    buildStart() {
      this.emitFile({ type: 'asset', fileName: duckdbFileName, source: readFileSync(duckdbNativeBinding) });
      this.emitFile({
        type: 'asset',
        fileName: 'chunks/libduckdb.dylib',
        source: readTargetArchitecture(duckdbNativeLibrary),
      });
      this.emitFile({
        type: 'asset',
        fileName: tokenizersFileName,
        source: readTargetArchitecture(tokenizersNativeBinding),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'chunks/libonnxruntime.1.dylib',
        source: readFileSync(onnxRuntimeNativeLibrary),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'chunks/onnxruntime_binding.node',
        source: readFileSync(onnxRuntimeNativeBinding),
      });
    },
    load(id) {
      if (id === duckdbId) {
        return `
          import { createRequire } from 'node:module';
          const binding = createRequire(import.meta.url)('./chunks/duckdb.darwin.node');
          export default binding;
        `;
      }
      if (id === tokenizersId) {
        return `
          import { createRequire } from 'node:module';
          const binding = createRequire(import.meta.url)('./chunks/tokenizers.darwin-universal.node');
          export const AddedToken = binding.AddedToken;
          export const Tokenizer = binding.Tokenizer;
        `;
      }
      return null;
    },
    transform(code, id) {
      if (!id.endsWith('/onnxruntime-node/dist/binding.js')) return null;
      const dynamicBindingRequire =
        'require(`../bin/napi-v6/${process.platform}/${process.arch}/onnxruntime_binding.node`)';
      if (!code.includes(dynamicBindingRequire)) {
        throw new Error('onnxruntime-node binding loader changed; update the desktop native binding adapter');
      }
      return code.replace(dynamicBindingRequire, '__mastracodeLoadOnnxBinding()');
    },
    renderChunk(code) {
      if (!code.includes('__mastracodeLoadOnnxBinding()')) return null;
      return {
        code: `import { createRequire as __mastracodeCreateOnnxRequire } from "node:module";\nconst __mastracodeLoadOnnxBinding = () => __mastracodeCreateOnnxRequire(import.meta.url)("./chunks/onnxruntime_binding.node");\n${code}`,
        map: null,
      };
    },
  };
}

function rewriteLibsqlNativeRequire() {
  return {
    name: 'rewrite-libsql-native-require',
    transform(code: string, id: string) {
      if (!id.endsWith('/libsql/index.js') && !id.endsWith('/libsql/promise.js')) return null;
      return code
        .replaceAll(
          'return require(`@libsql/${target}`);',
          `const nativeBinding = require(${libsqlNativeBindingRequire});\n    return nativeBinding.default ?? nativeBinding;`,
        )
        .replaceAll('require(`@libsql/${target}`)', `require(${libsqlNativeBindingRequire})`);
    },
  };
}

function rewriteNativeChunkRequire() {
  return {
    name: 'rewrite-native-chunk-require',
    renderChunk(code: string) {
      const rewritten = code.replace(/require\("(\.\/[^"]+\.node)"\)/g, '__mastracodeNativeRequire("$1")');
      if (rewritten === code) return null;
      return {
        code: `import { createRequire as __mastracodeCreateRequire } from "node:module";\nconst __mastracodeNativeRequire = __mastracodeCreateRequire(import.meta.url);\n${rewritten}`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  main: {
    plugins: [targetNativeBindings(), rewriteLibsqlNativeRequire(), rewriteNativeChunkRequire()],
    build: {
      commonjsOptions: {
        dynamicRequireTargets: [libsqlNativeBinding],
      },
      externalizeDeps: false,
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          backend: resolve('src/backend.ts'),
          main: resolve('src/main.ts'),
        },
        external: ['electron', /^node:/, 'typescript'],
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      outDir: 'dist/preload',
      rollupOptions: {
        input: resolve('src/preload.ts'),
        external: ['electron', /^node:/],
        output: {
          format: 'cjs',
          entryFileNames: 'preload.cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    publicDir: resolve('../app/src/ui/public'),
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    },
    build: {
      outDir: resolve('dist/renderer'),
      emptyOutDir: true,
      minify: 'esbuild',
    },
  },
});

import { builtinModules } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

/**
 * Portal build target for the Platform-embedded Studio spike.
 *
 * Produces:
 *   dist/portal/studio-portal.js   — ES module exporting mountStudioPortal
 *   dist/portal/studio-portal.css  — Tailwind + playground-ui styles, wrapped
 *                                    in `@layer studio-portal` so host rules
 *                                    can always win overrides.
 *
 * Externals:
 *   react, react-dom (+ subpaths), react-router, @tanstack/react-query.
 *   Host must expose these via an import map or shim so the portal shares
 *   the host's React tree — no duplicate copies, no hook mismatches.
 *
 * This target is deliberately narrow. The standalone Studio build (`build`)
 * is untouched.
 */

const EXTERNALS = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react-router',
  '@tanstack/react-query',
];

// Same stub as the standalone build: @mastra/core's browser-safe chunks share
// files with server-only code that imports Node builtins. Stub them so
// Rollup can resolve the graph.
const nodeOnlyPackages = new Set(['execa']);

const stubNodeBuiltinsPlugin: Plugin = {
  name: 'stub-node-builtins',
  enforce: 'pre',
  apply: 'build',
  resolveId(source) {
    if (nodeOnlyPackages.has(source)) {
      return { id: `\0node-stub:${source}`, moduleSideEffects: false };
    }
    const mod = source.startsWith('node:') ? source.slice(5) : source;
    const baseMod = mod.split('/')[0];
    if (builtinModules.includes(baseMod)) {
      return { id: `\0node-stub:${source}`, moduleSideEffects: false };
    }
  },
  load(id) {
    if (id.startsWith('\0node-stub:')) {
      return { code: 'export default {}', syntheticNamedExports: true };
    }
  },
};

/**
 * Wrap the entire generated portal stylesheet in `@layer studio-portal { ... }`.
 * CSS cascade layers give host rules a clean way to override without
 * specificity wars: portal rules land in a named layer; anything the host
 * emits unlayered outranks the whole layer.
 *
 * This is a naive wrap — it assumes no already-layered `@import` inside the
 * bundle (Vite inlines them by build time, so the final file is a flat rule
 * list). If we ever need conditional layering per @scope, revisit.
 */
/**
 * Rewrites the portal bundle's external bare-specifier imports into reads
 * from `globalThis.__PORTAL_DEPS__`. This means the portal shares the host's
 * React (and friends) via a single well-known runtime handoff instead of
 * relying on an `<script type="importmap">`.
 *
 * Trade-off (see PLTFRM-1266 ADR): Option A. Portal bundle is not a pure ES
 * module — it only runs in hosts that populate `__PORTAL_DEPS__`. Option B
 * (native import maps + host-served ESM builds) is the follow-up.
 *
 * The rewrite runs on the emitted chunk (post-Rollup), so it only has to
 * cope with Vite/Rollup's own import syntax — clean, single-line imports at
 * the top of the file — not arbitrary user syntax.
 */
const rewriteExternalsToPortalDepsPlugin = (externalIds: string[]): Plugin => {
  // Escape module names for use in a RegExp.
  const idsAlt = externalIds.map((id) => id.replace(/[/\-]/g, (m) => `\\${m}`)).join('|');
  // Matches: import <bindings> from "moduleName";
  // Captures: [1] = raw bindings section, [2] = module id.
  const importRe = new RegExp(`^import\\s+(.+?)\\s+from\\s+["'](${idsAlt})["'];?\\s*$`, 'gm');

  return {
    name: 'rewrite-externals-to-portal-deps',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (chunk.type !== 'chunk') return null;
      let touched = false;
      const rewritten = code.replace(importRe, (_full, bindings: string, id: string) => {
        touched = true;
        return renderPortalDepImport(bindings.trim(), id);
      });
      if (!touched) return null;
      const prelude =
        `const __PORTAL_DEPS = globalThis.__PORTAL_DEPS__;\n` +
        `if (!__PORTAL_DEPS) throw new Error(` +
        `"Studio portal: host did not expose window.__PORTAL_DEPS__ ` +
        `(react, react-dom, react-dom/client, react/jsx-runtime, react-router, @tanstack/react-query)"` +
        `);\n`;
      return { code: prelude + rewritten, map: null };
    },
  };
};

/** Turn one import statement's bindings into a `const … = __PORTAL_DEPS[id]` line. */
function renderPortalDepImport(bindings: string, id: string): string {
  const target = `__PORTAL_DEPS[${JSON.stringify(id)}]`;
  // import * as X from "M";
  const nsMatch = /^\*\s+as\s+(\w+)$/.exec(bindings);
  if (nsMatch) {
    return `const ${nsMatch[1]} = ${target};`;
  }
  // Split at the first "{" to separate default from named.
  const braceIdx = bindings.indexOf('{');
  let defaultBinding: string | null = null;
  let namedBindings: string | null = null;
  if (braceIdx === -1) {
    defaultBinding = bindings;
  } else {
    const before = bindings.slice(0, braceIdx).replace(/,\s*$/, '').trim();
    if (before) defaultBinding = before;
    namedBindings = bindings.slice(braceIdx).replace(/^\{|\}$/g, '').trim();
  }
  const parts: string[] = [];
  if (defaultBinding) {
    parts.push(`const ${defaultBinding} = (${target}).default ?? ${target};`);
  }
  if (namedBindings) {
    // { A, B as C, D } → const { A, B: C, D } = target;
    const destructure = namedBindings
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        // JS identifiers include $ and digits after the first char.
        const asMatch = /^([a-zA-Z_$][\w$]*)\s+as\s+([a-zA-Z_$][\w$]*)$/.exec(s);
        return asMatch ? `${asMatch[1]}: ${asMatch[2]}` : s;
      })
      .join(', ');
    parts.push(`const { ${destructure} } = ${target};`);
  }
  return parts.join('\n');
}

const wrapPortalCssInLayerPlugin: Plugin = {
  name: 'wrap-portal-css-in-layer',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const [, chunk] of Object.entries(bundle)) {
      if (chunk.type !== 'asset') continue;
      const isCss =
        chunk.fileName.endsWith('.css') ||
        (Array.isArray(chunk.names) && chunk.names.some((n) => n.endsWith('.css')));
      if (!isCss) continue;
      const source =
        typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source).toString('utf8');
      chunk.source = `@layer studio-portal {\n${source}\n}\n`;
    }
  },
};

export default defineConfig({
  plugins: [
    stubNodeBuiltinsPlugin,
    tailwindcss(),
    react(),
    rewriteExternalsToPortalDepsPlugin(EXTERNALS),
    wrapPortalCssInLayerPlugin,
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    process: { env: {} },
    // Baked into the bundle so `manifest.mastraVersion` reports the exact
    // version this bundle was built against. Overridable via env for
    // per-release builds (see PLTFRM-1266 build script).
    __PORTAL_MASTRA_VERSION__: JSON.stringify(
      process.env.PORTAL_MASTRA_VERSION ?? '0.0.0-dev',
    ),
  },
  build: {
    outDir: 'dist/portal',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/portal/mount.tsx'),
      formats: ['es'],
      fileName: () => 'studio-portal.js',
      // No `name` needed for pure ES modules.
    },
    rollupOptions: {
      external: (id) =>
        EXTERNALS.includes(id) ||
        id.startsWith('react/') ||
        id.startsWith('react-dom/') ||
        id.startsWith('react-router/'),
      output: {
        // Force single-file JS output. Studio dynamically imports shiki
        // language grammars, monaco, livekit, etc.; without this Rollup emits
        // a code-split graph that would need its own loader in Platform.
        inlineDynamicImports: true,
        assetFileNames: (asset) => {
          if (asset.names?.some((n) => n.endsWith('.css'))) return 'studio-portal.css';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});

import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Drift guard: keep the package bundleable for Convex's default (V8 isolate)
 * runtime, which provides Web APIs but no Node builtin modules.
 *
 * The schema and server entrypoints are deployed as Convex functions, and the
 * client adapters (ConvexStore, vectors, cache) only need HTTP + JSON + Web
 * Crypto — so no source file may import a Node builtin module. Web-standard
 * globals (crypto.randomUUID, fetch, ReadableStream) are fine.
 *
 * See https://docs.convex.dev/functions/runtimes#supported-apis
 */
const SRC_DIR = join(__dirname);

// Builtins Convex's default runtime explicitly provides as importable modules.
const CONVEX_ALLOWED_BUILTINS = new Set(['async_hooks', 'node:async_hooks']);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return [];
    return [path];
  });
}

function findBuiltinImports(source: string): string[] {
  const specifiers = [...source.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)].map(
    match => match[1]!,
  );
  return specifiers.filter(specifier => {
    if (CONVEX_ALLOWED_BUILTINS.has(specifier)) return false;
    const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
    return specifier.startsWith('node:') || builtinModules.includes(bare);
  });
}

describe('Convex isolate-runtime safety', () => {
  it('no source file imports Node builtin modules', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      const builtins = findBuiltinImports(readFileSync(file, 'utf8'));
      if (builtins.length > 0) {
        offenders.push(`${relative(SRC_DIR, file)}: ${builtins.join(', ')}`);
      }
    }
    expect(
      offenders,
      'Node builtin imports break bundling for the Convex default runtime. ' +
        'Use Web APIs (e.g. globalThis crypto.randomUUID) or move the code behind an optional Node-only entrypoint.',
    ).toEqual([]);
  });
});

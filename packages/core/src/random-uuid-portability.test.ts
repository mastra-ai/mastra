import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Drift guard for https://github.com/mastra-ai/mastra/issues/19501.
 *
 * `randomUUID` from `node:crypto` marks the importing module (and, through
 * bundler chunking, every chunk it lands in) as Node-only. The Web Crypto
 * global (`crypto.randomUUID()`) is available on every runtime this package
 * targets (Node >= 22, browsers, and V8-isolate edge runtimes), so source
 * files should use the global instead.
 *
 * This only guards `randomUUID` — other `node:crypto` APIs (createHash, HMAC,
 * cipher usage) are out of scope and unaffected by this check.
 */
const SRC_DIR = __dirname;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts') || entry.name.endsWith('.test-d.ts')) {
      return [];
    }
    return [path];
  });
}

const NODE_CRYPTO_RANDOM_UUID_IMPORT = /import\s*\{[^}]*\brandomUUID\b[^}]*\}\s*from\s*['"](?:node:)?crypto['"]/;

describe('randomUUID portability', () => {
  it('no source file imports randomUUID from node:crypto', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      const source = readFileSync(file, 'utf8');
      if (NODE_CRYPTO_RANDOM_UUID_IMPORT.test(source)) {
        offenders.push(relative(SRC_DIR, file));
      }
    }
    expect(
      offenders,
      'Use the Web Crypto global (crypto.randomUUID()) instead of importing randomUUID from node:crypto — ' +
        'the node:crypto import marks the module as Node-only and breaks bundling for isolate/edge runtimes.',
    ).toEqual([]);
  });
});

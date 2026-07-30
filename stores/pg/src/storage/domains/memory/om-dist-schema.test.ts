import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The observational memory schema used to be loaded through a dynamic
 * `require` guarded by `typeof require === 'function'`. esbuild rewrites the
 * bare `require` identifier in the ESM bundle to its dynamic-require shim,
 * which is always a function and always throws in ESM; the surrounding
 * `catch {}` swallowed that, so the published ESM build silently skipped
 * creating `mastra_observational_memory` while the CJS build created it
 * (#18954). Because the failure only exists in the bundled output, these
 * tests run `exportSchemas()` from the built artifacts in child processes.
 * CI builds the package before running tests, so dist/ is always present
 * there; locally the suite is skipped until `pnpm build:lib` has run.
 */
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const distEsm = join(pkgRoot, 'dist/index.js');
const distCjs = join(pkgRoot, 'dist/index.cjs');

function exportSchemasFromEsm(): string {
  const script = `import(${JSON.stringify(pathToFileURL(distEsm).href)}).then(m => process.stdout.write(m.exportSchemas()));`;
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
}

function exportSchemasFromCjs(): string {
  const script = `process.stdout.write(require(${JSON.stringify(distCjs)}).exportSchemas());`;
  return execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
}

describe.skipIf(!existsSync(distEsm) || !existsSync(distCjs))('observational memory schema in built output', () => {
  it('ESM build includes the observational memory table', () => {
    const ddl = exportSchemasFromEsm();
    expect(ddl).toContain('mastra_observational_memory');
    expect(ddl).toContain('idx_om_lookup_key');
  }, 30000);

  it('CJS build includes the observational memory table', () => {
    const ddl = exportSchemasFromCjs();
    expect(ddl).toContain('mastra_observational_memory');
    expect(ddl).toContain('idx_om_lookup_key');
  }, 30000);
});

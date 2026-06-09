import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };

describe('package exports', () => {
  it('publishes a runtime file for the package root export', async () => {
    const rootExport = packageJson.exports['.'];
    const rootImport = rootExport.import.default;
    const rootImportPath = path.resolve(process.cwd(), rootImport);

    const rootModule = await import(pathToFileURL(rootImportPath).href);

    expect(rootModule).toHaveProperty('runServer');
    expect(rootModule).toHaveProperty('server');
  });
});

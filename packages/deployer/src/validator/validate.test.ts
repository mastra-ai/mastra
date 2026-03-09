import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validate, ValidationError } from './validate';

describe('ValidationError', () => {
  it('should set message, type, and stack properties', () => {
    const args = {
      message: 'Test error message',
      type: 'TestError',
      stack: 'Error stack trace',
    };

    const error = new ValidationError(args);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error message');
    expect(error.type).toBe('TestError');
    expect(error.stack).toBe('Error stack trace');
  });
});

describe('validate', () => {
  let tempDir: string;
  let moduleMapPath: string;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `validate-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Create an empty module resolve map
    moduleMapPath = join(tempDir, 'module-resolve-map.json');
    await writeFile(moduleMapPath, JSON.stringify({}));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should resolve for a valid ESM file', async () => {
    const filePath = join(tempDir, 'valid.js');
    await writeFile(filePath, 'export const foo = 42;');

    await expect(validate(filePath, { moduleResolveMapLocation: moduleMapPath })).resolves.toBeUndefined();
  }, 10000);

  it('should reject with ValidationError for syntax errors', async () => {
    const filePath = join(tempDir, 'syntax-error.js');
    await writeFile(filePath, 'export const foo = {;'); // Invalid syntax

    await expect(validate(filePath, { moduleResolveMapLocation: moduleMapPath })).rejects.toThrow();
  }, 10000);

  it('should reject when importing non-existent module', async () => {
    const filePath = join(tempDir, 'missing-import.js');
    await writeFile(filePath, "import { foo } from 'non-existent-module-12345';");

    await expect(validate(filePath, { moduleResolveMapLocation: moduleMapPath })).rejects.toThrow();
  }, 10000);

  it('should reject when file does not exist', async () => {
    const filePath = join(tempDir, 'does-not-exist.js');

    await expect(validate(filePath, { moduleResolveMapLocation: moduleMapPath })).rejects.toThrow();
  }, 10000);

  it('should inject ESM shim when injectESMShim is true', async () => {
    const filePath = join(tempDir, 'esm-shim.js');
    // This file uses __filename and __dirname which only work with the shim
    await writeFile(
      filePath,
      `
      if (typeof __filename === 'undefined') {
        throw new Error('__filename is not defined');
      }
      if (typeof __dirname === 'undefined') {
        throw new Error('__dirname is not defined');
      }
      export const filename = __filename;
      export const dirname = __dirname;
    `,
    );

    await expect(
      validate(filePath, { injectESMShim: true, moduleResolveMapLocation: moduleMapPath }),
    ).resolves.toBeUndefined();
  }, 10000);

  it('should fail without ESM shim when using __filename/__dirname', async () => {
    const filePath = join(tempDir, 'no-esm-shim.js');
    await writeFile(
      filePath,
      `
      // Access __filename which is not available in ESM without shim
      console.log(__filename);
      export const foo = 1;
    `,
    );

    await expect(
      validate(filePath, { injectESMShim: false, moduleResolveMapLocation: moduleMapPath }),
    ).rejects.toThrow();
  }, 10000);
});

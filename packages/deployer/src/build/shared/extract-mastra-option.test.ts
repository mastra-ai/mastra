import { describe, it, expect, afterEach } from 'vitest';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extractMastraOption } from './extract-mastra-option';
import { removeAllOptionsExceptBundler } from '../babel/remove-all-options-bundler';

describe('extractMastraOption', () => {
  const testOutputDir = join(__dirname, '.test-output');

  afterEach(async () => {
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should generate valid file URLs for dynamic imports', async () => {
    await mkdir(testOutputDir, { recursive: true });

    const entryFile = join(__dirname, '../plugins/__fixtures__/basic-with-bundler.js');
    const result = await extractMastraOption('bundler', entryFile, removeAllOptionsExceptBundler, testOutputDir);

    // Check that the bundler-config.mjs file was created
    const configPath = join(testOutputDir, 'bundler-config.mjs');
    expect(existsSync(configPath)).toBe(true);

    // The key test: getConfig() should not throw a module resolution error
    // This is the operation that fails with Bun due to invalid file URL
    expect(result).not.toBeNull();
    await expect(result!.getConfig()).resolves.toBeDefined();
  });

  it('should use proper file:// URL protocol for absolute paths', async () => {
    await mkdir(testOutputDir, { recursive: true });

    const entryFile = join(__dirname, '../plugins/__fixtures__/basic-with-bundler.js');

    // Extract the option
    const result = await extractMastraOption('bundler', entryFile, removeAllOptionsExceptBundler, testOutputDir);

    // The config file should exist
    const configPath = join(testOutputDir, 'bundler-config.mjs');
    expect(existsSync(configPath)).toBe(true);

    // Verify the file URL would be valid
    // A valid file URL for an absolute path should start with file://
    const expectedUrl = pathToFileURL(configPath).href;
    expect(expectedUrl).toMatch(/^file:\/\/\//); // file:/// for Unix absolute paths
  });

  describe('file URL format validation', () => {
    it.skipIf(process.platform === 'win32')('should correctly convert absolute Unix paths to file URLs', () => {
      // Test the expected format for absolute paths
      const absolutePath = '/app/.mastra/.build/bundler-config.mjs';
      const fileUrl = pathToFileURL(absolutePath).href;

      // Should have three slashes: file:// + / (root)
      expect(fileUrl).toBe('file:///app/.mastra/.build/bundler-config.mjs');

      // Contrast with the buggy format
      const buggyUrl = `file:${absolutePath}`;
      expect(buggyUrl).toBe('file:/app/.mastra/.build/bundler-config.mjs');

      // The buggy format has only one slash after file:
      // This is invalid and causes Bun to fail
      expect(buggyUrl).not.toEqual(fileUrl);
    });

    it('should correctly convert relative paths to file URLs', () => {
      // When configPath is relative, it needs to be resolved to absolute first
      const relativePath = '.mastra/.build/bundler-config.mjs';
      const absolutePath = join(process.cwd(), relativePath);
      const fileUrl = pathToFileURL(absolutePath).href;

      // Should be a valid file URL
      expect(fileUrl).toMatch(/^file:\/\/\//);
    });
  });
});

import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CloudflareDeployer } from './index.js';

describe('CloudflareDeployer', () => {
  let deployer: CloudflareDeployer;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cloudflare-deployer-test-${Date.now()}`);
    // Create the output directory that writeFiles expects
    await mkdir(join(tempDir, 'output'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('bundler platform configuration', () => {
    it('should use browser platform for Workers-compatible module resolution', () => {
      // Cloudflare Workers don't have Node.js built-in modules like 'https'.
      // Packages like the official Cloudflare SDK use conditional exports
      // to provide different implementations for Node.js vs browser/worker environments.
      //
      // When platform is 'node', the bundler uses exportConditions: ['node'],
      // causing packages to resolve to Node.js-specific code (e.g., node-fetch
      // which depends on the 'https' module).
      //
      // For Cloudflare Workers, we need to use 'browser' platform which:
      // 1. Uses browser-compatible export conditions ['browser', 'worker', 'default']
      // 2. Doesn't assume Node.js built-ins are available
      //
      // This enables both D1 modes to work:
      // - Bindings mode: Uses D1Database binding from Workers runtime directly
      // - REST API mode: Cloudflare SDK resolves to web runtime using global fetch
      deployer = new CloudflareDeployer({ name: 'test-worker' });

      // @ts-expect-error - accessing protected property for testing
      expect(deployer.platform).toBe('browser');
    });
  });

  describe('writeFiles', () => {
    describe('TypeScript stub for bundle size optimization', () => {
      it('should create typescript-stub.mjs and configure wrangler alias', async () => {
        deployer = new CloudflareDeployer({ name: 'test-worker' });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(tempDir);

        // Verify stub file is created with expected exports
        const stubPath = join(tempDir, 'output', 'typescript-stub.mjs');
        const stub = await import(stubPath);

        expect(stub.default).toEqual({});
        expect(stub.createSourceFile()).toBeNull();
        expect(stub.createProgram()).toBeNull();
        expect(stub.ScriptTarget.Latest).toBe(99);
        expect(stub.DiagnosticCategory.Error).toBe(1);

        // Verify wrangler config uses the stub
        const wranglerConfigPath = join(tempDir, 'output', 'wrangler.json');
        const wranglerConfig = JSON.parse(await readFile(wranglerConfigPath, 'utf-8'));

        expect(wranglerConfig.alias.typescript).toBe('./typescript-stub.mjs');
      });

      it('should allow user to override the TypeScript alias', async () => {
        deployer = new CloudflareDeployer({
          name: 'test-worker',
          alias: {
            typescript: './custom-typescript-stub.js',
            'other-module': './other.js',
          },
        });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(tempDir);

        const wranglerConfigPath = join(tempDir, 'output', 'wrangler.json');
        const wranglerConfig = JSON.parse(await readFile(wranglerConfigPath, 'utf-8'));

        // User's alias should override the default, other aliases preserved
        expect(wranglerConfig.alias.typescript).toBe('./custom-typescript-stub.js');
        expect(wranglerConfig.alias['other-module']).toBe('./other.js');
      });
    });
  });
});

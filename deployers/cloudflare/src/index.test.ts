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

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
    describe('environment variable handling', () => {
      it('should exclude .env variables from wrangler config vars', async () => {
        deployer = new CloudflareDeployer({
          name: 'test-worker',
          vars: { NODE_ENV: 'production' },
        });

        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(
          new Map([
            ['OPENAI_API_KEY', 'sk-secret-key'],
            ['DATABASE_URL', 'postgres://user:pass@host/db'],
          ]),
        );

        await deployer.writeFiles(tempDir);

        const wranglerConfigPath = join(tempDir, 'output', 'wrangler.json');
        const wranglerConfig = JSON.parse(await readFile(wranglerConfigPath, 'utf-8'));

        expect(wranglerConfig.vars).not.toHaveProperty('OPENAI_API_KEY');
        expect(wranglerConfig.vars).not.toHaveProperty('DATABASE_URL');
        expect(wranglerConfig.vars).toHaveProperty('NODE_ENV', 'production');
      });

      it('should include only user-provided vars when no .env file exists', async () => {
        deployer = new CloudflareDeployer({
          name: 'test-worker',
          vars: { APP_MODE: 'live' },
        });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(tempDir);

        const wranglerConfigPath = join(tempDir, 'output', 'wrangler.json');
        const wranglerConfig = JSON.parse(await readFile(wranglerConfigPath, 'utf-8'));

        expect(wranglerConfig.vars).toEqual({ APP_MODE: 'live' });
      });
    });

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

    describe('module stub for Workers compatibility', () => {
      it('should create module-stub.mjs and configure wrangler aliases', async () => {
        deployer = new CloudflareDeployer({ name: 'test-worker' });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(tempDir);

        const stubPath = join(tempDir, 'output', 'module-stub.mjs');
        const stub = await import(stubPath);
        const req = stub.createRequire();

        expect(req.resolve('@ast-grep/napi')).toBe('@ast-grep/napi');
        expect(() => req('@ast-grep/napi')).toThrow('require(@ast-grep/napi) is not available in Cloudflare Workers');

        const wranglerConfigPath = join(tempDir, 'output', 'wrangler.json');
        const wranglerConfig = JSON.parse(await readFile(wranglerConfigPath, 'utf-8'));

        expect(wranglerConfig.alias.module).toBe('./module-stub.mjs');
        expect(wranglerConfig.alias['node:module']).toBe('./module-stub.mjs');
      });
    });

    describe('readable-stream stub for Workers compatibility', () => {
      it('should create readable-stream-stub.mjs that re-exports from node:stream', async () => {
        deployer = new CloudflareDeployer({ name: 'test-worker' });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(tempDir);

        const stubPath = join(tempDir, 'output', 'readable-stream-stub.mjs');
        const stub = await import(stubPath);

        expect(stub.Readable).toBeDefined();
        expect(stub.Writable).toBeDefined();
        expect(stub.Duplex).toBeDefined();
        expect(stub.Transform).toBeDefined();
        expect(stub.PassThrough).toBeDefined();
        expect(typeof stub.Readable.from).toBe('function');

        const wranglerConfigPath = join(tempDir, 'output', 'wrangler.json');
        const wranglerConfig = JSON.parse(await readFile(wranglerConfigPath, 'utf-8'));

        expect(wranglerConfig.alias['readable-stream']).toBe('./readable-stream-stub.mjs');
      });

      it('should allow user to override the readable-stream alias', async () => {
        deployer = new CloudflareDeployer({
          name: 'test-worker',
          alias: {
            'readable-stream': './custom-stream.js',
          },
        });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(tempDir);

        const wranglerConfigPath = join(tempDir, 'output', 'wrangler.json');
        const wranglerConfig = JSON.parse(await readFile(wranglerConfigPath, 'utf-8'));

        expect(wranglerConfig.alias['readable-stream']).toBe('./custom-stream.js');
      });
    });

    describe('@opentelemetry/api stub for the optional posthog-node peer', () => {
      // Lay out a project so wrangler.jsonc lands inside the test directory: <project>/.mastra/output
      const projectDir = () => join(tempDir, 'project');
      const mastraDir = () => join(projectDir(), '.mastra');
      const readJsonc = async () =>
        JSON.parse((await readFile(join(projectDir(), 'wrangler.jsonc'), 'utf-8')).replace(/\/\*.*?\*\//, ''));

      beforeEach(async () => {
        await mkdir(join(mastraDir(), 'output'), { recursive: true });
      });

      it('aliases @opentelemetry/api to a module that fails to load when the project does not install it', async () => {
        deployer = new CloudflareDeployer({ name: 'test-worker' });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(mastraDir());

        const stubPath = join(mastraDir(), 'output', 'opentelemetry-api-stub.mjs');
        await expect(import(stubPath)).rejects.toThrow('@opentelemetry/api is not installed');

        const wranglerConfig = JSON.parse(await readFile(join(mastraDir(), 'output', 'wrangler.json'), 'utf-8'));
        expect(wranglerConfig.alias['@opentelemetry/api']).toBe('./opentelemetry-api-stub.mjs');
        expect((await readJsonc()).alias['@opentelemetry/api']).toBe('./.mastra/output/opentelemetry-api-stub.mjs');
      });

      it('leaves @opentelemetry/api alone when the project installs it', async () => {
        const otelDir = join(projectDir(), 'node_modules', '@opentelemetry', 'api');
        await mkdir(otelDir, { recursive: true });
        await writeFile(
          join(otelDir, 'package.json'),
          JSON.stringify({ name: '@opentelemetry/api', main: 'index.js' }),
        );
        await writeFile(join(otelDir, 'index.js'), 'module.exports = {};');
        deployer = new CloudflareDeployer({ name: 'test-worker' });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(mastraDir());

        await expect(stat(join(mastraDir(), 'output', 'opentelemetry-api-stub.mjs'))).rejects.toThrow();
        const wranglerConfig = JSON.parse(await readFile(join(mastraDir(), 'output', 'wrangler.json'), 'utf-8'));
        expect(wranglerConfig.alias).not.toHaveProperty('@opentelemetry/api');
        expect((await readJsonc()).alias).not.toHaveProperty('@opentelemetry/api');
      });

      it('keeps a user-provided @opentelemetry/api alias', async () => {
        deployer = new CloudflareDeployer({ name: 'test-worker', alias: { '@opentelemetry/api': './my-otel.mjs' } });
        vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());

        await deployer.writeFiles(mastraDir());

        await expect(stat(join(mastraDir(), 'output', 'opentelemetry-api-stub.mjs'))).rejects.toThrow();
        const wranglerConfig = JSON.parse(await readFile(join(mastraDir(), 'output', 'wrangler.json'), 'utf-8'));
        expect(wranglerConfig.alias['@opentelemetry/api']).toBe('./my-otel.mjs');
        expect((await readJsonc()).alias['@opentelemetry/api']).toBe('./my-otel.mjs');
      });
    });
  });
});

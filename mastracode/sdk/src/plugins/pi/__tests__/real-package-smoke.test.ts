import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { PluginManager } from '../../manager.js';
import { loadPluginRegistry } from '../../registry.js';
import { inspectPiPackageManifest } from '../package-manifest.js';
import { discoverPiPackageResources } from '../resource-discovery.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/pi-mcp-adapter-2.26.1/', import.meta.url));
const packageEntry = fileURLToPath(import.meta.resolve('pi-mcp-adapter'));
const packageRoot = path.dirname(packageEntry);
const sdkRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
const workspaceRoot = path.resolve(sdkRoot, '../..');
let tempDir: string | undefined;

const originalCwd = process.cwd();
const originalHome = process.env.HOME;

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('pinned real Pi Package fixture', () => {
  it('loads, characterizes, shuts down, and invalidates pi-mcp-adapter@2.26.1', async () => {
    const provenance = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'fixture.json'), 'utf8')) as {
      specifier: string;
      version: string;
      integrity: string;
    };
    const sdkManifest = JSON.parse(fs.readFileSync(path.join(sdkRoot, 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
    };
    const lockfile = fs.readFileSync(path.join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');
    const manifest = inspectPiPackageManifest(packageRoot);
    const resources = discoverPiPackageResources(manifest);
    expect(provenance).toMatchObject({
      specifier: 'npm:pi-mcp-adapter@2.26.1',
      version: '2.26.1',
      integrity: 'sha512-6/KDXIEPXTVM77274jAloxAo9AQSEy5EJ/7afIlUK2T8HOfeVapTJvwImvyChiIH+0gGShbFgnBK2BXFrjbj2w==',
    });
    expect(sdkManifest.devDependencies?.['pi-mcp-adapter']).toBe(provenance.version);
    expect(lockfile).toContain(
      `pi-mcp-adapter@${provenance.version}:\n    resolution: {integrity: ${provenance.integrity}}`,
    );
    expect(manifest).toMatchObject({
      name: 'pi-mcp-adapter',
      version: provenance.version,
      observedApiVersion: '^0.84.1',
      lifecycleScripts: {},
      hasDependencies: true,
    });
    expect(resources.extensions).toEqual(['index.ts']);
    expect(resources.skills).toContain('skills/mcp-scripting/SKILL.md');

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-real-package-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    fs.mkdirSync(projectRoot, { recursive: true });
    process.env.HOME = homeDir;
    process.chdir(projectRoot);

    const corepackFixture = path.join(tempDir, 'corepack-fixture.mjs');
    fs.writeFileSync(
      corepackFixture,
      `#!/usr/bin/env node\nimport fs from 'node:fs';\nimport path from 'node:path';\nfs.symlinkSync(${JSON.stringify(path.join(sdkRoot, 'node_modules'))}, path.join(process.cwd(), 'node_modules'), 'dir');\n`,
      { mode: 0o755 },
    );

    const manager = new PluginManager({ projectRoot, homeDir });
    try {
      const prepared = await manager.preparePiPackage(packageRoot, 'global');
      const characterized = await manager.characterizePiPackage(prepared, {
        trustCodeExecution: true,
        installScripts: 'deny',
        corepackCliPath: corepackFixture,
      });
      expect(characterized.compatibility.status).toBe('pi-compatible');

      await manager.installPiPackage(characterized, { confirmEnable: true });
      const generation = manager.getPiGenerations()[0]!;
      const api = generation.createApi();
      expect(generation.registrations.tools.has('mcp')).toBe(true);
      expect((await manager.listPlugins()).find(plugin => plugin.id === manifest.name)).toMatchObject({
        status: 'active',
        piPackage: {
          targetApiVersion: '0.84.2',
          observedApiVersion: '^0.84.1',
          compatibilityReport: { status: 'pi-compatible' },
        },
      });
      expect(
        loadPluginRegistry(path.join(homeDir, '.mastracode/plugins/plugins.json')).plugins[manifest.name],
      ).toMatchObject({ source: 'pi-package', enabled: true });

      await manager.uninstall(manifest.name, 'global');
      expect(manager.getPiGenerations()).toEqual([]);
      expect(loadPluginRegistry(path.join(homeDir, '.mastracode/plugins/plugins.json')).plugins).not.toHaveProperty(
        manifest.name,
      );
      expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(false);
      expect(fs.existsSync(characterized.resolution.packageRoot)).toBe(false);
      expect(() => api.getFlag('transport')).toThrow('context is stale');
    } finally {
      await manager.dispose();
    }
  }, 20_000);
});

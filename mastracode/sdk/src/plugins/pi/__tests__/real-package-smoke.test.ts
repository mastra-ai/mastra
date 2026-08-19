import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { loadPiExtensionGeneration } from '../loader.js';
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
    process.env.HOME = tempDir;
    process.chdir(tempDir);
    const generation = await loadPiExtensionGeneration({
      pluginId: manifest.name,
      entryPath: resources.extensions[0]!,
      pluginRoot: packageRoot,
    });
    const api = generation.createApi();
    try {
      expect(generation.registrations.tools.has('mcp')).toBe(true);
      expect(generation.compatibility.status).toBe('pi-compatible');
      await generation.emit('session_shutdown', { type: 'session_shutdown' });
    } finally {
      await generation.invalidate('Real Pi Package smoke completed.');
    }
    expect(generation.active).toBe(false);
    expect(() => api.getFlag('transport')).toThrow('Real Pi Package smoke completed.');
  });
});

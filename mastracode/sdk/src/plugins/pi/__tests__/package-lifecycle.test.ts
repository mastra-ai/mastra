import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from '../../manager.js';
import { loadPluginRegistry, savePluginRegistry } from '../../registry.js';
import type { PluginScope } from '../../types.js';
import { createPiPackageCompatibility } from '../compatibility.js';
import type { CharacterizedPiPackage } from '../package-intake.js';
import { inspectPiPackageManifest } from '../package-manifest.js';
import { hashMaterializedPackageDirectory, hashPackageDirectory } from '../package-resolver.js';
import type { PiUiHost } from '../ui-adapter.js';

let tempDir: string | undefined;
let manager: PluginManager | undefined;

afterEach(async () => {
  await manager?.dispose();
  manager = undefined;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function createCharacterizedPackage(
  root: string,
  version: string,
  options: { invalid?: boolean; scope?: PluginScope } = {},
): CharacterizedPiPackage {
  const scope = options.scope ?? 'project';
  const sourceRoot = path.join(root, '.mastracode/plugins/sources/pi-packages/local/lifecycle', version);
  const packageRoot = path.join(path.dirname(sourceRoot), '.materialized', `package-${version}`, 'package');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sourceRoot, 'package.json'),
    JSON.stringify({
      name: 'pi-lifecycle',
      version,
      pi: { extensions: ['./index.ts'], skills: ['./skills'] },
    }),
  );
  fs.writeFileSync(path.join(sourceRoot, 'index.ts'), extensionSource(version, options.invalid));
  fs.mkdirSync(path.join(sourceRoot, 'skills/lifecycle'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'skills/lifecycle/SKILL.md'), `---\nname: lifecycle\n---\n${version}`);
  const contentIntegrity = hashPackageDirectory(sourceRoot);
  fs.mkdirSync(path.dirname(packageRoot), { recursive: true });
  fs.cpSync(sourceRoot, packageRoot, {
    recursive: true,
    filter: source =>
      !source.includes(`${path.sep}.materialized${path.sep}`) && !source.endsWith(`${path.sep}.materialized`),
  });
  const resources = {
    extensions: ['index.ts'],
    skills: ['skills/lifecycle/SKILL.md'],
    prompts: [],
    themes: [],
  };
  const compatibility = createPiPackageCompatibility([], []);
  return {
    specifier: `local:fixtures/pi-lifecycle-${version}`,
    scope,
    resolution: {
      sourceType: 'local',
      resolvedSpecifier: `local:pi-lifecycle#${contentIntegrity}`,
      sourceRoot,
      packageRoot,
      integrity: contentIntegrity,
      contentIntegrity,
      materializedIntegrity: hashMaterializedPackageDirectory(packageRoot),
    },
    manifest: inspectPiPackageManifest(sourceRoot),
    resources,
    compatibility,
    extensions: [{ entry: 'index.ts', compatibility }],
    trust: {
      codeExecution: 'trusted',
      project: scope === 'project' ? 'trusted' : 'not-required',
      installScripts: 'deny',
    },
  };
}

function extensionSource(version: string, invalid = false): string {
  if (invalid) return `throw new Error('broken candidate ${version}')`;
  return `
    import { Type } from 'typebox';
    export default function (pi) {
      pi.registerTool({
        name: 'pi_lifecycle_tool',
        label: 'Lifecycle tool',
        description: '${version}',
        parameters: Type.Object({}),
        execute: async () => ({ content: [{ type: 'text', text: '${version}' }], details: {} }),
      });
    }
  `;
}

function createUiHost(clearGeneration: PiUiHost['clearGeneration']): PiUiHost {
  return {
    notify: () => undefined,
    setStatus: () => undefined,
    setWidget: () => true,
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    editor: async () => undefined,
    getTheme: () => ({}),
    getEditorText: () => '',
    setEditorText: () => undefined,
    clearGeneration,
  };
}

describe('Pi Package lifecycle', () => {
  it('installs, reuses, disables, enables, and uninstalls one owned generation', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const characterized = createCharacterizedPackage(projectRoot, '1.0.0');
    let cleanupCount = 0;
    manager = new PluginManager({ projectRoot, homeDir });
    manager.setPiUiHost(
      createUiHost(async () => {
        expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(true);
        cleanupCount += 1;
      }),
    );

    await expect(manager.installPiPackage(characterized, { confirmEnable: false })).rejects.toThrow(
      'explicit enable confirmation',
    );
    await expect(manager.installPiPackage(characterized, { confirmEnable: true })).resolves.toBe('pi-lifecycle');
    const firstGeneration = manager.getPiGenerations()[0]!;
    expect(manager.getPluginTools().pi_lifecycle_tool?.description).toBe('1.0.0');
    expect(manager.getPluginSkillPaths()).toEqual([path.join(characterized.resolution.packageRoot, 'skills')]);

    manager.discardPiPackageCandidate(characterized);
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(true);
    expect(fs.existsSync(characterized.resolution.packageRoot)).toBe(true);

    await manager.reloadPiPackage('pi-lifecycle', 'project');
    expect(manager.getPiGenerations()[0]).toBe(firstGeneration);
    await manager.installPiPackage(characterized, { confirmEnable: true });
    expect(manager.getPiGenerations()[0]).toBe(firstGeneration);

    const conflictingNativeRoot = path.join(tempDir, 'conflicting-native');
    fs.mkdirSync(conflictingNativeRoot, { recursive: true });
    fs.writeFileSync(path.join(conflictingNativeRoot, 'index.ts'), `export default { id: 'pi-lifecycle', tools: {} }`);
    await expect(manager.installLocal(conflictingNativeRoot, 'project', { entry: 'index.ts' })).rejects.toThrow(
      'already installed as a Pi Package',
    );
    expect(manager.getPiGenerations()[0]).toBe(firstGeneration);
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(true);

    await manager.setEnabled('pi-lifecycle', 'project', false);
    expect(firstGeneration.active).toBe(false);
    expect(manager.getPiGenerations()).toEqual([]);
    expect(Object.keys(manager.getPluginTools())).toEqual([]);
    expect(manager.getPluginSkillPaths()).toEqual([]);
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(true);
    expect(cleanupCount).toBe(1);

    await manager.setEnabled('pi-lifecycle', 'project', true);
    expect(manager.getPiGenerations()).toHaveLength(1);
    expect(manager.getPiGenerations()[0]).not.toBe(firstGeneration);

    await Promise.all([
      manager.setConfigValue('pi-lifecycle', 'project', 'first', 'one'),
      manager.setConfigValue('pi-lifecycle', 'project', 'second', 'two'),
    ]);
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle']?.config,
    ).toEqual({ first: 'one', second: 'two' });

    await manager.uninstall('pi-lifecycle', 'project');
    expect(manager.getPiGenerations()).toEqual([]);
    expect(Object.keys(manager.getPluginTools())).toEqual([]);
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(false);
    expect(cleanupCount).toBe(4);
    expect(loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins).toEqual({});
  });

  it('rolls back a failed staged update without replacing the prior generation or sibling', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const first = createCharacterizedPackage(projectRoot, '1.0.0');
    const broken = createCharacterizedPackage(projectRoot, '2.0.0', { invalid: true });
    manager = new PluginManager({ projectRoot, homeDir });
    await manager.installPiPackage(first, { confirmEnable: true });
    const firstGeneration = manager.getPiGenerations()[0]!;

    const siblingRoot = path.join(projectRoot, 'sibling');
    fs.mkdirSync(siblingRoot, { recursive: true });
    fs.writeFileSync(
      path.join(siblingRoot, 'index.ts'),
      `export default { id: 'sibling', tools: { sibling_tool: { tool: { id: 'sibling_tool' } } } }`,
    );
    savePluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json'), {
      ...loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')),
      plugins: {
        ...loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins,
        sibling: { enabled: true, source: 'local', specifier: siblingRoot, path: siblingRoot, entry: 'index.ts' },
      },
    });
    await manager.reload();

    await expect(manager.installPiPackage(broken, { confirmEnable: true })).rejects.toThrow('broken candidate 2.0.0');

    expect(manager.getPiGenerations()[0]).toBe(firstGeneration);
    expect((await manager.listPlugins()).find(plugin => plugin.id === 'pi-lifecycle')?.candidateError).toContain(
      'broken candidate 2.0.0',
    );
    expect(manager.getPluginTools().pi_lifecycle_tool?.description).toBe('1.0.0');
    expect(manager.getPluginTools()).toHaveProperty('sibling_tool');
    expect(fs.existsSync(first.resolution.sourceRoot)).toBe(true);
    expect(fs.existsSync(broken.resolution.packageRoot)).toBe(false);
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle']?.version,
    ).toBe('1.0.0');
  });

  it('persists retryable old-source cleanup after a successful candidate update', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const first = createCharacterizedPackage(projectRoot, '1.0.0');
    const next = createCharacterizedPackage(projectRoot, '2.0.0');
    manager = new PluginManager({ projectRoot, homeDir });
    await manager.installPiPackage(first, { confirmEnable: true });
    const originalRmSync = fs.rmSync.bind(fs);
    const removeSpy = vi.spyOn(fs, 'rmSync').mockImplementation((target, options) => {
      if (path.resolve(String(target)) === first.resolution.sourceRoot) {
        throw new Error('simulated previous-source cleanup failure');
      }
      return originalRmSync(target, options);
    });

    try {
      await expect(manager.installPiPackage(next, { confirmEnable: true })).rejects.toThrow(
        'updated, but previous source cleanup is pending',
      );
    } finally {
      removeSpy.mockRestore();
    }

    expect(manager.getPluginTools().pi_lifecycle_tool?.description).toBe('2.0.0');
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle']?.piPackage
        ?.pendingCleanup,
    ).toMatchObject({ error: 'simulated previous-source cleanup failure' });
    expect(fs.existsSync(first.resolution.sourceRoot)).toBe(true);

    await manager.dispose();
    manager = new PluginManager({ projectRoot, homeDir });
    expect((await manager.listPlugins())[0]?.candidateError).toBe('simulated previous-source cleanup failure');
    await manager.installPiPackage(next, { confirmEnable: true });
    expect(fs.existsSync(first.resolution.sourceRoot)).toBe(false);
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle']?.piPackage
        ?.pendingCleanup,
    ).toBeUndefined();
  });

  it('serializes a failed and successful concurrent update without a partial package set', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const first = createCharacterizedPackage(projectRoot, '1.0.0');
    const broken = createCharacterizedPackage(projectRoot, '2.0.0', { invalid: true });
    const final = createCharacterizedPackage(projectRoot, '3.0.0');
    const boundAgainstRegistryVersions: Array<string | undefined> = [];
    manager = new PluginManager({ projectRoot, homeDir });
    manager.setPiRuntimeActions(() => {
      boundAgainstRegistryVersions.push(
        loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle']?.version,
      );
      return {};
    });
    await manager.installPiPackage(first, { confirmEnable: true });
    boundAgainstRegistryVersions.length = 0;

    const [failed, succeeded] = await Promise.allSettled([
      manager.installPiPackage(broken, { confirmEnable: true }),
      manager.installPiPackage(final, { confirmEnable: true }),
    ]);

    expect(failed.status).toBe('rejected');
    expect(succeeded).toEqual({ status: 'fulfilled', value: 'pi-lifecycle' });
    expect(boundAgainstRegistryVersions).toEqual(['1.0.0']);
    expect(manager.getPiGenerations()).toHaveLength(1);
    expect(manager.getPluginTools().pi_lifecycle_tool?.description).toBe('3.0.0');
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle']?.version,
    ).toBe('3.0.0');
    expect(fs.existsSync(first.resolution.sourceRoot)).toBe(false);
    expect(fs.existsSync(broken.resolution.packageRoot)).toBe(false);
    expect(fs.existsSync(final.resolution.sourceRoot)).toBe(true);
  });

  it('serializes native registry writes behind Pi candidate publication without losing siblings', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const characterized = createCharacterizedPackage(projectRoot, '1.0.0');
    const nativeRoot = path.join(tempDir, 'native-plugin');
    fs.mkdirSync(nativeRoot, { recursive: true });
    fs.writeFileSync(
      path.join(nativeRoot, 'index.ts'),
      `export default { id: 'native-sibling', tools: { native_sibling_tool: { tool: { id: 'native_sibling_tool' } } } }`,
    );
    let releaseCandidate: (() => void) | undefined;
    const candidateGate = new Promise<void>(resolve => {
      releaseCandidate = resolve;
    });
    let markCandidateStarted: (() => void) | undefined;
    const candidateStarted = new Promise<void>(resolve => {
      markCandidateStarted = resolve;
    });
    manager = new PluginManager({ projectRoot, homeDir });
    manager.onPiGenerationsReconcile(async generations => {
      if (generations.some(generation => generation.pluginId === 'pi-lifecycle')) {
        markCandidateStarted?.();
        await candidateGate;
      }
    });

    const piInstall = manager.installPiPackage(characterized, { confirmEnable: true });
    await candidateStarted;
    const nativeInstall = manager.installLocal(nativeRoot, 'project', { entry: 'index.ts' });
    releaseCandidate?.();
    await Promise.all([piInstall, nativeInstall]);

    const registry = loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json'));
    expect(Object.keys(registry.plugins).sort()).toEqual(['native-sibling', 'pi-lifecycle']);
    expect(manager.getPluginTools()).toHaveProperty('native_sibling_tool');
    expect(manager.getPluginTools()).toHaveProperty('pi_lifecycle_tool');
  });

  it('awaits owned cleanup and an in-flight mutation before shutdown removes source files', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const characterized = createCharacterizedPackage(projectRoot, '1.0.0');
    let releaseCleanup: (() => void) | undefined;
    const cleanupGate = new Promise<void>(resolve => {
      releaseCleanup = resolve;
    });
    let markCleanupStarted: (() => void) | undefined;
    const cleanupStarted = new Promise<void>(resolve => {
      markCleanupStarted = resolve;
    });
    manager = new PluginManager({ projectRoot, homeDir });
    manager.setPiUiHost(
      createUiHost(async () => {
        markCleanupStarted?.();
        await cleanupGate;
      }),
    );
    await manager.installPiPackage(characterized, { confirmEnable: true });

    const uninstall = manager.uninstall('pi-lifecycle', 'project');
    await cleanupStarted;
    let disposed = false;
    const dispose = manager.dispose().then(() => {
      disposed = true;
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(disposed).toBe(false);
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(true);

    releaseCleanup?.();
    await Promise.all([uninstall, dispose]);
    expect(disposed).toBe(true);
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(false);
    manager = undefined;
  });

  it('retains a disabled cleanup record when source deletion fails so uninstall can be retried', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const characterized = createCharacterizedPackage(projectRoot, '1.0.0');
    manager = new PluginManager({ projectRoot, homeDir });
    await manager.installPiPackage(characterized, { confirmEnable: true });
    const originalRmSync = fs.rmSync.bind(fs);
    const removeSpy = vi.spyOn(fs, 'rmSync').mockImplementation((target, options) => {
      if (path.resolve(String(target)) === characterized.resolution.sourceRoot) {
        throw new Error('simulated source cleanup failure');
      }
      return originalRmSync(target, options);
    });

    try {
      await expect(manager.uninstall('pi-lifecycle', 'project')).rejects.toThrow('simulated source cleanup failure');
    } finally {
      removeSpy.mockRestore();
    }

    expect(manager.getPiGenerations()).toEqual([]);
    expect(manager.getPluginTools()).toEqual({});
    expect((await manager.listPlugins())[0]).toMatchObject({
      id: 'pi-lifecycle',
      status: 'inactive',
      candidateError: 'simulated source cleanup failure',
    });
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle'],
    ).toMatchObject({
      enabled: false,
      source: 'pi-package',
      piPackage: { pendingCleanup: { error: 'simulated source cleanup failure' } },
    });

    await manager.uninstall('pi-lifecycle', 'project');
    expect(loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins).toEqual({});
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(false);
  });

  it('persists a blocked global package without displacing the project override', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-lifecycle-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const globalPackage = createCharacterizedPackage(homeDir, '1.0.0', { scope: 'global' });
    const projectRegistryPath = path.join(projectRoot, '.mastracode/plugins/plugins.json');
    savePluginRegistry(projectRegistryPath, { plugins: {}, disabledPlugins: ['pi-lifecycle'] });
    manager = new PluginManager({ projectRoot, homeDir });

    await manager.installPiPackage(globalPackage, { confirmEnable: true });

    expect((await manager.listPlugins())[0]).toMatchObject({ id: 'pi-lifecycle', scope: 'global', status: 'blocked' });
    expect(manager.getPiGenerations()).toEqual([]);
    expect(
      loadPluginRegistry(path.join(homeDir, '.mastracode/plugins/plugins.json')).plugins['pi-lifecycle'],
    ).toBeTruthy();
  });
});

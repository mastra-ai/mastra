import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from '../../manager.js';
import { savePluginRegistry } from '../../registry.js';
import type { PluginRegistry } from '../../types.js';

let tempDir: string | undefined;
let manager: PluginManager | undefined;

afterEach(async () => {
  await manager?.dispose();
  manager = undefined;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

async function waitUntil(assertion: () => boolean, timeoutMs = 4000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (assertion()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  expect(assertion()).toBe(true);
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-manager-'));
  tempDir = root;
  const projectRoot = path.join(root, 'project');
  const homeDir = path.join(root, 'home');
  const nativeRoot = path.join(root, 'native');
  const piRoot = path.join(root, 'pi');
  fs.mkdirSync(nativeRoot, { recursive: true });
  fs.mkdirSync(piRoot, { recursive: true });
  fs.writeFileSync(
    path.join(nativeRoot, 'index.ts'),
    `export default { id: 'fixture.native', tools: { native_tool: { tool: { id: 'native_tool', description: 'native' } } } };`,
  );
  fs.writeFileSync(
    path.join(piRoot, 'index.ts'),
    `export default function (pi) { pi.registerCommand('pi-command', { handler: async () => {} }); }`,
  );
  const registry: PluginRegistry = {
    plugins: {
      'fixture.native': {
        enabled: true,
        source: 'local',
        specifier: nativeRoot,
        path: nativeRoot,
        entry: 'index.ts',
      },
      'fixture.pi': {
        enabled: true,
        source: 'local',
        compatibility: 'pi',
        specifier: piRoot,
        path: piRoot,
        entry: 'index.ts',
      },
    },
  };
  const registryPath = path.join(projectRoot, '.mastracode/plugins/plugins.json');
  savePluginRegistry(registryPath, registry);
  manager = new PluginManager({ projectRoot, homeDir });
  return { manager, nativeRoot, piRoot, registryPath };
}

describe('PluginManager Pi generation integration', () => {
  it('publishes native and Pi candidates together and reuses unchanged generations', async () => {
    const fixture = createFixture();

    const first = await fixture.manager.reload();
    const native = first.find(plugin => plugin.id === 'fixture.native');
    const pi = first.find(plugin => plugin.id === 'fixture.pi');
    expect(native).toMatchObject({ status: 'active', toolNames: ['native_tool'] });
    expect(pi).toMatchObject({ status: 'active', compatibility: 'pi' });
    expect(pi?.piGeneration?.bound).toBe(true);
    expect(pi?.piGeneration?.registrations.commands.has('pi-command')).toBe(true);

    await fixture.manager.reload();
    expect(fixture.manager.getLoadedPlugins().find(plugin => plugin.id === 'fixture.pi')?.piGeneration).toBe(
      pi?.piGeneration,
    );
  });

  it('keeps the prior Pi generation active when a reload candidate fails', async () => {
    const fixture = createFixture();
    const first = await fixture.manager.reload();
    const previous = first.find(plugin => plugin.id === 'fixture.pi');
    const oldApi = previous?.piGeneration?.createApi();

    fs.writeFileSync(path.join(fixture.piRoot, 'index.ts'), 'export default function (pi) {');
    const failed = await fixture.manager.reload();
    const retained = failed.find(plugin => plugin.id === 'fixture.pi');

    expect(retained?.status).toBe('active');
    expect(retained?.piGeneration).toBe(previous?.piGeneration);
    expect(retained?.candidateError).toBeTruthy();
    expect(() => oldApi?.registerFlag('still-active', { type: 'boolean' })).not.toThrow();
    expect(failed.find(plugin => plugin.id === 'fixture.native')?.status).toBe('active');
  });

  it('keeps the local watcher alive across a failed candidate and recovers on the next edit', async () => {
    const fixture = createFixture();
    const first = await fixture.manager.reload();
    const previous = first.find(plugin => plugin.id === 'fixture.pi')?.piGeneration;
    const entryPath = path.join(fixture.piRoot, 'index.ts');

    fs.writeFileSync(entryPath, 'export default function broken(pi) {');
    await waitUntil(() =>
      Boolean(fixture.manager.getLoadedPlugins().find(plugin => plugin.id === 'fixture.pi')?.candidateError),
    );
    expect(fixture.manager.getLoadedPlugins().find(plugin => plugin.id === 'fixture.pi')?.piGeneration).toBe(previous);

    fs.writeFileSync(
      entryPath,
      `export default function recovered(pi) {
         pi.registerCommand('watcher-recovered', { handler: async () => {} });
       }`,
    );
    await waitUntil(
      () =>
        fixture.manager
          .getLoadedPlugins()
          .find(plugin => plugin.id === 'fixture.pi')
          ?.piGeneration?.registrations.commands.has('watcher-recovered') === true,
    );

    expect(previous?.active).toBe(false);
  });

  it('invalidates the old generation only after a changed candidate succeeds', async () => {
    const fixture = createFixture();
    const first = await fixture.manager.reload();
    const previous = first.find(plugin => plugin.id === 'fixture.pi');
    const oldApi = previous?.piGeneration?.createApi();

    fs.writeFileSync(
      path.join(fixture.piRoot, 'index.ts'),
      `export default function (pi) {
         pi.registerCommand('replacement-command', { handler: async () => {} });
       }`,
    );
    const second = await fixture.manager.reload();
    const replacement = second.find(plugin => plugin.id === 'fixture.pi');

    expect(replacement?.piGeneration).not.toBe(previous?.piGeneration);
    expect(replacement?.piGeneration?.registrations.commands.has('replacement-command')).toBe(true);
    expect(previous?.piGeneration?.active).toBe(false);
    expect(() => oldApi?.registerFlag('stale', { type: 'boolean' })).toThrow('context is stale');
  });

  it('invalidates controller-scoped generations when runtime accessors are replaced', async () => {
    const fixture = createFixture();
    fixture.manager.setRuntime({ getController: () => undefined, getActiveSession: () => undefined });
    const first = await fixture.manager.reload();
    const previous = first.find(plugin => plugin.id === 'fixture.pi')?.piGeneration;

    fixture.manager.setRuntime({ getController: () => undefined, getActiveSession: () => undefined });
    const second = await fixture.manager.reload();

    expect(second.find(plugin => plugin.id === 'fixture.pi')?.piGeneration).not.toBe(previous);
    expect(previous?.active).toBe(false);
  });

  it('serializes overlapping reloads and isolates cleanup failures', async () => {
    const fixture = createFixture();
    const first = await fixture.manager.reload();
    const generation = first.find(plugin => plugin.id === 'fixture.pi')?.piGeneration;
    const cleanup = vi.fn();
    generation?.addCleanup(() => Promise.reject(new Error('cleanup failed')));
    generation?.addCleanup(cleanup);

    fs.writeFileSync(
      path.join(fixture.piRoot, 'index.ts'),
      `export default async function (pi) {
         await new Promise(resolve => setTimeout(resolve, 20));
         pi.registerCommand('serialized-command', { handler: async () => {} });
       }`,
    );
    const [left, right] = await Promise.all([fixture.manager.reload(), fixture.manager.reload()]);

    expect(left).toBe(right);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(generation?.compatibility.diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'cleanup', message: expect.stringContaining('cleanup failed') }),
    );
    expect(left.find(plugin => plugin.id === 'fixture.native')?.status).toBe('active');
  });

  it('retires Pi generations on disable and uninstall without disturbing native plugins', async () => {
    const fixture = createFixture();
    const first = await fixture.manager.reload();
    const generation = first.find(plugin => plugin.id === 'fixture.pi')?.piGeneration;
    const cleanup = vi.fn();
    generation?.addCleanup(cleanup);

    await fixture.manager.setEnabled('fixture.pi', 'project', false);
    expect(generation?.active).toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(fixture.manager.getLoadedPlugins().find(plugin => plugin.id === 'fixture.native')?.status).toBe('active');

    await fixture.manager.uninstall('fixture.pi', 'project');
    expect(fixture.manager.getLoadedPlugins().map(plugin => plugin.id)).toEqual(['fixture.native']);
  });
});

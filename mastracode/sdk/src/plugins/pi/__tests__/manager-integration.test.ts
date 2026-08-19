import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import type { ToolExecutionContext } from '@mastra/core/tools';
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
    `import { Type } from 'typebox';
     export default function (pi) {
       pi.registerCommand('pi-command', { handler: async () => {} });
       pi.registerTool({
         name: 'pi_fixture_tool',
         label: 'Pi fixture tool',
         description: 'Echoes fixture input',
         parameters: Type.Object({ value: Type.String() }),
         execute: async (_id, params) => ({ content: [{ type: 'text', text: 'echo:' + params.value }] }),
       });
     }`,
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

async function executeTool(tool: unknown, input: unknown): Promise<unknown> {
  if (!tool || typeof tool !== 'object' || !('execute' in tool) || typeof tool.execute !== 'function') {
    throw new Error('Missing executable fixture tool');
  }
  return tool.execute(input, {
    requestContext: new RequestContext(),
    observe: vi.fn(),
  } as unknown as ToolExecutionContext);
}

describe('PluginManager Pi generation integration', () => {
  it('publishes native and Pi candidates together and reuses unchanged generations', async () => {
    const fixture = createFixture();

    const first = await fixture.manager.reload();
    const native = first.find(plugin => plugin.id === 'fixture.native');
    const pi = first.find(plugin => plugin.id === 'fixture.pi');
    expect(native).toMatchObject({ status: 'active', toolNames: ['native_tool'] });
    expect(pi).toMatchObject({ status: 'active', compatibility: 'pi', toolNames: ['pi_fixture_tool'] });
    expect(pi?.piGeneration?.bound).toBe(true);
    expect(pi?.piGeneration?.registrations.commands.has('pi-command')).toBe(true);
    const piTool = fixture.manager.getPluginTools().pi_fixture_tool;
    expect(piTool && typeof piTool.execute === 'function').toBe(true);
    await expect(executeTool(piTool, { value: 'manager' })).resolves.toMatchObject({
      content: [{ type: 'text', text: 'echo:manager' }],
      isError: false,
    });

    await fixture.manager.reload();
    expect(fixture.manager.getLoadedPlugins().find(plugin => plugin.id === 'fixture.pi')?.piGeneration).toBe(
      pi?.piGeneration,
    );
  });

  it('keeps native plugin tools ahead of conflicting Pi tools and diagnoses the Pi contribution', async () => {
    const fixture = createFixture();
    fs.writeFileSync(
      path.join(fixture.nativeRoot, 'index.ts'),
      `export default { id: 'fixture.native', tools: { shared_tool: { tool: { id: 'shared_tool', description: 'native' } } } };`,
    );
    fs.writeFileSync(
      path.join(fixture.piRoot, 'index.ts'),
      `import { Type } from 'typebox';
       export default function (pi) {
         pi.registerTool({
           name: 'shared_tool',
           label: 'Pi shared tool',
           description: 'Must not replace native',
           parameters: Type.Object({}),
           execute: async () => ({ content: [{ type: 'text', text: 'pi' }] }),
         });
       }`,
    );

    const loaded = await fixture.manager.reload();
    const native = loaded.find(plugin => plugin.id === 'fixture.native');
    const pi = loaded.find(plugin => plugin.id === 'fixture.pi');

    expect(native).toMatchObject({ status: 'active', toolNames: ['shared_tool'] });
    expect(pi).toMatchObject({ status: 'active', toolNames: [], conflicts: ['shared_tool'] });
    expect(fixture.manager.getPluginTools().shared_tool?.id).toBe('shared_tool');
    expect(pi?.piCompatibility?.diagnostics).toEqual([
      expect.objectContaining({
        extensionId: 'fixture.pi:index.ts',
        message: expect.stringContaining('existing contribution wins'),
      }),
    ]);
  });

  it('retargets a stable live proxy after a Pi tool reload', async () => {
    const fixture = createFixture();
    await fixture.manager.reload();
    const proxy = fixture.manager.getPluginTools().pi_fixture_tool;
    await expect(executeTool(proxy, { value: 'before' })).resolves.toMatchObject({
      content: [{ type: 'text', text: 'echo:before' }],
    });

    fs.writeFileSync(
      path.join(fixture.piRoot, 'index.ts'),
      `import { Type } from 'typebox';
       export default function (pi) {
         pi.registerTool({
           name: 'pi_fixture_tool',
           label: 'Pi fixture tool',
           description: 'Updated fixture',
           parameters: Type.Object({ value: Type.String() }),
           execute: async (_id, params) => ({ content: [{ type: 'text', text: 'updated:' + params.value }] }),
         });
       }`,
    );
    await fixture.manager.reload();

    expect(fixture.manager.getPluginTools().pi_fixture_tool).toBe(proxy);
    await expect(executeTool(proxy, { value: 'after' })).resolves.toMatchObject({
      content: [{ type: 'text', text: 'updated:after' }],
    });
  });

  it('preserves the prior generation when Pi tool schema adaptation fails', async () => {
    const fixture = createFixture();
    const first = await fixture.manager.reload();
    const previous = first.find(plugin => plugin.id === 'fixture.pi');
    const proxy = fixture.manager.getPluginTools().pi_fixture_tool;

    fs.writeFileSync(
      path.join(fixture.piRoot, 'index.ts'),
      `export default function (pi) {
         pi.registerTool({
           name: 'pi_fixture_tool',
           description: 'Invalid candidate',
           parameters: 'not-a-schema',
           execute: async () => ({ content: [{ type: 'text', text: 'invalid' }] }),
         });
       }`,
    );
    const failed = await fixture.manager.reload();
    const retained = failed.find(plugin => plugin.id === 'fixture.pi');

    expect(retained?.piGeneration).toBe(previous?.piGeneration);
    expect(retained?.candidateError).toContain('must be a TypeBox schema object');
    expect(fixture.manager.getPluginTools().pi_fixture_tool).toBe(proxy);
    await expect(executeTool(proxy, { value: 'retained' })).resolves.toMatchObject({
      content: [{ type: 'text', text: 'echo:retained' }],
    });
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

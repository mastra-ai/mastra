import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from '../../manager.js';
import { savePluginRegistry } from '../../registry.js';
import type { PluginRegistry } from '../../types.js';
import {
  getPiExtensionAliases,
  loadPiExtensionGeneration,
  loadPiExtensionGenerations,
  resolvePiExtensionEntry,
} from '../loader.js';
import { PI_EXTENSION_NOT_INITIALIZED_ERROR, MastraPiExtensionGeneration } from '../runtime.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function writeEntry(root: string, name: string, source: string): string {
  const entryPath = path.join(root, name);
  fs.mkdirSync(path.dirname(entryPath), { recursive: true });
  fs.writeFileSync(entryPath, source);
  return entryPath;
}

describe('Pi extension loader', () => {
  it('loads async TypeScript factories through current Pi and TypeBox aliases', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-loader-'));
    tempDir = root;
    const entryPath = writeEntry(
      root,
      'extension.ts',
      `import { defineTool } from '@earendil-works/pi-coding-agent';
       import { Type } from 'typebox';
       import * as agentCore from '@earendil-works/pi-agent-core';
       import * as ai from '@earendil-works/pi-ai';
       import * as tui from '@earendil-works/pi-tui';
       export default async function (pi) {
         await Promise.resolve();
         pi.registerTool(defineTool({
           name: 'alias_probe',
           label: 'Alias probe',
           description: [typeof Type.Object, typeof agentCore, typeof ai, typeof tui].join(':'),
           parameters: Type.Object({ value: Type.String() }),
           execute: async () => ({ content: [{ type: 'text', text: 'ok' }], details: {} })
         }));
         pi.on('session_start', () => {});
       }`,
    );

    const generation = await loadPiExtensionGeneration({
      pluginId: 'fixture.current',
      entryPath,
      pluginRoot: root,
    });

    expect(generation.bound).toBe(false);
    expect(generation.registrations.tools.get('alias_probe')?.description).toBe('function:object:object:object');
    expect(generation.registrations.events.get('session_start')).toHaveLength(1);
    expect(generation.compatibility.status).toBe('pi-compatible');
  });

  it('loads JavaScript factories through legacy Pi and TypeBox aliases', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-loader-'));
    tempDir = root;
    const entryPath = writeEntry(
      root,
      'legacy.js',
      `import { defineTool } from '@mariozechner/pi-coding-agent';
       import { Type } from '@sinclair/typebox';
       import * as agentCore from '@mariozechner/pi-agent-core';
       import * as ai from '@mariozechner/pi-ai';
       import * as tui from '@mariozechner/pi-tui';
       export default function (pi) {
         pi.registerTool(defineTool({
           name: 'legacy_probe',
           label: 'Legacy probe',
           description: [typeof Type.Object, typeof agentCore, typeof ai, typeof tui].join(':'),
           parameters: Type.Object({}),
           execute: async () => ({ content: [], details: {} })
         }));
       }`,
    );

    const generation = await loadPiExtensionGeneration({
      pluginId: 'fixture.legacy',
      entryPath,
      pluginRoot: root,
    });

    expect(generation.registrations.tools.get('legacy_probe')?.description).toBe('function:object:object:object');
    expect(getPiExtensionAliases()['@mariozechner/pi-coding-agent']).toContain('shim');
  });

  it('loads multiple package-relative entries and prefers index.ts over index.js', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-loader-'));
    tempDir = root;
    fs.copyFileSync(path.join(fixtureRoot, 'current.js'), path.join(root, 'current.js'));
    fs.copyFileSync(path.join(fixtureRoot, 'second.js'), path.join(root, 'second.js'));
    writeEntry(
      root,
      'index-preference/index.js',
      `export default pi => pi.registerFlag('index-js', { type: 'string' });`,
    );
    writeEntry(
      root,
      'index-preference/index.ts',
      `export default pi => pi.registerFlag('index-ts', { type: 'string' });`,
    );

    expect(resolvePiExtensionEntry('index-preference', root)).toBe(
      fs.realpathSync(path.join(root, 'index-preference/index.ts')),
    );

    const generations = await loadPiExtensionGenerations({
      pluginId: 'fixture.multiple',
      pluginRoot: root,
      entryPaths: ['current.js', 'second.js', 'index-preference'],
    });

    expect(generations).toHaveLength(3);
    expect(generations[0]?.registrations.tools.has('current_fixture')).toBe(true);
    expect(generations[1]?.registrations.flags.has('second-fixture')).toBe(true);
    expect(generations[2]?.registrations.flags.has('index-ts')).toBe(true);
    await Promise.all(generations.map(generation => generation.invalidate()));
  });

  it('rejects non-factory exports and action calls during factory execution', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-loader-'));
    tempDir = root;
    const invalidEntry = writeEntry(root, 'invalid.ts', 'export default {};');
    await expect(
      loadPiExtensionGeneration({ pluginId: 'fixture.invalid', entryPath: invalidEntry, pluginRoot: root }),
    ).rejects.toThrow('must default export a factory function');

    const actionEntry = writeEntry(
      root,
      'action.ts',
      `export default function (pi) { pi.sendMessage({ customType: 'too-early' }); }`,
    );
    await expect(
      loadPiExtensionGeneration({ pluginId: 'fixture.action', entryPath: actionEntry, pluginRoot: root }),
    ).rejects.toThrow(PI_EXTENSION_NOT_INITIALIZED_ERROR);

    const missingExportEntry = writeEntry(
      root,
      'missing-export.ts',
      `import { SessionManager } from '@earendil-works/pi-coding-agent';
       export default function () { new SessionManager(); }`,
    );
    await expect(
      loadPiExtensionGeneration({
        pluginId: 'fixture.missing-export',
        entryPath: missingExportEntry,
        pluginRoot: root,
      }),
    ).rejects.toThrow('Pi extension "fixture.missing-export:missing-export.ts" failed');
  });

  it('binds registration-only runtimes, rejects stale contexts, and awaits isolated cleanup', async () => {
    const generation = new MastraPiExtensionGeneration('fixture.runtime', 'fixture.runtime:index.ts', '/fixture.ts');
    const api = generation.createApi();
    api.registerCommand('before-bind', { handler: async () => {} });
    expect(() => api.sendMessage({ customType: 'early' })).toThrow(PI_EXTENSION_NOT_INITIALIZED_ERROR);

    const sendMessage = vi.fn();
    const successfulCleanup = vi.fn();
    generation.addCleanup(() => Promise.reject(new Error('cleanup failure')));
    generation.addCleanup(successfulCleanup);
    generation.bind({ sendMessage });
    api.sendMessage({ customType: 'bound' });
    await generation.invalidate();

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(successfulCleanup).toHaveBeenCalledOnce();
    expect(generation.compatibility.diagnostics).toContainEqual(
      expect.objectContaining({ extensionId: 'fixture.runtime:index.ts', capability: 'cleanup' }),
    );
    expect(() => api.registerFlag('stale', { type: 'boolean' })).toThrow('context is stale');
  });

  it('serializes manager reload and preserves an active generation when a candidate fails', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-loader-'));
    tempDir = root;
    const projectRoot = path.join(root, 'project');
    const piRoot = path.join(root, 'pi');
    const entryPath = writeEntry(
      piRoot,
      'index.ts',
      `export default function (pi) { pi.registerCommand('first', { handler: async () => {} }); }`,
    );
    const registry: PluginRegistry = {
      plugins: {
        'fixture.atomic': {
          enabled: true,
          source: 'local',
          compatibility: 'pi',
          specifier: piRoot,
          path: piRoot,
          entry: 'index.ts',
        },
      },
    };
    savePluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json'), registry);
    const sendMessage = vi.fn();
    const pluginManager = new PluginManager({
      projectRoot,
      homeDir: path.join(root, 'home'),
      piRuntimeActions: () => ({ sendMessage }),
    });
    const first = await pluginManager.reload();
    const previous = first[0]?.piGeneration;
    previous?.createApi().sendMessage({ customType: 'bound-by-manager' });
    expect(sendMessage).toHaveBeenCalledOnce();

    fs.writeFileSync(entryPath, 'export default function broken(pi) {');
    const [left, right] = await Promise.all([pluginManager.reload(), pluginManager.reload()]);
    expect(left).toBe(right);
    expect(left[0]?.status).toBe('active');
    expect(left[0]?.piGeneration).toBe(previous);
    expect(left[0]?.candidateError).toBeTruthy();
    expect(previous?.active).toBe(true);

    await pluginManager.dispose();
    expect(previous?.active).toBe(false);
  });

  it('rejects lexical and symlink entry escapes from the plugin root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-loader-'));
    tempDir = root;
    const pluginRoot = path.join(root, 'plugin');
    fs.mkdirSync(pluginRoot);
    const outsideEntry = writeEntry(root, 'outside.ts', 'export default function () {};');

    await expect(
      loadPiExtensionGeneration({ pluginId: 'fixture.escape', entryPath: outsideEntry, pluginRoot }),
    ).rejects.toThrow('must be inside the plugin directory');

    const symlinkEntry = path.join(pluginRoot, 'linked.ts');
    fs.symlinkSync(outsideEntry, symlinkEntry);
    await expect(
      loadPiExtensionGeneration({ pluginId: 'fixture.symlink', entryPath: symlinkEntry, pluginRoot }),
    ).rejects.toThrow('must be inside the plugin directory');
  });
});

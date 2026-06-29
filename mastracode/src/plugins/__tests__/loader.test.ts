import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { collectActivePluginTools, loadPluginFromEntry, loadPlugins } from '../loader.js';
import type { PluginRegistry } from '../types.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function writePlugin(filePath: string, source: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
}

describe('plugin loader', () => {
  it('loads default exported TypeScript plugins and resolves tools functions', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const entryPath = path.join(tempDir, 'plugin.ts');
    writePlugin(
      entryPath,
      `export default {
        id: 'acme.loader',
        name: 'Loader Plugin',
        version: '1.0.0',
        tools: context => ({ echo_tool: { id: 'echo_tool', description: context.cwd } })
      };`,
    );

    await expect(loadPluginFromEntry(entryPath)).resolves.toMatchObject({ id: 'acme.loader', name: 'Loader Plugin' });
  });

  it('loads enabled registry records and marks disabled records inactive', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(tempDir, 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export const plugin = {
        id: 'acme.enabled',
        tools: { enabled_tool: { id: 'enabled_tool', description: 'enabled' } }
      };`,
    );

    const projectRegistry: PluginRegistry = {
      plugins: {
        'acme.enabled': {
          enabled: true,
          source: 'local',
          specifier: '../plugin',
          path: pluginDir,
          entry: 'src/index.ts',
        },
        'acme.disabled': {
          enabled: false,
          source: 'local',
          specifier: '../disabled',
          path: path.join(tempDir, 'disabled'),
          entry: 'src/index.ts',
        },
      },
    };

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry,
      globalRegistry: { plugins: {} },
    });

    expect(loaded.map(plugin => [plugin.id, plugin.status])).toEqual([
      ['acme.disabled', 'inactive'],
      ['acme.enabled', 'active'],
    ]);
    expect(loaded.find(plugin => plugin.id === 'acme.enabled')?.toolNames).toEqual(['enabled_tool']);
  });

  it('passes configured plugin option values into tools functions', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(tempDir, 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.config',
        config: {
          answerModel: { type: 'model', default: 'default-model' },
          enabled: { type: 'boolean', default: true },
          prompt: { type: 'string', default: 'default prompt' }
        },
        tools: context => ({ configured_tool: { id: 'configured_tool', description: JSON.stringify(context.config) } })
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.config': {
            enabled: true,
            source: 'local',
            specifier: '../plugin',
            path: pluginDir,
            entry: 'src/index.ts',
            config: { answerModel: 'chosen-model', enabled: false },
          },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded[0]).toMatchObject({
      id: 'acme.config',
      status: 'active',
      configValues: { answerModel: 'chosen-model', enabled: false, prompt: 'default prompt' },
    });
    expect(loaded[0]?.tools.configured_tool?.description).toContain('chosen-model');
  });

  it('surfaces load failures without throwing', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRegistry: PluginRegistry = {
      plugins: {
        broken: {
          enabled: true,
          source: 'local',
          specifier: '../broken',
          path: path.join(tempDir, 'broken'),
          entry: 'index.ts',
        },
      },
    };

    const loaded = await loadPlugins({
      projectRoot: path.join(tempDir, 'project'),
      homeDir: path.join(tempDir, 'home'),
      projectRegistry,
      globalRegistry: { plugins: {} },
    });

    expect(loaded[0]).toMatchObject({ id: 'broken', status: 'load failed' });
    expect(loaded[0]?.error).toBeTruthy();
  });

  it('marks later duplicate tool names conflicted', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const firstDir = path.join(tempDir, 'first');
    const secondDir = path.join(tempDir, 'second');
    writePlugin(path.join(firstDir, 'index.ts'), `export default { id: 'a.first', tools: { same: { id: 'same' } } };`);
    writePlugin(
      path.join(secondDir, 'index.ts'),
      `export default { id: 'b.second', tools: { same: { id: 'same' } } };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'a.first': { enabled: true, source: 'local', specifier: 'first', path: firstDir, entry: 'index.ts' },
          'b.second': { enabled: true, source: 'local', specifier: 'second', path: secondDir, entry: 'index.ts' },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded.map(plugin => [plugin.id, plugin.status])).toEqual([
      ['a.first', 'active'],
      ['b.second', 'conflicted'],
    ]);
    expect(loaded[1]?.conflicts).toEqual(['same']);
    expect(Object.keys(collectActivePluginTools(loaded))).toEqual(['same']);
    expect(collectActivePluginTools(loaded).same).toBe(loaded[0]?.tools.same);
  });
});

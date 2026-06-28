import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { PluginManager } from '../manager.js';
import { loadPluginRegistry } from '../registry.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function writePlugin(pluginDir: string, id: string, toolName: string): void {
  fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'src/index.ts'),
    `export default { id: '${id}', name: '${id}', tools: { ${toolName}: { id: '${toolName}', description: 'tool' } } };`,
  );
}

describe('PluginManager', () => {
  it('installs, lists, disables, enables, and uninstalls local plugins', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    writePlugin(pluginDir, 'acme.manager', 'manager_tool');
    const manager = new PluginManager({ projectRoot, homeDir });
    const pluginTools = manager.getPluginTools();

    await expect(manager.installLocal(pluginDir, 'project')).resolves.toBe('acme.manager');
    expect(await manager.listPlugins()).toMatchObject([
      { id: 'acme.manager', scope: 'project', status: 'active', toolNames: ['manager_tool'] },
    ]);
    expect(manager.getPluginTools()).toBe(pluginTools);
    expect(Object.keys(pluginTools)).toEqual(['manager_tool']);

    await manager.setEnabled('acme.manager', 'project', false);
    expect(manager.getPluginTools()).toBe(pluginTools);
    expect(Object.keys(pluginTools)).toEqual([]);
    expect((await manager.listPlugins())[0]?.status).toBe('inactive');
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.manager']?.enabled,
    ).toBe(false);

    await manager.setEnabled('acme.manager', 'project', true);
    expect(manager.getPluginTools()).toBe(pluginTools);
    expect(Object.keys(pluginTools)).toEqual(['manager_tool']);
    expect((await manager.listPlugins())[0]?.status).toBe('active');

    await manager.uninstall('acme.manager', 'project');
    expect(await manager.listPlugins()).toEqual([]);
    expect(fs.existsSync(pluginDir)).toBe(true);
  });

  it('removes GitHub checkout directories when uninstalling GitHub plugins', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool');
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.github': {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/plugin',
            path: 'sources/github/acme-plugin',
            entry: 'src/index.ts',
          },
        },
      }),
    );

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.uninstall('acme.github', 'project');

    expect(fs.existsSync(checkoutDir)).toBe(false);
  });
});

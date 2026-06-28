import fs from 'node:fs';
import path from 'node:path';

import { discoverLocalPlugins, installGithubPlugin, installLocalPlugin } from './install.js';
import type { InstallPluginOptions } from './install.js';
import { collectActivePluginTools, loadPlugins, resolvePluginEntryPath } from './loader.js';
import { getPluginScopePaths } from './paths.js';
import type { PluginPathOptions } from './paths.js';
import { loadPluginRegistry, removePluginRecord, savePluginRegistry, setPluginRecord } from './registry.js';
import type { LoadedPlugin, PluginScope } from './types.js';

export class PluginManager {
  private loadedPlugins: LoadedPlugin[] = [];
  private readonly pluginTools: ReturnType<typeof collectActivePluginTools> = {};
  private readonly watchedLocalEntries = new Set<string>();
  private reloadInFlight: Promise<LoadedPlugin[]> | undefined;

  constructor(private readonly options: PluginPathOptions) {}

  async reload(): Promise<LoadedPlugin[]> {
    if (this.reloadInFlight) return this.reloadInFlight;

    this.reloadInFlight = (async () => {
      this.loadedPlugins = await loadPlugins(this.options);
      this.updateLocalEntryWatchers(this.loadedPlugins);
      const nextTools = collectActivePluginTools(this.loadedPlugins);
      for (const name of Object.keys(this.pluginTools)) {
        delete this.pluginTools[name];
      }
      Object.assign(this.pluginTools, nextTools);
      return this.loadedPlugins;
    })().finally(() => {
      this.reloadInFlight = undefined;
    });

    return this.reloadInFlight;
  }

  async listPlugins(): Promise<LoadedPlugin[]> {
    if (this.loadedPlugins.length === 0) {
      await this.reload();
    }
    return this.loadedPlugins;
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return this.loadedPlugins;
  }

  getPluginTools() {
    return this.pluginTools;
  }

  getToolRenderConfig(toolName: string) {
    return this.pluginTools[toolName]?.mastracode?.render;
  }

  private updateLocalEntryWatchers(plugins: LoadedPlugin[]): void {
    const nextEntries = new Set<string>();
    for (const plugin of plugins) {
      if (plugin.source !== 'local' || plugin.status === 'inactive') continue;
      const entryPath = resolvePluginEntryPath(plugin, this.options);
      nextEntries.add(entryPath);
      if (this.watchedLocalEntries.has(entryPath)) continue;

      const watcher = fs.watchFile(entryPath, { interval: 500 }, (current, previous) => {
        if (current.mtimeMs === previous.mtimeMs) return;
        void this.reload().catch(() => undefined);
      });
      watcher.unref?.();
      this.watchedLocalEntries.add(entryPath);
    }

    for (const entryPath of this.watchedLocalEntries) {
      if (nextEntries.has(entryPath)) continue;
      fs.unwatchFile(entryPath);
      this.watchedLocalEntries.delete(entryPath);
    }
  }

  discoverLocal(searchRoot = '.'): ReturnType<typeof discoverLocalPlugins> {
    return discoverLocalPlugins(searchRoot, this.options);
  }

  async installLocal(
    localPath: string,
    scope: PluginScope,
    options: Pick<InstallPluginOptions, 'entry'> = {},
  ): Promise<string> {
    const id = await installLocalPlugin(localPath, scope, { ...this.options, ...options });
    await this.reload();
    return id;
  }

  async installGithub(
    url: string,
    scope: PluginScope,
    options: Pick<InstallPluginOptions, 'entry' | 'ref'> = {},
  ): Promise<string> {
    const id = await installGithubPlugin(url, scope, { ...this.options, ...options });
    await this.reload();
    return id;
  }

  async setEnabled(pluginId: string, scope: PluginScope, enabled: boolean): Promise<void> {
    const paths = getPluginScopePaths(scope, this.options);
    const registry = loadPluginRegistry(paths.registryPath);
    const record = registry.plugins[pluginId];
    if (!record) {
      throw new Error(`Plugin "${pluginId}" is not installed in ${scope} scope`);
    }
    savePluginRegistry(paths.registryPath, setPluginRecord(registry, pluginId, { ...record, enabled }));
    await this.reload();
  }

  async uninstall(pluginId: string, scope: PluginScope): Promise<void> {
    const paths = getPluginScopePaths(scope, this.options);
    const registry = loadPluginRegistry(paths.registryPath);
    const record = registry.plugins[pluginId];
    if (!record) {
      throw new Error(`Plugin "${pluginId}" is not installed in ${scope} scope`);
    }

    savePluginRegistry(paths.registryPath, removePluginRecord(registry, pluginId));
    if (record.source === 'github') {
      const checkoutPath = path.isAbsolute(record.path) ? record.path : path.join(paths.root, record.path);
      fs.rmSync(checkoutPath, { recursive: true, force: true });
    }
    await this.reload();
  }
}

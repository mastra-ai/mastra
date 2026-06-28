import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

import { discoverLocalPlugins, installGithubPlugin, installLocalPlugin } from './install.js';
import type { InstallPluginOptions } from './install.js';
import { collectActivePluginTools, loadPlugins, resolvePluginEntryPath } from './loader.js';
import { getPluginScopePaths } from './paths.js';
import type { PluginPathOptions } from './paths.js';
import { loadPluginRegistry, removePluginRecord, savePluginRegistry, setPluginRecord } from './registry.js';
import type { LoadedPlugin, PluginScope } from './types.js';

const GITHUB_PLUGIN_POLL_INTERVAL_MS = 60_000;

function getEntryVersion(entryPath: string): string {
  const stat = fs.statSync(entryPath, { bigint: true });
  return `${stat.mtimeNs}:${stat.size}`;
}

export class PluginManager {
  private loadedPlugins: LoadedPlugin[] = [];
  private readonly pluginTools: ReturnType<typeof collectActivePluginTools> = {};
  private readonly rawPluginTools: ReturnType<typeof collectActivePluginTools> = {};
  private readonly watchedLocalEntries = new Set<string>();
  private readonly localEntryVersions = new Map<string, string>();
  private githubPollTimer: ReturnType<typeof setInterval> | undefined;
  private githubPollInFlight: Promise<boolean> | undefined;
  private reloadInFlight: Promise<LoadedPlugin[]> | undefined;

  constructor(private readonly options: PluginPathOptions) {}

  async reload(): Promise<LoadedPlugin[]> {
    if (this.reloadInFlight) return this.reloadInFlight;

    this.reloadInFlight = (async () => {
      this.loadedPlugins = await loadPlugins(this.options);
      this.updateLocalEntryWatchers(this.loadedPlugins);
      this.updateGithubPoller(this.loadedPlugins);
      this.updatePluginTools(collectActivePluginTools(this.loadedPlugins));
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

  private updatePluginTools(nextTools: ReturnType<typeof collectActivePluginTools>): void {
    for (const name of Object.keys(this.rawPluginTools)) {
      if (!(name in nextTools)) {
        delete this.rawPluginTools[name];
        delete this.pluginTools[name];
      }
    }

    for (const [name, tool] of Object.entries(nextTools)) {
      this.rawPluginTools[name] = tool;
      if (!this.pluginTools[name]) {
        this.pluginTools[name] = this.createLiveToolProxy(name);
      }
      this.syncLiveToolProxy(name, tool);
    }
  }

  private createLiveToolProxy(toolName: string) {
    return {
      execute: async (...args: any[]) => {
        await this.reloadChangedLocalPlugins();
        const latestTool = this.rawPluginTools[toolName];
        if (!latestTool?.execute) {
          throw new Error(`Plugin tool "${toolName}" is no longer available`);
        }
        return (latestTool.execute as (...args: any[]) => unknown)(...args);
      },
    } as LoadedPlugin['tools'][string];
  }

  private syncLiveToolProxy(toolName: string, tool: LoadedPlugin['tools'][string]): void {
    const proxy = this.pluginTools[toolName];
    if (!proxy) return;
    const mutableProxy = proxy as unknown as Record<string, unknown>;
    for (const key of Object.keys(mutableProxy)) {
      delete mutableProxy[key];
    }
    Object.assign(proxy, tool);
    proxy.execute = this.createLiveToolProxy(toolName).execute;
  }

  private async reloadChangedLocalPlugins(): Promise<void> {
    for (const plugin of this.loadedPlugins) {
      if (plugin.source !== 'local' || plugin.status !== 'active') continue;
      const entryPath = resolvePluginEntryPath(plugin, this.options);
      const currentVersion = getEntryVersion(entryPath);
      if (this.localEntryVersions.get(entryPath) !== currentVersion) {
        await this.reload();
        return;
      }
    }
  }

  private updateLocalEntryWatchers(plugins: LoadedPlugin[]): void {
    const nextEntries = new Set<string>();
    for (const plugin of plugins) {
      if (plugin.source !== 'local' || plugin.status === 'inactive') continue;
      const entryPath = resolvePluginEntryPath(plugin, this.options);
      nextEntries.add(entryPath);
      this.localEntryVersions.set(entryPath, getEntryVersion(entryPath));
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
      this.localEntryVersions.delete(entryPath);
    }
  }

  private updateGithubPoller(plugins: LoadedPlugin[]): void {
    const hasGithubPlugin = plugins.some(plugin => plugin.source === 'github' && plugin.enabled);
    if (hasGithubPlugin && !this.githubPollTimer) {
      this.githubPollTimer = setInterval(() => {
        void this.pollGithubSourcesForUpdates().catch(() => undefined);
      }, GITHUB_PLUGIN_POLL_INTERVAL_MS);
      this.githubPollTimer.unref?.();
    }
    if (!hasGithubPlugin && this.githubPollTimer) {
      clearInterval(this.githubPollTimer);
      this.githubPollTimer = undefined;
    }
  }

  async pollGithubSourcesForUpdates(): Promise<boolean> {
    if (this.githubPollInFlight) return this.githubPollInFlight;
    this.githubPollInFlight = this.pollGithubSourcesForUpdatesOnce().finally(() => {
      this.githubPollInFlight = undefined;
    });
    return this.githubPollInFlight;
  }

  private async pollGithubSourcesForUpdatesOnce(): Promise<boolean> {
    let changed = false;
    const seen = new Set<string>();
    for (const plugin of this.loadedPlugins) {
      if (plugin.source !== 'github' || plugin.status === 'inactive') continue;
      const checkoutPath = this.resolvePluginSourcePath(plugin);
      if (seen.has(checkoutPath) || !fs.existsSync(path.join(checkoutPath, '.git'))) continue;
      seen.add(checkoutPath);

      const before = await this.readGitHead(checkoutPath);
      await execa('git', ['pull', '--ff-only'], { cwd: checkoutPath });
      const after = await this.readGitHead(checkoutPath);
      if (before !== after) changed = true;
    }

    if (changed) {
      await this.reload();
    }
    return changed;
  }

  private resolvePluginSourcePath(plugin: LoadedPlugin): string {
    const paths = getPluginScopePaths(plugin.scope, this.options);
    return path.isAbsolute(plugin.path) ? plugin.path : path.join(paths.root, plugin.path);
  }

  private async readGitHead(cwd: string): Promise<string> {
    const { stdout } = await execa('git', ['rev-parse', 'HEAD'], { cwd });
    return stdout.trim();
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

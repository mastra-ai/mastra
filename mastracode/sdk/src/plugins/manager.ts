import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

import type { MastraCodePluginConfigValue } from '../plugin.js';
import { getEntryPackageRoot, installPluginDependenciesForEntry } from './dependencies.js';
import { discoverLocalPlugins, installGithubPlugin, installLocalPlugin, NON_INTERACTIVE_GIT_ENV } from './install.js';
import type { InstallPluginOptions } from './install.js';
import { collectActivePluginTools, isInsideDirectory, loadPlugins, resolvePluginEntryPath } from './loader.js';
import { ensureMastraCodePackageLink } from './package-link.js';
import { getPluginScopePaths } from './paths.js';
import type { PluginPathOptions } from './paths.js';
import { loadPluginRegistry, removePluginRecord, savePluginRegistry, setPluginRecord } from './registry.js';
import type { LoadedPlugin, PluginScope } from './types.js';

const GITHUB_PLUGIN_POLL_INTERVAL_MS = 60_000;

function gitExecOptions(cwd: string) {
  return { cwd, env: NON_INTERACTIVE_GIT_ENV };
}

function getEntryVersion(entryPath: string): string {
  const stat = fs.statSync(entryPath, { bigint: true });
  return `${stat.mtimeNs}:${stat.size}`;
}

type PluginManagerOptions = PluginPathOptions & {
  githubCliPath?: string;
};

export class PluginManager {
  private loadedPlugins: LoadedPlugin[] = [];
  private readonly pluginTools: ReturnType<typeof collectActivePluginTools> = {};
  private readonly rawPluginTools: ReturnType<typeof collectActivePluginTools> = {};
  private readonly toolRenderConfigs = new Map<string, NonNullable<LoadedPlugin['renderConfigs']>[string]>();
  private readonly watchedLocalEntries = new Set<string>();
  private readonly localEntryVersions = new Map<string, string>();
  private githubPollTimer: ReturnType<typeof setInterval> | undefined;
  private githubPollInFlight: Promise<boolean> | undefined;
  private reloadInFlight: Promise<LoadedPlugin[]> | undefined;
  private readonly reloadListeners = new Set<(plugins: LoadedPlugin[]) => void | Promise<void>>();
  private readonly githubUpdateListeners = new Set<(pluginNames: string[]) => void | Promise<void>>();

  constructor(private readonly options: PluginManagerOptions) {}

  onReload(listener: (plugins: LoadedPlugin[]) => void | Promise<void>): () => void {
    this.reloadListeners.add(listener);
    return () => this.reloadListeners.delete(listener);
  }

  /** Notified with the display names of GitHub plugins that were updated by the background poll. */
  onGithubPluginsUpdated(listener: (pluginNames: string[]) => void | Promise<void>): () => void {
    this.githubUpdateListeners.add(listener);
    return () => this.githubUpdateListeners.delete(listener);
  }

  async reload(): Promise<LoadedPlugin[]> {
    if (this.reloadInFlight) return this.reloadInFlight;

    this.reloadInFlight = (async () => {
      this.loadedPlugins = await loadPlugins(this.options);
      this.updateLocalEntryWatchers(this.loadedPlugins);
      this.updateGithubPoller(this.loadedPlugins);
      this.updatePluginRenderConfigs(this.loadedPlugins);
      this.updatePluginTools(collectActivePluginTools(this.loadedPlugins));
      await this.notifyReloadListeners(this.loadedPlugins);
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
    return this.toolRenderConfigs.get(toolName);
  }

  getPluginSkillPaths(): string[] {
    return this.loadedPlugins.flatMap(plugin => (plugin.status === 'active' ? (plugin.skillPaths ?? []) : []));
  }

  getPluginCommandPaths(): string[] {
    return this.loadedPlugins.flatMap(plugin => (plugin.status === 'active' ? (plugin.commandPaths ?? []) : []));
  }

  getPluginInstructions(): string[] {
    return this.loadedPlugins.flatMap(plugin =>
      plugin.status === 'active' && plugin.instructions ? [plugin.instructions] : [],
    );
  }

  private async notifyReloadListeners(plugins: LoadedPlugin[]): Promise<void> {
    await Promise.all([...this.reloadListeners].map(listener => Promise.resolve(listener(plugins))));
  }

  private updatePluginRenderConfigs(plugins: LoadedPlugin[]): void {
    this.toolRenderConfigs.clear();
    for (const plugin of plugins) {
      if (plugin.status !== 'active') continue;
      for (const [toolName, renderConfig] of Object.entries(plugin.renderConfigs ?? {})) {
        if (!this.toolRenderConfigs.has(toolName)) {
          this.toolRenderConfigs.set(toolName, renderConfig);
        }
      }
    }
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
      if (plugin.source !== 'local' || plugin.status !== 'active') continue;
      let entryPath: string;
      let entryVersion: string;
      try {
        entryPath = resolvePluginEntryPath(plugin, this.options);
        entryVersion = getEntryVersion(entryPath);
      } catch {
        continue;
      }
      nextEntries.add(entryPath);
      this.localEntryVersions.set(entryPath, entryVersion);
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
    const hasGithubPlugin = plugins.some(
      plugin => plugin.source === 'github' && plugin.status !== 'inactive' && plugin.status !== 'blocked',
    );
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
    const changedCheckouts = new Set<string>();
    const seen = new Set<string>();
    for (const plugin of this.loadedPlugins) {
      if (plugin.source !== 'github' || plugin.status === 'inactive' || plugin.status === 'blocked') continue;
      const checkoutPath = this.resolvePluginSourcePath(plugin);
      if (seen.has(checkoutPath) || !fs.existsSync(path.join(checkoutPath, '.git'))) continue;
      seen.add(checkoutPath);

      const before = await this.readGitHead(checkoutPath);
      const checkoutChanged = await this.refreshGithubCheckout(plugin, checkoutPath, before);
      const after = await this.readGitHead(checkoutPath);
      if (checkoutChanged || before !== after) changedCheckouts.add(checkoutPath);
    }

    if (changedCheckouts.size === 0) return false;

    // Multiple plugins can share one checkout — report every plugin whose source changed.
    const updatedPluginNames = this.loadedPlugins
      .filter(
        plugin =>
          plugin.source === 'github' &&
          plugin.status !== 'inactive' &&
          plugin.status !== 'blocked' &&
          changedCheckouts.has(this.resolvePluginSourcePath(plugin)),
      )
      .map(plugin => plugin.name ?? plugin.id);
    await this.reload();
    await this.notifyGithubUpdateListeners(updatedPluginNames);
    return true;
  }

  private async notifyGithubUpdateListeners(pluginNames: string[]): Promise<void> {
    await Promise.all([...this.githubUpdateListeners].map(listener => Promise.resolve(listener(pluginNames))));
  }

  private async refreshGithubCheckout(
    plugin: LoadedPlugin,
    checkoutPath: string,
    currentHead: string,
  ): Promise<boolean> {
    await execa('git', ['fetch', 'origin'], gitExecOptions(checkoutPath));
    const upstream = await this.resolveGitUpstream(checkoutPath, plugin.ref);
    if (!upstream) return false;
    const [localOnly, remoteOnly] = await this.readGitAheadBehind(checkoutPath, upstream);
    const hasLocalChanges = await this.hasGitWorkingTreeChanges(checkoutPath);

    if (localOnly > 0 || hasLocalChanges) {
      await this.backupGitCheckout(checkoutPath, currentHead, hasLocalChanges);
    }

    if (remoteOnly > 0 || localOnly > 0 || hasLocalChanges) {
      await execa('git', ['reset', '--hard', upstream], gitExecOptions(checkoutPath));
      try {
        await installPluginDependenciesForEntry(checkoutPath, plugin.entry);
        ensureMastraCodePackageLink(getEntryPackageRoot(checkoutPath, plugin.entry));
      } catch (error) {
        await execa('git', ['reset', '--hard', currentHead], gitExecOptions(checkoutPath));
        throw error;
      }
      return true;
    }

    return false;
  }

  private async backupGitCheckout(
    checkoutPath: string,
    currentHead: string,
    includeWorkingTree: boolean,
  ): Promise<void> {
    const backupBranch = this.createGitBackupBranchName(currentHead);

    if (includeWorkingTree) {
      const currentBranch = await this.readGitCurrentBranch(checkoutPath);
      await execa('git', ['switch', '-c', backupBranch], gitExecOptions(checkoutPath));
      await execa('git', ['add', '-A'], gitExecOptions(checkoutPath));
      const hasStagedChanges = await this.hasGitStagedChanges(checkoutPath);
      if (hasStagedChanges) {
        await execa(
          'git',
          [
            '-c',
            'user.name=Mastra Code',
            '-c',
            'user.email=noreply@mastra.ai',
            'commit',
            '-m',
            'chore: backup local plugin checkout changes',
          ],
          gitExecOptions(checkoutPath),
        );
      }
      await this.restoreGitCheckout(checkoutPath, currentBranch, currentHead);
      return;
    }

    await execa('git', ['branch', backupBranch, 'HEAD'], gitExecOptions(checkoutPath));
  }

  private async resolveGitUpstream(cwd: string, installedRef?: string): Promise<string | undefined> {
    try {
      const { stdout } = await execa(
        'git',
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        gitExecOptions(cwd),
      );
      return stdout.trim();
    } catch {
      return installedRef ? undefined : 'origin/main';
    }
  }

  private async readGitAheadBehind(cwd: string, upstream: string): Promise<[number, number]> {
    const { stdout } = await execa(
      'git',
      ['rev-list', '--left-right', '--count', `HEAD...${upstream}`],
      gitExecOptions(cwd),
    );
    const [ahead = '0', behind = '0'] = stdout.trim().split(/\s+/);
    return [Number(ahead) || 0, Number(behind) || 0];
  }

  private async hasGitWorkingTreeChanges(cwd: string): Promise<boolean> {
    const { stdout } = await execa('git', ['status', '--porcelain'], gitExecOptions(cwd));
    return stdout.trim().length > 0;
  }

  private async hasGitStagedChanges(cwd: string): Promise<boolean> {
    try {
      await execa('git', ['diff', '--cached', '--quiet'], gitExecOptions(cwd));
      return false;
    } catch {
      return true;
    }
  }

  private async restoreGitCheckout(cwd: string, branch: string | undefined, fallbackHead: string): Promise<void> {
    if (branch) {
      await execa('git', ['switch', branch], gitExecOptions(cwd));
      return;
    }
    await execa('git', ['checkout', fallbackHead], gitExecOptions(cwd));
  }

  private async readGitCurrentBranch(cwd: string): Promise<string | undefined> {
    const { stdout } = await execa('git', ['branch', '--show-current'], gitExecOptions(cwd));
    const branch = stdout.trim();
    return branch.length > 0 ? branch : undefined;
  }

  private createGitBackupBranchName(currentHead: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `mastracode/plugin-backup/${timestamp}-${currentHead.slice(0, 8)}`;
  }

  private resolvePluginSourcePath(plugin: LoadedPlugin): string {
    const paths = getPluginScopePaths(plugin.scope, this.options);
    return path.isAbsolute(plugin.path) ? plugin.path : path.join(paths.root, plugin.path);
  }

  private async readGitHead(cwd: string): Promise<string> {
    const { stdout } = await execa('git', ['rev-parse', 'HEAD'], gitExecOptions(cwd));
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
    options: Pick<InstallPluginOptions, 'entry' | 'ref' | 'onOutput' | 'signal'> = {},
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

  async setConfigValue(
    pluginId: string,
    scope: PluginScope,
    key: string,
    value: MastraCodePluginConfigValue,
  ): Promise<void> {
    const paths = getPluginScopePaths(scope, this.options);
    const registry = loadPluginRegistry(paths.registryPath);
    const record = registry.plugins[pluginId];
    if (!record) {
      throw new Error(`Plugin "${pluginId}" is not installed in ${scope} scope`);
    }
    const config = { ...(record.config ?? {}) };
    if (value === undefined || value === '') {
      delete config[key];
    } else {
      config[key] = value;
    }
    const nextRecord = { ...record, config: Object.keys(config).length > 0 ? config : undefined };
    savePluginRegistry(paths.registryPath, setPluginRecord(registry, pluginId, nextRecord));
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
      const checkoutPath = path.resolve(
        path.isAbsolute(record.path) ? record.path : path.join(paths.root, record.path),
      );
      const githubSourcesPath = path.resolve(paths.sourcesPath, 'github');
      if (isInsideDirectory(checkoutPath, githubSourcesPath)) {
        fs.rmSync(checkoutPath, { recursive: true, force: true });
      }
    }
    await this.reload();
  }
}

import fs from 'node:fs';
import path from 'node:path';

import type { SignalProvider } from '@mastra/core/signals';
import { execa } from 'execa';

import type { MastraCodePluginConfigValue, MastraCodePluginRuntime } from '../plugin.js';
import { getEntryPackageRoot, installPluginDependenciesForEntry } from './dependencies.js';
import { discoverLocalPlugins, installGithubPlugin, installLocalPlugin, NON_INTERACTIVE_GIT_ENV } from './install.js';
import type { InstallPluginOptions } from './install.js';
import { collectActivePluginTools, isInsideDirectory, loadPlugins, resolvePluginEntryPath } from './loader.js';
import { ensureMastraCodePackageLink } from './package-link.js';
import { getPluginScopePaths } from './paths.js';
import type { PluginPathOptions } from './paths.js';
import { PiCommandAdapter } from './pi/command-adapter.js';
import type { PiCommandDispatchOptions, PiOwnedCommand } from './pi/command-adapter.js';
import {
  characterizePiPackage as characterizePreparedPiPackage,
  createPiPackageRecord,
  preparePiPackage as resolvePiPackageForIntake,
} from './pi/package-intake.js';
import type {
  CharacterizedPiPackage,
  PiPackageCharacterizationOptions,
  PreparedPiPackageInspection,
} from './pi/package-intake.js';
import type { ResolvePiPackageOptions } from './pi/package-resolver.js';
import type { PiExtensionGeneration, PiRuntimeActions } from './pi/types.js';
import { bindPiUiHost } from './pi/ui-adapter.js';
import type { PiUiHost } from './pi/ui-adapter.js';
import { loadPluginRegistry, removePluginRecord, savePluginRegistry, setPluginRecord } from './registry.js';
import type {
  InstalledPluginRecord,
  LoadedPlugin,
  PluginContribution,
  PluginProcessorEntries,
  PluginRegistry,
  PluginScope,
} from './types.js';

const GITHUB_PLUGIN_POLL_INTERVAL_MS = 60_000;

function gitExecOptions(cwd: string) {
  return { cwd, env: NON_INTERACTIVE_GIT_ENV };
}

function getEntryVersion(entryPath: string): string {
  const stat = fs.statSync(entryPath, { bigint: true });
  return `${stat.mtimeNs}:${stat.size}`;
}

function getCommandNames(commandPaths: readonly string[]): string[] {
  return commandPaths.flatMap(commandPath => {
    try {
      return fs
        .readdirSync(commandPath, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.basename(entry.name, path.extname(entry.name)));
    } catch {
      return [];
    }
  });
}

type PluginManagerOptions = PluginPathOptions & {
  githubCliPath?: string;
  /**
   * Lazy accessors for Mastra Code's runtime, handed to plugin field resolvers on
   * every load and reload.
   */
  runtime?: MastraCodePluginRuntime;
  piRuntimeActions?: (generation: PiExtensionGeneration) => PiRuntimeActions;
};

export class PluginManager {
  private loadedPlugins: LoadedPlugin[] = [];
  private readonly pluginTools: ReturnType<typeof collectActivePluginTools> = {};
  private readonly rawPluginTools: ReturnType<typeof collectActivePluginTools> = {};
  private readonly toolRenderConfigs = new Map<string, NonNullable<LoadedPlugin['renderConfigs']>[string]>();
  private readonly piCommands = new PiCommandAdapter();
  private piCommandReservedNames: string[] = [];
  private piUiHost: PiUiHost | undefined;
  private readonly piUiCleanups = new Map<PiExtensionGeneration, () => Promise<void>>();
  private readonly watchedLocalEntries = new Set<string>();
  private readonly localEntryVersions = new Map<string, string>();
  /** Last known git HEAD per GitHub checkout, kept current by the poller. */
  private readonly githubCheckoutHeads = new Map<string, string>();
  private githubPollTimer: ReturnType<typeof setInterval> | undefined;
  private githubPollInFlight: Promise<boolean> | undefined;
  private reloadInFlight: Promise<LoadedPlugin[]> | undefined;
  private pluginMutationTail: Promise<void> = Promise.resolve();
  private readonly reloadListeners = new Set<(plugins: LoadedPlugin[]) => void | Promise<void>>();
  private readonly piGenerationListeners = new Set<(generations: PiExtensionGeneration[]) => void | Promise<void>>();
  private readonly githubUpdateListeners = new Set<(pluginNames: string[]) => void | Promise<void>>();
  private runtime: MastraCodePluginRuntime | undefined;
  private piRuntimeActions: ((generation: PiExtensionGeneration) => PiRuntimeActions) | undefined;
  private runtimeGeneration = 0;
  private loadedRuntimeGeneration = 0;

  constructor(private readonly options: PluginManagerOptions) {
    this.runtime = options.runtime;
    this.piRuntimeActions = options.piRuntimeActions;
  }

  /**
   * Publish (or replace) the runtime accessors handed to plugin field resolvers.
   * Takes effect on the next load or reload. `createMastraCode` calls this for
   * every manager it uses — including an injected one — so a manager constructed
   * without a runtime still exposes `getController`/`getActiveSession` to plugins.
   * A manager shared across controllers sees the most recent controller's accessors.
   */
  setRuntime(runtime: MastraCodePluginRuntime): void {
    if (this.runtime !== runtime) this.runtimeGeneration += 1;
    this.runtime = runtime;
  }

  setPiRuntimeActions(actions: (generation: PiExtensionGeneration) => PiRuntimeActions): void {
    this.piRuntimeActions = actions;
    this.runtimeGeneration += 1;
  }

  onReload(listener: (plugins: LoadedPlugin[]) => void | Promise<void>): () => void {
    this.reloadListeners.add(listener);
    return () => this.reloadListeners.delete(listener);
  }

  onPiGenerationsReconcile(listener: (generations: PiExtensionGeneration[]) => void | Promise<void>): () => void {
    this.piGenerationListeners.add(listener);
    return () => this.piGenerationListeners.delete(listener);
  }

  /** Notified with the display names of GitHub plugins that were updated by the background poll. */
  onGithubPluginsUpdated(listener: (pluginNames: string[]) => void | Promise<void>): () => void {
    this.githubUpdateListeners.add(listener);
    return () => this.githubUpdateListeners.delete(listener);
  }

  async reload(): Promise<LoadedPlugin[]> {
    await this.pluginMutationTail;
    return this.reloadRegistry();
  }

  private async reloadRegistry(override?: { scope: PluginScope; registry: PluginRegistry }): Promise<LoadedPlugin[]> {
    if (this.reloadInFlight) return this.reloadInFlight;

    this.reloadInFlight = (async () => {
      const candidates = await loadPlugins({
        ...this.options,
        runtime: this.runtime,
        ...(override?.scope === 'global' ? { globalRegistry: override.registry } : {}),
        ...(override?.scope === 'project' ? { projectRegistry: override.registry } : {}),
      });
      await this.stampLoadedPlugins(candidates);
      const { plugins, retiredGenerations, newGenerations } = this.reconcilePiGenerations(
        candidates,
        this.runtimeGeneration === this.loadedRuntimeGeneration,
      );
      const actionsByGeneration = new Map<PiExtensionGeneration, PiRuntimeActions | undefined>();
      try {
        for (const generation of newGenerations) {
          actionsByGeneration.set(generation, this.piRuntimeActions?.(generation));
        }
        for (const generation of newGenerations) {
          await generation.bind(actionsByGeneration.get(generation));
          this.bindPiGenerationUi(generation);
        }
      } catch (error) {
        const candidateGenerations = candidates.flatMap(plugin => (plugin.piGeneration ? [plugin.piGeneration] : []));
        await Promise.all(candidateGenerations.map(generation => generation.invalidate()));
        for (const generation of candidateGenerations) this.piUiCleanups.delete(generation);
        throw error;
      }
      const previousGenerations = this.getPiGenerations();
      try {
        await this.notifyPiGenerationListeners(
          plugins.flatMap(plugin => (plugin.piGeneration ? [plugin.piGeneration] : [])),
        );
      } catch (error) {
        await Promise.all(newGenerations.map(generation => generation.invalidate()));
        for (const generation of newGenerations) this.piUiCleanups.delete(generation);
        await this.notifyPiGenerationListeners(previousGenerations).catch(() => undefined);
        throw error;
      }
      const nativeCommandNames = getCommandNames(
        plugins.filter(plugin => !plugin.piGeneration).flatMap(plugin => plugin.commandPaths ?? []),
      );
      this.piCommands.setGenerations(
        plugins.flatMap(plugin => (plugin.piGeneration ? [plugin.piGeneration] : [])),
        [...this.piCommandReservedNames, ...nativeCommandNames],
      );
      await Promise.all(retiredGenerations.map(generation => generation.invalidate()));
      for (const generation of retiredGenerations) this.piUiCleanups.delete(generation);
      this.loadedPlugins = plugins;
      this.loadedRuntimeGeneration = this.runtimeGeneration;
      this.updateLocalEntryWatchers(plugins);
      this.updateGithubPoller(plugins);
      this.updatePluginRenderConfigs(plugins);
      this.updatePluginTools(collectActivePluginTools(plugins));
      await this.notifyReloadListeners(plugins);
      return plugins;
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

  getPiCommands(): PiOwnedCommand[] {
    return this.piCommands.list();
  }

  setPiCommandReservedNames(names: readonly string[]): void {
    this.piCommandReservedNames = [...new Set(names)];
    const nativeCommandNames = getCommandNames(
      this.loadedPlugins.filter(plugin => !plugin.piGeneration).flatMap(plugin => plugin.commandPaths ?? []),
    );
    this.piCommands.setGenerations(this.getPiGenerations(), [...this.piCommandReservedNames, ...nativeCommandNames]);
  }

  async dispatchPiCommand(name: string, args = '', options: PiCommandDispatchOptions = {}): Promise<unknown> {
    return this.piCommands.dispatch(name, args, options);
  }

  async setPiUiHost(host: PiUiHost | undefined): Promise<void> {
    if (this.reloadInFlight) await this.reloadInFlight;
    const cleanups = [...this.piUiCleanups.values()];
    this.piUiCleanups.clear();
    this.piUiHost = host;
    await Promise.allSettled(cleanups.map(cleanup => cleanup()));
    if (!host) return;
    for (const generation of this.getPiGenerations()) this.bindPiGenerationUi(generation);
  }

  async stopPiExtensions(message?: string): Promise<void> {
    const generations = this.loadedPlugins.flatMap(plugin => (plugin.piGeneration ? [plugin.piGeneration] : []));
    await Promise.all(generations.map(generation => generation.invalidate(message)));
    for (const generation of generations) this.piUiCleanups.delete(generation);
  }

  async dispose(): Promise<void> {
    await this.pluginMutationTail;
    if (this.reloadInFlight) await this.reloadInFlight;
    for (const entryPath of this.watchedLocalEntries) fs.unwatchFile(entryPath);
    this.watchedLocalEntries.clear();
    this.localEntryVersions.clear();
    if (this.githubPollTimer) clearInterval(this.githubPollTimer);
    this.githubPollTimer = undefined;
    await this.stopPiExtensions();
    this.loadedPlugins = [];
    this.piCommands.setGenerations([]);
    this.updatePluginRenderConfigs([]);
    this.updatePluginTools({});
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

  /**
   * Processors contributed by active plugins, tagged with the plugin that owns
   * each one. Reads already-resolved state — no filesystem access — because the
   * agent's processor lanes call this before every request.
   */
  getPluginProcessors(): PluginProcessorEntries {
    return {
      input: this.collectActive(plugin => plugin.processors?.input ?? []),
      output: this.collectActive(plugin => plugin.processors?.output ?? []),
    };
  }

  /** Signal providers contributed by active plugins, tagged with their owning plugin. */
  getPluginSignalProviders(): PluginContribution<SignalProvider<string>>[] {
    return this.collectActive(plugin => plugin.signalProviders ?? []);
  }

  /** Active Pi generations for controller/session event adapters. */
  getPiGenerations(): PiExtensionGeneration[] {
    return this.loadedPlugins.flatMap(plugin =>
      plugin.status === 'active' && plugin.piGeneration?.active ? [plugin.piGeneration] : [],
    );
  }

  private bindPiGenerationUi(generation: PiExtensionGeneration): void {
    if (!this.piUiHost || this.piUiCleanups.has(generation)) return;
    this.piUiCleanups.set(generation, bindPiUiHost(generation, this.piUiHost));
  }

  private reconcilePiGenerations(
    candidates: LoadedPlugin[],
    reuseUnchanged: boolean,
  ): {
    plugins: LoadedPlugin[];
    retiredGenerations: PiExtensionGeneration[];
    newGenerations: PiExtensionGeneration[];
  } {
    const previousById = new Map(this.loadedPlugins.map(plugin => [plugin.id, plugin]));
    const nextGenerationIds = new Set<string>();
    const retiredGenerations = new Set<PiExtensionGeneration>();
    const newGenerations: PiExtensionGeneration[] = [];
    const plugins = candidates.map(candidate => {
      const previous = previousById.get(candidate.id);
      if (
        reuseUnchanged &&
        candidate.compatibility === 'pi' &&
        candidate.status === 'load failed' &&
        previous?.status === 'active' &&
        previous.piGeneration?.active
      ) {
        nextGenerationIds.add(previous.piGeneration.id);
        return { ...previous, candidateError: candidate.error };
      }
      if (candidate.status === 'active' && candidate.piGeneration) {
        if (
          reuseUnchanged &&
          previous?.status === 'active' &&
          previous.piGeneration?.active &&
          previous.versionStamp === candidate.versionStamp
        ) {
          nextGenerationIds.add(previous.piGeneration.id);
          retiredGenerations.add(candidate.piGeneration);
          return previous.candidateError ? { ...previous, candidateError: undefined } : previous;
        }
        newGenerations.push(candidate.piGeneration);
        nextGenerationIds.add(candidate.piGeneration.id);
      }
      return candidate;
    });
    for (const plugin of this.loadedPlugins) {
      const generation = plugin.piGeneration;
      if (generation && !nextGenerationIds.has(generation.id)) retiredGenerations.add(generation);
    }
    return { plugins, retiredGenerations: [...retiredGenerations], newGenerations };
  }

  private collectActive<TValue>(select: (plugin: LoadedPlugin) => TValue[]): PluginContribution<TValue>[] {
    return this.loadedPlugins.flatMap(plugin =>
      plugin.status === 'active'
        ? select(plugin).map(value => ({ pluginId: plugin.id, versionStamp: plugin.versionStamp ?? '', value }))
        : [],
    );
  }

  private async notifyReloadListeners(plugins: LoadedPlugin[]): Promise<void> {
    await Promise.all([...this.reloadListeners].map(listener => Promise.resolve(listener(plugins))));
  }

  private async notifyPiGenerationListeners(generations: PiExtensionGeneration[]): Promise<void> {
    let firstError: unknown;
    for (const listener of this.piGenerationListeners) {
      try {
        await listener(generations);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError !== undefined) throw firstError;
  }

  /**
   * Stamps each plugin with a value that changes when its contributions should
   * be rebuilt. Runs on every reload, so it stays off the network: GitHub heads
   * come from the cache the poller keeps current and cost one `git rev-parse`
   * per checkout the first time it is seen.
   */
  private async stampLoadedPlugins(plugins: LoadedPlugin[]): Promise<void> {
    for (const plugin of plugins) {
      plugin.versionStamp = [
        plugin.status,
        plugin.compatibility ?? 'native',
        await this.readSourceStamp(plugin),
        JSON.stringify(plugin.configValues ?? {}),
      ].join('|');
    }
  }

  private async readSourceStamp(plugin: LoadedPlugin): Promise<string> {
    try {
      if (plugin.source === 'pi-package') {
        return JSON.stringify({
          resolution: plugin.piPackage?.resolution,
          resources: plugin.piPackage?.resources,
          targetApiVersion: plugin.piPackage?.targetApiVersion,
          observedApiVersion: plugin.piPackage?.observedApiVersion,
          compatibilityReport: plugin.piPackage?.compatibilityReport,
          entries: plugin.entries,
          enabled: plugin.enabled,
        });
      }
      if (plugin.source === 'github') {
        const checkoutPath = this.resolvePluginSourcePath(plugin);
        let head = this.githubCheckoutHeads.get(checkoutPath);
        if (head === undefined) {
          head = await this.readGitHead(checkoutPath);
          this.githubCheckoutHeads.set(checkoutPath, head);
        }
        return head;
      }
      return getEntryVersion(resolvePluginEntryPath(plugin, this.options));
    } catch {
      // A plugin that failed to load has no readable source. Its stamp is then
      // status + config, which is enough to notice when it starts working.
      return '';
    }
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
      // Feed the cache before reloading: the stamp is computed during reload and
      // has to see the new head, or a real update would look unchanged.
      this.githubCheckoutHeads.set(checkoutPath, after);
      if (checkoutChanged || before !== after) changedCheckouts.add(checkoutPath);
    }

    if (changedCheckouts.size === 0) return false;

    await this.reload();
    // Derive names from the reloaded state so a manifest display-name change reports the new name.
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
    // Normalized so cache keys derived here match the `path.resolve`-normalized
    // key that `uninstall` deletes with.
    return path.resolve(path.isAbsolute(plugin.path) ? plugin.path : path.join(paths.root, plugin.path));
  }

  private async readGitHead(cwd: string): Promise<string> {
    const { stdout } = await execa('git', ['rev-parse', 'HEAD'], gitExecOptions(cwd));
    return stdout.trim();
  }

  discoverLocal(searchRoot = '.'): ReturnType<typeof discoverLocalPlugins> {
    return discoverLocalPlugins(searchRoot, this.options);
  }

  async preparePiPackage(
    specifier: string,
    scope: PluginScope,
    options: Omit<ResolvePiPackageOptions, keyof PluginPathOptions> = {},
  ): Promise<PreparedPiPackageInspection> {
    return resolvePiPackageForIntake(specifier, scope, { ...this.options, ...options });
  }

  async characterizePiPackage(
    prepared: PreparedPiPackageInspection,
    options: PiPackageCharacterizationOptions,
  ): Promise<CharacterizedPiPackage> {
    return characterizePreparedPiPackage(prepared, options);
  }

  discardPiPackageCandidate(candidate: PreparedPiPackageInspection | CharacterizedPiPackage): void {
    const scopeRoot = getPluginScopePaths(candidate.scope, this.options).root;
    const activeRoots = new Set<string>();
    for (const scope of ['global', 'project'] as const) {
      const paths = getPluginScopePaths(scope, this.options);
      for (const record of Object.values(loadPluginRegistry(paths.registryPath).plugins)) {
        if (record.source !== 'pi-package' || !record.piPackage) continue;
        activeRoots.add(path.resolve(paths.root, record.piPackage.resolution.sourceRoot));
        activeRoots.add(path.resolve(paths.root, record.piPackage.resolution.packageRoot));
      }
    }

    const roots = new Set([candidate.resolution.sourceRoot, candidate.resolution.packageRoot]);
    for (const root of roots) {
      const absoluteRoot = path.resolve(root);
      if (!isInsideDirectory(absoluteRoot, scopeRoot)) {
        throw new Error('Pi Package candidate cleanup must remain inside the scope-owned plugin directory');
      }
      const ownedRoot = absoluteRoot.includes(`${path.sep}.materialized${path.sep}`)
        ? path.dirname(absoluteRoot)
        : absoluteRoot;
      if ([...activeRoots].some(activeRoot => activeRoot === ownedRoot || isInsideDirectory(activeRoot, ownedRoot)))
        continue;
      fs.rmSync(ownedRoot, { recursive: true, force: true });
    }
  }

  async installPiPackage(characterized: CharacterizedPiPackage, options: { confirmEnable: boolean }): Promise<string> {
    if (options.confirmEnable !== true) throw new Error('Enabling a Pi Package requires explicit enable confirmation');
    const pluginId = characterized.manifest.name;
    return this.enqueuePluginMutation(async () => {
      const paths = getPluginScopePaths(characterized.scope, this.options);
      let previousRegistry = loadPluginRegistry(paths.registryPath);
      let previousRecord = previousRegistry.plugins[pluginId];
      if (previousRecord?.source === 'pi-package' && previousRecord.piPackage?.pendingCleanup) {
        await this.retryPendingPiPackageCleanup(pluginId, characterized.scope, previousRecord);
        previousRegistry = loadPluginRegistry(paths.registryPath);
        previousRecord = previousRegistry.plugins[pluginId];
      }
      if (previousRecord && previousRecord.source !== 'pi-package') {
        throw new Error(
          `Plugin "${pluginId}" is already installed as a native Mastra Code plugin in ${characterized.scope} scope`,
        );
      }
      const candidateRecord = createPiPackageRecord(characterized, this.options);
      if (previousRecord && JSON.stringify(previousRecord) === JSON.stringify(candidateRecord)) {
        await this.reloadRegistry();
        return pluginId;
      }

      const candidateRegistry = setPluginRecord(previousRegistry, pluginId, candidateRecord);
      try {
        const plugins = await this.reloadRegistry({ scope: characterized.scope, registry: candidateRegistry });
        this.assertPiPackagePromotion(pluginId, characterized.scope, candidateRecord, plugins);
        savePluginRegistry(paths.registryPath, candidateRegistry);
      } catch (error) {
        try {
          await this.reloadRegistry();
          this.recordPiPackageCandidateError(pluginId, characterized.scope, error);
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], `Failed to install Pi Package "${pluginId}" and restore it`);
        }
        try {
          this.removeOwnedPiPackageFiles(candidateRecord, characterized.scope, previousRecord);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `Pi Package "${pluginId}" candidate failed and its staged files could not be removed`,
          );
        }
        throw error;
      }

      if (previousRecord?.source === 'pi-package') {
        try {
          this.removeOwnedPiPackageFiles(previousRecord, characterized.scope, candidateRecord);
        } catch (error) {
          await this.persistPendingPiPackageCleanup(
            pluginId,
            characterized.scope,
            candidateRecord,
            previousRecord,
            error,
          );
          throw new Error(`Pi Package "${pluginId}" was updated, but previous source cleanup is pending`, {
            cause: error,
          });
        }
      }
      return pluginId;
    });
  }

  async reloadPiPackage(pluginId: string, scope: PluginScope): Promise<void> {
    await this.enqueuePluginMutation(async () => {
      const record = this.getInstalledPiPackage(pluginId, scope);
      const plugins = await this.reloadRegistry();
      this.assertPiPackagePromotion(pluginId, scope, record, plugins);
    });
  }

  async installLocal(
    localPath: string,
    scope: PluginScope,
    options: Pick<InstallPluginOptions, 'entry'> = {},
  ): Promise<string> {
    return this.enqueuePluginMutation(async () => {
      const id = await installLocalPlugin(localPath, scope, { ...this.options, ...options });
      await this.reloadRegistry();
      return id;
    });
  }

  async installGithub(
    url: string,
    scope: PluginScope,
    options: Pick<InstallPluginOptions, 'entry' | 'ref' | 'onOutput' | 'signal'> = {},
  ): Promise<string> {
    return this.enqueuePluginMutation(async () => {
      const id = await installGithubPlugin(url, scope, { ...this.options, ...options });
      // Installing over an existing checkout replaces it at the same path, so the
      // cached head would make a genuinely different commit stamp as unchanged and
      // leave the previous signal providers running.
      this.githubCheckoutHeads.clear();
      await this.reloadRegistry();
      return id;
    });
  }

  async setEnabled(pluginId: string, scope: PluginScope, enabled: boolean): Promise<void> {
    await this.enqueuePluginMutation(async () => {
      const paths = getPluginScopePaths(scope, this.options);
      const registry = loadPluginRegistry(paths.registryPath);
      const record = registry.plugins[pluginId];
      if (!record) throw new Error(`Plugin "${pluginId}" is not installed in ${scope} scope`);
      if (record.source === 'pi-package') {
        await this.commitPiPackageRegistryMutation(pluginId, scope, { ...record, enabled });
        return;
      }
      savePluginRegistry(paths.registryPath, setPluginRecord(registry, pluginId, { ...record, enabled }));
      await this.reloadRegistry();
    });
  }

  async setConfigValue(
    pluginId: string,
    scope: PluginScope,
    key: string,
    value: MastraCodePluginConfigValue,
  ): Promise<void> {
    await this.enqueuePluginMutation(async () => {
      const paths = getPluginScopePaths(scope, this.options);
      const registry = loadPluginRegistry(paths.registryPath);
      const record = registry.plugins[pluginId];
      if (!record) throw new Error(`Plugin "${pluginId}" is not installed in ${scope} scope`);
      const nextRecord = updatePluginConfig(record, key, value);
      if (record.source === 'pi-package') {
        await this.commitPiPackageRegistryMutation(pluginId, scope, nextRecord);
        return;
      }
      savePluginRegistry(paths.registryPath, setPluginRecord(registry, pluginId, nextRecord));
      await this.reloadRegistry();
    });
  }

  async uninstall(pluginId: string, scope: PluginScope): Promise<void> {
    await this.enqueuePluginMutation(async () => {
      const paths = getPluginScopePaths(scope, this.options);
      const registry = loadPluginRegistry(paths.registryPath);
      const record = registry.plugins[pluginId];
      if (!record) throw new Error(`Plugin "${pluginId}" is not installed in ${scope} scope`);

      if (record.source === 'pi-package') {
        const cleanupPaths = this.getOwnedPiPackageCleanupPaths(record, scope).map(cleanupPath =>
          path.relative(paths.root, cleanupPath),
        );
        await this.commitPiPackageRegistryMutation(pluginId, scope, undefined);
        try {
          this.removeOwnedPiPackageFiles(record, scope);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const retryRecord: InstalledPluginRecord = {
            ...record,
            enabled: false,
            piPackage: record.piPackage
              ? { ...record.piPackage, pendingCleanup: { paths: cleanupPaths, error: message } }
              : undefined,
          };
          const removedRegistry = loadPluginRegistry(paths.registryPath);
          savePluginRegistry(paths.registryPath, setPluginRecord(removedRegistry, pluginId, retryRecord));
          await this.reloadRegistry();
          throw error;
        }
        return;
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
        this.githubCheckoutHeads.delete(checkoutPath);
      }
      await this.reloadRegistry();
    });
  }

  private enqueuePluginMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.pluginMutationTail.then(async () => {
      if (this.reloadInFlight) await this.reloadInFlight;
      return operation();
    });
    this.pluginMutationTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private getInstalledPiPackage(pluginId: string, scope: PluginScope): InstalledPluginRecord {
    const paths = getPluginScopePaths(scope, this.options);
    const record = loadPluginRegistry(paths.registryPath).plugins[pluginId];
    if (!record) throw new Error(`Plugin "${pluginId}" is not installed in ${scope} scope`);
    if (record.source !== 'pi-package') throw new Error(`Plugin "${pluginId}" is not a Pi Package`);
    return record;
  }

  private async commitPiPackageRegistryMutation(
    pluginId: string,
    scope: PluginScope,
    nextRecord: InstalledPluginRecord | undefined,
  ): Promise<void> {
    const paths = getPluginScopePaths(scope, this.options);
    const previousRegistry = loadPluginRegistry(paths.registryPath);
    const previousRecord = previousRegistry.plugins[pluginId];
    if (!previousRecord || previousRecord.source !== 'pi-package') {
      throw new Error(`Pi Package "${pluginId}" is not installed in ${scope} scope`);
    }
    const nextRegistry = nextRecord
      ? setPluginRecord(previousRegistry, pluginId, nextRecord)
      : removePluginRecord(previousRegistry, pluginId);
    try {
      const plugins = await this.reloadRegistry({ scope, registry: nextRegistry });
      if (nextRecord?.enabled) this.assertPiPackagePromotion(pluginId, scope, nextRecord, plugins);
      savePluginRegistry(paths.registryPath, nextRegistry);
    } catch (error) {
      try {
        await this.reloadRegistry();
        this.recordPiPackageCandidateError(pluginId, scope, error);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `Failed to update Pi Package "${pluginId}" and restore it`);
      }
      throw error;
    }
  }

  private recordPiPackageCandidateError(pluginId: string, scope: PluginScope, error: unknown): void {
    const restored = this.loadedPlugins.find(plugin => plugin.id === pluginId && plugin.scope === scope);
    if (restored) restored.candidateError = error instanceof Error ? error.message : String(error);
  }

  private assertPiPackagePromotion(
    pluginId: string,
    scope: PluginScope,
    record: InstalledPluginRecord,
    plugins: LoadedPlugin[],
  ): void {
    const loaded = plugins.find(plugin => plugin.id === pluginId);
    if (loaded?.scope !== scope) {
      if (scope === 'global' && loaded?.scope === 'project') return;
      throw new Error(`Pi Package "${pluginId}" was not published from ${scope} scope`);
    }
    if (loaded.status === 'blocked') return;
    if (loaded.status !== 'active' || loaded.path !== record.path || loaded.candidateError) {
      throw new Error(
        loaded.candidateError ?? loaded.error ?? `Pi Package "${pluginId}" candidate did not become active`,
      );
    }
  }

  private async retryPendingPiPackageCleanup(
    pluginId: string,
    scope: PluginScope,
    record: InstalledPluginRecord,
  ): Promise<void> {
    const piPackage = record.piPackage;
    const pending = piPackage?.pendingCleanup;
    if (!piPackage || !pending) return;
    this.removeOwnedPiPackagePaths(pending.paths.map(storedPath => this.resolveOwnedPiPackagePath(storedPath, scope)));
    const clearedRecord: InstalledPluginRecord = {
      ...record,
      piPackage: { ...piPackage, pendingCleanup: undefined },
    };
    const paths = getPluginScopePaths(scope, this.options);
    const registry = loadPluginRegistry(paths.registryPath);
    savePluginRegistry(paths.registryPath, setPluginRecord(registry, pluginId, clearedRecord));
    const loaded = this.loadedPlugins.find(plugin => plugin.id === pluginId && plugin.scope === scope);
    if (loaded) {
      loaded.piPackage = clearedRecord.piPackage;
      loaded.candidateError = undefined;
      await this.notifyReloadListeners(this.loadedPlugins);
    }
  }

  private async persistPendingPiPackageCleanup(
    pluginId: string,
    scope: PluginScope,
    activeRecord: InstalledPluginRecord,
    previousRecord: InstalledPluginRecord,
    error: unknown,
  ): Promise<void> {
    if (!activeRecord.piPackage) return;
    const paths = getPluginScopePaths(scope, this.options);
    const cleanupPaths = this.getOwnedPiPackageCleanupPaths(previousRecord, scope, activeRecord).map(cleanupPath =>
      path.relative(paths.root, cleanupPath),
    );
    const message = error instanceof Error ? error.message : String(error);
    const pendingRecord: InstalledPluginRecord = {
      ...activeRecord,
      piPackage: { ...activeRecord.piPackage, pendingCleanup: { paths: cleanupPaths, error: message } },
    };
    const registry = loadPluginRegistry(paths.registryPath);
    savePluginRegistry(paths.registryPath, setPluginRecord(registry, pluginId, pendingRecord));
    const loaded = this.loadedPlugins.find(plugin => plugin.id === pluginId && plugin.scope === scope);
    if (loaded) {
      loaded.piPackage = pendingRecord.piPackage;
      loaded.candidateError = message;
      await this.notifyReloadListeners(this.loadedPlugins);
    }
  }

  private removeOwnedPiPackageFiles(
    record: InstalledPluginRecord,
    scope: PluginScope,
    retainedRecord?: InstalledPluginRecord,
  ): void {
    this.removeOwnedPiPackagePaths(this.getOwnedPiPackageCleanupPaths(record, scope, retainedRecord));
  }

  private getOwnedPiPackageCleanupPaths(
    record: InstalledPluginRecord,
    scope: PluginScope,
    retainedRecord?: InstalledPluginRecord,
  ): string[] {
    if (record.source !== 'pi-package' || !record.piPackage) return [];
    const candidateRoots = [
      record.piPackage.resolution.sourceRoot,
      record.piPackage.resolution.packageRoot,
      ...(record.piPackage.pendingCleanup?.paths ?? []),
    ].map(storedPath => this.resolveOwnedPiPackagePath(storedPath, scope));
    const retainedRoots =
      retainedRecord?.source === 'pi-package' && retainedRecord.piPackage
        ? [
            this.resolveOwnedPiPackagePath(retainedRecord.piPackage.resolution.sourceRoot, scope),
            this.resolveOwnedPiPackagePath(retainedRecord.piPackage.resolution.packageRoot, scope),
          ]
        : [];
    return [...new Set(candidateRoots)]
      .filter(candidate => !retainedRoots.some(retained => isInsideDirectory(retained, candidate)))
      .sort((a, b) => a.length - b.length)
      .filter((candidate, index, candidates) =>
        candidates.slice(0, index).every(parent => !isInsideDirectory(candidate, parent)),
      );
  }

  private resolveOwnedPiPackagePath(storedPath: string, scope: PluginScope): string {
    const paths = getPluginScopePaths(scope, this.options);
    const packagesRoot = path.resolve(paths.sourcesPath, 'pi-packages');
    const resolved = path.resolve(path.isAbsolute(storedPath) ? storedPath : path.join(paths.root, storedPath));
    if (resolved === packagesRoot || !isInsideDirectory(resolved, packagesRoot)) {
      throw new Error(`Refusing to remove unowned Pi Package path: ${storedPath}`);
    }
    return resolved;
  }

  private removeOwnedPiPackagePaths(paths: string[]): void {
    const errors: unknown[] = [];
    for (const candidate of paths) {
      try {
        fs.rmSync(candidate, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Failed to remove owned Pi Package source paths');
  }
}

function updatePluginConfig(
  record: InstalledPluginRecord,
  key: string,
  value: MastraCodePluginConfigValue,
): InstalledPluginRecord {
  const config = { ...(record.config ?? {}) };
  if (value === undefined || value === '') delete config[key];
  else config[key] = value;
  return { ...record, config: Object.keys(config).length > 0 ? config : undefined };
}

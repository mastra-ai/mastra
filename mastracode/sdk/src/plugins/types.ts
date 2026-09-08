import type { InputProcessor, OutputProcessor } from '@mastra/core/processors';
import type { SignalProvider } from '@mastra/core/signals';

import type {
  MastraCodePluginConfigSchema,
  MastraCodePluginConfigValue,
  MastraCodePluginTools,
  MastraCodeToolRenderConfig,
} from '../plugin.js';

/** Processors a plugin contributed, normalized into the lane they belong to. */
export type LoadedPluginProcessors = {
  input: InputProcessor[];
  output: OutputProcessor[];
};

/**
 * A single contribution, carrying the id of the plugin that owns it. Ownership
 * has to survive collection: the signal lane keys live providers by
 * `(pluginId, providerId)`, and a processor's state id is derived from the
 * plugin id so it stays stable when the plugin is reloaded.
 */
export type PluginContribution<TValue> = {
  pluginId: string;
  /** The owning plugin's {@link LoadedPlugin.versionStamp} at collection time. */
  versionStamp: string;
  value: TValue;
};

export type PluginProcessorEntries = {
  input: PluginContribution<InputProcessor>[];
  output: PluginContribution<OutputProcessor>[];
};

export type PluginScope = 'global' | 'project';
export type PluginSource = 'local' | 'github';
export type PluginStatus = 'active' | 'inactive' | 'blocked' | 'load failed' | 'conflicted';

export type InstalledPluginRecord = {
  enabled: boolean;
  source: PluginSource;
  specifier: string;
  path: string;
  entry: string;
  ref?: string;
  version?: string;
  config?: Record<string, MastraCodePluginConfigValue>;
};

export type PluginRegistry = {
  plugins: Record<string, InstalledPluginRecord>;
  disabledPlugins?: string[];
};

export type ScopedInstalledPluginRecord = InstalledPluginRecord & {
  id: string;
  scope: PluginScope;
  blocked?: boolean;
};

export type LoadedPlugin = ScopedInstalledPluginRecord & {
  name?: string;
  description?: string;
  instructions?: string;
  status: PluginStatus;
  error?: string;
  tools: MastraCodePluginTools;
  renderConfigs?: Record<string, MastraCodeToolRenderConfig>;
  toolNames: string[];
  processors?: LoadedPluginProcessors;
  signalProviders?: SignalProvider<string>[];
  skillPaths?: string[];
  commandPaths?: string[];
  configSchema?: MastraCodePluginConfigSchema;
  configValues?: Record<string, MastraCodePluginConfigValue>;
  conflicts?: string[];
  /**
   * Changes when this plugin's contributions should be rebuilt: source content
   * (git HEAD for GitHub checkouts, entry file version for local plugins) plus
   * the registry record's config values and enabled flag. Reload fires on
   * non-content events too — a config edit hands the plugin different values
   * while every file is untouched — so both halves matter.
   *
   * Consumers that own long-lived instances (the signal-provider lane) compare
   * this to decide between keeping what they have and cycling it.
   */
  versionStamp?: string;
};

export type PluginScopePaths = {
  scope: PluginScope;
  root: string;
  registryPath: string;
  sourcesPath: string;
};

import type {
  MastraCodePluginConfigSchema,
  MastraCodePluginConfigValue,
  MastraCodePluginTools,
  MastraCodeToolRenderConfig,
} from '../plugin.js';

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
  skillPaths?: string[];
  commandPaths?: string[];
  configSchema?: MastraCodePluginConfigSchema;
  configValues?: Record<string, MastraCodePluginConfigValue>;
  conflicts?: string[];
};

export type PluginScopePaths = {
  scope: PluginScope;
  root: string;
  registryPath: string;
  sourcesPath: string;
};

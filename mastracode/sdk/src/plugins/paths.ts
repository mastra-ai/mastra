import os from 'node:os';
import path from 'node:path';

import { DEFAULT_CONFIG_DIR } from '../constants.js';
import type { PluginScope, PluginScopePaths } from './types.js';

export type PluginPathOptions = {
  projectRoot: string;
  configDir?: string;
  homeDir?: string;
};

export function getPluginRoot(scope: PluginScope, options: PluginPathOptions): string {
  const configDir = options.configDir ?? DEFAULT_CONFIG_DIR;
  const baseDir = scope === 'project' ? options.projectRoot : (options.homeDir ?? os.homedir());
  return path.join(baseDir, configDir, 'plugins');
}

export function getPluginDataDir(pluginId: string, options: PluginPathOptions): string {
  if (!pluginId || pluginId.split(/[\\/\\\\]/).some(part => part === '.' || part === '..') || pluginId.includes('\0')) {
    throw new Error('Invalid plugin id for data directory');
  }
  const root = path.resolve(options.homeDir ?? os.homedir(), options.configDir ?? DEFAULT_CONFIG_DIR, 'plugin-data');
  const directory = path.resolve(root, encodeURIComponent(pluginId));
  if (path.dirname(directory) !== root) throw new Error('Plugin data directory must remain inside the profile');
  return directory;
}

export function getPluginRegistryPath(scope: PluginScope, options: PluginPathOptions): string {
  return path.join(getPluginRoot(scope, options), 'plugins.json');
}

export function getPluginScopePaths(scope: PluginScope, options: PluginPathOptions): PluginScopePaths {
  const root = getPluginRoot(scope, options);
  return {
    scope,
    root,
    registryPath: path.join(root, 'plugins.json'),
    sourcesPath: path.join(root, 'sources'),
  };
}

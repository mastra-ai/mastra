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

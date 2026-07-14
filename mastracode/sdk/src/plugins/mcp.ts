import path from 'node:path';

import { MCPServer } from '@mastra/mcp';

import type { MastraCodePluginConfigValue, MastraCodePluginConfigValues } from '../plugin.js';
import { resolveStandalonePlugin } from './loader.js';
import type { PluginPathOptions } from './paths.js';
import { preparePluginSource } from './source.js';
import type { PreparedPluginSource } from './source.js';

export type CreatePluginMCPServerOptions = Partial<PluginPathOptions> & {
  specifier: string;
  cwd?: string;
  ref?: string;
  config?: Record<string, MastraCodePluginConfigValue>;
  envConfig?: string;
  entry?: string;
  githubCliPath?: string;
};

export type PluginMCPServer = {
  server: MCPServer;
  source: PreparedPluginSource;
  plugin: {
    id: string;
    name: string;
    version: string;
  };
  config: MastraCodePluginConfigValues;
  close(): Promise<void>;
};

export function resolvePluginConfigInput(
  explicit: MastraCodePluginConfigValues | undefined,
  environmentJson: string | undefined,
): MastraCodePluginConfigValues {
  let environment: MastraCodePluginConfigValues = {};
  if (environmentJson !== undefined && environmentJson.trim() !== '') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(environmentJson);
    } catch {
      throw new Error('MASTRACODE_PLUGIN_CONFIG must be valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('MASTRACODE_PLUGIN_CONFIG must be a JSON object');
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string' && typeof value !== 'boolean') {
        throw new Error(`MASTRACODE_PLUGIN_CONFIG has an invalid value for key: ${key}`);
      }
      environment[key] = value;
    }
  }
  return { ...environment, ...explicit };
}

export async function createPluginMCPServer(options: CreatePluginMCPServerOptions): Promise<PluginMCPServer> {
  const cwd = path.resolve(options.cwd ?? options.projectRoot ?? process.cwd());
  const projectRoot = path.resolve(options.projectRoot ?? cwd);
  const source = await preparePluginSource(options.specifier, {
    projectRoot,
    cwd,
    configDir: options.configDir,
    homeDir: options.homeDir,
    ref: options.ref,
    entry: options.entry,
    githubCliPath: options.githubCliPath,
    standalone: true,
  });
  const resolved = await resolveStandalonePlugin({
    entryPath: path.join(source.pluginRoot, source.entry),
    cwd,
    pluginDir: path.dirname(path.join(source.pluginRoot, source.entry)),
    config: resolvePluginConfigInput(options.config, options.envConfig),
  });
  const name = resolved.plugin.name?.trim() || resolved.plugin.id;
  const version = resolved.plugin.version?.trim() || '0.0.0';
  const server = new MCPServer({ name, version, tools: resolved.tools });
  let closed = false;

  return {
    server,
    source,
    plugin: { id: resolved.plugin.id, name, version },
    config: resolved.configValues,
    async close() {
      if (closed) return;
      closed = true;
      await server.close();
    },
  };
}

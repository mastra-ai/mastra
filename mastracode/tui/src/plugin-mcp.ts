import type { MastraCodePluginConfigValues } from '@mastra/code-sdk/plugin';
import { createPluginMCPServer } from '@mastra/code-sdk/plugins/mcp';

export const PLUGIN_MCP_USAGE = 'Usage: mastracode plugin mcp <specifier> [--ref <git-ref>] [--config key=value ...]';

export type PluginMCPCommandOptions = {
  specifier: string;
  ref?: string;
  config: MastraCodePluginConfigValues;
};

type PluginMCPLifecycle = Awaited<ReturnType<typeof createPluginMCPServer>>;

type PluginMCPRuntime = {
  cwd(): string;
  env: NodeJS.ProcessEnv;
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  exit(code: number): never;
};

export function parsePluginMCPArgs(args: string[]): PluginMCPCommandOptions {
  const specifier = args[0];
  if (!specifier || specifier.startsWith('--')) throw new Error('Missing plugin specifier');

  const config: MastraCodePluginConfigValues = {};
  let ref: string | undefined;
  for (let index = 1; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--ref') {
      if (ref !== undefined) throw new Error('Duplicate --ref flag');
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --ref');
      ref = value;
      continue;
    }
    if (flag === '--config') {
      const pair = args[++index];
      if (!pair || pair.startsWith('--')) throw new Error('Missing value for --config');
      const separator = pair.indexOf('=');
      if (separator <= 0) throw new Error('--config must use key=value');
      const key = pair.slice(0, separator);
      if (key in config) throw new Error(`Duplicate --config key: ${key}`);
      const value = pair.slice(separator + 1);
      config[key] = value;
      continue;
    }
    throw new Error(`Unknown argument: ${flag}`);
  }

  return { specifier, config, ...(ref ? { ref } : {}) };
}

export async function startPluginMCPCommand(
  args: string[],
  runtime: PluginMCPRuntime = process,
  createServer: typeof createPluginMCPServer = createPluginMCPServer,
): Promise<PluginMCPLifecycle> {
  const parsed = parsePluginMCPArgs(args);
  const lifecycle = await createServer({
    specifier: parsed.specifier,
    cwd: runtime.cwd(),
    config: parsed.config,
    envConfig: runtime.env.MASTRACODE_PLUGIN_CONFIG,
    ...(parsed.ref ? { ref: parsed.ref } : {}),
  });
  let closing: Promise<void> | undefined;
  const shutdown = () => {
    closing ??= lifecycle.close().finally(() => runtime.exit(0));
  };
  runtime.on('SIGINT', shutdown);
  runtime.on('SIGTERM', shutdown);
  await lifecycle.server.startStdio();
  return lifecycle;
}

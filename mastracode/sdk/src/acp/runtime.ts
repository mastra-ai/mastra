import { RequestError } from '@agentclientprotocol/sdk';
import type { NewSessionRequest } from '@agentclientprotocol/sdk';
import { createMastraCode } from '../index.js';
import type { MastraCodeConfig } from '../index.js';
import type { McpServerConfig } from '../mcp/types.js';
import { loadSettings, resolveDefaultThinkingLevel } from '../onboarding/settings.js';
import type { AcpSessionRuntime } from './agent.js';

export async function createAcpSession(
  request: NewSessionRequest,
  options: Pick<MastraCodeConfig, 'coAuthor'> = {},
): Promise<AcpSessionRuntime> {
  const names = new Set<string>();
  const servers = request.mcpServers.map(server => {
    if ('type' in server && server.type === 'sse')
      throw RequestError.invalidParams(undefined, 'Legacy SSE MCP servers are unsupported; use HTTP or stdio');
    if (names.has(server.name))
      throw RequestError.invalidParams(undefined, `Duplicate MCP server name: ${server.name}`);
    names.add(server.name);
    const config: McpServerConfig =
      'command' in server
        ? {
            command: server.command,
            args: server.args,
            env: Object.fromEntries(server.env.map(item => [item.name, item.value])),
            cwd: request.cwd,
          }
        : { url: server.url, headers: Object.fromEntries(server.headers.map(item => [item.name, item.value])) };
    return [server.name, config] as const;
  });
  const result = await createMastraCode({
    coAuthor: options.coAuthor,
    cwd: request.cwd,
    initialState: {
      projectPath: request.cwd,
      yolo: false,
      permissionRules: { categories: {}, tools: { ask_user: 'deny' } },
    },
    mcpServers: Object.fromEntries(servers),
    // ACP clients can answer permission requests, but have no free-text tool response method.
    disabledTools: ['ask_user'],
    unixSocketPubSub: false,
    disableMcp: false,
    disableHooks: false,
    // Project environment files must not mutate other ACP sessions.
    disableEnvFile: true,
  });
  const settings = loadSettings();
  let cleanupPromise: Promise<void> | undefined;
  const runtime: AcpSessionRuntime = {
    controller: result.controller,
    session: result.session,
    modes: result.controller.listModes(),
    getSkills: async () => (await result.controller.resolveWorkspace({ session: result.session }))?.skills,
    getThinkingLevel: () =>
      result.session.state.get().thinkingLevel ??
      resolveDefaultThinkingLevel(settings, result.session.mode.get()).level,
    cleanup: () =>
      (cleanupPromise ??= (async () => {
        result.session.abort();
        result.session.thread.detachFromCurrent();
        result.stopPluginSignalProviders();
        result.githubSignals?.stopAllPolling();
        await Promise.allSettled([
          result.session.thread.clearAndReleaseLock(),
          result.mcpManager?.disconnect(),
          result.controller.getMastra()?.stopWorkers(),
          result.controller.stopIntervals(),
          (result.signalsPubSub as { close?: () => void | Promise<void> } | undefined)?.close?.(),
        ]);
        await result.storage.close();
      })()),
  };
  try {
    const status = await result.mcpManager?.initInBackground();
    const failed = status?.failed.filter(server => names.has(server.name)) ?? [];
    if (failed.length)
      throw RequestError.internalError(
        undefined,
        failed.map(server => `MCP server ${server.name}: ${server.error ?? 'connection failed'}`).join('; '),
      );

    return runtime;
  } catch (error) {
    await runtime.cleanup?.();
    throw error;
  }
}

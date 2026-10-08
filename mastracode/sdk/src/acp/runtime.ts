import { RequestError } from '@agentclientprotocol/sdk';
import type { NewSessionRequest } from '@agentclientprotocol/sdk';
import { createMastraCode } from '../index.js';
import type { MastraCodeConfig } from '../index.js';
import type { McpServerConfig } from '../mcp/types.js';
import { loadSettings, resolveDefaultThinkingLevel } from '../onboarding/settings.js';
import type { AcpSessionRuntime } from './agent.js';
import { withCleanupFailure } from './errors.js';

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
        // Release thread claims before the slow teardown, so a restarted
        // process can claim the thread (and peers can reach it) right away.
        try {
          result.releaseThreadClaims();
        } catch {
          // Best-effort — cleanup continues regardless.
        }
        await Promise.allSettled([
          Promise.resolve().then(() => result.session.abort()),
          Promise.resolve().then(() => result.session.thread.detachFromCurrent()),
          Promise.resolve().then(() => result.stopPluginSignalProviders()),
          Promise.resolve().then(() => result.githubSignals?.stopAllPolling()),
          Promise.resolve().then(() => result.threadScheduler.stop()),
        ]);
        // Leave time for the other cleanup phases within ACP's shared 10-second cap.
        // A timed-out dispatch may still finish later; this grace is not cancellation.
        let dispatchTimeout: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          Promise.resolve()
            .then(() => result.stopNotificationDispatch())
            .catch(() => {}),
          new Promise<void>(resolve => {
            dispatchTimeout = setTimeout(resolve, 2_000);
            dispatchTimeout.unref();
          }),
        ]).finally(() => clearTimeout(dispatchTimeout));
        await Promise.allSettled([
          Promise.resolve().then(() => result.session.thread.clearAndReleaseLock()),
          Promise.resolve().then(() => result.mcpManager?.disconnect()),
          Promise.resolve().then(() => result.controller.getMastra()?.stopWorkers()),
          Promise.resolve().then(() => result.controller.stopIntervals()),
        ]);
        await Promise.resolve()
          .then(() => (result.signalsPubSub as { close?: () => void | Promise<void> } | undefined)?.close?.())
          .catch(() => {});
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
    try {
      await runtime.cleanup?.();
    } catch (cleanupError) {
      throw withCleanupFailure(error, cleanupError);
    }
    throw error;
  }
}

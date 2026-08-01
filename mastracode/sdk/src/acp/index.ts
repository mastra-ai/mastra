import type { AgentControllerMode } from '@mastra/core/agent-controller';

import { createMastraCode } from '../index.js';
import { releaseAllThreadLocks } from '../utils/thread-lock.js';
import { setAutoApprove } from './event-mapper.js';
import { runAcpServer } from './server.js';

/**
 * Entry point for ACP server mode.
 * Initializes mastracode and runs the ACP protocol over stdio.
 */
export async function acpMain(options?: { dangerousAutoApprove?: boolean }): Promise<void> {
  if (options?.dangerousAutoApprove) {
    setAutoApprove(true);
  }
  // Redirect console.log to stderr to avoid polluting the JSON-RPC stream on stdout.
  // eslint-disable-next-line no-console
  const originalConsoleLog = console.log;
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => {
    process.stderr.write(args.map(String).join(' ') + '\n');
  };

  let result: Awaited<ReturnType<typeof createMastraCode>> | undefined;

  try {
    result = await createMastraCode({
      unixSocketPubSub: false,
      disableMcp: false,
      disableHooks: false,
    });

    const { controller, mcpManager, signalsPubSub } = result;

    // Default modes (same as createMastraCode defaults)
    const modes: AgentControllerMode[] = [
      { id: 'build', name: 'Build' },
      { id: 'plan', name: 'Plan' },
      { id: 'fast', name: 'Fast' },
    ];

    // Cleanup function (mirrors main.ts asyncCleanup)
    const cleanup = async () => {
      releaseAllThreadLocks();
      const closeSignalsPubSub = (signalsPubSub as { close?: () => Promise<void> | void } | undefined)?.close;
      await Promise.allSettled([
        mcpManager?.disconnect(),
        controller?.getMastra()?.stopWorkers(),
        controller?.stopIntervals(),
        closeSignalsPubSub?.(),
      ]);

      // Restore console.log
      // eslint-disable-next-line no-console
      console.log = originalConsoleLog;
    };

    // Handle signals
    const handleSignal = async () => {
      await cleanup();
      process.exit(0);
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    await runAcpServer(controller, modes, cleanup);
  } catch (error) {
    process.stderr.write(`[acp] Fatal error: ${error}\n`);
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog;
    process.exit(1);
  }
}

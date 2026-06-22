import type { HarnessMode } from '@mastra/core/harness';

import { createMastraCode } from '../index';
import { releaseAllThreadLocks } from '../utils/thread-lock';
import { runAcpServer } from './server';

/**
 * Entry point for ACP server mode.
 * Initializes mastracode and runs the ACP protocol over stdio.
 */
export async function acpMain(): Promise<void> {
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

    const { harness, mcpManager, signalsPubSub } = result;

    // Default modes (same as createMastraCode defaults)
    const modes: HarnessMode[] = [
      { id: 'build', name: 'Build' },
      { id: 'plan', name: 'Plan' },
      { id: 'fast', name: 'Explore' },
    ];

    // Cleanup function (mirrors main.ts asyncCleanup)
    const cleanup = async () => {
      releaseAllThreadLocks();
      const closeSignalsPubSub = (signalsPubSub as { close?: () => Promise<void> | void } | undefined)?.close;
      await Promise.allSettled([
        mcpManager?.disconnect(),
        harness?.getMastra()?.stopWorkers(),
        harness?.stopHeartbeats(),
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

    await runAcpServer(harness, modes, cleanup);
  } catch (error) {
    process.stderr.write(`[acp] Fatal error: ${error}\n`);
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog;
    process.exit(1);
  }
}

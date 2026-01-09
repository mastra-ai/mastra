import { IPCPubSub } from '../events/ipc-pubsub';
import type { Mastra } from '../mastra';

/**
 * Check if the current process is running as a Mastra worker.
 */
export function isWorkerMode(): boolean {
  return process.env.MASTRA_WORKER_MODE === 'true';
}

/**
 * Options for starting the worker runtime
 */
export interface WorkerRuntimeOptions {
  /**
   * The Mastra instance to run in worker mode.
   * This should have the same workflows, agents, and tools as the main process.
   */
  mastra: Mastra;

  /**
   * Called when the worker is shutting down.
   * Use this to clean up any resources.
   */
  onShutdown?: () => Promise<void> | void;
}

/**
 * Start the Mastra worker runtime.
 *
 * This function configures a Mastra instance to run in worker mode,
 * setting up IPC communication with the parent process and handling
 * workflow execution requests.
 *
 * This should be called from the worker entry script:
 *
 * @example
 * ```typescript
 * // worker.ts (compiled to .mastra/worker.mjs)
 * import { startWorkerRuntime, isWorkerMode } from '@mastra/core/worker';
 * import { mastra } from './index'; // Same mastra config as main
 *
 * if (isWorkerMode()) {
 *   startWorkerRuntime({ mastra }).catch(err => {
 *     console.error('Worker failed to start:', err);
 *     process.exit(1);
 *   });
 * }
 * ```
 */
export async function startWorkerRuntime(options: WorkerRuntimeOptions): Promise<void> {
  const { mastra, onShutdown } = options;

  // Verify we're actually in a worker process
  if (!process.send) {
    throw new Error(
      'startWorkerRuntime must be called from a child process. ' +
        'Use MastraWorker from the main process to spawn workers.',
    );
  }

  const logger = mastra.getLogger();
  logger?.info('Starting Mastra worker runtime...');

  try {
    // Create IPC pubsub for communication with parent
    const ipcPubSub = new IPCPubSub();

    // Replace mastra's pubsub with IPC version
    await mastra.setPubSub(ipcPubSub);

    // Start the event engine to process workflow events
    await mastra.startEventEngine();

    // Set up shutdown handler
    process.on('message', async (msg: { type: string }) => {
      if (msg.type === 'shutdown') {
        logger?.info('Worker received shutdown signal');

        try {
          // Run custom shutdown handler
          await onShutdown?.();

          // Stop the event engine
          await mastra.stopEventEngine();

          // Clean up pubsub
          await ipcPubSub.close();

          logger?.info('Worker shutdown complete');
          process.exit(0);
        } catch (err) {
          logger?.error('Error during worker shutdown', err);
          process.exit(1);
        }
      }
    });

    // Handle process signals
    const handleSignal = async (signal: string) => {
      logger?.info(`Worker received ${signal} signal`);
      await onShutdown?.();
      await mastra.stopEventEngine();
      await ipcPubSub.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));

    // Signal to parent that we're ready
    process.send({ type: 'worker-ready' });

    logger?.info('Mastra worker runtime started successfully');
  } catch (err) {
    logger?.error('Failed to start worker runtime', err);

    // Signal error to parent
    process.send?.({
      type: 'worker-error',
      error: err instanceof Error ? err.message : String(err),
    });

    process.exit(1);
  }
}

/**
 * Create a simple worker entry point.
 *
 * This is a convenience function that wraps startWorkerRuntime
 * with standard error handling and logging.
 *
 * @example
 * ```typescript
 * // worker.ts
 * import { createWorkerEntry } from '@mastra/core/worker';
 * import { mastra } from './index';
 *
 * createWorkerEntry({ mastra });
 * ```
 */
export function createWorkerEntry(options: WorkerRuntimeOptions): void {
  if (!isWorkerMode()) {
    console.warn('Worker entry called but not in worker mode. Skipping initialization.');
    return;
  }

  startWorkerRuntime(options).catch(err => {
    console.error('Worker failed to start:', err);
    process.exit(1);
  });
}

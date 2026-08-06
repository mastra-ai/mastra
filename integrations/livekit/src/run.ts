import { fileURLToPath } from 'node:url';
import { cli, ServerOptions } from '@livekit/agents';
import { DEFAULT_LIVEKIT_AGENT_NAME } from './constants';
import { workerSetupComplete } from './worker-setup';

export interface RunLiveKitWorkerOptions {
  /** The worker entry module whose default export is the agent definition. Pass `import.meta.url`. */
  entry: string | URL;
  /** LiveKit agent name for explicit dispatch. Defaults to `'mastra-voice'`. */
  agentName?: string;
  /** Extra LiveKit ServerOptions merged over what this helper builds. */
  serverOptions?: Partial<ConstructorParameters<typeof ServerOptions>[0]>;
}

export function resolveWorkerEntryPath(entry: string | URL): string {
  if (entry instanceof URL) return fileURLToPath(entry);
  return entry.startsWith('file:') ? fileURLToPath(entry) : entry;
}

/**
 * Starts the LiveKit agent worker CLI (`dev` / `start` / `connect` subcommands) for a
 * worker entry file. Call it from the same file that default-exports
 * {@link createLiveKitWorker}, guarded so it only runs when executed directly:
 *
 * ```ts
 * import { fileURLToPath } from 'node:url';
 * import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit/worker';
 * import { mastra } from './index';
 *
 * export default createLiveKitWorker({ mastra, agent: 'support' });
 *
 * if (process.argv[1] === fileURLToPath(import.meta.url)) {
 *   runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
 * }
 * ```
 *
 * Using this helper (instead of `cli.runApp` from `@livekit/agents`) guarantees the worker
 * runtime and the bridge share one copy of the LiveKit SDK.
 */
export function runLiveKitWorker(options: RunLiveKitWorkerOptions): void {
  // Wait for plugin imports queued by createLiveKitWorker so their inference runners
  // (e.g. the turn detector) are registered before the agent server starts.
  void workerSetupComplete().then(() => {
    cli.runApp(
      new ServerOptions({
        agent: resolveWorkerEntryPath(options.entry),
        agentName: options.agentName ?? DEFAULT_LIVEKIT_AGENT_NAME,
        ...options.serverOptions,
      }),
    );
  });
}

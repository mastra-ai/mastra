import type { ChildProcess } from 'node:child_process';
import { fork } from 'node:child_process';
import path from 'node:path';
import { IPCPubSub } from '../events/ipc-pubsub';
import type { Mastra } from '../mastra';

/**
 * Message types for worker communication
 */
interface WorkerMessage {
  type: string;
  [key: string]: unknown;
}

interface WorkerReadyMessage extends WorkerMessage {
  type: 'worker-ready';
}

interface WorkerErrorMessage extends WorkerMessage {
  type: 'worker-error';
  error: string;
}

/**
 * Options for configuring a MastraWorker
 */
export interface MastraWorkerOptions {
  /**
   * The Mastra instance to use for workflow execution.
   * The worker will use this instance's configuration.
   */
  mastra: Mastra;

  /**
   * Path to the worker entry script.
   * If not provided, defaults to the MASTRA_WORKER_ENTRY env var
   * or attempts to find a worker script in .mastra/worker.mjs
   */
  workerScript?: string;

  /**
   * Environment variables to pass to the worker process.
   */
  env?: Record<string, string>;

  /**
   * Timeout in milliseconds for waiting for worker to be ready.
   * @default 30000
   */
  startupTimeout?: number;

  /**
   * Whether to automatically restart the worker if it crashes.
   * @default true
   */
  autoRestart?: boolean;

  /**
   * Maximum number of restart attempts before giving up.
   * @default 3
   */
  maxRestarts?: number;

  /**
   * Delay in milliseconds between restart attempts.
   * @default 1000
   */
  restartDelay?: number;
}

/**
 * MastraWorker runs workflow execution in a separate Node.js process.
 *
 * This enables offloading CPU-intensive workflow operations from the main
 * HTTP server process, improving responsiveness and scalability.
 *
 * The worker process loads the same Mastra configuration and communicates
 * with the main process via IPC (Inter-Process Communication).
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core';
 * import { MastraWorker } from '@mastra/core/worker';
 *
 * const mastra = new Mastra({
 *   workflows: { myWorkflow },
 *   agents: { myAgent },
 * });
 *
 * // Start the worker
 * const worker = new MastraWorker({ mastra });
 * await worker.start();
 *
 * // The mastra instance now routes workflow execution to the worker
 * // via IPC pubsub instead of running in-process
 *
 * // Later, stop the worker
 * await worker.stop();
 * ```
 */
export class MastraWorker {
  private mastra: Mastra;
  private workerScript?: string;
  private childProcess?: ChildProcess;
  private ipcPubSub?: IPCPubSub;
  private env: Record<string, string>;
  private startupTimeout: number;
  private autoRestart: boolean;
  private maxRestarts: number;
  private restartDelay: number;
  private restartCount = 0;
  private isShuttingDown = false;
  private isStarted = false;

  constructor(options: MastraWorkerOptions) {
    this.mastra = options.mastra;
    this.workerScript = options.workerScript;
    this.env = options.env ?? {};
    this.startupTimeout = options.startupTimeout ?? 30000;
    this.autoRestart = options.autoRestart ?? true;
    this.maxRestarts = options.maxRestarts ?? 3;
    this.restartDelay = options.restartDelay ?? 1000;
  }

  /**
   * Start the worker process.
   *
   * This will:
   * 1. Fork a new Node.js process running the worker script
   * 2. Set up IPC communication between main and worker
   * 3. Replace the Mastra instance's pubsub with IPC-based pubsub
   * 4. Wait for the worker to signal it's ready
   *
   * @throws {Error} If the worker fails to start within the timeout
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Worker is already started');
    }

    const workerEntry = this.getWorkerEntryPath();

    // Create IPC pubsub for communication
    this.ipcPubSub = new IPCPubSub();

    // Fork the worker process
    this.childProcess = fork(workerEntry, [], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: {
        ...process.env,
        ...this.env,
        MASTRA_WORKER_MODE: 'true',
      },
    });

    // Attach IPC pubsub to the child process
    this.ipcPubSub.attachToChild(this.childProcess);

    // Set up event handlers
    this.setupProcessHandlers();

    // Wait for worker to signal ready
    await this.waitForReady();

    // Replace mastra's pubsub with IPC version
    await this.mastra.setPubSub(this.ipcPubSub);

    this.isStarted = true;
    this.restartCount = 0;

    this.mastra.getLogger()?.info('Mastra worker started successfully');
  }

  /**
   * Stop the worker process gracefully.
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.isShuttingDown = true;

    if (this.childProcess) {
      // Send shutdown signal
      this.childProcess.send({ type: 'shutdown' });

      // Give the worker time to clean up
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          // Force kill if graceful shutdown takes too long
          this.childProcess?.kill('SIGKILL');
          resolve();
        }, 5000);

        this.childProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.childProcess = undefined;
    }

    if (this.ipcPubSub) {
      await this.ipcPubSub.close();
      this.ipcPubSub = undefined;
    }

    this.isStarted = false;
    this.isShuttingDown = false;

    this.mastra.getLogger()?.info('Mastra worker stopped');
  }

  /**
   * Check if the worker is currently running.
   */
  get isRunning(): boolean {
    return this.isStarted && !!this.childProcess && this.childProcess.connected;
  }

  /**
   * Get the process ID of the worker.
   */
  get pid(): number | undefined {
    return this.childProcess?.pid;
  }

  /**
   * Resolve the worker entry script path.
   */
  private getWorkerEntryPath(): string {
    // Priority:
    // 1. Explicit workerScript option
    // 2. MASTRA_WORKER_ENTRY environment variable
    // 3. Default to .mastra/worker.mjs in current directory

    if (this.workerScript) {
      return path.resolve(this.workerScript);
    }

    if (process.env.MASTRA_WORKER_ENTRY) {
      return path.resolve(process.env.MASTRA_WORKER_ENTRY);
    }

    // Default path - this should be generated by the build process
    return path.resolve(process.cwd(), '.mastra', 'output', 'worker.mjs');
  }

  /**
   * Wait for the worker to signal it's ready.
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker failed to start within ${this.startupTimeout}ms`));
      }, this.startupTimeout);

      const messageHandler = (msg: WorkerMessage) => {
        if (msg.type === 'worker-ready') {
          clearTimeout(timeout);
          this.childProcess?.off('message', messageHandler);
          resolve();
        } else if (msg.type === 'worker-error') {
          clearTimeout(timeout);
          this.childProcess?.off('message', messageHandler);
          reject(new Error((msg as WorkerErrorMessage).error));
        }
      };

      this.childProcess?.on('message', messageHandler);

      this.childProcess?.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });

      this.childProcess?.on('exit', (code, signal) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code} (signal: ${signal})`));
        }
      });
    });
  }

  /**
   * Set up handlers for child process events.
   */
  private setupProcessHandlers(): void {
    if (!this.childProcess) return;

    this.childProcess.on('exit', async (code, signal) => {
      if (this.isShuttingDown) {
        return;
      }

      this.mastra.getLogger()?.warn(`Worker exited unexpectedly (code: ${code}, signal: ${signal})`);

      if (this.autoRestart && this.restartCount < this.maxRestarts) {
        this.restartCount++;
        this.mastra.getLogger()?.info(`Attempting to restart worker (attempt ${this.restartCount}/${this.maxRestarts})`);

        // Wait before restarting
        await new Promise(resolve => setTimeout(resolve, this.restartDelay));

        try {
          this.isStarted = false;
          await this.start();
        } catch (err) {
          this.mastra.getLogger()?.error('Failed to restart worker', err);
        }
      } else if (this.restartCount >= this.maxRestarts) {
        this.mastra.getLogger()?.error(`Worker exceeded maximum restart attempts (${this.maxRestarts})`);
      }
    });

    this.childProcess.on('error', err => {
      this.mastra.getLogger()?.error('Worker process error', err);
    });
  }
}

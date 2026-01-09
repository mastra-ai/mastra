import type { ChildProcess } from 'node:child_process';
import { PubSub } from './pubsub';
import type { Event } from './types';

/**
 * Message format for IPC communication
 */
interface IPCMessage {
  type: 'mastra:pubsub';
  topic: string;
  event: Event;
}

/**
 * PubSub implementation using Node.js IPC (process.send/process.on).
 *
 * This enables communication between a main process and worker processes
 * for distributed workflow execution. The main process can forward workflow
 * commands to workers, and workers can send results back.
 *
 * Usage in main process:
 * ```typescript
 * const pubsub = new IPCPubSub();
 * pubsub.attachToChild(childProcess);
 * ```
 *
 * Usage in worker process:
 * ```typescript
 * const pubsub = new IPCPubSub(); // Auto-detects worker mode
 * ```
 */
export class IPCPubSub extends PubSub {
  private handlers = new Map<string, Set<(event: Event, ack?: () => Promise<void>) => void>>();
  private childProcesses: Set<ChildProcess> = new Set();
  private isWorker: boolean;
  private messageHandler?: (msg: unknown) => void;

  constructor() {
    super();
    // Detect if we're running as a child process (worker)
    this.isWorker = typeof process.send === 'function';

    if (this.isWorker) {
      this.setupWorkerListener();
    }
  }

  /**
   * Set up the message listener for worker processes
   */
  private setupWorkerListener(): void {
    this.messageHandler = (msg: unknown) => {
      if (this.isIPCMessage(msg)) {
        this.handleIncomingEvent(msg.topic, msg.event);
      }
    };
    process.on('message', this.messageHandler);
  }

  /**
   * Type guard for IPC messages
   */
  private isIPCMessage(msg: unknown): msg is IPCMessage {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'type' in msg &&
      (msg as IPCMessage).type === 'mastra:pubsub' &&
      'topic' in msg &&
      'event' in msg
    );
  }

  /**
   * Attach a child process for IPC communication.
   * Call this from the main process after forking a worker.
   *
   * @param child - The child process to communicate with
   */
  attachToChild(child: ChildProcess): void {
    this.childProcesses.add(child);

    const handler = (msg: unknown) => {
      if (this.isIPCMessage(msg)) {
        this.handleIncomingEvent(msg.topic, msg.event);
      }
    };

    child.on('message', handler);

    // Clean up when child exits
    child.on('exit', () => {
      this.childProcesses.delete(child);
    });
  }

  /**
   * Detach a child process from IPC communication.
   *
   * @param child - The child process to detach
   */
  detachChild(child: ChildProcess): void {
    this.childProcesses.delete(child);
  }

  /**
   * Handle an incoming event from IPC
   */
  private handleIncomingEvent(topic: string, event: Event): void {
    const callbacks = this.handlers.get(topic);
    if (callbacks) {
      for (const cb of callbacks) {
        // IPC doesn't need acknowledgment, but we provide a no-op for compatibility
        cb(event, async () => {});
      }
    }
  }

  /**
   * Publish an event to the specified topic.
   *
   * - In worker mode: sends to parent process via IPC
   * - In main mode: sends to all attached child processes via IPC
   * - Always dispatches locally to any subscribed handlers
   */
  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const fullEvent: Event = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    } as Event;

    const ipcMessage: IPCMessage = {
      type: 'mastra:pubsub',
      topic,
      event: fullEvent,
    };

    if (this.isWorker) {
      // Worker: send to parent process
      process.send?.(ipcMessage);
    } else {
      // Main process: send to all child workers
      for (const child of this.childProcesses) {
        if (child.connected) {
          child.send(ipcMessage);
        }
      }
    }

    // Also dispatch locally for any local subscribers
    this.handleIncomingEvent(topic, fullEvent);
  }

  /**
   * Subscribe to events on a topic.
   */
  async subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)!.add(cb);
  }

  /**
   * Unsubscribe from events on a topic.
   */
  async unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    this.handlers.get(topic)?.delete(cb);
    if (this.handlers.get(topic)?.size === 0) {
      this.handlers.delete(topic);
    }
  }

  /**
   * Flush is a no-op for IPC since messages are sent immediately.
   */
  async flush(): Promise<void> {
    // No-op - IPC messages are sent synchronously
  }

  /**
   * Clean up resources.
   */
  async close(): Promise<void> {
    this.handlers.clear();
    this.childProcesses.clear();

    if (this.isWorker && this.messageHandler) {
      process.off('message', this.messageHandler);
    }
  }

  /**
   * Check if this pubsub instance is running in worker mode.
   */
  get isInWorkerMode(): boolean {
    return this.isWorker;
  }

  /**
   * Get the number of attached child processes (main process only).
   */
  get childCount(): number {
    return this.childProcesses.size;
  }
}

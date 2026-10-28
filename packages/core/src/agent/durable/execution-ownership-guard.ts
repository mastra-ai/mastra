import {
  DurableExecutionFenceError,
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
  EXECUTION_LEASE_TTL_MS,
  EXECUTION_UNVERIFIED_ERROR_ID,
} from './execution-fence';

/** One step's observation of its immutable driver's claim. Never renews it. */
export class ExecutionOwnershipGuard {
  readonly #controller = new AbortController();
  readonly #disposal = new AbortController();
  readonly #observe: () => Promise<void>;
  readonly #details: { agentId: string; runId: string; executionId: string };
  readonly #remote: boolean;
  #disposed = false;
  #pending?: Promise<void>;
  #deadline?: ReturnType<typeof setTimeout>;
  #poll?: ReturnType<typeof setInterval>;
  #unsubscribe?: () => void;

  constructor(options: {
    observe: () => Promise<void>;
    details: { agentId: string; runId: string; executionId: string };
    subscribe?: (listener: (error: DurableExecutionFenceError) => void) => () => void;
  }) {
    this.#observe = options.observe;
    this.#details = options.details;
    this.#remote = !options.subscribe;
    this.#unsubscribe = options.subscribe?.(error => this.#lose(error));
    this.#armDeadline();
    if (this.#remote) {
      this.#poll = setInterval(() => {
        if (!this.#pending) void this.check().catch(() => {});
      }, EXECUTION_LEASE_RENEW_INTERVAL_MS);
      this.#poll.unref?.();
    }
  }

  isLost(): boolean {
    return this.#controller.signal.aborted;
  }

  throwIfLost(): void {
    this.#controller.signal.throwIfAborted();
  }

  composeSignal(signal: AbortSignal | undefined): AbortSignal {
    return signal ? AbortSignal.any([signal, this.#controller.signal]) : this.#controller.signal;
  }

  #lose(error: DurableExecutionFenceError): void {
    if (this.#disposed || this.isLost()) return;
    this.#controller.abort(error);
    this.#stopTimers();
  }

  #armDeadline(): void {
    if (this.#deadline) clearTimeout(this.#deadline);
    if (this.isLost() || this.#disposed) return;
    this.#deadline = setTimeout(() => {
      this.#lose(new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, this.#details));
    }, EXECUTION_LEASE_TTL_MS);
    this.#deadline.unref?.();
  }

  async #bounded(operation: Promise<void>): Promise<void> {
    this.throwIfLost();
    if (this.#disposed) return;
    const signal = this.#controller.signal;
    let onAbort!: () => void;
    let onDispose!: () => void;
    const stopped = new Promise<void>((resolve, reject) => {
      onAbort = () => reject(signal.reason);
      onDispose = resolve;
      signal.addEventListener('abort', onAbort, { once: true });
      this.#disposal.signal.addEventListener('abort', onDispose, { once: true });
    });
    try {
      await Promise.race([operation, stopped]);
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.#disposal.signal.removeEventListener('abort', onDispose);
    }
  }

  /** Boundary callers wait for a fresh read, never an earlier periodic read. */
  async check(): Promise<void> {
    while (this.#pending) await this.#pending;
    this.throwIfLost();
    if (this.#disposed) return;
    if (!this.#remote) this.#armDeadline();
    const pending = this.#check();
    this.#pending = pending;
    try {
      await pending;
    } finally {
      if (this.#pending === pending) this.#pending = undefined;
    }
  }

  async #check(): Promise<void> {
    while (!this.#disposed) {
      try {
        await this.#bounded(this.#observe());
        if (this.#disposed) return;
        this.throwIfLost();
        if (this.#remote) this.#armDeadline();
        else if (this.#deadline) clearTimeout(this.#deadline);
        return;
      } catch (error) {
        this.throwIfLost();
        if (this.#disposed) return;
        if (error instanceof DurableExecutionFenceError) {
          this.#lose(error);
          throw error;
        }
        let timer!: ReturnType<typeof setTimeout>;
        try {
          await this.#bounded(
            new Promise<void>(resolve => {
              timer = setTimeout(resolve, 250);
              timer.unref?.();
            }),
          );
        } finally {
          clearTimeout(timer);
        }
      }
    }
  }

  #stopTimers(): void {
    if (this.#deadline) clearTimeout(this.#deadline);
    if (this.#poll) clearInterval(this.#poll);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#disposal.abort();
    this.#stopTimers();
    this.#unsubscribe?.();
  }
}

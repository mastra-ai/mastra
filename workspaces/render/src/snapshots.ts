import { setTimeout as delay } from 'node:timers/promises';
import type { Render } from '@renderinc/sdk';
import type {
  SandboxSnapshot,
  SandboxSnapshotCreateInput,
  SandboxSnapshotGetInput,
  SandboxSnapshotListInput,
  SandboxSnapshotDeleteInput,
} from '@renderinc/sdk/experimental';
import { RenderSandboxError } from './errors.js';
import { bounded, deadline } from './utils.js';

export interface SnapshotWaitOptions {
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}

/** Full public snapshot API, with bounded waits and receipts for late captures. */
export class RenderSnapshots {
  readonly pendingCreates = new Set<Promise<SandboxSnapshot>>();
  lastCreated?: SandboxSnapshot;
  /** Creation receipts, including late responses after aborted or timed-out waits. */
  readonly createdSnapshots = new Map<string, SandboxSnapshot>();
  constructor(
    private readonly api: () => Render['experimental']['sandboxes']['snapshots'],
    private readonly ownerId: `tea-${string}` | undefined,
    private readonly controlMs: number,
    private readonly pollMs: number,
  ) {}

  private async control<T>(operation: () => Promise<T>, options: SnapshotWaitOptions = {}): Promise<T> {
    options.abortSignal?.throwIfAborted();
    const wait = deadline(options.timeoutMs ?? this.controlMs, [options.abortSignal]);
    try {
      return await bounded(operation(), wait.signal);
    } finally {
      wait.dispose();
    }
  }

  create(input: SandboxSnapshotCreateInput, options: SnapshotWaitOptions = {}): Promise<SandboxSnapshot> {
    return this.control(() => {
      const pending = this.api().create({ ...input, ownerId: input.ownerId ?? this.ownerId });
      this.pendingCreates.add(pending);
      void pending
        .then(
          value => {
            this.lastCreated = value;
            this.createdSnapshots.set(value.id, value);
          },
          () => {},
        )
        .finally(() => this.pendingCreates.delete(pending));
      return pending;
    }, options);
  }
  get(input: SandboxSnapshotGetInput, options?: SnapshotWaitOptions) {
    return this.control(() => this.api().get({ ...input, ownerId: input.ownerId ?? this.ownerId }), options);
  }
  list(input: SandboxSnapshotListInput, options?: SnapshotWaitOptions) {
    return this.control(() => this.api().list({ ...input, ownerId: input.ownerId ?? this.ownerId }), options);
  }
  delete(input: SandboxSnapshotDeleteInput, options?: SnapshotWaitOptions) {
    return this.control(() => this.api().delete({ ...input, ownerId: input.ownerId ?? this.ownerId }), options);
  }
  async waitForAvailable(
    snapshot: SandboxSnapshot,
    options: SnapshotWaitOptions & { ownerId?: `tea-${string}` } = {},
  ): Promise<SandboxSnapshot> {
    const wait = deadline(options.timeoutMs ?? 120_000, [options.abortSignal]);
    let current = snapshot;
    try {
      while (true) {
        wait.signal.throwIfAborted();
        if (current.status === 'available') return current;
        if (current.status !== 'creating')
          throw new RenderSandboxError('STATE', `Snapshot ${current.id} failed: ${current.error ?? current.status}`, {
            snapshotId: current.id,
            sandboxGroupId: current.sandboxGroupId,
          });
        await delay(this.pollMs, undefined, { signal: wait.signal });
        current = await this.get(
          { snapshotId: current.id, sandboxGroupId: current.sandboxGroupId, ownerId: options.ownerId },
          { abortSignal: wait.signal },
        );
      }
    } catch (cause) {
      if (cause instanceof RenderSandboxError && cause.code === 'STATE') throw cause;
      throw new RenderSandboxError(
        wait.signal.aborted
          ? wait.signal.reason instanceof RenderSandboxError
            ? wait.signal.reason.code
            : 'ABORTED'
          : 'STREAM',
        `Snapshot ${current.id} is not confirmed available; inspect this ID before another capture`,
        { snapshotId: current.id, sandboxGroupId: current.sandboxGroupId },
        { cause },
      );
    } finally {
      wait.dispose();
    }
  }
  async capture(input: SandboxSnapshotCreateInput, options: SnapshotWaitOptions = {}) {
    const wait = deadline(options.timeoutMs ?? 120_000, [options.abortSignal]);
    try {
      const snapshot = await this.create(input, { abortSignal: wait.signal });
      return await this.waitForAvailable(snapshot, {
        abortSignal: wait.signal,
        timeoutMs: options.timeoutMs,
        ownerId: input.ownerId,
      });
    } finally {
      wait.dispose();
    }
  }
}

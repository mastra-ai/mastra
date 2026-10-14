import { LibsqlError } from '@libsql/client';
import type { Client, InStatement, InArgs, Transaction, TransactionMode } from '@libsql/client';
import { MastraError } from '@mastra/core/error';

export type StorageFamily = 'BUSY' | 'CONSTRAINT' | 'CLOSED' | 'OTHER' | 'RECONNECT_FORBIDDEN';
const trusted = new WeakSet<object>();
export class StorageFault extends Error {
  readonly code = 'VRQ_STORAGE_TERMINAL';
  readonly family: StorageFamily;
  constructor(family: StorageFamily = 'OTHER') {
    super('STORAGE_FAILURE');
    this.family = family;
    this.name = 'StorageFault';
    this.stack = 'STORAGE_FAILURE';
    trusted.add(this);
  }
}
export function isStorageFailure(error: unknown): boolean {
  const seen = new Set<object>();
  for (let depth = 0; depth < 8 && error instanceof Error && !seen.has(error); depth++) {
    if (
      trusted.has(error) ||
      error instanceof LibsqlError ||
      (error instanceof MastraError && error.domain === 'STORAGE' && error.id.startsWith('MASTRA_STORAGE_LIBSQL_'))
    )
      return true;
    seen.add(error);
    error = error.cause;
  }
  return false;
}
export class UnpersistedStorageFault extends StorageFault {
  readonly persistence = 'unpersisted';
  constructor() {
    super();
    this.message = 'STORAGE_FAILURE_UNPERSISTED';
    this.stack = this.message;
  }
}

function family(error: unknown): StorageFamily {
  if (error instanceof StorageFault) return error.family;
  if (!(error instanceof LibsqlError)) return 'OTHER';
  if (['SQLITE_BUSY', 'SQLITE_BUSY_SNAPSHOT', 'SQLITE_LOCKED'].includes(error.code)) return 'BUSY';
  if (error.code.startsWith('SQLITE_CONSTRAINT')) return 'CONSTRAINT';
  if (error.code === 'CLIENT_CLOSED') return 'CLOSED';
  return 'OTHER';
}

// A composition owns its active runs. Native storage failure cannot depend on a DB read or stop write.
export class StorageOwner {
  private failed = false;
  private unpersisted = false;
  private readonly active = new Map<
    string,
    { failure?: () => Promise<void>; close?: () => Promise<void>; terminal?: Promise<void> }
  >();
  claim(runId: string) {
    this.assertHealthy();
    if (this.active.has(runId)) throw new Error('WORKFLOW_OWNER_CONFLICT');
    this.active.set(runId, {});
  }
  bind(runId: string, failure: () => Promise<void>, close: () => Promise<void>) {
    const lease = this.active.get(runId);
    if (!lease || lease.close) throw new Error('WORKFLOW_OWNER_CONFLICT');
    lease.failure = failure;
    lease.close = close;
    if (this.failed) this.failLease(lease);
  }
  private failLease(lease: { failure?: () => Promise<void>; terminal?: Promise<void> }) {
    if (!lease.terminal && lease.failure)
      lease.terminal = Promise.resolve()
        .then(lease.failure)
        .catch(() => {
          this.unpersisted = true;
        });
  }
  release(runId: string) {
    this.active.delete(runId);
  }
  stop() {
    this.failed = true;
    for (const lease of this.active.values()) this.failLease(lease);
  }
  async settled() {
    await Promise.all([...this.active.values()].map(lease => lease.terminal));
    if (this.unpersisted) throw new UnpersistedStorageFault();
  }
  async settle(runId: string) {
    await this.active.get(runId)?.terminal;
    if (this.unpersisted) throw new UnpersistedStorageFault();
  }
  async close() {
    this.stop();
    const leases = [...this.active.entries()];
    for (const [runId, lease] of leases) {
      await lease.terminal;
      try {
        await lease.close?.();
      } catch {
        this.unpersisted = true;
      }
      this.release(runId);
    }
    if (this.unpersisted) throw new UnpersistedStorageFault();
  }
  assertHealthy() {
    if (this.failed) throw new StorageFault();
  }
  get stopped() {
    return this.failed;
  }
  get incompletePersistence() {
    return this.unpersisted;
  }
  get activeRuns() {
    return this.active.size;
  }
}

// Repositories need SQL and transactions, not transport/reconnection controls.
export type DatabaseClient = Pick<Client, 'execute' | 'batch' | 'transaction'>;
type OwnedTransaction = Omit<Transaction, 'execute'> & Pick<Client, 'execute'>;
// Shared by physical clients for one database; a rejected operation never poisons admission.
export class DatabaseAdmission {
  private pending: Promise<void> = Promise.resolve();
  acquire() {
    const previous = this.pending;
    let release!: () => void;
    this.pending = new Promise<void>(resolve => {
      release = resolve;
    });
    return { previous, release };
  }
}
export class OwnedClient implements Client {
  private fault?: StorageFault;
  private closing = false;
  private finished = false;
  private closeFailed = false;
  private active = 0;
  private readonly lane: DatabaseAdmission;
  private completion?: Promise<void>;
  private complete?: () => void;
  private rejectClose?: (error: StorageFault) => void;
  private ready?: Promise<void>;
  private readonly initialize?: (client: Client) => Promise<void>;
  private readonly beforeAdmission?: () => Promise<void>;
  private raw?: Client;
  private readonly createUnderlying?: () => Client;
  private get underlying() {
    return (this.raw ??= this.createUnderlying!());
  }
  private readonly onFault?: () => void;
  constructor(
    underlying: Client | (() => Client),
    onFault?: () => void,
    initialize?: (client: Client) => Promise<void>,
    lane = new DatabaseAdmission(),
    beforeAdmission?: () => Promise<void>,
  ) {
    if (typeof underlying === 'function') this.createUnderlying = underlying;
    else this.raw = underlying;
    this.lane = lane;
    this.onFault = onFault;
    this.initialize = initialize;
    this.beforeAdmission = beforeAdmission;
  }
  // The first admitted operation owns startup. Closing an unused client opens nothing.
  private startup() {
    return (this.ready ??= (async () => {
      await this.beforeAdmission?.();
      const admission = this.lane.acquire();
      try {
        await admission.previous;
        await this.initialize?.(this.underlying);
      } finally {
        admission.release();
      }
    })());
  }
  get protocol() {
    return this.raw?.protocol ?? 'file';
  }
  get closed() {
    return this.finished && !this.closeFailed && (this.raw?.closed ?? true);
  }
  get state() {
    return this.finished
      ? this.closeFailed
        ? 'quarantined'
        : 'closed'
      : this.closing
        ? 'draining'
        : this.fault
          ? 'quarantined'
          : 'healthy';
  }
  private quarantine(error: unknown) {
    if (!this.fault) {
      this.fault = new StorageFault(family(error));
      this.onFault?.();
    }
    return this.fault;
  }
  private admit(cleanup = false, existingTransaction = false) {
    if (this.finished || (!cleanup && (this.fault || (this.closing && !existingTransaction))))
      throw this.fault ?? new StorageFault('CLOSED');
    this.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.tryClose();
    };
  }
  private async operation<T>(execute: () => Promise<T>, cleanup = false, existingTransaction = false) {
    const release = this.admit(cleanup, existingTransaction);
    let lane: ReturnType<DatabaseAdmission['acquire']> | undefined;
    try {
      await this.startup();
      lane = existingTransaction ? undefined : this.lane.acquire();
      await lane?.previous;
      if (this.fault && !cleanup) throw this.fault;
      return await execute();
    } catch (error) {
      throw this.quarantine(error);
    } finally {
      lane?.release();
      release();
    }
  }
  execute(statement: InStatement): ReturnType<Client['execute']>;
  execute(sql: string, args?: InArgs): ReturnType<Client['execute']>;
  execute(statement: InStatement | string, args?: InArgs) {
    return this.operation(() =>
      typeof statement === 'string' ? this.underlying.execute(statement, args) : this.underlying.execute(statement),
    );
  }
  batch(...args: Parameters<Client['batch']>) {
    return this.operation(() => this.underlying.batch(...args));
  }
  migrate(...args: Parameters<Client['migrate']>) {
    return this.operation(() => this.underlying.migrate(...args));
  }
  executeMultiple(...args: Parameters<Client['executeMultiple']>) {
    return this.operation(() => this.underlying.executeMultiple(...args));
  }
  sync() {
    return this.operation(() => this.underlying.sync());
  }
  reconnect(): void {
    throw new StorageFault('RECONNECT_FORBIDDEN');
  }
  async transaction(mode?: TransactionMode): Promise<OwnedTransaction> {
    const release = this.admit();
    let lane: ReturnType<DatabaseAdmission['acquire']> | undefined;
    let transaction: Transaction;
    try {
      await this.startup();
      lane = this.lane.acquire();
      await lane.previous;
      if (this.fault) throw this.fault;
      transaction = await this.underlying.transaction(mode);
    } catch (error) {
      const fault = this.quarantine(error);
      lane?.release();
      release();
      throw fault;
    }
    let settled = false,
      closeFailed = false,
      pending: Promise<unknown> = Promise.resolve();
    const finish = () => {
      if (settled) return;
      settled = true;
      lane?.release();
      release();
    };
    const execute = <T>(fn: () => Promise<T>, cleanup = false) => {
      const result = pending.then(async () => {
        if (settled) throw new StorageFault('CLOSED');
        return this.operation(fn, cleanup, true);
      });
      pending = result.catch(() => {});
      return result;
    };
    const close = () => {
      void pending.then(() => {
        if (settled) return;
        try {
          transaction.close();
        } catch (error) {
          closeFailed = true;
          this.quarantine(error);
        } finally {
          finish();
        }
      });
    };
    return {
      get closed() {
        return settled && !closeFailed && transaction.closed;
      },
      execute: (statement: InStatement | string, args?: InArgs) =>
        execute(() =>
          typeof statement === 'string'
            ? transaction.execute({ sql: statement, args: args ?? [] })
            : transaction.execute(statement),
        ),
      batch: statements => execute(() => transaction.batch(statements)),
      executeMultiple: sql => execute(() => transaction.executeMultiple(sql)),
      commit: () => execute(() => transaction.commit()).then(finish),
      rollback: () =>
        execute(() => transaction.rollback(), true).then(finish, error => {
          try {
            transaction.close();
          } catch (closeError) {
            closeFailed = true;
            this.quarantine(closeError);
          } finally {
            finish();
          }
          throw error;
        }),
      close,
    };
  }
  close() {
    if (this.closing || this.finished) return;
    this.closing = true;
    this.completion = new Promise<void>((resolve, reject) => {
      this.complete = resolve;
      this.rejectClose = reject;
    });
    void this.completion.catch(() => {});
    // Transaction owners perform their own rollback/close; do not abort admitted scopes here.
    this.tryClose();
  }
  private tryClose() {
    if (!this.closing || this.active || this.finished) return;
    this.finished = true;
    try {
      this.raw?.close();
      this.complete?.();
    } catch (error) {
      this.closeFailed = true;
      this.rejectClose?.(this.quarantine(error));
    }
  }
  async drain() {
    this.close();
    await this.completion;
    if (this.fault) throw this.fault;
  }
}
// Native lifecycle callbacks can log/swallow their own errors. Application callers verify the owner
// after the actual public exporter flush, rather than trusting an already-computed native result.
export async function executeWithStorageOwner<T>(
  owner: StorageOwner,
  flush: () => Promise<void>,
  execute: () => Promise<T>,
): Promise<T> {
  owner.assertHealthy();
  try {
    const result = await execute();
    await flush();
    await owner.settled();
    owner.assertHealthy();
    return result;
  } catch (error) {
    if (isStorageFailure(error) || owner.stopped) {
      owner.stop();
      await owner.settled();
      throw new StorageFault();
    }
    throw error;
  }
}

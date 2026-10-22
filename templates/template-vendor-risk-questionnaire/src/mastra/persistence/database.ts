import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import type { Client, InStatement, InArgs, TransactionMode } from '@libsql/client';
import { MastraCompositeStore } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import type { DuckDBStore } from '@mastra/duckdb';
import { DatabaseAdmission, OwnedClient, StorageOwner, StorageFault, UnpersistedStorageFault } from './client.ts';
import type { DatabaseClient } from './client.ts';
import { localDatabasePath, writerLease } from './ownership.ts';
import { resolveRuntimeRoot } from '../runtime/paths.ts';

export const runtimeRoot = resolveRuntimeRoot();
export const databaseUrl = `file:${resolve(runtimeRoot, 'vrq.db')}`;
export const telemetryPath = (url: string) => `${localDatabasePath(url)}.telemetry.duckdb`;

export class TelemetryHealth {
  private incomplete = false;
  degrade() {
    this.incomplete = true;
  }
  get status() {
    return this.incomplete ? ('degraded_incomplete' as const) : ('healthy' as const);
  }
}

type DatabaseGroup = {
  lane: DatabaseAdmission;
  lease: ReturnType<typeof writerLease>;
  application: OwnedClient;
  applicationInput?: Client;
  owners: Set<StorageOwner>;
  borrowers: number;
  compositions: number;
  closing?: Promise<void>;
  ready?: Promise<void>;
};
const groups = new Map<string, DatabaseGroup>();
const keyFor = (url: string) => localDatabasePath(url);
let readOnlyDefault = false;
// CLI status/metrics explicitly opt into query-only access before opening any repository.
export function configureReadOnlyAccess() {
  readOnlyDefault = true;
}
function groupFor(url: string, underlying?: Client) {
  const key = keyFor(url);
  let group = groups.get(key);
  const ready = group?.closing;
  if (ready) group = undefined;
  if (group) {
    return group;
  }
  const lane = new DatabaseAdmission();
  const owners = new Set<StorageOwner>();
  const application = new OwnedClient(
    underlying ?? (() => createClient({ url })),
    () => {
      for (const owner of owners) owner.stop();
    },
    undefined,
    lane,
  );
  group = {
    lane,
    application,
    applicationInput: underlying,
    lease: writerLease(url),
    owners,
    borrowers: 0,
    compositions: 0,
    ready,
  };
  groups.set(key, group);
  return group;
}
async function releaseGroup(url: string, group: DatabaseGroup) {
  if (group.borrowers || group.compositions) return;
  group.closing ??= (async () => {
    try {
      await group.application.drain();
    } finally {
      group.lease.release();
      if (groups.get(keyFor(url)) === group) groups.delete(keyFor(url));
    }
  })();
  await group.closing;
}

// Repositories borrow one application connection. Closing a repository cannot close a
// composition's connection or abort a transaction admitted by a different repository.
class DatabaseBorrower implements DatabaseClient {
  private released = false;
  private completion?: Promise<void>;
  private readonly client: OwnedClient;
  private readonly release: () => Promise<void>;
  readonly readOnly: boolean;
  constructor(client: OwnedClient, release: () => Promise<void>, readOnly = false) {
    this.client = client;
    this.release = release;
    this.readOnly = readOnly;
  }
  get closed() {
    return this.released;
  }
  private check() {
    if (this.released) throw new StorageFault('CLOSED');
  }
  execute(statement: InStatement): ReturnType<Client['execute']>;
  execute(sql: string, args?: InArgs): ReturnType<Client['execute']>;
  execute(statement: InStatement | string, args?: InArgs) {
    this.check();
    return typeof statement === 'string' ? this.client.execute(statement, args) : this.client.execute(statement);
  }
  batch(...args: Parameters<Client['batch']>) {
    this.check();
    return this.client.batch(...args);
  }
  transaction(mode?: TransactionMode) {
    this.check();
    return this.client.transaction(mode);
  }
  close() {
    if (this.released) return;
    this.released = true;
    this.completion = this.release();
    void this.completion.catch(() => {});
  }
  async drain() {
    this.close();
    await this.completion;
  }
}

export function createNativeStorage(
  id: string,
  url: string,
  underlying?: Client,
  owner = new StorageOwner(),
  application?: Client,
) {
  const group = groupFor(url, application);
  group.compositions++;
  group.owners.add(owner);
  // WorkflowsLibSQL starts PRAGMAs in its constructor, before public init().
  // Keep those calls behind explicit activation and the process writer lease.
  let activate!: () => void, cancel!: (error: Error) => void;
  const activation = new Promise<void>((resolve, reject) => {
    activate = resolve;
    cancel = reject;
  });
  const client = new OwnedClient(
    underlying ?? (() => createClient({ url, timeout: 5000 })),
    () => owner.stop(),
    async raw => {
      if (!underlying)
        for (const sql of [
          'PRAGMA journal_mode=WAL;',
          'PRAGMA busy_timeout=5000;',
          'PRAGMA synchronous=NORMAL;',
          'PRAGMA temp_store=MEMORY;',
          'PRAGMA cache_size=-16000;',
          'PRAGMA mmap_size=134217728;',
        ])
          await raw.execute(sql);
    },
    group.lane,
    async () => {
      await activation;
      await group.ready;
      for (const authority of group.owners) authority.assertHealthy();
      group.lease.acquire();
    },
  );
  const native = new LibSQLStore({ id: `${id}-workflows`, client });
  let telemetry: DuckDBStore | undefined;
  const health = new TelemetryHealth();
  let telemetryRequested = true,
    telemetryReady: Promise<void> | undefined;
  const initializeTelemetry = () =>
    (telemetryReady ??= (async () => {
      const { DuckDBStore } = await import('@mastra/duckdb');
      telemetry = new DuckDBStore({ id: `${id}-telemetry`, path: telemetryPath(url) });
      const domain = telemetry.stores.observability!;
      // Observe public adapter failures even when the native exporter catches them.
      storage.stores.observability = new Proxy(domain, {
        get(target, key) {
          const value = Reflect.get(target, key, target);
          if (typeof value !== 'function') return value;
          if (typeof key === 'string' && (key.startsWith('__') || key === 'getFeatures' || key === 'getLogger'))
            return value.bind(target);
          return (...args: unknown[]) => {
            try {
              const result = value.apply(target, args);
              return result && typeof result.then === 'function'
                ? result.catch((error: unknown) => {
                    health.degrade();
                    throw error;
                  })
                : result;
            } catch (error) {
              health.degrade();
              throw error;
            }
          };
        },
      });
      await telemetry.init();
    })());
  let initialized: Promise<void> | undefined, closing: Promise<void> | undefined;
  let activated = false;
  let accepting = true;
  const admitted = new Set<Promise<unknown>>();
  class LocalStorage extends MastraCompositeStore {
    declare stores: StorageDomains;
    private admit<T>(execute: () => Promise<T>): Promise<T> {
      if (!accepting) return Promise.reject(new StorageFault('CLOSED'));
      const pending = Promise.resolve().then(execute);
      admitted.add(pending);
      void pending.finally(() => admitted.delete(pending)).catch(() => {});
      return pending;
    }
    override getStore<K extends keyof StorageDomains>(name: K): Promise<StorageDomains[K] | undefined> {
      return this.admit(async () => {
        // An admitted lookup may reach lazy startup after close has sealed admission.
        // Use the internal initializer so that lookup can finish before adapter teardown.
        await this.initialize();
        if (name === 'observability') {
          try {
            await initializeTelemetry();
          } catch {
            health.degrade();
          }
        }
        return this.stores[name];
      });
    }
    override init() {
      return this.admit(() => this.initialize());
    }
    private initialize() {
      initialized ??= (async () => {
        // Report process ownership conflicts before adapter startup sanitizes them.
        // Keep constructor-time operations blocked until this composition owns the writer.
        try {
          await group.ready;
          for (const authority of group.owners) authority.assertHealthy();
          group.lease.acquire();
        } catch (error) {
          cancel(error instanceof Error ? error : new StorageFault());
          throw error;
        }
        activated = true;
        activate();
        await native.init();
        try {
          if (telemetryRequested) await initializeTelemetry();
        } catch {
          health.degrade();
        }
      })();
      return initialized;
    }
    override close() {
      accepting = false;
      closing ??= (async () => {
        // Await whole admitted calls, including callbacks queued before lazy telemetry
        // startup, before closing either physical adapter. Rejections still drain below.
        await Promise.allSettled([...admitted]);
        if (!activated) cancel(new StorageFault('CLOSED'));
        owner.stop();
        client.close();
        let failed = false,
          unpersisted = false;
        for (const close of [() => owner.close(), () => native.close(), () => client.drain()]) {
          try {
            await close();
          } catch (error) {
            failed = true;
            if (error instanceof UnpersistedStorageFault) unpersisted = true;
          }
        }
        try {
          await telemetry?.close();
        } catch {
          health.degrade();
        }
        group.owners.delete(owner);
        group.compositions--;
        try {
          await releaseGroup(url, group);
        } catch {
          failed = true;
        }
        if (unpersisted) throw new UnpersistedStorageFault();
        if (failed && activated) throw new StorageFault();
      })();
      return closing;
    }
  }
  const storage = new LocalStorage({ id, default: native });
  storage.stores.observability = undefined;
  return {
    storage,
    client,
    owner,
    get telemetry() {
      if (!telemetry) throw new Error('TELEMETRY_NOT_INITIALIZED');
      return telemetry;
    },
    telemetryHealth: health,
    deferTelemetry() {
      if (initialized || admitted.size || !accepting) throw new Error('COMPOSITION_ALREADY_INITIALIZED');
      telemetryRequested = false;
    },
    close: () => storage.close(),
  };
}
export const nativeStorage = createNativeStorage('vendor-risk-local', databaseUrl);
export const storage = nativeStorage.storage;
export const storageOwner = nativeStorage.owner;
export const telemetryHealth = nativeStorage.telemetryHealth;

export async function openReadOnlyDatabase(url: string) {
  const client = new OwnedClient(() => createClient({ url }));
  await client.execute('PRAGMA query_only=ON');
  return new DatabaseBorrower(client, () => client.drain(), true);
}
export async function openDatabase(url: string, owner?: StorageOwner, underlying?: Client) {
  if (readOnlyDefault && url === databaseUrl) {
    return openReadOnlyDatabase(url);
  }
  let group: DatabaseGroup;
  do {
    group = groupFor(url, underlying);
    await group.ready;
    // A repository close may begin while this borrower awaits its predecessor.
    // Recheck identity and lifecycle before retaining the selected connection.
  } while (group.closing || groups.get(keyFor(url)) !== group);
  for (const authority of group.owners) authority.assertHealthy();
  group.lease.acquire();
  if (owner) group.owners.add(owner);
  group.borrowers++;
  const connection =
    underlying && underlying !== group.application && underlying !== group.applicationInput
      ? new OwnedClient(underlying, () => owner?.stop(), undefined, group.lane)
      : group.application;
  const client = new DatabaseBorrower(connection, async () => {
    try {
      if (connection !== group.application) await connection.drain();
    } finally {
      group.borrowers--;
      await releaseGroup(url, group);
    }
  });
  try {
    await client.batch(
      [
        "CREATE TABLE IF NOT EXISTS vrq_questionnaire_lifecycle (run_id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('cancelled','removed')))",
        'CREATE TABLE IF NOT EXISTS vrq_http_jobs (run_id TEXT PRIMARY KEY, error TEXT)',
        'CREATE TABLE IF NOT EXISTS vrq_events (run_id TEXT NOT NULL, event_key TEXT NOT NULL, event_json TEXT NOT NULL, PRIMARY KEY(run_id,event_key))',
        'CREATE TABLE IF NOT EXISTS vrq_diagnostics (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, diagnostic_json TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_sources (digest TEXT PRIMARY KEY, source_id TEXT NOT NULL, original_name TEXT NOT NULL, size_bytes INTEGER NOT NULL, bytes BLOB NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_consistency (run_id TEXT NOT NULL, digest TEXT NOT NULL, outcome INTEGER NOT NULL, PRIMARY KEY(run_id,digest))',
        'CREATE TABLE IF NOT EXISTS vrq_draft_inputs (run_id TEXT PRIMARY KEY, input_json TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_interpretations (run_id TEXT NOT NULL, question_id TEXT NOT NULL, interpretation_json TEXT NOT NULL, PRIMARY KEY(run_id,question_id))',
        'CREATE TABLE IF NOT EXISTS vrq_draft_owners (run_id TEXT PRIMARY KEY, workflow_run_id TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_document_plans (run_id TEXT PRIMARY KEY, plan_json TEXT)',
        'CREATE TABLE IF NOT EXISTS vrq_respond (run_id TEXT PRIMARY KEY, checkpoint_json TEXT NOT NULL, source_bytes BLOB NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_intakes (run_id TEXT PRIMARY KEY, digest TEXT NOT NULL, canonical_json TEXT NOT NULL, mapping_json TEXT NOT NULL, source_digest TEXT NOT NULL, created_at TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_evidence_snapshots (run_id TEXT PRIMARY KEY, digest TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL)',
      ],
      'write',
    );
    return client;
  } catch (error) {
    await client.drain().catch(() => {});
    throw error;
  }
}

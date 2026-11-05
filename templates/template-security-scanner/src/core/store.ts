import { createClient, type Transaction } from '@libsql/client';
import { ControlPlaneError } from './contracts.js';

/** Supported operator-owned control-plane record category. */
export type RecordKind = 'policy' | 'target' | 'profile';
/** Minimal persisted identity and concurrency metadata. */
export type StoredRecord = {
  /** Stable identifier of this record. */
  id: string;
  /** Operator that owns this record; derived from the authenticated session. */
  owner: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
};

// Application tables deliberately use a separate public libSQL client, never Mastra's internal client/tables.
export class DomainStore {
  private readonly client;
  private pendingWrite: Promise<unknown> = Promise.resolve();
  constructor(url: string) {
    this.client = createClient({ url });
  }
  async initialize() {
    await this.client.execute('PRAGMA busy_timeout = 5000');
    await this.client.execute('PRAGMA foreign_keys = ON');
    await this.write(async transaction => {
      await transaction.execute('CREATE TABLE IF NOT EXISTS scanner_migrations (version INTEGER PRIMARY KEY)');
      const versions = await transaction.execute('SELECT version FROM scanner_migrations');
      if (versions.rows.some(row => Number(row.version) > 4))
        throw new ControlPlaneError('DATABASE_VERSION_UNSUPPORTED', 503);
      if (!versions.rows.some(row => Number(row.version) === 1)) {
        await transaction.execute(`CREATE TABLE scanner_records (
          kind TEXT NOT NULL CHECK(kind IN ('policy','target','profile')), id TEXT PRIMARY KEY,
          owner TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0), data TEXT NOT NULL)`);
        await transaction.execute('CREATE INDEX scanner_records_owner_kind ON scanner_records(owner, kind, id)');
        await transaction.execute(`CREATE TABLE scanner_credentials (
          profile_id TEXT PRIMARY KEY REFERENCES scanner_records(id) ON DELETE CASCADE, envelope TEXT NOT NULL)`);
        await transaction.execute(`CREATE TABLE scanner_record_revisions (
          kind TEXT NOT NULL, id TEXT NOT NULL, owner TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL,
          PRIMARY KEY(id,revision))`);
        await transaction.execute('INSERT INTO scanner_migrations(version) VALUES (1)');
      }
    });
  }
  async write<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    const pending = this.pendingWrite.then(async () => {
      const transaction = await this.client.transaction('write');
      try {
        const value = await operation(transaction);
        await transaction.commit();
        return value;
      } catch (error) {
        await transaction.rollback();
        throw error;
      } finally {
        transaction.close();
      }
    });
    this.pendingWrite = pending.catch(() => undefined);
    return pending;
  }
  /** Load an operator-owned revisioned record of the requested domain kind. */
  async get<T extends StoredRecord>(
    kind: RecordKind,
    id: string,
    owner: string,
    transaction?: Transaction,
  ): Promise<T> {
    const result = await (transaction ?? this.client).execute({
      sql: 'SELECT data FROM scanner_records WHERE kind = ? AND id = ? AND owner = ?',
      args: [kind, id, owner],
    });
    if (!result.rows[0]) throw new ControlPlaneError('NOT_FOUND', 404);
    return JSON.parse(String(result.rows[0].data)) as T;
  }
  /** List operator-owned domain records of one kind with bounded pagination. */
  async list<T>(
    kind: RecordKind,
    owner: string,
    limit: number,
    offset: number,
    transaction?: Transaction,
  ): Promise<T[]> {
    const result = await (transaction ?? this.client).execute({
      sql: 'SELECT data FROM scanner_records WHERE kind = ? AND owner = ? ORDER BY id LIMIT ? OFFSET ?',
      args: [kind, owner, limit, offset],
    });
    return result.rows.map(row => JSON.parse(String(row.data)) as T);
  }
  private async saveRevision(kind: RecordKind, record: StoredRecord, transaction: Transaction) {
    await transaction.execute({
      sql: 'INSERT INTO scanner_record_revisions(kind,id,owner,revision,data) VALUES (?,?,?,?,?)',
      args: [kind, record.id, record.owner, record.revision, JSON.stringify(record)],
    });
  }
  async revisions(kind: RecordKind, id: string, owner: string, limit: number, offset: number) {
    await this.get(kind, id, owner);
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_record_revisions WHERE kind = ? AND id = ? AND owner = ? ORDER BY revision DESC LIMIT ? OFFSET ?',
      args: [kind, id, owner, limit, offset],
    });
    return result.rows.map(row => JSON.parse(String(row.data)));
  }
  async insert(kind: RecordKind, record: StoredRecord, transaction: Transaction) {
    await transaction.execute({
      sql: 'INSERT INTO scanner_records(kind,id,owner,revision,data) VALUES (?,?,?,?,?)',
      args: [kind, record.id, record.owner, record.revision, JSON.stringify(record)],
    });
    await this.saveRevision(kind, record, transaction);
  }
  /** Replace a domain record only when its persisted owner and expected revision match. */
  async replace(kind: RecordKind, record: StoredRecord, expectedRevision: number, transaction: Transaction) {
    const result = await transaction.execute({
      sql: 'UPDATE scanner_records SET revision = ?, data = ? WHERE kind = ? AND id = ? AND owner = ? AND revision = ?',
      args: [record.revision, JSON.stringify(record), kind, record.id, record.owner, expectedRevision],
    });
    if (result.rowsAffected !== 1) throw new ControlPlaneError('REVISION_CONFLICT', 409);
    await this.saveRevision(kind, record, transaction);
  }
  /** Delete an operator-owned record only when its expected revision is current. */
  async remove(kind: RecordKind, id: string, owner: string, revision: number, transaction: Transaction) {
    const result = await transaction.execute({
      sql: 'DELETE FROM scanner_records WHERE kind = ? AND id = ? AND owner = ? AND revision = ?',
      args: [kind, id, owner, revision],
    });
    if (result.rowsAffected !== 1) throw new ControlPlaneError('REVISION_CONFLICT', 409);
    await transaction.execute({
      sql: 'DELETE FROM scanner_record_revisions WHERE kind = ? AND id = ? AND owner = ?',
      args: [kind, id, owner],
    });
  }
  async setEnvelope(profileId: string, envelope: string, transaction: Transaction) {
    await transaction.execute({
      sql: 'INSERT INTO scanner_credentials(profile_id,envelope) VALUES (?,?) ON CONFLICT(profile_id) DO UPDATE SET envelope = excluded.envelope',
      args: [profileId, envelope],
    });
  }
  /** Load a profile's sealed credential envelope or fail with CREDENTIAL_UNAVAILABLE. */
  async envelope(profileId: string, transaction?: Transaction) {
    const result = await (transaction ?? this.client).execute({
      sql: 'SELECT envelope FROM scanner_credentials WHERE profile_id = ?',
      args: [profileId],
    });
    if (!result.rows[0]) throw new ControlPlaneError('CREDENTIAL_UNAVAILABLE', 503);
    return String(result.rows[0].envelope);
  }
  async deleteEnvelope(profileId: string, transaction: Transaction) {
    await transaction.execute({ sql: 'DELETE FROM scanner_credentials WHERE profile_id = ?', args: [profileId] });
  }
  async dependentTargets(policyId: string, owner: string, transaction: Transaction) {
    const result = await transaction.execute({
      sql: "SELECT 1 FROM scanner_records WHERE kind = 'target' AND owner = ? AND json_extract(data,'$.policyId') = ? LIMIT 1",
      args: [owner, policyId],
    });
    return result.rows.length > 0;
  }
  close() {
    this.client.close();
  }
}

import { createClient, type Transaction } from '@libsql/client';
import { ControlPlaneError } from '../core/contracts.js';
import { advisoryId, materialHash, type AdvisoryDetail } from './contracts.js';

export type CursorKind = 'head' | 'rotation';
export class AdvisoryStore {
  private readonly client;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(url: string) {
    this.client = createClient({ url });
  }
  private async write<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    const work = this.pending.then(async () => {
      const tx = await this.client.transaction('write');
      try {
        const result = await operation(tx);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    });
    this.pending = work.catch(() => undefined);
    return work;
  }
  async initialize() {
    await this.client.execute('PRAGMA busy_timeout = 5000');
    await this.write(async tx => {
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisories (
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision > 0), material_hash TEXT NOT NULL,
        record_revision INTEGER NOT NULL DEFAULT 1 CHECK(record_revision > 0),
        provider_modified_at TEXT NOT NULL, retrieved_at TEXT NOT NULL, upstream_status TEXT NOT NULL,
        triage_status TEXT NOT NULL CHECK(triage_status IN ('new','triaged','investigating','closed')),
        detail TEXT NOT NULL)`);
      const columns = await tx.execute('PRAGMA table_info(scanner_advisories)');
      if (!columns.rows.some(row => String(row.name) === 'record_revision')) {
        await tx.execute(
          'ALTER TABLE scanner_advisories ADD COLUMN record_revision INTEGER NOT NULL DEFAULT 1 CHECK(record_revision > 0)',
        );
        // Invalidate all tokens issued by the earlier advisory schema.
        await tx.execute('UPDATE scanner_advisories SET record_revision = revision + 1');
      }
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_aliases (
        alias TEXT PRIMARY KEY, id TEXT NOT NULL REFERENCES scanner_advisories(id))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_refresh_queue (
        position INTEGER PRIMARY KEY AUTOINCREMENT,
        advisory_id TEXT NOT NULL UNIQUE REFERENCES scanner_advisories(id))`);
      await tx.execute(`INSERT OR IGNORE INTO scanner_advisory_refresh_queue(advisory_id)
        SELECT id FROM scanner_advisories ORDER BY id`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_events (
        id TEXT NOT NULL, revision INTEGER NOT NULL, event TEXT NOT NULL, occurred_at TEXT NOT NULL,
        PRIMARY KEY(id,revision))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_quarantine (
        id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT, reason TEXT NOT NULL, occurred_at TEXT NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_checkpoint (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1), head_cursor TEXT, rotation_cursor TEXT,
        last_success_at TEXT, last_attempt_at TEXT, next_retry_at TEXT,
        failure_count INTEGER NOT NULL DEFAULT 0,
        stale INTEGER NOT NULL DEFAULT 1, incomplete INTEGER NOT NULL DEFAULT 1, failure_code TEXT)`);
      const checkpointColumns = await tx.execute('PRAGMA table_info(scanner_advisory_checkpoint)');
      const checkpointNames = new Set(checkpointColumns.rows.map(row => String(row.name)));
      if (!checkpointNames.has('next_retry_at'))
        await tx.execute('ALTER TABLE scanner_advisory_checkpoint ADD COLUMN next_retry_at TEXT');
      if (!checkpointNames.has('failure_count'))
        await tx.execute('ALTER TABLE scanner_advisory_checkpoint ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0');
      await tx.execute('INSERT OR IGNORE INTO scanner_advisory_checkpoint(singleton) VALUES (1)');
    });
  }
  async checkpoint() {
    const result = await this.client.execute('SELECT * FROM scanner_advisory_checkpoint WHERE singleton = 1');
    const row = result.rows[0];
    if (!row) throw new ControlPlaneError('ADVISORY_STORE_UNAVAILABLE', 503);
    return {
      headCursor: row.head_cursor ? String(row.head_cursor) : null,
      rotationCursor: row.rotation_cursor ? String(row.rotation_cursor) : null,
      lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
      lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
      nextRetryAt: row.next_retry_at ? String(row.next_retry_at) : null,
      failureCount: Number(row.failure_count),
      stale: Boolean(row.stale),
      incomplete: Boolean(row.incomplete),
      failureCode: row.failure_code ? String(row.failure_code) : null,
    };
  }
  async list(limit: number, offset: number) {
    const result = await this.client.execute({
      sql: 'SELECT id,revision,record_revision,provider_modified_at,retrieved_at,upstream_status,triage_status,detail FROM scanner_advisories ORDER BY provider_modified_at DESC,id LIMIT ? OFFSET ?',
      args: [limit, offset],
    });
    return result.rows.map(row => ({
      id: String(row.id),
      revision: Number(row.revision),
      recordRevision: Number(row.record_revision),
      providerModifiedAt: String(row.provider_modified_at),
      retrievedAt: String(row.retrieved_at),
      upstreamStatus: String(row.upstream_status),
      triageStatus: String(row.triage_status),
      detail: JSON.parse(String(row.detail)),
    }));
  }
  async get(id: string) {
    const result = await this.client.execute({
      sql: 'SELECT id,revision,record_revision,provider_modified_at,retrieved_at,upstream_status,triage_status,detail FROM scanner_advisories WHERE id = ?',
      args: [id.toUpperCase()],
    });
    const row = result.rows[0];
    if (!row) throw new ControlPlaneError('ADVISORY_NOT_FOUND', 404);
    return {
      id: String(row.id),
      revision: Number(row.revision),
      recordRevision: Number(row.record_revision),
      providerModifiedAt: String(row.provider_modified_at),
      retrievedAt: String(row.retrieved_at),
      upstreamStatus: String(row.upstream_status),
      triageStatus: String(row.triage_status),
      detail: JSON.parse(String(row.detail)),
    };
  }
  async resolveAlias(alias: string) {
    const result = await this.client.execute({
      sql: 'SELECT id FROM scanner_advisory_aliases WHERE alias = ?',
      args: [alias.toUpperCase()],
    });
    return result.rows[0] ? String(result.rows[0].id) : null;
  }
  async setTriage(id: string, expectedRecordRevision: number, status: 'new' | 'triaged' | 'investigating' | 'closed') {
    return this.write(async tx => {
      const result = await tx.execute({
        sql: 'UPDATE scanner_advisories SET triage_status = ?, record_revision = record_revision + 1 WHERE id = ? AND record_revision = ? RETURNING revision, record_revision',
        args: [status, id.toUpperCase(), expectedRecordRevision],
      });
      const row = result.rows[0];
      if (!row) throw new ControlPlaneError('REVISION_CONFLICT', 409);
      return {
        id: id.toUpperCase(),
        revision: Number(row.revision),
        recordRevision: Number(row.record_revision),
        triageStatus: status,
      };
    });
  }
  async knownIdsForRefresh(limit: number) {
    const result = await this.client.execute({
      sql: 'SELECT advisory_id FROM scanner_advisory_refresh_queue ORDER BY position LIMIT ?',
      args: [limit],
    });
    return result.rows.map(row => String(row.advisory_id));
  }
  async importPage(kind: CursorKind, details: AdvisoryDetail[], nextCursor: string | null, refreshedId?: string) {
    const now = new Date().toISOString();
    if (refreshedId && (details.length !== 1 || details[0]?.id.toUpperCase() !== refreshedId))
      throw new ControlPlaneError('ADVISORY_REFRESH_QUEUE_INVALID', 503);
    return this.write(async tx => {
      let revisions = 0;
      for (const detail of details) {
        const id = detail.id.toUpperCase();
        const aliases = [...new Set([id, ...detail.aliases.map(value => value.toUpperCase())])];
        for (const alias of aliases) {
          const collision = await tx.execute({
            sql: 'SELECT id FROM scanner_advisory_aliases WHERE alias = ?',
            args: [alias],
          });
          if (collision.rows[0] && String(collision.rows[0].id) !== id)
            throw new ControlPlaneError('ADVISORY_ALIAS_CONFLICT', 503);
        }
        const current = await tx.execute({
          sql: 'SELECT revision,material_hash FROM scanner_advisories WHERE id = ?',
          args: [id],
        });
        const hash = materialHash(detail);
        const prior = current.rows[0];
        const revision = prior ? Number(prior.revision) + (String(prior.material_hash) === hash ? 0 : 1) : 1;
        if (!prior) {
          await tx.execute({
            sql: 'INSERT INTO scanner_advisories(id,revision,record_revision,material_hash,provider_modified_at,retrieved_at,upstream_status,triage_status,detail) VALUES (?,?,?,?,?,?,?,?,?)',
            args: [id, revision, 1, hash, detail.modifiedAt, now, detail.status, 'new', JSON.stringify(detail)],
          });
          await tx.execute({
            sql: 'INSERT INTO scanner_advisory_refresh_queue(advisory_id) VALUES (?)',
            args: [id],
          });
        } else {
          await tx.execute({
            sql: 'UPDATE scanner_advisories SET revision=?,record_revision=record_revision+?,material_hash=?,provider_modified_at=?,retrieved_at=?,upstream_status=?,detail=? WHERE id=?',
            args: [
              revision,
              revision > Number(prior.revision) ? 1 : 0,
              hash,
              detail.modifiedAt,
              now,
              detail.status,
              JSON.stringify(detail),
              id,
            ],
          });
          if (revision > Number(prior.revision)) {
            revisions++;
            await tx.execute({
              sql: 'INSERT INTO scanner_advisory_events(id,revision,event,occurred_at) VALUES (?,?,?,?)',
              args: [id, revision, 'material_revision', now],
            });
          }
        }
        await tx.execute({ sql: 'DELETE FROM scanner_advisory_aliases WHERE id = ?', args: [id] });
        for (const alias of aliases)
          await tx.execute({ sql: 'INSERT INTO scanner_advisory_aliases(alias,id) VALUES (?,?)', args: [alias, id] });
      }
      if (refreshedId) {
        const removed = await tx.execute({
          sql: 'DELETE FROM scanner_advisory_refresh_queue WHERE advisory_id = ?',
          args: [refreshedId],
        });
        if (removed.rowsAffected !== 1) throw new ControlPlaneError('ADVISORY_REFRESH_QUEUE_INVALID', 503);
        await tx.execute({
          sql: 'INSERT INTO scanner_advisory_refresh_queue(advisory_id) VALUES (?)',
          args: [refreshedId],
        });
      }
      const field = kind === 'head' ? 'head_cursor' : 'rotation_cursor';
      // Bounded polling never claims complete upstream coverage, even when one cursor ends.
      await tx.execute({
        sql: `UPDATE scanner_advisory_checkpoint SET ${field} = ?, last_success_at = ?, last_attempt_at = ?, incomplete = 1 WHERE singleton = 1`,
        args: [nextCursor, now, now],
      });
      return { imported: details.length, materialRevisions: revisions, nextCursor };
    });
  }
  async markFailure(code: string, sourceId?: string) {
    const now = new Date().toISOString();
    const reason = /^[A-Z0-9_]{1,80}$/.test(code) ? code : 'ADVISORY_SYNC_INVALID';
    const safeSourceId = sourceId && advisoryId.safeParse(sourceId).success ? sourceId.toUpperCase() : null;
    await this.write(async tx => {
      const current = await tx.execute('SELECT failure_count FROM scanner_advisory_checkpoint WHERE singleton = 1');
      const failures = Math.min(6, Number(current.rows[0]?.failure_count ?? 0) + 1);
      const delay = Math.min(30000, 1000 * 2 ** (failures - 1));
      const nextRetryAt = new Date(Date.now() + delay).toISOString();
      await tx.execute({
        sql: 'UPDATE scanner_advisory_checkpoint SET last_attempt_at = ?, next_retry_at = ?, failure_count = ?, stale = 1, incomplete = 1, failure_code = ? WHERE singleton = 1',
        args: [now, nextRetryAt, failures, reason],
      });
      if (safeSourceId) {
        await tx.execute({
          sql: 'INSERT INTO scanner_advisory_quarantine(source_id,reason,occurred_at) VALUES (?,?,?)',
          args: [safeSourceId, reason, now],
        });
        await tx.execute(
          'DELETE FROM scanner_advisory_quarantine WHERE id NOT IN (SELECT id FROM scanner_advisory_quarantine ORDER BY id DESC LIMIT 200)',
        );
      }
    });
  }
  async markSuccess() {
    await this.write(async tx => {
      await tx.execute(
        'UPDATE scanner_advisory_checkpoint SET stale = 0, failure_code = NULL, next_retry_at = NULL, failure_count = 0 WHERE singleton = 1',
      );
    });
  }
  async quarantine(limit: number, offset: number) {
    const result = await this.client.execute({
      sql: 'SELECT id,source_id,reason,occurred_at FROM scanner_advisory_quarantine ORDER BY id DESC LIMIT ? OFFSET ?',
      args: [limit, offset],
    });
    return result.rows.map(row => ({
      id: Number(row.id),
      sourceId: String(row.source_id),
      reason: String(row.reason),
      occurredAt: String(row.occurred_at),
    }));
  }
  async events(id: string) {
    const result = await this.client.execute({
      sql: 'SELECT revision,event,occurred_at FROM scanner_advisory_events WHERE id = ? ORDER BY revision',
      args: [id.toUpperCase()],
    });
    return result.rows.map(row => ({
      revision: Number(row.revision),
      event: String(row.event),
      occurredAt: String(row.occurred_at),
    }));
  }
  close() {
    this.client.close();
  }
}

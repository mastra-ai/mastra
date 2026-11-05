import { createClient, type Transaction } from '@libsql/client';
import { createHash, randomUUID } from 'node:crypto';
import { ControlPlaneError } from '../core/contracts.js';
import { evidenceSchema, scanSchema, terminal, type Evidence, type Observation, type Scan } from './contracts.js';
import { initializeRetention, purgeExpiredBatch, RETENTION_BATCH_SIZE } from './retention.js';

/** Persisted exact resource ownership used for bounded crash cleanup. */
export type OwnedResource = {
  /** Exact Docker container, network, or image identifier. */
  id: string;
  /** Docker resource category determining verification and cleanup. */
  kind: 'container' | 'network' | 'image';
  /** Scan or owned job whose cleanup receipt records this resource. */
  scanId: string;
  /** Expected provenance label value checked before cleanup. */
  token: string;
  /** Expected immutable image for a recorded container, when present. */
  imageId?: string;
  /** Whether image removal must also honor the shared-base retention policy. */
  sharedBase?: boolean;
};
export class DiscoveryStore {
  readonly client;
  private writes: Promise<unknown> = Promise.resolve();
  private retentionFailure = false;
  constructor(url: string) {
    this.client = createClient({ url });
  }
  async write<T>(operation: (transaction: Transaction) => Promise<T>) {
    const pending = this.writes.then(async () => {
      const transaction = await this.client.transaction('write');
      try {
        const result = await operation(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw error;
      } finally {
        transaction.close();
      }
    });
    this.writes = pending.catch(() => undefined);
    return pending;
  }
  async initialize() {
    await this.client.execute('PRAGMA busy_timeout=5000');
    await this.write(async transaction => {
      await transaction.execute(
        `CREATE TABLE IF NOT EXISTS scanner_discovery_scans (id TEXT PRIMARY KEY,job_id TEXT UNIQUE NOT NULL,target_id TEXT NOT NULL,owner TEXT NOT NULL,idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,active INTEGER NOT NULL,data TEXT NOT NULL,UNIQUE(owner,target_id,idempotency_key))`,
      );
      await transaction.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS scanner_discovery_active_target ON scanner_discovery_scans(target_id) WHERE active=1',
      );
      await transaction.execute(
        `CREATE INDEX IF NOT EXISTS scanner_discovery_usable_target ON scanner_discovery_scans(owner,target_id)
          WHERE json_extract(data,'$.state')='COMPLETED' AND json_extract(data,'$.partial')=0
          AND json_extract(data,'$.cleanup')='COMPLETE'`,
      );
      await transaction.execute(
        `CREATE TABLE IF NOT EXISTS scanner_discovery_jobs (id TEXT PRIMARY KEY,scan_id TEXT UNIQUE NOT NULL,state TEXT NOT NULL)`,
      );
      await transaction.execute(
        `CREATE TABLE IF NOT EXISTS scanner_discovery_evidence (id TEXT PRIMARY KEY,scan_id TEXT NOT NULL,owner TEXT NOT NULL,expires_at TEXT,data TEXT NOT NULL)`,
      );
      await transaction.execute(
        `CREATE TABLE IF NOT EXISTS scanner_discovery_resources (id TEXT PRIMARY KEY,scan_id TEXT NOT NULL,data TEXT NOT NULL)`,
      );
      await transaction.execute('INSERT OR IGNORE INTO scanner_migrations(version) VALUES (2)');
      await initializeRetention(transaction);
    });
    await this.purgeExpired().catch(() => undefined);
  }
  /** Load a persisted scan only for its owning operator. */
  async get(id: string, owner: string, transaction?: Transaction): Promise<Scan> {
    const result = await (transaction ?? this.client).execute({
      sql: 'SELECT data FROM scanner_discovery_scans WHERE id=? AND owner=?',
      args: [id, owner],
    });
    if (!result.rows[0]) throw new ControlPlaneError('NOT_FOUND', 404);
    return scanSchema.parse(JSON.parse(String(result.rows[0].data)));
  }
  async admit(scan: Scan, hash: string, authorize: (transaction: Transaction) => Promise<void>) {
    return this.write(async transaction => {
      const previous = await transaction.execute({
        sql: 'SELECT request_hash,data FROM scanner_discovery_scans WHERE owner=? AND target_id=? AND idempotency_key=?',
        args: [scan.owner, scan.targetId, scan.request.idempotencyKey],
      });
      if (previous.rows[0]) {
        if (previous.rows[0].request_hash !== hash) throw new ControlPlaneError('IDEMPOTENCY_CONFLICT', 409);
        return { scan: scanSchema.parse(JSON.parse(String(previous.rows[0].data))), created: false };
      }
      await authorize(transaction);
      const active = await transaction.execute({
        sql: "SELECT 1 FROM scanner_discovery_scans WHERE target_id=? AND (active=1 OR json_extract(data,'$.cleanup')='DEBT')",
        args: [scan.targetId],
      });
      if (active.rows.length) throw new ControlPlaneError('TARGET_SCAN_ACTIVE', 409);
      await transaction.execute({
        sql: 'INSERT INTO scanner_discovery_scans(id,job_id,target_id,owner,idempotency_key,request_hash,active,data) VALUES (?,?,?,?,?,?,1,?)',
        args: [
          scan.id,
          scan.jobId,
          scan.targetId,
          scan.owner,
          scan.request.idempotencyKey,
          hash,
          JSON.stringify(scanSchema.parse(scan)),
        ],
      });
      await transaction.execute({
        sql: 'INSERT INTO scanner_discovery_jobs(id,scan_id,state) VALUES (?,?,?)',
        args: [scan.jobId, scan.id, scan.state],
      });
      return { scan, created: true };
    });
  }
  async update(id: string, owner: string, change: (scan: Scan) => Scan) {
    return this.write(async transaction => {
      const current = await this.get(id, owner, transaction);
      const next = scanSchema.parse(change(current));
      if (terminal(current.state) && current.state !== next.state) throw new ControlPlaneError('SCAN_TERMINAL', 409);
      next.updatedAt = new Date().toISOString();
      await transaction.execute({
        sql: 'UPDATE scanner_discovery_scans SET active=?,data=? WHERE id=? AND owner=?',
        args: [terminal(next.state) ? 0 : 1, JSON.stringify(next), id, owner],
      });
      await transaction.execute({
        sql: 'UPDATE scanner_discovery_jobs SET state=? WHERE id=?',
        args: [next.state, next.jobId],
      });
      return next;
    });
  }
  /** List the operator's scans using bounded pagination and supported target filtering. */
  async list(owner: string, limit: number, offset: number, targetId?: string) {
    const result = await this.client.execute({
      sql: `SELECT data FROM scanner_discovery_scans WHERE owner=?${targetId ? ' AND target_id=?' : ''} ORDER BY rowid DESC LIMIT ? OFFSET ?`,
      args: targetId ? [owner, targetId, limit, offset] : [owner, limit, offset],
    });
    return result.rows.map(row => scanSchema.parse(JSON.parse(String(row.data))));
  }
  /** Find the newest completed scan whose retained evidence remains usable. */
  async latestUsable(owner: string, targetId: string): Promise<Scan | null> {
    const result = await this.client.execute({
      sql: `SELECT data FROM scanner_discovery_scans WHERE owner=? AND target_id=?
        AND json_extract(data,'$.state')='COMPLETED' AND json_extract(data,'$.partial')=0
        AND json_extract(data,'$.cleanup')='COMPLETE' ORDER BY rowid DESC LIMIT 1`,
      args: [owner, targetId],
    });
    return result.rows[0] ? scanSchema.parse(JSON.parse(String(result.rows[0].data))) : null;
  }
  async interrupted() {
    const result = await this.client.execute(
      "SELECT data FROM scanner_discovery_scans WHERE active=1 OR json_extract(data,'$.cleanup')='DEBT'",
    );
    return result.rows.map(row => scanSchema.parse(JSON.parse(String(row.data))));
  }
  async publish(scan: Scan, observations: Observation[], retentionDays?: number) {
    await this.write(async transaction => {
      const current = await this.get(scan.id, scan.owner, transaction);
      if (terminal(current.state)) throw new ControlPlaneError('SCAN_TERMINAL', 409);
      const now = new Date();
      for (const observation of observations) {
        const sanitized = JSON.stringify(observation);
        const evidence = evidenceSchema.parse({
          id: randomUUID(),
          scanId: scan.id,
          targetId: scan.targetId,
          observedAt: now.toISOString(),
          observation,
          sha256: createHash('sha256').update(sanitized).digest('hex'),
          expiresAt: retentionDays ? new Date(now.getTime() + retentionDays * 86400000).toISOString() : null,
          confirmationEligible: false,
        });
        await transaction.execute({
          sql: 'INSERT INTO scanner_discovery_evidence(id,scan_id,owner,expires_at,data) VALUES (?,?,?,?,?)',
          args: [evidence.id, scan.id, scan.owner, evidence.expiresAt, JSON.stringify(evidence)],
        });
      }
    });
  }
  async evidence(scanId: string, owner: string, limit: number, offset: number): Promise<Evidence[]> {
    await this.get(scanId, owner);
    await this.purgeExpired();
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_discovery_evidence WHERE scan_id=? AND owner=? AND (expires_at IS NULL OR expires_at>?) ORDER BY rowid LIMIT ? OFFSET ?',
      args: [scanId, owner, new Date().toISOString(), limit, offset],
    });
    return result.rows.map(row => evidenceSchema.parse(JSON.parse(String(row.data))));
  }
  /** Purge one bounded evidence-retention batch and preserve visible retry debt. */
  async purgeExpired() {
    try {
      const result = await this.write(tx => purgeExpiredBatch(tx, new Date().toISOString()));
      this.retentionFailure = false;
      return result;
    } catch {
      this.retentionFailure = true;
      await this.write(tx =>
        tx.execute({
          sql: 'INSERT INTO scanner_retention_runs(id,occurred_at,state,deleted_evidence,expired_proofs,failure_code) VALUES (?,?,?,?,?,?)',
          args: [randomUUID(), new Date().toISOString(), 'DEBT', 0, 0, 'RETENTION_STORAGE_FAILURE'],
        }),
      ).catch(() => undefined);
      throw new ControlPlaneError('RETENTION_CLEANUP_FAILED', 503);
    }
  }
  /** Report retained, expired and unknown evidence availability with recorded cleanup debt. */
  async retentionStatus() {
    const runs = await this.client.execute('SELECT * FROM scanner_retention_runs ORDER BY rowid DESC LIMIT 10');
    const pending = await this.client.execute({
      sql: 'SELECT 1 FROM scanner_discovery_evidence WHERE expires_at IS NOT NULL AND expires_at<=? LIMIT 1',
      args: [new Date().toISOString()],
    });
    return {
      state: this.retentionFailure || runs.rows[0]?.state === 'DEBT' ? 'DEBT' : 'READY',
      batchLimit: RETENTION_BATCH_SIZE,
      pending: pending.rows.length > 0,
      runs: runs.rows,
    };
  }
  async remember(resource: OwnedResource) {
    await this.write(transaction =>
      transaction.execute({
        sql: 'INSERT INTO scanner_discovery_resources(id,scan_id,data) VALUES (?,?,?)',
        args: [resource.id, resource.scanId, JSON.stringify(resource)],
      }),
    );
  }
  async forget(id: string) {
    await this.write(transaction =>
      transaction.execute({ sql: 'DELETE FROM scanner_discovery_resources WHERE id=?', args: [id] }),
    );
  }
  /** Read a scan's persisted runtime-resource receipts for lifecycle reconciliation. */
  async resources(scanId?: string): Promise<OwnedResource[]> {
    const result = await this.client.execute({
      sql: `SELECT data FROM scanner_discovery_resources${scanId ? ' WHERE scan_id=?' : ''} ORDER BY rowid`,
      args: scanId ? [scanId] : [],
    });
    return result.rows.map(row => JSON.parse(String(row.data)) as OwnedResource);
  }
  async resourceSummary() {
    const rows = await this.client.execute(
      "SELECT json_extract(data,'$.kind') AS kind,COUNT(*) AS total FROM scanner_discovery_resources GROUP BY json_extract(data,'$.kind')",
    );
    return Object.fromEntries(rows.rows.map(row => [String(row.kind), Number(row.total)]));
  }
  async close() {
    await this.writes;
    this.client.close();
  }
}

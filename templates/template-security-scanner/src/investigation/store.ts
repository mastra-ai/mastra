import { createClient, type Transaction } from '@libsql/client';
import { createHash, randomUUID } from 'node:crypto';
import { ControlPlaneError } from '../core/contracts.js';
import type {
  HypothesisInput,
  InvestigationAdmission,
  VerificationOutcome,
  ScheduleInput,
  OwnedResourceInput,
} from './contracts.js';
import { nextOccurrence, scheduledEventId } from './schedule.js';
import type { VerificationProof } from './verification.js';
import type { PlaybookBinding } from '../knowledge/playbooks.js';

export type Lineage = {
  targetId: string;
  targetRevision: number;
  policyId: string;
  policyRevision: number;
  profiles: { profileId: string; profileRevision: number; credentialRevision: number }[];
  scanId: string;
};
export type Investigation = {
  id: string;
  owner: string;
  idempotencyKey: string;
  lineage: Lineage;
  state: 'QUEUED' | 'PLANNING' | 'RUNNING' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED';
  revision: number;
  createdAt: string;
  updatedAt: string;
  limits: Pick<InvestigationAdmission, 'maxRequests' | 'maxTokens' | 'maxDurationSeconds'>;
  usedRequests: number;
  usedTokens: number;
  reason: string | null;
};
export type Hypothesis = HypothesisInput & {
  id: string;
  investigationId: string;
  owner: string;
  lineage: Lineage;
  resourceBindingId: string | null;
  ruleBinding?: PlaybookBinding;
  state: 'QUEUED' | 'AWAITING_APPROVAL' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  reason: string | null;
  createdAt: string;
};
export type OwnedResource = OwnedResourceInput & {
  id: string;
  owner: string;
  targetId: string;
  targetRevision: number;
  policyRevision: number;
  profileRevisions: { profileId: string; profileRevision: number; credentialRevision: number }[];
  createdAt: string;
};
export type Job = {
  id: string;
  investigationId: string;
  hypothesisId: string;
  targetId: string;
  owner: string;
  state: 'QUEUED' | 'LEASED' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED' | 'DEAD';
  fence: number;
  leaseUntil: string | null;
  attempts: number;
  reservedRequests: number;
  result: {
    outcome: VerificationOutcome;
    evidenceIds: string[];
    reason: string;
    modelId: string | null;
    usageTokens: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};
export type Approval = {
  id: string;
  owner: string;
  investigationId: string;
  hypothesisId: string;
  jobId: string;
  lineage: Lineage;
  toolId: string;
  callback: string;
  maxRequests: number;
  expiresAt: string;
  decision: 'pending' | 'approved' | 'denied' | 'expired';
  revision: number;
  consumed: boolean;
  createdAt: string;
  decidedAt: string | null;
};

const read = <T>(row: object | undefined): T => {
  if (!row) throw new ControlPlaneError('NOT_FOUND', 404);
  return JSON.parse(String((row as { data: unknown }).data)) as T;
};
const now = () => new Date().toISOString();

export class InvestigationStore {
  private readonly client;
  private writes: Promise<unknown> = Promise.resolve();
  constructor(url: string) {
    this.client = createClient({ url });
  }
  async write<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    const pending = this.writes.then(async () => {
      const tx = await this.client.transaction('write');
      try {
        const value = await operation(tx);
        await tx.commit();
        return value;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    });
    this.writes = pending.catch(() => undefined);
    return pending;
  }
  async initialize() {
    await this.client.execute('PRAGMA busy_timeout=5000');
    await this.write(async tx => {
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_investigations (
        id TEXT PRIMARY KEY,owner TEXT NOT NULL,scan_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,
        state TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,
        UNIQUE(owner,scan_id,idempotency_key))`);
      await tx.execute(
        "CREATE INDEX IF NOT EXISTS scanner_investigations_target ON scanner_investigations(owner,json_extract(data,'$.lineage.targetId'))",
      );
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_hypotheses (
        id TEXT PRIMARY KEY,investigation_id TEXT NOT NULL,owner TEXT NOT NULL,scan_id TEXT NOT NULL,
        role TEXT NOT NULL,policy_revision INTEGER NOT NULL,dedup_key TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL,data TEXT NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_verification_jobs (
        id TEXT PRIMARY KEY,investigation_id TEXT NOT NULL,hypothesis_id TEXT NOT NULL UNIQUE,
        target_id TEXT NOT NULL,owner TEXT NOT NULL,state TEXT NOT NULL,fence INTEGER NOT NULL,
        lease_until TEXT,data TEXT NOT NULL)`);
      await tx.execute(
        'CREATE INDEX IF NOT EXISTS scanner_jobs_queue ON scanner_verification_jobs(state,lease_until,target_id)',
      );
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_approvals (
        id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE,investigation_id TEXT NOT NULL,owner TEXT NOT NULL,decision TEXT NOT NULL,
        revision INTEGER NOT NULL,data TEXT NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_findings (
        id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE,investigation_id TEXT NOT NULL,owner TEXT NOT NULL,data TEXT NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_verification_proofs (
        id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE,investigation_id TEXT NOT NULL,owner TEXT NOT NULL,data TEXT NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_model_events (
        id TEXT PRIMARY KEY,investigation_id TEXT NOT NULL,owner TEXT NOT NULL,role TEXT NOT NULL,
        model_id TEXT NOT NULL,usage_tokens INTEGER,occurred_at TEXT NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_recurrences (
        target_id TEXT PRIMARY KEY,owner TEXT NOT NULL,revision INTEGER NOT NULL,enabled INTEGER NOT NULL,
        next_at TEXT NOT NULL,data TEXT NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_owned_resources (
        id TEXT PRIMARY KEY,owner TEXT NOT NULL,target_id TEXT NOT NULL,category TEXT NOT NULL,path TEXT NOT NULL,
        data TEXT NOT NULL,UNIQUE(owner,target_id,category,path))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_recurrence_events (
        id TEXT PRIMARY KEY,target_id TEXT NOT NULL,owner TEXT NOT NULL,occurred_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('PENDING','CONSUMED','CANCELLED')))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_reassessment_events (
        id TEXT PRIMARY KEY,target_id TEXT NOT NULL,advisory_id TEXT NOT NULL,advisory_revision INTEGER NOT NULL,
        owner TEXT NOT NULL,occurred_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('PENDING','CONSUMED','CANCELLED')),
        UNIQUE(owner,target_id,advisory_id,advisory_revision))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_advisory_reassessment_cursors (
        owner TEXT NOT NULL,advisory_id TEXT NOT NULL,advisory_revision INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,last_target_id TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL CHECK(state IN ('PENDING','COMPLETE')),
        PRIMARY KEY(owner,advisory_id,advisory_revision))`);
      await tx.execute(
        'CREATE INDEX IF NOT EXISTS scanner_advisory_reassessment_cursor_pending ON scanner_advisory_reassessment_cursors(owner,state,occurred_at)',
      );
      await tx.execute(
        'CREATE INDEX IF NOT EXISTS scanner_advisory_reassessment_pending ON scanner_advisory_reassessment_events(owner,state,occurred_at)',
      );
      await tx.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS scanner_recurrence_pending ON scanner_recurrence_events(target_id) WHERE state = 'PENDING'",
      );
      await tx.execute(
        'CREATE INDEX IF NOT EXISTS scanner_investigations_scheduled ON scanner_investigations(owner,state,idempotency_key)',
      );
      await tx.execute('INSERT OR IGNORE INTO scanner_migrations(version) VALUES (3)');
    });
  }
  private async record<T>(table: string, id: string, owner: string, tx?: Transaction): Promise<T> {
    const row = await (tx ?? this.client).execute({
      sql: `SELECT data FROM ${table} WHERE id=? AND owner=?`,
      args: [id, owner],
    });
    return read<T>(row.rows[0]);
  }
  getInvestigation(id: string, owner: string, tx?: Transaction) {
    return this.record<Investigation>('scanner_investigations', id, owner, tx);
  }
  getHypothesis(id: string, owner: string, tx?: Transaction) {
    return this.record<Hypothesis>('scanner_hypotheses', id, owner, tx);
  }
  private async setHypothesisState(tx: Transaction, job: Job, state: Hypothesis['state'], reason: string | null) {
    const current = await this.getHypothesis(job.hypothesisId, job.owner, tx);
    const next: Hypothesis = { ...current, state, reason };
    await tx.execute({
      sql: 'UPDATE scanner_hypotheses SET state=?,data=? WHERE id=? AND owner=?',
      args: [state, JSON.stringify(next), job.hypothesisId, job.owner],
    });
    return next;
  }
  getJob(id: string, owner: string, tx?: Transaction) {
    return this.record<Job>('scanner_verification_jobs', id, owner, tx);
  }
  getApproval(id: string, owner: string, tx?: Transaction) {
    return this.record<Approval>('scanner_approvals', id, owner, tx);
  }
  getOwnedResource(id: string, owner: string, tx?: Transaction) {
    return this.record<OwnedResource>('scanner_owned_resources', id, owner, tx);
  }
  async ownedResource(owner: string, targetId: string, category: string, path: string) {
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_owned_resources WHERE owner=? AND target_id=? AND category=? AND path=?',
      args: [owner, targetId, category, path],
    });
    return result.rows[0] ? read<OwnedResource>(result.rows[0]) : null;
  }
  async bindOwnedResource(binding: OwnedResource) {
    return this.write(async tx => {
      const prior = await tx.execute({
        sql: 'SELECT data FROM scanner_owned_resources WHERE owner=? AND target_id=? AND category=? AND path=?',
        args: [binding.owner, binding.targetId, binding.category, binding.path],
      });
      if (prior.rows[0]) {
        const existing = read<OwnedResource>(prior.rows[0]);
        if (JSON.stringify({ ...existing, id: binding.id, createdAt: binding.createdAt }) !== JSON.stringify(binding))
          throw new ControlPlaneError('RESOURCE_BINDING_CONFLICT', 409);
        return { binding: existing, created: false };
      }
      await tx.execute({
        sql: 'INSERT INTO scanner_owned_resources(id,owner,target_id,category,path,data) VALUES (?,?,?,?,?,?)',
        args: [binding.id, binding.owner, binding.targetId, binding.category, binding.path, JSON.stringify(binding)],
      });
      return { binding, created: true };
    });
  }
  async approvalForJob(jobId: string, owner: string) {
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_approvals WHERE job_id=? AND owner=?',
      args: [jobId, owner],
    });
    return result.rows[0] ? read<Approval>(result.rows[0]) : null;
  }
  async list<T>(
    table:
      | 'scanner_investigations'
      | 'scanner_hypotheses'
      | 'scanner_verification_jobs'
      | 'scanner_approvals'
      | 'scanner_findings'
      | 'scanner_verification_proofs',
    owner: string,
    limit: number,
    offset: number,
    investigationId?: string,
  ) {
    const where = investigationId && table !== 'scanner_investigations' ? ' AND investigation_id=?' : '';
    const result = await this.client.execute({
      sql: `SELECT data FROM ${table} WHERE owner=?${where} ORDER BY rowid DESC LIMIT ? OFFSET ?`,
      args: where ? [owner, investigationId!, limit, offset] : [owner, limit, offset],
    });
    return result.rows.map(row => read<T>(row));
  }
  async latestInvestigationForTarget(owner: string, targetId: string) {
    const result = await this.client.execute({
      sql: "SELECT data FROM scanner_investigations WHERE owner=? AND json_extract(data,'$.lineage.targetId')=? ORDER BY rowid DESC LIMIT 1",
      args: [owner, targetId],
    });
    return result.rows[0] ? read<Investigation>(result.rows[0]) : null;
  }
  async unplannedScheduledInvestigations(owner: string, limit: number) {
    const result = await this.client.execute({
      sql: `SELECT i.data,r.enabled FROM scanner_investigations i
        JOIN scanner_recurrence_events e ON e.id=i.idempotency_key AND e.owner=i.owner
        JOIN scanner_recurrences r ON r.target_id=e.target_id AND r.owner=e.owner
        WHERE i.owner=? AND i.state='QUEUED' AND e.state='CONSUMED'
        ORDER BY i.rowid LIMIT ?`,
      args: [owner, limit],
    });
    return result.rows.map(row => ({ investigation: read<Investigation>(row), enabled: Number(row.enabled) === 1 }));
  }
  async unplannedAdvisoryInvestigations(owner: string, limit: number) {
    const result = await this.client.execute({
      sql: `SELECT i.data FROM scanner_investigations i
        JOIN scanner_advisory_reassessment_events e ON e.id=i.idempotency_key AND e.owner=i.owner
        WHERE i.owner=? AND i.state='QUEUED' AND e.state='CONSUMED'
        ORDER BY i.rowid LIMIT ?`,
      args: [owner, limit],
    });
    return result.rows.map(row => read<Investigation>(row));
  }
  async materializeAdvisoryEvents(owner: string, limit: number) {
    return this.write(async tx => {
      const bound = Math.max(0, Math.min(limit, 100));
      await tx.execute({
        sql: `INSERT OR IGNORE INTO scanner_advisory_reassessment_cursors
          (owner,advisory_id,advisory_revision,occurred_at,state)
          SELECT ?,s.id,s.revision,s.occurred_at,'PENDING'
          FROM scanner_advisory_reassessment_sources s
          JOIN scanner_advisories a ON a.id=s.id AND a.revision=s.revision AND a.upstream_status='published'
          WHERE NOT EXISTS (SELECT 1 FROM scanner_advisory_reassessment_cursors c
            WHERE c.owner=? AND c.advisory_id=s.id AND c.advisory_revision=s.revision)
          ORDER BY s.occurred_at,s.id LIMIT ?`,
        args: [owner, owner, bound],
      });
      await tx.execute({
        sql: `UPDATE scanner_advisory_reassessment_cursors SET state='COMPLETE'
          WHERE owner=? AND state='PENDING' AND NOT EXISTS (
            SELECT 1 FROM scanner_advisories a WHERE a.id=scanner_advisory_reassessment_cursors.advisory_id
              AND a.revision=scanner_advisory_reassessment_cursors.advisory_revision
              AND a.upstream_status='published')`,
        args: [owner],
      });
      const current = await tx.execute({
        sql: `SELECT c.advisory_id,c.advisory_revision,c.occurred_at,c.last_target_id
          FROM scanner_advisory_reassessment_cursors c
          JOIN scanner_advisories a ON a.id=c.advisory_id
            AND a.revision=c.advisory_revision AND a.upstream_status='published'
          WHERE c.owner=? AND c.state='PENDING'
          ORDER BY c.occurred_at,c.advisory_id LIMIT 1`,
        args: [owner],
      });
      const cursor = current.rows[0];
      if (!cursor) return 0;
      const advisoryId = String(cursor.advisory_id);
      const revision = Number(cursor.advisory_revision);
      const candidates = await tx.execute({
        sql: `SELECT DISTINCT json_extract(data,'$.lineage.targetId') AS target_id
          FROM scanner_investigations
          WHERE owner=? AND json_extract(data,'$.lineage.targetId')>?
            AND json_extract(data,'$.createdAt')<?
          ORDER BY target_id LIMIT ?`,
        args: [owner, String(cursor.last_target_id), String(cursor.occurred_at), bound],
      });
      for (const row of candidates.rows) {
        const targetId = String(row.target_id);
        const id = createHash('sha256').update(`${owner}:${targetId}:${advisoryId}:${revision}`).digest('hex');
        await tx.execute({
          sql: `INSERT OR IGNORE INTO scanner_advisory_reassessment_events
            (id,target_id,advisory_id,advisory_revision,owner,occurred_at,state)
            VALUES (?,?,?,?,?,?,'PENDING')`,
          args: [id, targetId, advisoryId, revision, owner, String(cursor.occurred_at)],
        });
      }
      await tx.execute({
        sql: `UPDATE scanner_advisory_reassessment_cursors SET last_target_id=?,state=?
          WHERE owner=? AND advisory_id=? AND advisory_revision=? AND state='PENDING'`,
        args: [
          candidates.rows.length ? String(candidates.rows.at(-1)!.target_id) : String(cursor.last_target_id),
          candidates.rows.length < bound ? 'COMPLETE' : 'PENDING',
          owner,
          advisoryId,
          revision,
        ],
      });
      return candidates.rows.length;
    });
  }
  async pendingAdvisoryEvents(owner: string, limit: number) {
    const result = await this.client.execute({
      sql: `SELECT id,target_id,advisory_id,advisory_revision FROM scanner_advisory_reassessment_events
        WHERE owner=? AND state='PENDING' ORDER BY occurred_at,id LIMIT ?`,
      args: [owner, Math.max(0, Math.min(limit, 100))],
    });
    return result.rows.map(row => ({
      id: String(row.id),
      targetId: String(row.target_id),
      advisoryId: String(row.advisory_id),
      advisoryRevision: Number(row.advisory_revision),
    }));
  }
  async finishAdvisoryEvent(id: string, owner: string, state: 'CANCELLED') {
    await this.write(tx =>
      tx.execute({
        sql: "UPDATE scanner_advisory_reassessment_events SET state=? WHERE id=? AND owner=? AND state='PENDING'",
        args: [state, id, owner],
      }),
    );
  }
  async advisoryEventForInvestigation(owner: string, idempotencyKey: string) {
    const result = await this.client.execute({
      sql: `SELECT e.advisory_id,e.advisory_revision FROM scanner_advisory_reassessment_events e
        WHERE e.id=? AND e.owner=? AND e.state='CONSUMED'`,
      args: [idempotencyKey, owner],
    });
    return result.rows[0]
      ? { id: String(result.rows[0].advisory_id), revision: Number(result.rows[0].advisory_revision) }
      : null;
  }
  async admit(
    owner: string,
    input: InvestigationAdmission,
    lineage: Lineage,
    scheduleEventId?: string,
    advisoryEventId?: string,
  ) {
    return this.write(async tx => {
      if (scheduleEventId) {
        const event = await tx.execute({
          sql: 'SELECT e.state,e.target_id,r.enabled FROM scanner_recurrence_events e JOIN scanner_recurrences r ON r.target_id=e.target_id AND r.owner=e.owner WHERE e.id=? AND e.owner=?',
          args: [scheduleEventId, owner],
        });
        const row = event.rows[0];
        if (!row || row.state !== 'PENDING' || Number(row.enabled) !== 1 || row.target_id !== lineage.targetId)
          throw new ControlPlaneError('SCHEDULE_EVENT_CANCELLED', 409);
        if (input.idempotencyKey !== scheduleEventId) throw new ControlPlaneError('SCHEDULE_EVENT_MISMATCH', 409);
      }
      if (advisoryEventId) {
        const event = await tx.execute({
          sql: `SELECT e.state,e.target_id FROM scanner_advisory_reassessment_events e
            JOIN scanner_advisories a ON a.id=e.advisory_id AND a.revision=e.advisory_revision
            WHERE e.id=? AND e.owner=? AND a.upstream_status='published'`,
          args: [advisoryEventId, owner],
        });
        const row = event.rows[0];
        if (!row || row.state !== 'PENDING' || row.target_id !== lineage.targetId)
          throw new ControlPlaneError('ADVISORY_EVENT_CANCELLED', 409);
        if (input.idempotencyKey !== advisoryEventId) throw new ControlPlaneError('ADVISORY_EVENT_MISMATCH', 409);
      }
      if (scheduleEventId || advisoryEventId) await this.validateEventAdmissionLineage(tx, owner, input, lineage);
      const prior = await tx.execute({
        sql: 'SELECT data FROM scanner_investigations WHERE owner=? AND scan_id=? AND idempotency_key=?',
        args: [owner, input.scanId, input.idempotencyKey],
      });
      if (prior.rows[0]) {
        const existing = read<Investigation>(prior.rows[0]);
        if (
          JSON.stringify(existing.limits) !==
          JSON.stringify({
            maxRequests: input.maxRequests,
            maxTokens: input.maxTokens,
            maxDurationSeconds: input.maxDurationSeconds,
          })
        )
          throw new ControlPlaneError('IDEMPOTENCY_CONFLICT', 409);
        if (scheduleEventId) await this.consumeScheduleEvent(tx, scheduleEventId, owner);
        if (advisoryEventId) await this.consumeAdvisoryEvent(tx, advisoryEventId, owner);
        return { investigation: existing, created: false };
      }
      const at = now();
      const investigation: Investigation = {
        id: randomUUID(),
        owner,
        idempotencyKey: input.idempotencyKey,
        lineage,
        state: 'QUEUED',
        revision: 1,
        createdAt: at,
        updatedAt: at,
        limits: {
          maxRequests: input.maxRequests,
          maxTokens: input.maxTokens,
          maxDurationSeconds: input.maxDurationSeconds,
        },
        usedRequests: 0,
        usedTokens: 0,
        reason: null,
      };
      await tx.execute({
        sql: 'INSERT INTO scanner_investigations(id,owner,scan_id,idempotency_key,state,revision,data) VALUES (?,?,?,?,?,?,?)',
        args: [
          investigation.id,
          owner,
          input.scanId,
          input.idempotencyKey,
          investigation.state,
          1,
          JSON.stringify(investigation),
        ],
      });
      if (scheduleEventId) await this.consumeScheduleEvent(tx, scheduleEventId, owner);
      if (advisoryEventId) await this.consumeAdvisoryEvent(tx, advisoryEventId, owner);
      return { investigation, created: true };
    });
  }
  private async validateEventAdmissionLineage(
    tx: Transaction,
    owner: string,
    input: InvestigationAdmission,
    lineage: Lineage,
  ) {
    if (input.scanId !== lineage.scanId) throw new ControlPlaneError('REVISION_CONFLICT', 409);
    const scan = await tx.execute({
      sql: `SELECT 1 FROM scanner_discovery_scans WHERE id=? AND owner=? AND target_id=?
        AND json_extract(data,'$.state')='COMPLETED'
        AND json_extract(data,'$.partial')=0 AND json_extract(data,'$.cleanup')='COMPLETE'`,
      args: [input.scanId, owner, lineage.targetId],
    });
    if (!scan.rows[0]) throw new ControlPlaneError('SCAN_NOT_READY', 409);
    const target = await tx.execute({
      sql: `SELECT 1 FROM scanner_records WHERE kind='target' AND id=? AND owner=? AND revision=?
        AND json_extract(data,'$.authorizationConfirmed')=1
        AND json_extract(data,'$.policyId')=? AND json_extract(data,'$.policyRevision')=?`,
      args: [lineage.targetId, owner, lineage.targetRevision, lineage.policyId, lineage.policyRevision],
    });
    if (!target.rows[0]) throw new ControlPlaneError('REVISION_CONFLICT', 409);
    const policy = await tx.execute({
      sql: "SELECT 1 FROM scanner_records WHERE kind='policy' AND id=? AND owner=? AND revision=?",
      args: [lineage.policyId, owner, lineage.policyRevision],
    });
    if (!policy.rows[0]) throw new ControlPlaneError('REVISION_CONFLICT', 409);
    for (const profile of lineage.profiles) {
      const current = await tx.execute({
        sql: `SELECT 1 FROM scanner_records WHERE kind='profile' AND id=? AND owner=? AND revision=?
          AND json_extract(data,'$.targetId')=?
          AND json_extract(data,'$.credentialRevision')=?
          AND (json_extract(data,'$.expiresAt') IS NULL OR json_extract(data,'$.expiresAt')>?)
          AND NOT (COALESCE(json_extract(data,'$.identityResult.status'),'READY')='AUTH_REQUIRED'
            AND COALESCE(json_extract(data,'$.identityResult.credentialRevision'),-1)=?)`,
        args: [
          profile.profileId,
          owner,
          profile.profileRevision,
          lineage.targetId,
          profile.credentialRevision,
          now(),
          profile.credentialRevision,
        ],
      });
      if (!current.rows[0]) throw new ControlPlaneError('REVISION_CONFLICT', 409);
    }
  }
  private async consumeScheduleEvent(tx: Transaction, id: string, owner: string) {
    const result = await tx.execute({
      sql: "UPDATE scanner_recurrence_events SET state='CONSUMED' WHERE id=? AND owner=? AND state='PENDING'",
      args: [id, owner],
    });
    if (result.rowsAffected !== 1) throw new ControlPlaneError('SCHEDULE_EVENT_CANCELLED', 409);
  }
  private async consumeAdvisoryEvent(tx: Transaction, id: string, owner: string) {
    const result = await tx.execute({
      sql: "UPDATE scanner_advisory_reassessment_events SET state='CONSUMED' WHERE id=? AND owner=? AND state='PENDING'",
      args: [id, owner],
    });
    if (result.rowsAffected !== 1) throw new ControlPlaneError('ADVISORY_EVENT_CANCELLED', 409);
  }
  async enqueue(hypothesis: Hypothesis, role: string) {
    return this.write(async tx => {
      const investigation = await this.getInvestigation(hypothesis.investigationId, hypothesis.owner, tx);
      if (['CANCELLED', 'BLOCKED', 'COMPLETED'].includes(investigation.state))
        throw new ControlPlaneError('INVESTIGATION_TERMINAL', 409);
      const key = [
        hypothesis.investigationId,
        hypothesis.lineage.targetId,
        hypothesis.scanId,
        role,
        hypothesis.category,
        hypothesis.toolId,
        hypothesis.lineage.policyRevision,
        ...hypothesis.evidenceIds,
      ].join(':');
      const prior = await tx.execute({ sql: 'SELECT data FROM scanner_hypotheses WHERE dedup_key=?', args: [key] });
      if (prior.rows[0]) return { hypothesis: read<Hypothesis>(prior.rows[0]), created: false };
      const job: Job = {
        id: randomUUID(),
        investigationId: investigation.id,
        hypothesisId: hypothesis.id,
        targetId: hypothesis.lineage.targetId,
        owner: hypothesis.owner,
        state: hypothesis.risk === 'active' ? 'AWAITING_APPROVAL' : 'QUEUED',
        fence: 0,
        leaseUntil: null,
        attempts: 0,
        reservedRequests: 0,
        result: null,
        createdAt: now(),
        updatedAt: now(),
      };
      await tx.execute({
        sql: 'INSERT INTO scanner_hypotheses(id,investigation_id,owner,scan_id,role,policy_revision,dedup_key,state,data) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [
          hypothesis.id,
          investigation.id,
          hypothesis.owner,
          hypothesis.scanId,
          role,
          hypothesis.lineage.policyRevision,
          key,
          hypothesis.state,
          JSON.stringify(hypothesis),
        ],
      });
      await tx.execute({
        sql: 'INSERT INTO scanner_verification_jobs(id,investigation_id,hypothesis_id,target_id,owner,state,fence,lease_until,data) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [
          job.id,
          job.investigationId,
          job.hypothesisId,
          job.targetId,
          job.owner,
          job.state,
          0,
          null,
          JSON.stringify(job),
        ],
      });
      return { hypothesis, job, created: true };
    });
  }
  async cancel(id: string, owner: string, expectedRevision: number) {
    return this.write(async tx => {
      const current = await this.getInvestigation(id, owner, tx);
      if (current.revision !== expectedRevision) throw new ControlPlaneError('REVISION_CONFLICT', 409);
      if (['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(current.state)) return current;
      const next: Investigation = {
        ...current,
        state: 'CANCELLED',
        reason: 'CANCELLED_BY_OPERATOR',
        revision: current.revision + 1,
        updatedAt: now(),
      };
      await tx.execute({
        sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=? AND owner=? AND revision=?',
        args: [next.state, next.revision, JSON.stringify(next), id, owner, current.revision],
      });
      const jobs = await tx.execute({
        sql: "SELECT data FROM scanner_verification_jobs WHERE investigation_id=? AND owner=? AND state IN ('QUEUED','LEASED','AWAITING_APPROVAL')",
        args: [id, owner],
      });
      for (const row of jobs.rows) {
        const job = read<Job>(row);
        const cancelled: Job = { ...job, state: 'CANCELLED', fence: job.fence + 1, leaseUntil: null, updatedAt: now() };
        await tx.execute({
          sql: 'UPDATE scanner_verification_jobs SET state=?,fence=?,lease_until=NULL,data=? WHERE id=?',
          args: [cancelled.state, cancelled.fence, JSON.stringify(cancelled), job.id],
        });
        await this.setHypothesisState(tx, cancelled, 'CANCELLED', next.reason);
      }
      return next;
    });
  }
  async blockInvestigation(id: string, owner: string, reason: string) {
    return this.write(async tx => {
      const current = await this.getInvestigation(id, owner, tx);
      if (['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(current.state)) return current;
      const next: Investigation = {
        ...current,
        state: 'BLOCKED',
        reason,
        revision: current.revision + 1,
        updatedAt: now(),
      };
      await tx.execute({
        sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=? AND owner=? AND revision=?',
        args: [next.state, next.revision, JSON.stringify(next), id, owner, current.revision],
      });
      const jobs = await tx.execute({
        sql: "SELECT data FROM scanner_verification_jobs WHERE investigation_id=? AND owner=? AND state IN ('QUEUED','LEASED','AWAITING_APPROVAL')",
        args: [id, owner],
      });
      for (const row of jobs.rows) {
        const job = read<Job>(row);
        const blocked: Job = { ...job, state: 'CANCELLED', fence: job.fence + 1, leaseUntil: null, updatedAt: now() };
        await tx.execute({
          sql: 'UPDATE scanner_verification_jobs SET state=?,fence=?,lease_until=NULL,data=? WHERE id=? AND owner=?',
          args: [blocked.state, blocked.fence, JSON.stringify(blocked), job.id, owner],
        });
        await this.setHypothesisState(tx, blocked, 'BLOCKED', reason);
      }
      return next;
    });
  }
  async recoverInterruptedPlanning(owner: string) {
    return this.write(async tx => {
      const rows = await tx.execute({
        sql: "SELECT data FROM scanner_investigations WHERE owner=? AND state='PLANNING'",
        args: [owner],
      });
      for (const row of rows.rows) {
        const investigation = read<Investigation>(row);
        const blocked: Investigation = {
          ...investigation,
          state: 'BLOCKED',
          reason: 'PLANNING_INTERRUPTED',
          revision: investigation.revision + 1,
          updatedAt: now(),
        };
        await tx.execute({
          sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=? AND owner=? AND revision=?',
          args: [blocked.state, blocked.revision, JSON.stringify(blocked), blocked.id, owner, investigation.revision],
        });
        const jobs = await tx.execute({
          sql: "SELECT data FROM scanner_verification_jobs WHERE investigation_id=? AND owner=? AND state IN ('QUEUED','LEASED','AWAITING_APPROVAL')",
          args: [investigation.id, owner],
        });
        for (const jobRow of jobs.rows) {
          const job = read<Job>(jobRow);
          const cancelled: Job = {
            ...job,
            state: 'CANCELLED',
            fence: job.fence + 1,
            leaseUntil: null,
            updatedAt: now(),
          };
          await tx.execute({
            sql: 'UPDATE scanner_verification_jobs SET state=?,fence=?,lease_until=NULL,data=? WHERE id=? AND owner=?',
            args: [cancelled.state, cancelled.fence, JSON.stringify(cancelled), job.id, owner],
          });
          await this.setHypothesisState(tx, cancelled, 'BLOCKED', 'PLANNING_INTERRUPTED');
        }
      }
      return rows.rows.length;
    });
  }
  async beginPlanning(id: string, owner: string) {
    return this.write(async tx => {
      const current = await this.getInvestigation(id, owner, tx);
      if (current.state !== 'QUEUED') throw new ControlPlaneError('INVESTIGATION_ALREADY_PLANNED', 409);
      const next: Investigation = { ...current, state: 'PLANNING', revision: current.revision + 1, updatedAt: now() };
      await tx.execute({
        sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=? AND owner=? AND revision=?',
        args: [next.state, next.revision, JSON.stringify(next), id, owner, current.revision],
      });
      return next;
    });
  }
  async finishPlanning(id: string, owner: string) {
    return this.write(async tx => {
      const current = await this.getInvestigation(id, owner, tx);
      if (current.state !== 'PLANNING') throw new ControlPlaneError('INVESTIGATION_NOT_PLANNING', 409);
      const jobs = await tx.execute({
        sql: 'SELECT COUNT(*) AS total FROM scanner_verification_jobs WHERE investigation_id=? AND owner=?',
        args: [id, owner],
      });
      if (Number(jobs.rows[0]?.total) === 0) throw new ControlPlaneError('NO_GROUNDED_HYPOTHESIS', 409);
      const ready: Investigation = {
        ...current,
        state: 'RUNNING',
        revision: current.revision + 1,
        updatedAt: now(),
      };
      await tx.execute({
        sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=? AND owner=? AND revision=?',
        args: [ready.state, ready.revision, JSON.stringify(ready), id, owner, current.revision],
      });
      return this.finishIfAllJobsTerminal(tx, id, owner);
    });
  }
  private async finishIfAllJobsTerminal(tx: Transaction, investigationId: string, owner: string) {
    const current = await this.getInvestigation(investigationId, owner, tx);
    if (['COMPLETED', 'CANCELLED', 'BLOCKED', 'PLANNING'].includes(current.state)) return current;
    const result = await tx.execute({
      sql: `SELECT COUNT(*) AS total,
        SUM(CASE WHEN state IN ('QUEUED','LEASED','AWAITING_APPROVAL') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN state='DEAD' THEN 1 ELSE 0 END) AS dead,
        SUM(CASE WHEN state='CANCELLED' THEN 1 ELSE 0 END) AS cancelled
        FROM scanner_verification_jobs WHERE investigation_id=? AND owner=?`,
      args: [investigationId, owner],
    });
    const counts = result.rows[0];
    if (!counts || Number(counts.total) === 0 || Number(counts.pending) > 0) return current;
    const blocked = Number(counts.dead) > 0 || Number(counts.cancelled) > 0;
    const next: Investigation = {
      ...current,
      state: blocked ? 'BLOCKED' : 'COMPLETED',
      reason: blocked ? 'VERIFICATION_JOB_FAILED' : null,
      revision: current.revision + 1,
      updatedAt: now(),
    };
    await tx.execute({
      sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=? AND owner=? AND revision=?',
      args: [next.state, next.revision, JSON.stringify(next), next.id, owner, current.revision],
    });
    return next;
  }
  async expireApprovals(owner: string, limit = 100) {
    return this.write(async tx => {
      const approvals = await this.expireApprovalsInTransaction(tx, owner, limit);
      const unrequested = await this.expireUnrequestedApprovalJobs(tx, owner, limit);
      return approvals + unrequested;
    });
  }
  private async expireApprovalsInTransaction(tx: Transaction, owner: string, limit: number) {
    const expired = await tx.execute({
      sql: `SELECT a.data AS data,i.data AS investigation_data FROM scanner_approvals a
        JOIN scanner_investigations i ON i.id=a.investigation_id AND i.owner=a.owner
        WHERE a.owner=? AND a.decision IN ('pending','approved')
        AND json_extract(a.data,'$.consumed')=0
        AND (json_extract(a.data,'$.expiresAt')<=?
          OR julianday(json_extract(i.data,'$.createdAt'))
            + json_extract(i.data,'$.limits.maxDurationSeconds')/86400.0<=julianday(?))
        ORDER BY a.rowid LIMIT ?`,
      args: [owner, now(), now(), limit],
    });
    for (const row of expired.rows) {
      const approval = read<Approval>(row);
      const investigation = read<Investigation>({ data: row.investigation_data });
      const durationExceeded =
        Date.parse(investigation.createdAt) + investigation.limits.maxDurationSeconds * 1000 <= Date.now();
      const next: Approval = {
        ...approval,
        decision: 'expired',
        revision: approval.revision + 1,
        decidedAt: approval.decidedAt ?? now(),
      };
      await tx.execute({
        sql: 'UPDATE scanner_approvals SET decision=?,revision=?,data=? WHERE id=? AND owner=? AND revision=?',
        args: [next.decision, next.revision, JSON.stringify(next), next.id, owner, approval.revision],
      });
      const job = await this.getJob(approval.jobId, owner, tx);
      if (job.state === 'AWAITING_APPROVAL' || job.state === 'QUEUED')
        await this.blockUnexecutedJob(
          tx,
          job,
          owner,
          durationExceeded ? 'INVESTIGATION_DURATION_EXCEEDED' : 'APPROVAL_EXPIRED',
        );
    }
    return expired.rows.length;
  }
  private async expireUnrequestedApprovalJobs(tx: Transaction, owner: string, limit: number) {
    const jobs = await tx.execute({
      sql: `SELECT j.data FROM scanner_verification_jobs j
        JOIN scanner_investigations i ON i.id=j.investigation_id AND i.owner=j.owner
        WHERE j.owner=? AND j.state='AWAITING_APPROVAL'
          AND i.state IN ('QUEUED','RUNNING')
          AND NOT EXISTS (SELECT 1 FROM scanner_approvals a WHERE a.job_id=j.id AND a.owner=j.owner)
          AND julianday(json_extract(i.data,'$.createdAt'))
            + json_extract(i.data,'$.limits.maxDurationSeconds')/86400.0<=julianday(?)
        ORDER BY j.rowid LIMIT ?`,
      args: [owner, now(), limit],
    });
    for (const row of jobs.rows)
      await this.blockUnexecutedJob(tx, read<Job>(row), owner, 'INVESTIGATION_DURATION_EXCEEDED');
    return jobs.rows.length;
  }
  private async blockUnexecutedJob(tx: Transaction, job: Job, owner: string, reason: string) {
    const blocked: Job = {
      ...job,
      state: 'DEAD',
      fence: job.fence + 1,
      leaseUntil: null,
      result: { outcome: 'BLOCKED', evidenceIds: [], reason, modelId: null, usageTokens: null },
      updatedAt: now(),
    };
    await tx.execute({
      sql: 'UPDATE scanner_verification_jobs SET state=?,fence=?,lease_until=NULL,data=? WHERE id=? AND owner=? AND fence=?',
      args: [blocked.state, blocked.fence, JSON.stringify(blocked), job.id, owner, job.fence],
    });
    await this.setHypothesisState(tx, blocked, 'BLOCKED', reason);
    await this.finishIfAllJobsTerminal(tx, job.investigationId, owner);
    return blocked;
  }
  async recordModelUse(id: string, owner: string, role: string, modelId: string, tokens: number | null) {
    return this.write(async tx => {
      const current = await this.getInvestigation(id, owner, tx);
      if (['CANCELLED', 'BLOCKED', 'COMPLETED'].includes(current.state))
        throw new ControlPlaneError('INVESTIGATION_TERMINAL', 409);
      await tx.execute({
        sql: 'INSERT INTO scanner_model_events(id,investigation_id,owner,role,model_id,usage_tokens,occurred_at) VALUES (?,?,?,?,?,?,?)',
        args: [randomUUID(), id, owner, role, modelId, tokens, now()],
      });
      return current;
    });
  }
  async reserveModelTokens(id: string, owner: string, tokens: number) {
    if (!Number.isSafeInteger(tokens) || tokens < 1) throw new ControlPlaneError('TOKEN_RESERVATION_INVALID', 400);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await this.client.execute({
          sql: `UPDATE scanner_investigations
            SET revision=revision+1,
                data=json_set(data,'$.usedTokens',json_extract(data,'$.usedTokens')+?,
                  '$.revision',revision+1,'$.updatedAt',?)
            WHERE id=? AND owner=? AND state IN ('PLANNING','RUNNING')
              AND json_extract(data,'$.usedTokens')+?<=json_extract(data,'$.limits.maxTokens')
              AND julianday(json_extract(data,'$.createdAt'))
                + json_extract(data,'$.limits.maxDurationSeconds')/86400.0>julianday(?)
            RETURNING data`,
          args: [tokens, now(), id, owner, tokens, now()],
        });
        if (result.rows[0]) return read<Investigation>(result.rows[0]);
        const current = await this.getInvestigation(id, owner);
        if (current.state !== 'PLANNING' && current.state !== 'RUNNING')
          throw new ControlPlaneError('INVESTIGATION_TERMINAL', 409);
        if (Date.parse(current.createdAt) + current.limits.maxDurationSeconds * 1000 <= Date.now())
          throw new ControlPlaneError('INVESTIGATION_DURATION_EXCEEDED', 409);
        throw new ControlPlaneError('TOKEN_BUDGET_EXCEEDED', 403);
      } catch (error) {
        if ((error as { code?: string }).code !== 'SQLITE_BUSY') throw error;
        if (attempt === 3) throw new ControlPlaneError('MODEL_RESERVATION_BUSY', 503);
        await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
      }
    }
    throw new ControlPlaneError('MODEL_RESERVATION_BUSY', 503);
  }
  async claim(owner: string, leaseMs: number, globalLimit: number, perTargetLimit: number) {
    return this.write(async tx => {
      await this.expireApprovalsInTransaction(tx, owner, 100);
      await this.expireUnrequestedApprovalJobs(tx, owner, 100);
      const at = now();
      const active = await tx.execute({
        sql: "SELECT target_id,COUNT(*) AS total FROM scanner_verification_jobs WHERE state='LEASED' AND lease_until>? GROUP BY target_id",
        args: [at],
      });
      const byTarget = new Map(active.rows.map(row => [String(row.target_id), Number(row.total)]));
      const activeTotal = [...byTarget.values()].reduce((a, b) => a + b, 0);
      const candidates = await tx.execute({
        sql: "SELECT data FROM scanner_verification_jobs WHERE owner=? AND (state='QUEUED' OR (state='LEASED' AND lease_until<=?)) ORDER BY rowid LIMIT 1000",
        args: [owner, at],
      });
      for (const row of candidates.rows) {
        const job = read<Job>(row);
        const investigation = await this.getInvestigation(job.investigationId, owner, tx);
        if (['CANCELLED', 'COMPLETED', 'BLOCKED', 'PLANNING'].includes(investigation.state)) continue;
        const hypothesis = await this.getHypothesis(job.hypothesisId, owner, tx);
        if (job.attempts >= 2 || (hypothesis.risk === 'active' && job.fence > 0)) {
          await this.terminateInterruptedJob(
            tx,
            job,
            owner,
            hypothesis.risk === 'active' ? 'ACTIVE_PROBE_OUTCOME_UNKNOWN' : 'LEASE_RETRY_EXHAUSTED',
          );
          continue;
        }
        if (Date.now() - Date.parse(investigation.createdAt) >= investigation.limits.maxDurationSeconds * 1000) {
          await this.blockUnexecutedJob(tx, job, owner, 'INVESTIGATION_DURATION_EXCEEDED');
          continue;
        }
        const additionalRequests = Math.max(0, hypothesis.maxRequests - job.reservedRequests);
        if (investigation.usedRequests + additionalRequests > investigation.limits.maxRequests) {
          await this.blockUnexecutedJob(tx, job, owner, 'REQUEST_BUDGET_EXCEEDED');
          continue;
        }
        if (activeTotal >= globalLimit || (byTarget.get(job.targetId) ?? 0) >= perTargetLimit) continue;
        let approval: Approval | undefined;
        if (hypothesis.risk === 'active') {
          const result = await tx.execute({
            sql: 'SELECT data FROM scanner_approvals WHERE job_id=? AND owner=?',
            args: [job.id, owner],
          });
          if (!result.rows[0]) continue;
          approval = read<Approval>(result.rows[0]);
          if (approval.consumed) {
            await this.terminateInterruptedJob(tx, job, owner, 'ACTIVE_PROBE_OUTCOME_UNKNOWN');
            continue;
          }
          if (approval.decision !== 'approved' || approval.expiresAt <= at) continue;
        }
        const next: Job = {
          ...job,
          state: 'LEASED',
          fence: job.fence + 1,
          leaseUntil: new Date(Date.now() + leaseMs).toISOString(),
          attempts: job.attempts + 1,
          reservedRequests: job.reservedRequests + additionalRequests,
          updatedAt: at,
        };
        const result = await tx.execute({
          sql: 'UPDATE scanner_verification_jobs SET state=?,fence=?,lease_until=?,data=? WHERE id=? AND fence=?',
          args: [next.state, next.fence, next.leaseUntil, JSON.stringify(next), job.id, job.fence],
        });
        if (result.rowsAffected !== 1) throw new ControlPlaneError('LEASE_CONFLICT', 409);
        await this.setHypothesisState(tx, next, 'QUEUED', null);
        if (approval) {
          const consumed: Approval = { ...approval, consumed: true };
          await tx.execute({
            sql: 'UPDATE scanner_approvals SET data=? WHERE id=? AND revision=?',
            args: [JSON.stringify(consumed), approval.id, approval.revision],
          });
        }
        const updated: Investigation = {
          ...investigation,
          state: 'RUNNING',
          revision: investigation.revision + 1,
          usedRequests: investigation.usedRequests + additionalRequests,
          updatedAt: at,
        };
        await tx.execute({
          sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=?',
          args: [updated.state, updated.revision, JSON.stringify(updated), updated.id],
        });
        return next;
      }
      return null;
    });
  }
  private async terminateInterruptedJob(tx: Transaction, job: Job, owner: string, reason: string) {
    const dead: Job = {
      ...job,
      state: 'DEAD',
      fence: job.fence + 1,
      leaseUntil: null,
      result: { outcome: 'EXECUTION_ERROR', evidenceIds: [], reason, modelId: null, usageTokens: null },
      updatedAt: now(),
    };
    await tx.execute({
      sql: 'UPDATE scanner_verification_jobs SET state=?,fence=?,lease_until=NULL,data=? WHERE id=? AND owner=? AND fence=?',
      args: [dead.state, dead.fence, JSON.stringify(dead), job.id, owner, job.fence],
    });
    await this.setHypothesisState(tx, dead, 'BLOCKED', reason);
    await this.finishIfAllJobsTerminal(tx, job.investigationId, owner);
    return dead;
  }
  async heartbeat(id: string, owner: string, fence: number, leaseMs: number) {
    return this.write(async tx => {
      const job = await this.getJob(id, owner, tx);
      if (job.state !== 'LEASED' || job.fence !== fence || !job.leaseUntil || job.leaseUntil <= now())
        throw new ControlPlaneError('LEASE_STALE', 409);
      const next: Job = { ...job, leaseUntil: new Date(Date.now() + leaseMs).toISOString(), updatedAt: now() };
      await tx.execute({
        sql: 'UPDATE scanner_verification_jobs SET lease_until=?,data=? WHERE id=? AND fence=?',
        args: [next.leaseUntil, JSON.stringify(next), id, fence],
      });
      return next;
    });
  }
  async publish(
    id: string,
    owner: string,
    fence: number,
    result: NonNullable<Job['result']>,
    confirmed: boolean,
    proof?: VerificationProof,
  ) {
    return this.write(async tx => {
      const job = await this.getJob(id, owner, tx);
      if (job.state === 'COMPLETED' && job.fence === fence) return job;
      if (job.state !== 'LEASED' || job.fence !== fence || !job.leaseUntil || job.leaseUntil <= now())
        throw new ControlPlaneError('LEASE_STALE', 409);
      const investigation = await this.getInvestigation(job.investigationId, owner, tx);
      if (investigation.state === 'CANCELLED') throw new ControlPlaneError('INVESTIGATION_TERMINAL', 409);
      const next: Job = { ...job, state: 'COMPLETED', leaseUntil: null, result, updatedAt: now() };
      await tx.execute({
        sql: 'UPDATE scanner_verification_jobs SET state=?,lease_until=NULL,data=? WHERE id=? AND fence=?',
        args: [next.state, JSON.stringify(next), id, fence],
      });
      await this.setHypothesisState(tx, next, 'COMPLETED', result.reason);
      let proofId: string | null = null;
      if (proof) {
        proofId = randomUUID();
        const record = {
          id: proofId,
          jobId: id,
          investigationId: job.investigationId,
          owner,
          hypothesisId: job.hypothesisId,
          proof,
          createdAt: now(),
        };
        await tx.execute({
          sql: 'INSERT INTO scanner_verification_proofs(id,job_id,investigation_id,owner,data) VALUES (?,?,?,?,?)',
          args: [proofId, id, job.investigationId, owner, JSON.stringify(record)],
        });
      }
      if (confirmed) {
        if (!proofId) throw new ControlPlaneError('PROOF_REQUIRED', 409);
        const finding = {
          id: randomUUID(),
          jobId: id,
          investigationId: job.investigationId,
          owner,
          hypothesisId: job.hypothesisId,
          evidenceIds: result.evidenceIds,
          proofId,
          createdAt: now(),
        };
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO scanner_findings(id,job_id,investigation_id,owner,data) VALUES (?,?,?,?,?)',
          args: [finding.id, id, job.investigationId, owner, JSON.stringify(finding)],
        });
      }
      await this.finishIfAllJobsTerminal(tx, job.investigationId, owner);
      return next;
    });
  }
  async fail(id: string, owner: string, fence: number, reason: string, transient: boolean) {
    return this.write(async tx => {
      const job = await this.getJob(id, owner, tx);
      if (job.state !== 'LEASED' || job.fence !== fence) throw new ControlPlaneError('LEASE_STALE', 409);
      const hypothesis = await this.getHypothesis(job.hypothesisId, owner, tx);
      const retry = transient && job.attempts < 2 && hypothesis.risk !== 'active';
      const next: Job = {
        ...job,
        state: retry ? 'QUEUED' : 'DEAD',
        leaseUntil: null,
        result: retry
          ? null
          : {
              outcome: 'EXECUTION_ERROR',
              evidenceIds: [],
              reason: hypothesis.risk === 'active' ? 'ACTIVE_PROBE_OUTCOME_UNKNOWN' : reason,
              modelId: null,
              usageTokens: null,
            },
        updatedAt: now(),
      };
      await tx.execute({
        sql: 'UPDATE scanner_verification_jobs SET state=?,lease_until=NULL,data=? WHERE id=? AND fence=?',
        args: [next.state, JSON.stringify(next), id, fence],
      });
      await this.setHypothesisState(tx, next, retry ? 'QUEUED' : 'BLOCKED', retry ? reason : next.result!.reason);
      if (!retry) await this.finishIfAllJobsTerminal(tx, job.investigationId, owner);
      return next;
    });
  }
  async requestApproval(approval: Approval) {
    return this.write(async tx => {
      const job = await this.getJob(approval.jobId, approval.owner, tx);
      if (job.state !== 'AWAITING_APPROVAL') throw new ControlPlaneError('APPROVAL_NOT_PENDING', 409);
      await tx.execute({
        sql: 'INSERT INTO scanner_approvals(id,job_id,investigation_id,owner,decision,revision,data) VALUES (?,?,?,?,?,?,?)',
        args: [approval.id, job.id, approval.investigationId, approval.owner, 'pending', 1, JSON.stringify(approval)],
      });
      return approval;
    });
  }
  async decide(id: string, owner: string, revision: number, decision: 'approved' | 'denied') {
    await this.expireApprovals(owner);
    return this.write(async tx => {
      const current = await this.getApproval(id, owner, tx);
      if (current.decision === decision) return current;
      if (current.revision !== revision || current.decision !== 'pending' || current.expiresAt <= now())
        throw new ControlPlaneError('APPROVAL_CONFLICT', 409);
      const investigation = await this.getInvestigation(current.investigationId, owner, tx);
      if (investigation.state === 'CANCELLED') throw new ControlPlaneError('INVESTIGATION_TERMINAL', 409);
      const next: Approval = { ...current, decision, revision: revision + 1, decidedAt: now() };
      await tx.execute({
        sql: 'UPDATE scanner_approvals SET decision=?,revision=?,data=? WHERE id=? AND revision=?',
        args: [decision, next.revision, JSON.stringify(next), id, revision],
      });
      if (decision === 'approved') {
        const job = await this.getJob(current.jobId, owner, tx);
        const queued: Job = { ...job, state: 'QUEUED', updatedAt: now() };
        await tx.execute({
          sql: "UPDATE scanner_verification_jobs SET state=?,data=? WHERE id=? AND state='AWAITING_APPROVAL'",
          args: [queued.state, JSON.stringify(queued), job.id],
        });
        await this.setHypothesisState(tx, queued, 'QUEUED', null);
      } else {
        const job = await this.getJob(current.jobId, owner, tx);
        if (job.state !== 'AWAITING_APPROVAL') throw new ControlPlaneError('APPROVAL_CONFLICT', 409);
        await this.blockUnexecutedJob(tx, job, owner, 'APPROVAL_DENIED');
      }
      return next;
    });
  }
  async schedule(owner: string, input: ScheduleInput, expectedRevision?: number) {
    return this.write(async tx => {
      const existing = await tx.execute({
        sql: 'SELECT data FROM scanner_recurrences WHERE target_id=? AND owner=?',
        args: [input.targetId, owner],
      });
      const previous = existing.rows[0] ? read<{ revision: number }>(existing.rows[0]) : null;
      if ((previous?.revision ?? 0) !== (expectedRevision ?? 0)) throw new ControlPlaneError('REVISION_CONFLICT', 409);
      const next = {
        ...input,
        owner,
        revision: (previous?.revision ?? 0) + 1,
        nextAt: nextOccurrence(input.cron, input.timezone, new Date()).toISOString(),
      };
      await tx.execute({
        sql: 'INSERT INTO scanner_recurrences(target_id,owner,revision,enabled,next_at,data) VALUES (?,?,?,?,?,?) ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled,next_at=excluded.next_at,data=excluded.data',
        args: [input.targetId, owner, next.revision, Number(input.enabled), next.nextAt, JSON.stringify(next)],
      });
      if (!input.enabled)
        await tx.execute({
          sql: "UPDATE scanner_recurrence_events SET state='CANCELLED' WHERE target_id=? AND owner=? AND state='PENDING'",
          args: [input.targetId, owner],
        });
      return next;
    });
  }
  async tickSchedules(owner: string, at = new Date()) {
    return this.write(async tx => {
      const due = await tx.execute({
        sql: 'SELECT data FROM scanner_recurrences WHERE owner=? AND enabled=1 AND next_at<=? ORDER BY next_at LIMIT 100',
        args: [owner, at.toISOString()],
      });
      const events: { id: string; targetId: string; occurredAt: string }[] = [];
      for (const row of due.rows) {
        const schedule = read<ScheduleInput & { owner: string; revision: number; nextAt: string }>(row);
        const event = {
          id: scheduledEventId(schedule.targetId, schedule.revision, schedule.nextAt),
          targetId: schedule.targetId,
          occurredAt: schedule.nextAt,
        };
        const inserted = await tx.execute({
          sql: "INSERT OR IGNORE INTO scanner_recurrence_events(id,target_id,owner,occurred_at,state) VALUES (?,?,?,?,'PENDING')",
          args: [event.id, event.targetId, owner, event.occurredAt],
        });
        if (inserted.rowsAffected === 1) events.push(event);
        const next = { ...schedule, nextAt: nextOccurrence(schedule.cron, schedule.timezone, at).toISOString() };
        await tx.execute({
          sql: 'UPDATE scanner_recurrences SET next_at=?,data=? WHERE target_id=? AND owner=? AND revision=?',
          args: [next.nextAt, JSON.stringify(next), schedule.targetId, owner, schedule.revision],
        });
      }
      return events;
    });
  }
  async pendingScheduleEvents(owner: string, limit: number) {
    const result = await this.client.execute({
      sql: "SELECT id,target_id,occurred_at FROM scanner_recurrence_events WHERE owner=? AND state='PENDING' ORDER BY occurred_at LIMIT ?",
      args: [owner, limit],
    });
    return result.rows.map(row => ({
      id: String(row.id),
      targetId: String(row.target_id),
      occurredAt: String(row.occurred_at),
    }));
  }
  async finishScheduleEvent(id: string, owner: string, state: 'CONSUMED' | 'CANCELLED') {
    await this.write(tx =>
      tx.execute({
        sql: "UPDATE scanner_recurrence_events SET state=? WHERE id=? AND owner=? AND state='PENDING'",
        args: [state, id, owner],
      }),
    );
  }
  async metrics(owner: string) {
    const jobs = await this.client.execute({
      sql: 'SELECT state,COUNT(*) AS total FROM scanner_verification_jobs WHERE owner=? GROUP BY state',
      args: [owner],
    });
    const approvals = await this.client.execute({
      sql: 'SELECT decision,COUNT(*) AS total FROM scanner_approvals WHERE owner=? GROUP BY decision',
      args: [owner],
    });
    return {
      jobs: Object.fromEntries(jobs.rows.map(row => [String(row.state), Number(row.total)])),
      approvals: Object.fromEntries(approvals.rows.map(row => [String(row.decision), Number(row.total)])),
    };
  }
  async modelEvents(owner: string, investigationId: string, limit: number, offset: number) {
    const result = await this.client.execute({
      sql: 'SELECT id,role,model_id,usage_tokens,occurred_at FROM scanner_model_events WHERE owner=? AND investigation_id=? ORDER BY occurred_at,id LIMIT ? OFFSET ?',
      args: [owner, investigationId, limit, offset],
    });
    return result.rows.map(row => ({
      id: String(row.id),
      role: String(row.role),
      modelId: String(row.model_id),
      usageTokens: row.usage_tokens === null ? null : Number(row.usage_tokens),
      occurredAt: String(row.occurred_at),
    }));
  }
  async close() {
    await this.writes;
    this.client.close();
  }
}

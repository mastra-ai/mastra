import { randomUUID } from 'node:crypto';
import { ControlPlaneError } from '../core/contracts.js';
import { scanPrincipalComparison } from '../discovery/principals.js';
import type { DiscoveryStore } from '../discovery/store.js';
import type { BolaCandidate, BolaSelection } from './bola-contracts.js';
import type { BolaProof } from './bola-models.js';

export type BolaAssessment = {
  id: string;
  owner: string;
  targetId: string;
  scanId: string;
  idempotencyKey: string;
  state: 'DISCOVERING' | 'PLANNING' | 'VERIFYING' | 'CANCEL_REQUESTED' | 'CANCELLED' | 'COMPLETED' | 'BLOCKED';
  revision: number;
  createdAt: string;
  updatedAt: string;
  targetRevision: number;
  policyRevision: number;
  profiles: { profileId: string; profileRevision: number; credentialRevision: number }[];
  maxTokens: number;
  usedTokens: number;
  maxRequests: number;
  usedRequests: number;
  candidates: BolaCandidate[];
  selected: BolaCandidate | null;
  selection?: BolaSelection | null;
  proof: BolaProof | null;
  verificationJobId?: string | null;
  verificationCleanup?: 'NOT_STARTED' | 'PENDING' | 'DEBT' | 'COMPLETE';
  expiresAt?: string | null;
  evidenceAvailability?: 'available' | 'expired' | 'unknown';
  outcome: 'CONFIRMED' | 'NOT_REPRODUCED' | 'INCONCLUSIVE' | null;
  findingId: string | null;
  reason: string | null;
  modelEvents: { role: 'sherlock' | 'dupin' | 'watson'; modelId: string; usageTokens: number | null }[];
};
export type BolaFinding = {
  id: string;
  owner: string;
  assessmentId: string;
  targetId: string;
  categoryId: 'bola';
  checkerId: 'bola_rest_read';
  routeTemplate: string;
  ownerStatus: number;
  alternateStatus: number;
  samePrivateResponse: true;
  distinctPrincipals?: true;
  gatewayRequests: number;
  selection?: Pick<BolaSelection, 'rationaleCode' | 'hypothesis' | 'confidence' | 'limitations'> | null;
  createdAt: string;
};

const read = (value: unknown): BolaAssessment => JSON.parse(String(value)) as BolaAssessment;
const now = () => new Date().toISOString();
/** Withhold expired BOLA observations while preserving the assessment's visible availability state. */
const visible = (record: BolaAssessment): BolaAssessment => {
  if (record.evidenceAvailability === 'available' && record.expiresAt && record.expiresAt > now()) return record;
  return {
    ...record,
    candidates: [],
    selected: null,
    selection: null,
    proof: null,
    evidenceAvailability: record.expiresAt ? 'expired' : 'unknown',
  };
};
export class BolaStore {
  private readonly client;
  constructor(private readonly discovery: DiscoveryStore) {
    this.client = discovery.client;
  }
  async initialize() {
    await this.discovery.write(async transaction => {
      await transaction.execute(`CREATE TABLE IF NOT EXISTS scanner_bola_assessments (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, target_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL,
      data TEXT NOT NULL, UNIQUE(owner,target_id,idempotency_key))`);
      await transaction.execute(
        'CREATE INDEX IF NOT EXISTS scanner_bola_assessments_owner ON scanner_bola_assessments(owner,target_id)',
      );
      await transaction.execute(`CREATE TABLE IF NOT EXISTS scanner_bola_findings (
        id TEXT PRIMARY KEY, assessment_id TEXT UNIQUE NOT NULL, owner TEXT NOT NULL, data TEXT NOT NULL)`);
      await transaction.execute(
        'CREATE INDEX IF NOT EXISTS scanner_bola_findings_owner ON scanner_bola_findings(owner)',
      );
    });
  }
  async close() {}
  /** Persist a new owner-bound BOLA assessment with its idempotency binding. */
  async create(
    value: Omit<BolaAssessment, 'id' | 'revision' | 'createdAt' | 'updatedAt'>,
  ): Promise<{ assessment: BolaAssessment; created: boolean }> {
    const at = now();
    const record: BolaAssessment = { ...value, id: randomUUID(), revision: 1, createdAt: at, updatedAt: at };
    const deadline = Date.now() + 15000;
    for (let attempt = 0; Date.now() < deadline && attempt < 30; attempt++) {
      try {
        return await this.discovery.write(async transaction => {
          const prior = await transaction.execute({
            sql: 'SELECT data FROM scanner_bola_assessments WHERE owner=? AND target_id=? AND idempotency_key=?',
            args: [value.owner, value.targetId, value.idempotencyKey],
          });
          if (prior.rows[0]) {
            const existing = read(prior.rows[0].data);
            if (
              existing.scanId !== value.scanId ||
              existing.targetRevision !== value.targetRevision ||
              existing.policyRevision !== value.policyRevision ||
              JSON.stringify(existing.profiles) !== JSON.stringify(value.profiles)
            )
              throw new ControlPlaneError('IDEMPOTENCY_CONFLICT', 409);
            return { assessment: existing, created: false };
          }
          await transaction.execute({
            sql: 'INSERT INTO scanner_bola_assessments(id,owner,target_id,idempotency_key,state,revision,data) VALUES (?,?,?,?,?,?,?)',
            args: [
              record.id,
              record.owner,
              record.targetId,
              record.idempotencyKey,
              record.state,
              1,
              JSON.stringify(record),
            ],
          });
          return { assessment: record, created: true };
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'SQLITE_BUSY' && code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error;
        if (Date.now() >= deadline) break;
        await new Promise(resolve => setTimeout(resolve, Math.min(50 * 2 ** Math.min(attempt, 3), 400)));
      }
    }
    throw new ControlPlaneError('BOLA_ADMISSION_BUSY', 503);
  }
  /** Load an assessment only for the requesting owner. */
  async get(id: string, owner: string) {
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_bola_assessments WHERE id=? AND owner=?',
      args: [id, owner],
    });
    if (!result.rows[0]) throw new ControlPlaneError('NOT_FOUND', 404);
    return visible(read(result.rows[0].data));
  }
  /** Resolve an existing assessment using its owner-scoped idempotency key. */
  async byKey(owner: string, targetId: string, idempotencyKey: string): Promise<BolaAssessment | null> {
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_bola_assessments WHERE owner=? AND target_id=? AND idempotency_key=?',
      args: [owner, targetId, idempotencyKey],
    });
    return result.rows[0] ? visible(read(result.rows[0].data)) : null;
  }
  async list(owner: string, limit: number, offset: number) {
    await this.purgeExpired();
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_bola_assessments WHERE owner=? ORDER BY rowid DESC LIMIT ? OFFSET ?',
      args: [owner, limit, offset],
    });
    return result.rows.map(row => visible(read(row.data)));
  }
  /** Load the assessment's associated finding only within the requesting owner's scope. */
  async finding(id: string, owner: string): Promise<BolaFinding> {
    await this.purgeExpired();
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_bola_findings WHERE id=? AND owner=?',
      args: [id, owner],
    });
    if (!result.rows[0]) throw new ControlPlaneError('NOT_FOUND', 404);
    return JSON.parse(String(result.rows[0].data)) as BolaFinding;
  }
  async findings(owner: string, limit: number, offset: number): Promise<BolaFinding[]> {
    await this.purgeExpired();
    const result = await this.client.execute({
      sql: 'SELECT data FROM scanner_bola_findings WHERE owner=? ORDER BY rowid DESC LIMIT ? OFFSET ?',
      args: [owner, limit, offset],
    });
    return result.rows.map(row => JSON.parse(String(row.data)) as BolaFinding);
  }
  async pending(owner: string) {
    const result = await this.client.execute({
      sql: "SELECT data FROM scanner_bola_assessments WHERE owner=? AND state IN ('DISCOVERING','PLANNING','VERIFYING')",
      args: [owner],
    });
    return result.rows.map(row => read(row.data));
  }
  async cleanupJobs(owner: string) {
    const result = await this.client.execute({
      sql: `SELECT data FROM scanner_bola_assessments WHERE owner=?
        AND json_extract(data,'$.verificationCleanup') IN ('PENDING','DEBT')
        AND json_type(data,'$.verificationJobId')='text'`,
      args: [owner],
    });
    return result.rows.map(row => read(row.data));
  }
  async purgeExpired() {
    const at = now();
    return this.discovery.write(async transaction => {
      const rows = await transaction.execute({
        sql: `SELECT id,data FROM scanner_bola_assessments
          WHERE (json_extract(data,'$.expiresAt')<=? OR json_type(data,'$.expiresAt') IS NULL)
          AND COALESCE(json_extract(data,'$.evidenceAvailability'),'available') NOT IN ('expired','unknown')
          ORDER BY rowid LIMIT 128`,
        args: [at],
      });
      for (const row of rows.rows) {
        const current = read(row.data);
        const availability = current.expiresAt ? 'expired' : 'unknown';
        const redacted: BolaAssessment = {
          ...current,
          candidates: [],
          selected: null,
          selection: null,
          proof: null,
          evidenceAvailability: availability,
          revision: current.revision + 1,
          updatedAt: at,
        };
        await transaction.execute({
          sql: 'UPDATE scanner_bola_assessments SET data=?,revision=? WHERE id=? AND revision=?',
          args: [JSON.stringify(redacted), redacted.revision, current.id, current.revision],
        });
      }
      return rows.rows.length;
    });
  }
  async cancelRequested(owner: string) {
    const result = await this.client.execute({
      sql: "SELECT data FROM scanner_bola_assessments WHERE owner=? AND state='CANCEL_REQUESTED'",
      args: [owner],
    });
    return result.rows.map(row => read(row.data));
  }
  /** Apply a BOLA assessment transition while validating its owner and stored state. */
  async update(id: string, owner: string, transform: (current: BolaAssessment) => BolaAssessment) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const next = await this.discovery.write(async transaction => {
        const result = await transaction.execute({
          sql: 'SELECT data FROM scanner_bola_assessments WHERE id=? AND owner=?',
          args: [id, owner],
        });
        if (!result.rows[0]) throw new ControlPlaneError('NOT_FOUND', 404);
        const current = read(result.rows[0].data);
        const changed = { ...transform(current), revision: current.revision + 1, updatedAt: now() };
        await transaction.execute({
          sql: 'UPDATE scanner_bola_assessments SET data=?,state=?,revision=? WHERE id=? AND owner=? AND revision=?',
          args: [JSON.stringify(changed), changed.state, changed.revision, id, owner, current.revision],
        });
        return changed;
      });
      if (next) return next;
    }
    throw new ControlPlaneError('BOLA_RECORD_BUSY', 503);
  }
  async requestCancel(id: string, owner: string, revision: number) {
    return this.update(id, owner, current => {
      if (current.revision !== revision) throw new ControlPlaneError('REVISION_CONFLICT', 409);
      if (['COMPLETED', 'BLOCKED', 'CANCELLED'].includes(current.state))
        throw new ControlPlaneError('BOLA_ALREADY_TERMINAL', 409);
      return { ...current, state: 'CANCEL_REQUESTED', reason: 'BOLA_CANCELLED' };
    });
  }
  /** Atomically reserve bounded verification resources against the assessment's current budget. */
  async reserve(id: string, owner: string, field: 'usedTokens' | 'usedRequests', amount: number) {
    if (!Number.isSafeInteger(amount) || amount < 1) throw new ControlPlaneError('BOLA_RESERVATION_INVALID', 400);
    const maximum = field === 'usedTokens' ? 'maxTokens' : 'maxRequests';
    const states = field === 'usedTokens' ? "('PLANNING','VERIFYING')" : "('VERIFYING')";
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await this.discovery.write(transaction =>
          transaction.execute({
            sql: `UPDATE scanner_bola_assessments SET revision=revision+1,
          data=json_set(data,'$.${field}',json_extract(data,'$.${field}')+?,'$.revision',revision+1,'$.updatedAt',?)
          WHERE id=? AND owner=? AND state IN ${states} AND json_extract(data,'$.${field}')+?<=json_extract(data,'$.${maximum}') RETURNING data`,
            args: [amount, now(), id, owner, amount],
          }),
        );
        if (result.rows[0]) return read(result.rows[0].data);
        throw new ControlPlaneError(
          field === 'usedTokens' ? 'TOKEN_BUDGET_EXCEEDED' : 'BOLA_REQUEST_BUDGET_EXCEEDED',
          403,
        );
      } catch (error) {
        if ((error as { code?: string }).code !== 'SQLITE_BUSY' || attempt === 4) throw error;
        await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
      }
    }
    throw new ControlPlaneError('BOLA_RESERVATION_BUSY', 503);
  }
  async complete(
    id: string,
    owner: string,
    proof: BolaProof,
    outcome: 'CONFIRMED' | 'NOT_REPRODUCED' | 'INCONCLUSIVE',
    reason:
      | 'DETERMINISTIC_BOLA_COMPARISON'
      | 'INTERPRETATION_DISAGREEMENT'
      | 'REVIEW_DISAGREEMENT'
      | 'BOTH_DISAGREE' = 'DETERMINISTIC_BOLA_COMPARISON',
  ) {
    return this.discovery.write(async transaction => {
      const found = await transaction.execute({
        sql: 'SELECT data FROM scanner_bola_assessments WHERE id=? AND owner=?',
        args: [id, owner],
      });
      if (!found.rows[0]) throw new ControlPlaneError('NOT_FOUND', 404);
      const current = read(found.rows[0].data);
      if (current.state !== 'VERIFYING' || !current.selected || current.verificationCleanup !== 'COMPLETE')
        throw new ControlPlaneError('BOLA_STATE_CHANGED', 409);
      let finding: BolaFinding | null = null;
      if (outcome === 'CONFIRMED') {
        const scan = await this.discovery.get(current.scanId, owner, transaction);
        const bound =
          scan.id === current.scanId &&
          scan.targetId === current.targetId &&
          scan.state === 'COMPLETED' &&
          !scan.partial &&
          scan.cleanup === 'COMPLETE' &&
          scan.request.targetRevision === current.targetRevision &&
          scan.request.policyRevision === current.policyRevision &&
          current.profiles.every(profile =>
            scan.request.profiles.some(
              item =>
                item.profileId === profile.profileId &&
                item.profileRevision === profile.profileRevision &&
                item.credentialRevision === profile.credentialRevision,
            ),
          );
        if (
          !bound ||
          proof.principalComparison !== 'DISTINCT' ||
          scanPrincipalComparison(
            scan,
            current.profiles.map(item => item.profileId),
          ) !== 'DISTINCT' ||
          !proof.completed ||
          proof.ownerStatus !== 200 ||
          proof.alternateStatus !== 200 ||
          proof.bodyMatches !== true
        )
          throw new ControlPlaneError('BOLA_PROOF_INCOMPLETE', 409);
        finding = {
          id: randomUUID(),
          owner,
          assessmentId: id,
          targetId: current.targetId,
          categoryId: 'bola',
          checkerId: 'bola_rest_read',
          routeTemplate: current.selected.routeTemplate,
          ownerStatus: 200,
          alternateStatus: 200,
          samePrivateResponse: true,
          distinctPrincipals: true,
          gatewayRequests: proof.requestCount,
          selection: current.selection
            ? {
                rationaleCode: current.selection.rationaleCode,
                hypothesis: current.selection.hypothesis,
                confidence: current.selection.confidence,
                limitations: current.selection.limitations,
              }
            : null,
          createdAt: now(),
        };
        await transaction.execute({
          sql: 'INSERT INTO scanner_bola_findings(id,assessment_id,owner,data) VALUES (?,?,?,?)',
          args: [finding.id, id, owner, JSON.stringify(finding)],
        });
      }
      const next: BolaAssessment = {
        ...current,
        state: 'COMPLETED',
        proof,
        outcome,
        findingId: finding?.id ?? null,
        reason,
        revision: current.revision + 1,
        updatedAt: now(),
      };
      await transaction.execute({
        sql: 'UPDATE scanner_bola_assessments SET data=?,state=?,revision=? WHERE id=? AND owner=? AND revision=?',
        args: [JSON.stringify(next), next.state, next.revision, id, owner, current.revision],
      });
      return next;
    });
  }
}

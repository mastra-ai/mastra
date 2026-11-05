import type { Transaction } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { scanSchema } from './contracts.js';
import type { StoredProof, Finding, Job, Hypothesis } from '../investigation/store.js';

export const RETENTION_BATCH_SIZE = 128;
/** Retained proof availability; unknown is distinct from expired. */
export type EvidenceAvailability = {
  /** Persisted lifecycle state; read the reason and result before interpreting it. */
  state: 'available' | 'expired' | 'unknown';
  /** UTC timestamp of the evidence-availability transition, or null when unknown. */
  at: string | null;
};

export async function initializeRetention(tx: Transaction) {
  await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_retention_runs (
    id TEXT PRIMARY KEY,occurred_at TEXT NOT NULL,state TEXT NOT NULL,
    deleted_evidence INTEGER NOT NULL,expired_proofs INTEGER NOT NULL,failure_code TEXT)`);
  await tx.execute(`CREATE TABLE IF NOT EXISTS scanner_expired_evidence (
    id TEXT PRIMARY KEY,owner TEXT NOT NULL,occurred_at TEXT NOT NULL)`);
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS scanner_discovery_expiry ON scanner_discovery_evidence(expires_at) WHERE expires_at IS NOT NULL',
  );
}

/** Remove retained proof observations and propagate expired availability to linked findings and jobs. */
async function expireProof(tx: Transaction, record: StoredProof, at: string) {
  const { observation: _removed, ...summary } = record.proof;
  const availability: EvidenceAvailability = { state: 'expired', at };
  const expired: StoredProof = {
    ...record,
    proof: { ...summary, completed: false, evidence: [], withheld: true },
    availability,
  };
  await tx.execute({
    sql: 'UPDATE scanner_verification_proofs SET data=? WHERE id=?',
    args: [JSON.stringify(expired), record.id],
  });
  const findings = await tx.execute({
    sql: 'SELECT id,data FROM scanner_findings WHERE job_id=? LIMIT 1',
    args: [record.jobId],
  });
  for (const row of findings.rows) {
    const finding = JSON.parse(String(row.data)) as Finding;
    await tx.execute({
      sql: 'UPDATE scanner_findings SET data=? WHERE id=?',
      args: [JSON.stringify({ ...finding, evidenceIds: [], availability }), String(row.id)],
    });
  }
  const jobs = await tx.execute({ sql: 'SELECT data FROM scanner_verification_jobs WHERE id=?', args: [record.jobId] });
  if (jobs.rows[0]) {
    const job = JSON.parse(String(jobs.rows[0].data)) as Job;
    if (job.result) {
      job.result = { ...job.result, evidenceIds: [], evidenceAvailability: 'expired' };
      await tx.execute({
        sql: 'UPDATE scanner_verification_jobs SET data=? WHERE id=?',
        args: [JSON.stringify(job), job.id],
      });
    }
  }
  await tx.execute({ sql: 'DELETE FROM scanner_proof_sources WHERE proof_id=?', args: [record.id] });
}

// Earlier records gain retention only from their exact recorded policy revision.
// An unavailable historical policy remains explicitly unknown; no period is invented.
/** Recover proof retention only from its exact historical policy, leaving missing history unknown. */
async function backfillProofRetention(tx: Transaction) {
  const rows = await tx.execute(`SELECT data FROM scanner_verification_proofs
    WHERE json_type(data,'$.expiresAt') IS NULL ORDER BY rowid LIMIT ${RETENTION_BATCH_SIZE}`);
  for (const row of rows.rows) {
    const record = JSON.parse(String(row.data)) as StoredProof;
    const hypothesisRow = await tx.execute({
      sql: 'SELECT data FROM scanner_hypotheses WHERE id=? AND owner=?',
      args: [record.hypothesisId, record.owner],
    });
    const hypothesis = hypothesisRow.rows[0] ? (JSON.parse(String(hypothesisRow.rows[0].data)) as Hypothesis) : null;
    let days: number | undefined;
    let known = false;
    if (hypothesis) {
      const policy = await tx.execute({
        sql: "SELECT data FROM scanner_record_revisions WHERE kind='policy' AND id=? AND revision=? AND owner=?",
        args: [hypothesis.lineage.policyId, hypothesis.lineage.policyRevision, record.owner],
      });
      if (policy.rows[0]) {
        const data = JSON.parse(String(policy.rows[0].data)) as { retention?: { evidenceDays: number } };
        days = data.retention?.evidenceDays;
        known = true;
      }
      for (const id of hypothesis.evidenceIds)
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO scanner_proof_sources(evidence_id,proof_id,owner) VALUES (?,?,?)',
          args: [id, record.id, record.owner],
        });
    }
    record.expiresAt = days ? new Date(Date.parse(record.createdAt) + days * 86400000).toISOString() : null;
    record.availability = { state: known ? 'available' : 'unknown', at: null };
    await tx.execute({
      sql: 'UPDATE scanner_verification_proofs SET data=? WHERE id=?',
      args: [JSON.stringify(record), record.id],
    });
  }
}

/** Delete one bounded batch of expired evidence and record retention progress or debt. */
export async function purgeExpiredBatch(tx: Transaction, at: string) {
  const expired = await tx.execute({
    sql: `SELECT id,scan_id,owner FROM scanner_discovery_evidence
    WHERE expires_at IS NOT NULL AND expires_at<=? ORDER BY expires_at,id LIMIT ${RETENTION_BATCH_SIZE}`,
    args: [at],
  });
  const scans = new Map<string, { owner: string; total: number }>();
  for (const row of expired.rows) {
    const scanId = String(row.scan_id),
      prior = scans.get(scanId);
    scans.set(scanId, { owner: String(row.owner), total: (prior?.total ?? 0) + 1 });
    await tx.execute({
      sql: 'INSERT OR IGNORE INTO scanner_expired_evidence(id,owner,occurred_at) VALUES (?,?,?)',
      args: [String(row.id), String(row.owner), at],
    });
    await tx.execute({ sql: 'DELETE FROM scanner_discovery_evidence WHERE id=?', args: [String(row.id)] });
  }
  for (const [scanId, removed] of scans) {
    const result = await tx.execute({
      sql: 'SELECT data FROM scanner_discovery_scans WHERE id=? AND owner=?',
      args: [scanId, removed.owner],
    });
    const scan = scanSchema.parse(JSON.parse(String(result.rows[0]!.data)));
    scan.evidenceRetention = { expiredCount: scan.evidenceRetention.expiredCount + removed.total, lastExpiredAt: at };
    await tx.execute({
      sql: 'UPDATE scanner_discovery_scans SET data=? WHERE id=? AND owner=?',
      args: [JSON.stringify(scan), scan.id, scan.owner],
    });
  }
  let expiredProofs = 0;
  const proofTable = await tx.execute(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='scanner_proof_sources'",
  );
  if (proofTable.rows.length) {
    await backfillProofRetention(tx);
    const sourceProofs = await tx.execute(`SELECT DISTINCT s.proof_id FROM scanner_proof_sources s
      JOIN scanner_expired_evidence e ON e.id=s.evidence_id AND e.owner=s.owner LIMIT ${RETENTION_BATCH_SIZE}`);
    const ids = new Set(sourceProofs.rows.map(row => String(row.proof_id)));
    const dueProofs = await tx.execute({
      sql: `SELECT id FROM scanner_verification_proofs
      WHERE json_extract(data,'$.expiresAt')<=? AND json_extract(data,'$.availability.state')!='expired'
      ORDER BY json_extract(data,'$.expiresAt') LIMIT ${RETENTION_BATCH_SIZE}`,
      args: [at],
    });
    for (const row of dueProofs.rows) if (ids.size < RETENTION_BATCH_SIZE) ids.add(String(row.id));
    const proofs = { rows: [] as Array<{ data: unknown }> };
    for (const id of ids) {
      const result = await tx.execute({ sql: 'SELECT data FROM scanner_verification_proofs WHERE id=?', args: [id] });
      if (result.rows[0]) proofs.rows.push({ data: result.rows[0].data });
    }
    for (const row of proofs.rows) {
      await expireProof(tx, JSON.parse(String(row.data)) as StoredProof, at);
      expiredProofs++;
    }
  }
  await tx.execute({
    sql: 'INSERT INTO scanner_retention_runs(id,occurred_at,state,deleted_evidence,expired_proofs) VALUES (?,?,?,?,?)',
    args: [randomUUID(), at, 'COMPLETE', expired.rows.length, expiredProofs],
  });
  return { deletedEvidence: expired.rows.length, expiredProofs, batchLimit: RETENTION_BATCH_SIZE };
}

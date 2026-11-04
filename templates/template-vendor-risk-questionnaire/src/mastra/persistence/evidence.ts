import type { Client } from '@libsql/client';
import type { InputLimits } from '../contracts/limits.ts';
import { evidenceSnapshotSchema } from '../contracts/evidence-snapshot.ts';
import { canonicalJson, sha256, IntakeFailure } from '../intake/source.ts';
import { sourceStatement } from './sources.ts';
import { writeTransaction } from './transaction.ts';
import type { EvidenceSnapshotRecord, EligibleSource } from '../evidence/snapshot.ts';

export async function persistEvidence(
  client: Pick<Client, 'transaction'>,
  limits: InputLimits,
  record: EvidenceSnapshotRecord,
  sources: EligibleSource[],
) {
  record = evidenceSnapshotSchema.parse(record);
  const { digest, ...base } = record;
  if (digest !== sha256(canonicalJson({ ...base, asOf: undefined })))
    throw new Error('Evidence snapshot digest mismatch.');
  if (
    sources.length !== record.documents.length ||
    sources.some(
      s =>
        !record.documents.some(
          d =>
            d.id === s.document.id &&
            d.id === s.source.sourceId &&
            d.sha256 === s.source.sha256 &&
            d.version === s.document.version,
        ),
    )
  )
    throw new Error('Evidence sources mismatch.');
  for (const s of sources) sourceStatement(s.source, limits);
  const json = canonicalJson(record);
  return writeTransaction(client, async transaction => {
    const intake = await transaction.execute({
      sql: 'SELECT s.size_bytes FROM vrq_intakes i JOIN vrq_sources s ON s.digest = i.source_digest WHERE i.run_id = ?',
      args: [record.runId],
    });
    const aggregate = sources.reduce((sum, s) => sum + s.source.sizeBytes, Number(intake.rows[0]?.size_bytes ?? 0));
    if (aggregate > limits.maxAggregateBytes) throw new IntakeFailure('LIMIT_EXCEEDED', record.runId);
    const existing = await transaction.execute({
      sql: 'SELECT digest FROM vrq_evidence_snapshots WHERE run_id = ?',
      args: [record.runId],
    });
    if (existing.rows.length) {
      if (existing.rows[0]?.digest !== record.digest) throw new Error('Run already binds different evidence.');
    } else {
      for (const s of sources) await transaction.execute(sourceStatement(s.source, limits));
      await transaction.execute({
        sql: 'INSERT INTO vrq_evidence_snapshots (run_id,digest,snapshot_json,created_at) VALUES (?,?,?,?)',
        args: [record.runId, record.digest, json, new Date().toISOString()],
      });
    }
  });
}
export async function readEvidence(client: Pick<Client, 'execute'>, runId: string) {
  const result = await client.execute({
    sql: 'SELECT snapshot_json FROM vrq_evidence_snapshots WHERE run_id = ?',
    args: [runId],
  });
  return result.rows[0] ? evidenceSnapshotSchema.parse(JSON.parse(String(result.rows[0].snapshot_json))) : undefined;
}

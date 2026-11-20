import type { Client } from '@libsql/client';
import type { InputLimits } from '../contracts/limits.ts';
import { evidenceSnapshotSchema } from '../contracts/evidence-snapshot.ts';
import { canonicalJson, sha256, IntakeFailure } from '../intake/source.ts';
import { sourceStatement } from './sources.ts';
import { writeTransaction } from './transaction.ts';
import { questionnaireSchema } from '../contracts/questionnaire.ts';
import { mappingSchema } from '../contracts/mapping.ts';
import type { QuestionnaireInput } from '../contracts/questionnaire.ts';
import type { ConfirmedInputMapping } from '../contracts/mapping.ts';
import type { InputSourceSnapshot } from '../intake/source.ts';

export async function persistIntake(
  client: Pick<Client, 'transaction'>,
  limits: InputLimits,
  runId: string,
  input: QuestionnaireInput,
  mapping: ConfirmedInputMapping,
  source: InputSourceSnapshot,
) {
  input = questionnaireSchema.parse(input);
  mapping = mappingSchema.parse(mapping);
  if (
    input.inputProvenance.sourceId !== source.sourceId ||
    mapping.sourceSha256 !== source.sha256 ||
    mapping.adapterKey !== input.inputProvenance.adapterKey ||
    mapping.adapterVersion !== input.inputProvenance.adapterVersion ||
    mapping.profile !== input.inputProvenance.profile ||
    mapping.profileVersion !== input.inputProvenance.profileVersion ||
    input.inputProvenance.sourceSha256 !== source.sha256 ||
    input.inputProvenance.mappingDigest !== sha256(canonicalJson(mapping))
  )
    throw new Error('Intake binding mismatch.');
  sourceStatement(source, limits);
  const json = canonicalJson(input),
    map = canonicalJson(mapping),
    digest = sha256(json);
  return writeTransaction(client, async transaction => {
    const evidence = await transaction.execute({
      sql: 'SELECT snapshot_json FROM vrq_evidence_snapshots WHERE run_id = ?',
      args: [runId],
    });
    let aggregate = source.sizeBytes;
    if (evidence.rows[0]) {
      const snapshot = evidenceSnapshotSchema.parse(JSON.parse(String(evidence.rows[0].snapshot_json)));
      for (const d of snapshot.documents) {
        const row = await transaction.execute({
          sql: 'SELECT size_bytes FROM vrq_sources WHERE digest = ?',
          args: [d.sha256],
        });
        if (!row.rows[0]) throw new Error('Missing immutable evidence source.');
        aggregate += Number(row.rows[0].size_bytes);
      }
    }
    if (aggregate > limits.maxAggregateBytes) throw new IntakeFailure('LIMIT_EXCEEDED', source.sourceId);
    const existing = await transaction.execute({
      sql: 'SELECT digest FROM vrq_intakes WHERE run_id = ?',
      args: [runId],
    });
    if (existing.rows.length) {
      if (existing.rows[0]?.digest !== digest) throw new Error('Run already binds a different intake.');
    } else {
      await transaction.execute(sourceStatement(source, limits));
      await transaction.execute({
        sql: 'INSERT INTO vrq_intakes (run_id,digest,canonical_json,mapping_json,source_digest,created_at) VALUES (?,?,?,?,?,?)',
        args: [runId, digest, json, map, source.sha256, new Date().toISOString()],
      });
      await transaction.execute({
        sql: 'INSERT INTO vrq_document_plans (run_id,plan_json) VALUES (?,NULL)',
        args: [runId],
      });
    }
    return { runId, digest };
  });
}
export async function readIntake(client: Pick<Client, 'execute'>, runId: string) {
  const result = await client.execute({
    sql: 'SELECT canonical_json, mapping_json, source_digest FROM vrq_intakes WHERE run_id = ?',
    args: [runId],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  const source = await client.execute({
    sql: 'SELECT bytes FROM vrq_sources WHERE digest = ?',
    args: [String(row.source_digest)],
  });
  return {
    input: questionnaireSchema.parse(JSON.parse(String(row.canonical_json))),
    mapping: mappingSchema.parse(JSON.parse(String(row.mapping_json))),
    sourceBytes: source.rows[0]?.bytes,
  };
}

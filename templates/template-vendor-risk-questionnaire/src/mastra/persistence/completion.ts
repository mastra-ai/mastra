import { openDatabase } from './database.ts';
import { readIntake } from './intake.ts';
import { writePlanSchema } from '../contracts/completion.ts';
import type { DocumentWritePlan } from '../contracts/completion.ts';
import { defaultLimits } from '../contracts/limits.ts';
import { canonicalJson, readSource } from '../intake/source.ts';
import { buildWritePlan, preflightPlan } from '../completion/plan.ts';

export function sourceBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new Error('SOURCE_UNAVAILABLE');
}
export async function prepareCompletion(
  url: string,
  runId: string,
  consent: string[] = [],
): Promise<DocumentWritePlan> {
  const client = await openDatabase(url);
  try {
    const row = await client.execute({
      sql: 'SELECT plan_json FROM vrq_document_plans WHERE run_id = ?',
      args: [runId],
    });
    if (!row.rows[0]) throw new Error('COMPLETION_NOT_INITIALIZED');
    const intake = await readIntake(client, runId);
    if (!intake) throw new Error('SOURCE_UNAVAILABLE');
    const bytes = sourceBytes(intake.sourceBytes);
    const checkpoint = await client.execute({
      sql: 'SELECT checkpoint_json FROM vrq_respond WHERE run_id = ?',
      args: [runId],
    });
    if (checkpoint.rows[0]) {
      const sourcePath = JSON.parse(String(checkpoint.rows[0].checkpoint_json)).sourcePath;
      if (
        sourcePath &&
        (await readSource(sourcePath, intake.input.inputProvenance.sourceId, defaultLimits)).sha256 !==
          intake.input.inputProvenance.sourceSha256
      )
        throw new Error('STALE_SOURCE_MAPPING');
    }
    if (row.rows[0].plan_json) {
      const plan = writePlanSchema.parse(JSON.parse(String(row.rows[0].plan_json)));
      await preflightPlan(bytes, intake.input, intake.mapping, plan);
      return plan;
    }
    const plan = await buildWritePlan(bytes, intake.input, intake.mapping, consent);
    const update = await client.execute({
      sql: 'UPDATE vrq_document_plans SET plan_json = ? WHERE run_id = ? AND plan_json IS NULL',
      args: [canonicalJson(plan), runId],
    });
    if (update.rowsAffected !== 1) throw new Error('STALE_WRITE_PLAN');
    return plan;
  } finally {
    client.close();
  }
}

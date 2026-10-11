import { randomUUID } from 'node:crypto';
import type { Client } from '@libsql/client';
import { openDatabase, databaseUrl } from './database.ts';
import { writeTransaction } from './transaction.ts';
import { readIntake } from './intake.ts';
import { readEvidence } from './evidence.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';
import { executionPolicySchema } from '../contracts/execution-policy.ts';
import type { ExecutionPolicy } from '../contracts/execution-policy.ts';
import {
  processingRunSchema,
  usageRecordSchema,
  securityOutcomeSchema,
  processingStatusSchema,
} from '../contracts/processing.ts';
import type { ProcessingRun, UsageRecord, SecurityOutcome } from '../contracts/processing.ts';
import { questionResultSchema } from '../contracts/answer.ts';
import type { Reason, QuestionResult } from '../contracts/answer.ts';
import { ProcessingFailure } from '../processing/failure.ts';

export async function openProcessingStore(url = databaseUrl) {
  const client = await openDatabase(url);
  await client.batch(
    [
      'CREATE TABLE IF NOT EXISTS vrq_processing (run_id TEXT PRIMARY KEY, run_json TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS vrq_results (run_id TEXT NOT NULL, question_id TEXT NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY(run_id,question_id))',
      'CREATE TABLE IF NOT EXISTS vrq_usage (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, usage_json TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS vrq_security (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, outcome_json TEXT NOT NULL)',
    ],
    'write',
  );
  // One authority serializes all writes on this client. SQL transactions also serialize other clients.
  let pending: Promise<unknown> = Promise.resolve();
  let writeFailed = false;
  function queued<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending
      .then(() => {
        if (writeFailed) throw new ProcessingFailure('STORAGE_FAILURE');
        return operation();
      })
      .catch(() => {
        writeFailed = true;
        throw new ProcessingFailure('STORAGE_FAILURE');
      });
    pending = result.catch(() => {});
    return result;
  }
  async function runFrom(db: Pick<Client, 'execute'>, runId: string): Promise<ProcessingRun | undefined> {
    const r = await db.execute({ sql: 'SELECT run_json FROM vrq_processing WHERE run_id = ?', args: [runId] });
    return r.rows[0] ? processingRunSchema.parse(JSON.parse(String(r.rows[0].run_json))) : undefined;
  }
  const saveRun = (db: Pick<Client, 'execute'>, run: ProcessingRun) =>
    db.execute({
      sql: 'UPDATE vrq_processing SET run_json = ? WHERE run_id = ?',
      args: [canonicalJson(processingRunSchema.parse(run)), run.runId],
    });
  async function usageFrom(db: Pick<Client, 'execute'>, runId: string) {
    const r = await db.execute({
      sql: 'SELECT usage_json FROM vrq_usage WHERE run_id = ? ORDER BY rowid',
      args: [runId],
    });
    return r.rows.map(row => usageRecordSchema.parse(JSON.parse(String(row.usage_json))));
  }
  return {
    readIntake: (runId: string) => readIntake(client, runId),
    readEvidence: (runId: string) => readEvidence(client, runId),
    begin: (runId: string, raw: ExecutionPolicy) =>
      queued(async () => {
        const policy = executionPolicySchema.parse(raw);
        const intake = await readIntake(client, runId),
          evidence = await readEvidence(client, runId);
        if (!intake || !evidence || intake.input.organizationId !== evidence.scope.organizationId)
          throw new Error('Missing bound intake or evidence.');
        return writeTransaction(client, async tx => {
          const old = await runFrom(tx, runId);
          if (old) throw new Error('Processing identity already exists. Use status or a new intake run.');
          const now = new Date().toISOString();
          const run = processingRunSchema.parse({
            runId,
            intakeDigest: sha256(canonicalJson(intake.input)),
            evidenceDigest: evidence.digest,
            policyDigest: sha256(canonicalJson(policy)),
            policy,
            state: 'processing',
            stopReason: null,
            createdAt: now,
            updatedAt: now,
          });
          await tx.execute({
            sql: 'INSERT INTO vrq_processing (run_id,run_json) VALUES (?,?)',
            args: [runId, canonicalJson(run)],
          });
          return run;
        });
      }),
    reserve: (runId: string, questionId: string, phase: UsageRecord['phase'], attempt: number, inputReserved: number) =>
      queued(async () =>
        writeTransaction(client, async tx => {
          const run = await runFrom(tx, runId);
          if (!run) throw new Error('Missing processing identity.');
          if (run.stopReason || run.state !== 'processing')
            return { failure: run.stopReason ?? 'BUDGET_EXHAUSTED' } as const;
          const records = await usageFrom(tx, runId);
          const p = run.policy,
            cost = (inputReserved * p.rates.inputUsdPerMillion + p.maxOutputTokens * p.rates.outputUsdPerMillion) / 1e6;
          const reason =
            Date.now() - Date.parse(run.createdAt) >= p.maxRunElapsedMs
              ? 'TIME_LIMIT'
              : records.length >= p.maxPhysicalCalls ||
                  records.reduce((sum, r) => sum + r.estimatedUsd, 0) + cost > p.budgetUsd
                ? 'BUDGET_EXHAUSTED'
                : null;
          if (reason) {
            await saveRun(tx, { ...run, stopReason: reason, updatedAt: new Date().toISOString() });
            return { failure: reason } as const;
          }
          const record = usageRecordSchema.parse({
            id: randomUUID(),
            runId,
            questionId,
            phase,
            attempt,
            inputReserved,
            outputReserved: p.maxOutputTokens,
            inputTokens: null,
            outputTokens: null,
            reasoningTokens: null,
            estimatedUsd: cost,
            status: 'reserved',
            reason: null,
            createdAt: new Date().toISOString(),
          });
          await tx.execute({
            sql: 'INSERT INTO vrq_usage (id,run_id,usage_json) VALUES (?,?,?)',
            args: [record.id, runId, canonicalJson(record)],
          });
          return { record, remainingRunMs: p.maxRunElapsedMs - (Date.now() - Date.parse(run.createdAt)) } as const;
        }),
      ),
    settle: (
      reservation: UsageRecord,
      usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number } | undefined,
      reason: Reason | null,
    ) =>
      queued(async () => {
        const run = await runFrom(client, reservation.runId);
        if (!run) throw new Error('Missing run.');
        const valid =
          usage &&
          Number.isInteger(usage.inputTokens) &&
          usage.inputTokens >= 0 &&
          Number.isInteger(usage.outputTokens) &&
          usage.outputTokens >= 0 &&
          (usage.reasoningTokens === undefined ||
            (Number.isInteger(usage.reasoningTokens) &&
              usage.reasoningTokens >= 0 &&
              usage.reasoningTokens <= usage.outputTokens));
        const record = usageRecordSchema.parse({
          ...reservation,
          status: valid ? 'observed' : 'uncertain',
          inputTokens: valid ? usage.inputTokens : null,
          outputTokens: valid ? usage.outputTokens : null,
          reasoningTokens: valid ? (usage.reasoningTokens ?? null) : null,
          estimatedUsd: valid
            ? (usage.inputTokens * run.policy.rates.inputUsdPerMillion +
                usage.outputTokens * run.policy.rates.outputUsdPerMillion) /
              1e6
            : reservation.estimatedUsd,
          reason,
        });
        await client.execute({
          sql: 'UPDATE vrq_usage SET usage_json = ? WHERE id = ? AND run_id = ?',
          args: [canonicalJson(record), record.id, record.runId],
        });
      }),
    stop: (runId: string, reason: Reason) =>
      queued(async () => {
        const run = await runFrom(client, runId);
        if (!run) throw new Error('Missing run.');
        await saveRun(client, { ...run, stopReason: run.stopReason ?? reason, updatedAt: new Date().toISOString() });
      }),
    persistResult: (runId: string, raw: QuestionResult) =>
      queued(async () => {
        const result = questionResultSchema.parse(raw);
        await client.execute({
          sql: 'INSERT INTO vrq_results (run_id,question_id,result_json) VALUES (?,?,?) ON CONFLICT(run_id,question_id) DO UPDATE SET result_json = excluded.result_json',
          args: [runId, result.questionId, canonicalJson(result)],
        });
      }),
    persistSecurity: (raw: SecurityOutcome) =>
      queued(async () => {
        const result = securityOutcomeSchema.parse(raw);
        await client.execute({
          sql: 'INSERT INTO vrq_security (id,run_id,outcome_json) VALUES (?,?,?)',
          args: [randomUUID(), result.runId, canonicalJson(result)],
        });
      }),
    finish: (runId: string) =>
      queued(async () => {
        const run = await runFrom(client, runId);
        if (!run) throw new Error('Missing run.');
        await saveRun(client, {
          ...run,
          state: run.stopReason ? 'failed' : 'awaiting_review',
          updatedAt: new Date().toISOString(),
        });
      }),
    status: async (runId: string) => {
      await pending;
      const run = await runFrom(client, runId);
      if (!run) return undefined;
      const rows = await client.execute({ sql: 'SELECT result_json FROM vrq_results WHERE run_id = ?', args: [runId] });
      const security = await client.execute({
        sql: 'SELECT outcome_json FROM vrq_security WHERE run_id = ? ORDER BY rowid',
        args: [runId],
      });
      return processingStatusSchema.parse({
        run,
        results: rows.rows
          .map(r => questionResultSchema.parse(JSON.parse(String(r.result_json))))
          .sort((a, b) => a.order - b.order),
        usage: await usageFrom(client, runId),
        security: security.rows.map(r => securityOutcomeSchema.parse(JSON.parse(String(r.outcome_json)))),
      });
    },
    close: () => {
      writeFailed = true;
      client.close();
    },
  };
}
export type ProcessingStore = Awaited<ReturnType<typeof openProcessingStore>>;

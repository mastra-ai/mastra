import { persistDomainEvent } from './telemetry.ts';
import { randomUUID } from 'node:crypto';
import type { Client } from '@libsql/client';
import type { StorageOwner } from './client.ts';
import { openDatabase, databaseUrl, storageOwner } from './database.ts';
import { writeTransaction } from './transaction.ts';
import { readIntake } from './intake.ts';
import { readEvidence } from './evidence.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';
import { executionPolicySchema } from '../contracts/execution-policy.ts';
import { serviceLimits } from '../contracts/service-limits.ts';
import type { ExecutionPolicy } from '../contracts/execution-policy.ts';
import {
  processingRunSchema,
  usageRecordSchema,
  securityOutcomeSchema,
  processingStatusSchema,
} from '../contracts/processing.ts';
import type { ProcessingRun, UsageRecord, SecurityOutcome } from '../contracts/processing.ts';
import { questionResultSchema, interpretationSchema } from '../contracts/answer.ts';
import type { Reason, QuestionResult, Interpretation } from '../contracts/answer.ts';
import { ProcessingFailure } from '../processing/failure.ts';
import { processingDiagnosticSchema } from '../contracts/processing-diagnostic.ts';
import type { ProcessingDiagnostic } from '../contracts/processing-diagnostic.ts';
import { telemetryId } from '../observability/privacy.ts';
import { processingClock, processingElapsedMs } from '../processing/clock.ts';

export async function openProcessingStore(
  url = databaseUrl,
  reviewClaim?: { token: string; revision: number },
  owner?: StorageOwner,
  underlying?: Client,
) {
  owner ??= url === databaseUrl ? storageOwner : undefined;
  const client = await openDatabase(url, owner, underlying);
  if (!client.readOnly)
    await client.batch(
      [
        'CREATE TABLE IF NOT EXISTS vrq_processing (run_id TEXT PRIMARY KEY, run_json TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_results (run_id TEXT NOT NULL, question_id TEXT NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY(run_id,question_id))',
        'CREATE TABLE IF NOT EXISTS vrq_usage (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, usage_json TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_service_usage (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, reserved_usd REAL NOT NULL)',
        'CREATE TABLE IF NOT EXISTS vrq_security (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, outcome_json TEXT NOT NULL)',
      ],
      'write',
    );
  // One authority serializes all writes on this client. SQL transactions also serialize other clients.
  let pending: Promise<unknown> = Promise.resolve();
  let writeFailed = false,
    closing = false,
    dispatchStopped = false,
    activeWork = 0;
  const quiescence: Array<() => void> = [];
  const actualClose = async () => {
    closing = true;
    if (activeWork) await new Promise<void>(resolve => quiescence.push(resolve));
    await pending;
    writeFailed = true;
    await client.drain();
  };
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
  const api = {
    trackWork: () => {
      if (closing) throw new ProcessingFailure('STORAGE_FAILURE');
      activeWork++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeWork--;
        if (!activeWork) quiescence.splice(0).forEach(resolve => resolve());
      };
    },
    bindOwner: (runId: string, close: () => Promise<void> = actualClose) =>
      owner?.bind(
        runId,
        async () => {
          await api.stop(runId, 'STORAGE_FAILURE');
          const state = await api.status(runId);
          await api.persistDiagnostic(runId, {
            questionId: telemetryId('storage-owner')!,
            at: new Date().toISOString(),
            phase: state?.usage.at(-1)?.phase ?? 'interpretation',
            origin: 'origin',
            category: 'STORAGE_FAILURE',
            reason: 'STORAGE_FAILURE',
          });
          await api.finish(runId);
        },
        close,
      ),
    assertAdmission: () => {
      if (closing || writeFailed || dispatchStopped) throw new ProcessingFailure('STORAGE_FAILURE');
      owner?.assertHealthy();
    },
    stopAdmission: () => {
      dispatchStopped = true;
      owner?.stop();
    },
    persistDiagnostic: (runId: string, raw: ProcessingDiagnostic) =>
      queued(async () => {
        const value = processingDiagnosticSchema.parse(raw);
        await client.execute({
          sql: 'INSERT INTO vrq_diagnostics (id,run_id,diagnostic_json) VALUES (?,?,?)',
          args: [randomUUID(), telemetryId(runId)!, canonicalJson(value)],
        });
      }),
    diagnostics: async (runId: string) => {
      await pending;
      const rows = await client.execute({
        sql: 'SELECT diagnostic_json FROM vrq_diagnostics WHERE run_id = ? ORDER BY rowid',
        args: [telemetryId(runId)!],
      });
      return rows.rows.map(r => processingDiagnosticSchema.parse(JSON.parse(String(r.diagnostic_json))));
    },
    readIntake: (runId: string) => readIntake(client, runId),
    readEvidence: (runId: string) => readEvidence(client, runId),
    begin: (runId: string, raw: ExecutionPolicy, workflowRunId?: string) =>
      queued(async () => {
        const policy = executionPolicySchema.parse(raw);
        const intake = await readIntake(client, runId),
          evidence = await readEvidence(client, runId);
        if (!intake || !evidence || intake.input.organizationId !== evidence.scope.organizationId)
          throw new Error('Missing bound intake or evidence.');
        return writeTransaction(client, async tx => {
          const old = await runFrom(tx, runId);
          if (old) {
            const binding = await tx.execute({
              sql: 'SELECT workflow_run_id FROM vrq_draft_owners WHERE run_id = ?',
              args: [runId],
            });
            if (
              !workflowRunId ||
              binding.rows[0]?.workflow_run_id !== workflowRunId ||
              old.policyDigest !== sha256(canonicalJson(policy)) ||
              old.intakeDigest !== sha256(canonicalJson(intake.input)) ||
              old.evidenceDigest !== evidence.digest
            )
              throw new Error('Processing identity already exists. Use status or a new intake run.');
            if (old.stopReason && old.stopReason !== 'STORAGE_FAILURE') return old;
            const resumed = {
              ...old,
              clock: processingClock(old, true),
              state: 'processing' as const,
              stopReason: null,
              updatedAt: new Date().toISOString(),
            };
            await tx.execute({
              sql: 'UPDATE vrq_processing SET run_json = ? WHERE run_id = ?',
              args: [canonicalJson(resumed), runId],
            });
            return resumed;
          }
          if (workflowRunId)
            await tx.execute({
              sql: 'INSERT INTO vrq_draft_owners (run_id,workflow_run_id) VALUES (?,?)',
              args: [runId, workflowRunId],
            });
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
            clock: { elapsedMs: 0, startedAt: now },
          });
          await tx.execute({
            sql: 'INSERT INTO vrq_processing (run_id,run_json) VALUES (?,?)',
            args: [runId, canonicalJson(run)],
          });
          await persistDomainEvent(tx, runId, 'processing-started', { kind: 'processing_started', at: now });
          return run;
        });
      }),
    reserve: (runId: string, questionId: string, phase: UsageRecord['phase'], attempt: number, inputReserved: number) =>
      queued(async () => {
        try {
          api.assertAdmission();
        } catch {
          return { failure: 'STORAGE_FAILURE' } as const;
        }
        return writeTransaction(client, async tx => {
          const run = await runFrom(tx, runId);
          if (!run) throw new Error('Missing processing identity.');
          const reviewReservation =
            reviewClaim && run.state === 'awaiting_review' && ['injection', 'pii', 'verification'].includes(phase)
              ? await tx.execute({
                  sql: "SELECT claim_token FROM vrq_review WHERE run_id = ? AND claim_token = ? AND json_extract(state_json, '$.state') = 'awaiting_review' AND json_extract(state_json, '$.revision') = ?",
                  args: [runId, reviewClaim.token, reviewClaim.revision],
                })
              : undefined;
          if (run.stopReason || (run.state !== 'processing' && !reviewReservation?.rows[0]?.claim_token))
            return { failure: run.stopReason ?? 'BUDGET_EXHAUSTED' } as const;
          const records = await usageFrom(tx, runId);
          const p = run.policy,
            cost = (inputReserved * p.rates.inputUsdPerMillion + p.maxOutputTokens * p.rates.outputUsdPerMillion) / 1e6;
          const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          await tx.execute({ sql: 'DELETE FROM vrq_service_usage WHERE created_at < ?', args: [cutoff] });
          const aggregate = (
            await tx.execute('SELECT COUNT(*) AS calls, COALESCE(SUM(reserved_usd), 0) AS usd FROM vrq_service_usage')
          ).rows[0]!;
          const reason =
            processingElapsedMs(run) >= p.maxRunElapsedMs
              ? 'TIME_LIMIT'
              : records.length >= p.maxPhysicalCalls ||
                  records.reduce((sum, r) => sum + r.estimatedUsd, 0) + cost > p.budgetUsd ||
                  Number(aggregate.calls) >= serviceLimits.maxDailyCalls ||
                  Number(aggregate.usd) + cost > serviceLimits.maxDailyReservedUsd
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
            sql: 'INSERT INTO vrq_service_usage (id,created_at,reserved_usd) VALUES (?,?,?)',
            args: [record.id, record.createdAt, cost],
          });
          await tx.execute({
            sql: 'INSERT INTO vrq_usage (id,run_id,usage_json) VALUES (?,?,?)',
            args: [record.id, runId, canonicalJson(record)],
          });
          return { record, remainingRunMs: p.maxRunElapsedMs - processingElapsedMs(run) } as const;
        });
      }),
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
    readConsistency: async (runId: string, digest: string) => {
      const rows = await client.execute({
        sql: 'SELECT outcome FROM vrq_consistency WHERE run_id = ? AND digest = ?',
        args: [runId, digest],
      });
      return rows.rows[0] ? Boolean(rows.rows[0].outcome) : undefined;
    },
    persistConsistency: (runId: string, digest: string, outcome: boolean) =>
      queued(async () => {
        await client.execute({
          sql: 'INSERT INTO vrq_consistency (run_id,digest,outcome) VALUES (?,?,?) ON CONFLICT(run_id,digest) DO NOTHING',
          args: [runId, digest, outcome ? 1 : 0],
        });
      }),
    readInterpretations: async (runId: string) => {
      const rows = await client.execute({
        sql: 'SELECT question_id,interpretation_json FROM vrq_interpretations WHERE run_id = ?',
        args: [runId],
      });
      return new Map(
        rows.rows.map(r => [
          String(r.question_id),
          interpretationSchema.parse(JSON.parse(String(r.interpretation_json))),
        ]),
      );
    },
    persistInterpretation: (runId: string, questionId: string, raw: Interpretation) =>
      queued(async () => {
        await client.execute({
          sql: 'INSERT INTO vrq_interpretations (run_id,question_id,interpretation_json) VALUES (?,?,?) ON CONFLICT(run_id,question_id) DO UPDATE SET interpretation_json=excluded.interpretation_json',
          args: [runId, questionId, canonicalJson(interpretationSchema.parse(raw))],
        });
      }),
    persistResult: (runId: string, raw: QuestionResult) =>
      queued(async () => {
        const result = questionResultSchema.parse(raw);
        await writeTransaction(client, async tx => {
          await tx.execute({
            sql: 'INSERT INTO vrq_results (run_id,question_id,result_json) VALUES (?,?,?) ON CONFLICT(run_id,question_id) DO UPDATE SET result_json = excluded.result_json',
            args: [runId, result.questionId, canonicalJson(result)],
          });
          await persistDomainEvent(tx, runId, `route:${result.questionId}`, {
            kind: 'first_route',
            at: new Date().toISOString(),
            questionId: result.questionId,
            domain: result.interpretation?.domain ?? 'unclassified',
            route: result.status === 'draft_eligible' ? 'auto_draft' : 'escalated',
            materialClaims: result.draft?.claims.length ?? 0,
            supportedClaims: result.status === 'draft_eligible' ? result.draft!.claims.length : 0,
          });
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
        await writeTransaction(client, async tx => {
          const now = new Date().toISOString();
          await saveRun(tx, {
            ...run,
            clock: processingClock(run, false),
            state: run.stopReason ? 'failed' : 'awaiting_review',
            updatedAt: now,
          });
          await persistDomainEvent(tx, runId, 'processing-finished', { kind: 'processing_finished', at: now });
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
    close: actualClose,
  };
  return api;
}
export type ProcessingStore = Awaited<ReturnType<typeof openProcessingStore>>;

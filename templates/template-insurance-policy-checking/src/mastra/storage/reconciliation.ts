import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Transaction } from '@libsql/client';
import type { z } from 'zod';
import type { insuranceProfileSchema } from '../config/insurance.js';
import { canonicalJson, hashBytes, type CaseRecord, type OperationContext } from '../domain/contracts.js';
import { IntakeError, isDatabaseBusy, safeFailure, type Failure } from '../domain/errors.js';
import type {
  CompareRequest,
  Comparison,
  Extraction,
  ProcessingBudget,
  SemanticAssessment,
} from '../domain/reconciliation-contracts.js';
import type { CaseRepository, SavedSource } from './cases.js';

export type AnalysisInput = {
  schemaVersion: 'reconciliation-1';
  caseId: string;
  sourceRevision: number;
  clarification: NonNullable<CaseRecord['clarification']>;
  identity: CaseRecord['identity'];
  sources: SavedSource[];
  profile: z.infer<typeof insuranceProfileSchema>;
  asOf: string;
  model: string;
  promptVersion: 'insurance-1';
  budget: ProcessingBudget;
};
export type Analysis = {
  id: string;
  attemptId: string;
  inputHash: string;
  input: AnalysisInput;
  createdAt: string;
  extractions: Extraction[];
  comparisons: Comparison[];
  semantic: SemanticAssessment;
  rules: { profileId: string; version: string; ruleId: string; observation: string }[];
  limitations: string[];
  conclusion: 'OBSERVATIONS_AVAILABLE' | 'INCOMPLETE';
};
export type ProcessingAttempt = {
  id: string;
  caseId: string;
  runId: string;
  budgetKey: string;
  inputHash: string;
  input: AnalysisInput;
  state: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  heartbeatAt: string;
  failure: Failure | null;
  analysisId: string | null;
};

export class ReconciliationRepository {
  constructor(readonly cases: CaseRepository) {}
  async initialize() {
    await this.cases.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS insurance_processing (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_analysis (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), attempt_id TEXT NOT NULL UNIQUE REFERENCES insurance_processing(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_reservations (id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES insurance_processing(id), budget_key TEXT NOT NULL, tokens INTEGER NOT NULL, cost_micros INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_extractions (attempt_id TEXT NOT NULL REFERENCES insurance_processing(id), source_id TEXT NOT NULL REFERENCES insurance_sources(id), data TEXT NOT NULL, PRIMARY KEY(attempt_id,source_id));
    `);
  }
  async transaction<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.cases.serial(async () => {
      // Competing local processes must acquire the writer before re-reading state.
      // Retry only lock acquisition, never an operation whose effects may have run.
      let transaction: Transaction | undefined;
      for (let attempt = 0; !transaction; attempt++) {
        try {
          transaction = await this.cases.client.transaction('write');
        } catch (error) {
          if (!isDatabaseBusy(error)) throw error;
          // A failed native BEGIN can leave its statement active on a pooled connection.
          // No callback has run yet; discard that pool before another acquisition.
          await this.cases.client.reconnect();
          if (attempt >= 6) throw error;
          await delay(10 * 2 ** attempt);
        }
      }
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
  }
  async verifySources(context: OperationContext, sources: SavedSource[]) {
    const current = await this.cases.sources(context);
    if (canonicalJson(current) !== canonicalJson(sources))
      throw new IntakeError(
        'SOURCE_REVISION',
        'The captured source revision changed.',
        'Start a new analysis from current case status.',
        409,
      );
    for (const source of sources) {
      if (source.kind === 'pdf') await this.cases.evidence(context, source.sourceId, { physicalPage: 1 });
      else {
        const first = source.evidence[0]!;
        await this.cases.evidence(context, source.sourceId, { recordId: first.recordId, field: first.field });
      }
    }
  }
  async claim(
    context: OperationContext,
    request: CompareRequest,
    input: AnalysisInput,
    runId: string,
  ): Promise<ProcessingAttempt> {
    await this.verifySources(context, input.sources);
    return this.transaction(async transaction => {
      const record = await this.cases.requireCase(context, request.caseId);
      if (
        record.revision !== request.expectedRevision ||
        record.state === 'PROCESSING' ||
        (Boolean(record.latestReportId) &&
          !(record.revisionAuthority?.kind === 'evidence' && ['REVISION_REQUESTED', 'FAILED'].includes(record.state)))
      )
        throw new IntakeError(
          'STALE_CASE',
          'The case revision changed or another comparison is running.',
          'Read status and wait for the current attempt.',
          409,
        );
      let budgetKey: string | undefined;
      let snapshot = input;
      if (request.retryAttemptId) {
        const previous = await this.attempt(context, request.retryAttemptId);
        const comparable = (value: AnalysisInput) => ({ ...value, sourceRevision: 0 });
        if (
          record.state !== 'FAILED' ||
          previous.state !== 'FAILED' ||
          canonicalJson(comparable(previous.input)) !== canonicalJson(comparable(input))
        )
          throw new IntakeError(
            'RETRY_INPUT_CHANGED',
            'Retry requires the same failed case, sources, clarification, profile, model and budget.',
            'Start a new analysis after explicitly revising the case, or retry the unchanged failed input.',
            409,
          );
        snapshot = previous.input;
        budgetKey = previous.budgetKey;
      } else if (record.state === 'FAILED') {
        throw new IntakeError(
          'RETRY_REQUIRED',
          'The previous attempt failed.',
          'Use its retryAttemptId with unchanged inputs, or explicitly revise the case.',
          409,
        );
      }
      if (!budgetKey && record.revisionAuthority?.kind === 'evidence' && record.latestReportId) {
        const previous = (
          await transaction.execute({
            sql: 'SELECT analysis_id FROM insurance_reports WHERE id=?',
            args: [record.latestReportId],
          })
        ).rows[0];
        if (previous) {
          const analysisRow = (
            await transaction.execute({
              sql: 'SELECT data FROM insurance_analysis WHERE id=?',
              args: [String(previous.analysis_id)],
            })
          ).rows[0];
          if (analysisRow) {
            const previousAnalysis = JSON.parse(String(analysisRow.data)) as Analysis;
            const previousAttempt = await this.attempt(context, previousAnalysis.attemptId);
            if (canonicalJson(previousAttempt.input.budget) !== canonicalJson(input.budget))
              throw new IntakeError(
                'REVISION_BUDGET',
                'Evidence revision cannot replace its original processing budget.',
                'Keep the approved budget and inspect remaining reservations before retrying.',
                409,
              );
            budgetKey = previousAttempt.budgetKey;
          }
        }
      }
      const id = randomUUID();
      budgetKey ??= id;
      const history = await transaction.execute('SELECT data FROM insurance_processing');
      const count = history.rows
        .map(row => JSON.parse(String(row.data)) as ProcessingAttempt)
        .filter(attempt => attempt.budgetKey === budgetKey).length;
      if (count >= snapshot.budget.maxAttempts)
        throw new IntakeError(
          'ATTEMPT_LIMIT',
          'The configured processing attempt limit is exhausted.',
          'Review the failed attempt and obtain a new approved budget before changing configuration.',
        );
      const now = new Date().toISOString();
      const attempt: ProcessingAttempt = {
        id,
        caseId: record.id,
        runId,
        budgetKey,
        inputHash: hashBytes(canonicalJson(snapshot)),
        input: snapshot,
        state: 'PROCESSING',
        startedAt: now,
        heartbeatAt: now,
        failure: null,
        analysisId: null,
      };
      const updated = {
        ...record,
        state: 'PROCESSING',
        revision: record.revision + 1,
        ...(record.revisionAuthority ? { revisionAuthority: { ...record.revisionAuthority, runId } } : {}),
      };
      const changed = await transaction.execute({
        sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
        args: [JSON.stringify(updated), record.id, JSON.stringify(record)],
      });
      if (changed.rowsAffected !== 1)
        throw new IntakeError(
          'STALE_CASE',
          'The case changed before processing started.',
          'Read current status and retry.',
          409,
        );
      await transaction.execute({
        sql: 'INSERT INTO insurance_processing(id,case_id,data) VALUES(?,?,?)',
        args: [id, record.id, JSON.stringify(attempt)],
      });
      return attempt;
    });
  }
  async attempt(context: OperationContext, id: string): Promise<ProcessingAttempt> {
    const record = await this.cases.requireCase(context);
    const row = (
      await this.cases.client.execute({
        sql: 'SELECT data FROM insurance_processing WHERE id=? AND case_id=?',
        args: [id, record.id],
      })
    ).rows[0];
    if (!row)
      throw new IntakeError(
        'ATTEMPT_CONTEXT',
        'That processing attempt is not part of this case.',
        'Read case status for the current attempt.',
      );
    return JSON.parse(String(row.data)) as ProcessingAttempt;
  }
  async reserve(context: OperationContext, id: string, inputTokens: number, outputTokens: number, stage: string) {
    return this.transaction(async transaction => {
      const attempt = await this.attempt(context, id);
      const budget = attempt.input.budget;
      if (attempt.state !== 'PROCESSING')
        throw new IntakeError(
          'ATTEMPT_CLOSED',
          'This processing attempt has ended.',
          'Read its saved status before retrying.',
          409,
        );
      const totals = (
        await transaction.execute({
          sql: 'SELECT COUNT(*) AS requests, COALESCE(SUM(tokens),0) AS tokens, COALESCE(SUM(cost_micros),0) AS cost FROM insurance_reservations WHERE budget_key=?',
          args: [attempt.budgetKey],
        })
      ).rows[0]!;
      const tokens = inputTokens + outputTokens;
      const cost = inputTokens * budget.inputMicrosPerToken + outputTokens * budget.outputMicrosPerToken;
      if (
        !Number.isSafeInteger(cost) ||
        inputTokens > budget.maxInputTokensPerRequest ||
        outputTokens > budget.maxOutputTokensPerRequest ||
        Number(totals.requests) + 1 > budget.maxRequests ||
        Number(totals.tokens) + tokens > budget.maxTotalTokens ||
        Number(totals.cost) + cost > budget.maxCostMicros
      )
        throw new IntakeError(
          'PROCESSING_BUDGET',
          'The configured request, token or cost budget is exhausted.',
          'Inspect the failed attempt and obtain approved budget values before retrying.',
        );
      const reservationId = randomUUID();
      await transaction.execute({
        sql: 'INSERT INTO insurance_reservations(id,attempt_id,budget_key,tokens,cost_micros,data) VALUES(?,?,?,?,?,?)',
        args: [
          reservationId,
          id,
          attempt.budgetKey,
          tokens,
          cost,
          JSON.stringify({
            stage,
            reservedInputTokens: inputTokens,
            reservedOutputTokens: outputTokens,
            pricingAssumption: budget.pricingAssumption,
            usage: null,
            billingCost: null,
          }),
        ],
      });
      await transaction.execute({
        sql: 'UPDATE insurance_processing SET data=? WHERE id=? AND data=?',
        args: [JSON.stringify({ ...attempt, heartbeatAt: new Date().toISOString() }), id, JSON.stringify(attempt)],
      });
      return reservationId;
    });
  }
  async usage(id: string, usage: unknown) {
    const row = (
      await this.cases.client.execute({ sql: 'SELECT data FROM insurance_reservations WHERE id=?', args: [id] })
    ).rows[0]!;
    const data = JSON.parse(String(row.data)) as Record<string, unknown>;
    // Reservations remain charged at their conservative ceiling, including lost or missing usage.
    await this.cases.client.execute({
      sql: 'UPDATE insurance_reservations SET data=? WHERE id=?',
      args: [JSON.stringify({ ...data, usage, billingCost: null }), id],
    });
  }
  async saveExtraction(context: OperationContext, attemptId: string, extraction: Extraction) {
    await this.transaction(async transaction => {
      const attempt = await this.attempt(context, attemptId);
      if (attempt.state !== 'PROCESSING')
        throw new IntakeError(
          'ATTEMPT_CLOSED',
          'Processing has ended before extraction was saved.',
          'Read saved attempt status.',
          409,
        );
      await transaction.execute({
        sql: 'INSERT INTO insurance_extractions(attempt_id,source_id,data) VALUES(?,?,?)',
        args: [attemptId, extraction.sourceId, JSON.stringify(extraction)],
      });
    });
  }
  async finish(
    context: OperationContext,
    attemptId: string,
    analysis: Analysis | null,
    failure?: unknown,
    awaitPublication = false,
  ) {
    if (analysis) await this.verifySources(context, analysis.input.sources);
    return this.transaction(async transaction => {
      const attempt = await this.attempt(context, attemptId);
      if (attempt.state !== 'PROCESSING')
        throw new IntakeError('ATTEMPT_CLOSED', 'The attempt is no longer processing.', 'Read its saved status.', 409);
      const record = await this.cases.requireCase(context, attempt.caseId);
      if (
        record.state !== 'PROCESSING' ||
        canonicalJson(record.clarification) !== canonicalJson(attempt.input.clarification)
      )
        throw new IntakeError(
          'SOURCE_REVISION',
          'Case inputs changed during comparison.',
          'Read status and start with the current inputs.',
          409,
        );
      if (analysis)
        await transaction.execute({
          sql: 'INSERT INTO insurance_analysis(id,case_id,attempt_id,data) VALUES(?,?,?,?)',
          args: [analysis.id, record.id, attemptId, JSON.stringify(analysis)],
        });
      const updated = {
        ...record,
        state: analysis ? (awaitPublication ? 'PROCESSING' : 'CREATED') : 'FAILED',
        revision: record.revision + 1,
        ...(analysis ? { latestAnalysisId: analysis.id } : {}),
      };
      const changed = await transaction.execute({
        sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
        args: [JSON.stringify(updated), record.id, JSON.stringify(record)],
      });
      if (changed.rowsAffected !== 1)
        throw new IntakeError('STALE_CASE', 'Case state changed while saving results.', 'Read current status.', 409);
      await transaction.execute({
        sql: 'UPDATE insurance_processing SET data=? WHERE id=?',
        args: [
          JSON.stringify({
            ...attempt,
            state: analysis ? 'COMPLETED' : 'FAILED',
            analysisId: analysis?.id ?? null,
            failure: analysis ? null : safeFailure(failure),
          }),
          attemptId,
        ],
      });
    });
  }
  async status(context: OperationContext) {
    const record = await this.cases.active(context);
    if (!record) return { attempts: [], analyses: [] };
    const attempts = await this.cases.client.execute({
      sql: 'SELECT data FROM insurance_processing WHERE case_id=? ORDER BY rowid',
      args: [record.id],
    });
    const analyses = await this.cases.client.execute({
      sql: 'SELECT data FROM insurance_analysis WHERE case_id=? ORDER BY rowid',
      args: [record.id],
    });
    return {
      attempts: attempts.rows.map(row => JSON.parse(String(row.data)) as ProcessingAttempt),
      analyses: analyses.rows.map(row => JSON.parse(String(row.data)) as Analysis),
    };
  }
  async extractions(context: OperationContext, attemptId: string): Promise<Extraction[]> {
    await this.attempt(context, attemptId);
    const rows = await this.cases.client.execute({
      sql: 'SELECT data FROM insurance_extractions WHERE attempt_id=? ORDER BY rowid',
      args: [attemptId],
    });
    return rows.rows.map(row => JSON.parse(String(row.data)) as Extraction);
  }
  async progress(context: OperationContext) {
    const record = await this.cases.active(context);
    if (!record) return [];
    const rows = await this.cases.client.execute({
      sql: 'SELECT r.attempt_id,r.tokens,r.cost_micros,r.data FROM insurance_reservations r JOIN insurance_processing p ON p.id=r.attempt_id WHERE p.case_id=? ORDER BY r.rowid',
      args: [record.id],
    });
    const extractions = await this.cases.client.execute({
      sql: 'SELECT e.attempt_id,e.source_id FROM insurance_extractions e JOIN insurance_processing p ON p.id=e.attempt_id WHERE p.case_id=?',
      args: [record.id],
    });
    const ids = new Set([...rows.rows, ...extractions.rows].map(row => String(row.attempt_id)));
    return [...ids].map(attemptId => ({
      attemptId,
      extractedSourceIds: extractions.rows
        .filter(row => row.attempt_id === attemptId)
        .map(row => String(row.source_id)),
      requests: rows.rows
        .filter(row => row.attempt_id === attemptId)
        .map(row => {
          const data = JSON.parse(String(row.data)) as { usage: unknown; pricingAssumption: string };
          return {
            reservedTokens: Number(row.tokens),
            estimatedCeilingMicros: Number(row.cost_micros),
            pricingAssumption: data.pricingAssumption,
            usage: data.usage,
            billingCost: null,
          };
        }),
    }));
  }
  async recover(context: OperationContext) {
    const { attempts } = await this.status(context);
    // A lease spans every bounded HTTP request. Active work cannot be stolen by another process.
    for (const attempt of attempts.filter(
      value =>
        value.state === 'PROCESSING' &&
        Date.now() - Date.parse(value.heartbeatAt) > value.input.budget.timeoutMs * 2 + 1000,
    ))
      await this.finish(
        context,
        attempt.id,
        null,
        new IntakeError(
          'PROCESSING_INTERRUPTED',
          'Processing was interrupted before results were saved.',
          'Explicitly retry this attempt with its unchanged inputs.',
        ),
      );
  }
}

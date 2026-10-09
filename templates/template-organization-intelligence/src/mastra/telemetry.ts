import { randomUUID } from 'node:crypto';

import { createClient } from '@libsql/client';

export const TELEMETRY_RETENTION_MS = 7 * 86_400_000;

export type QueryTelemetry = {
  correlationId: string;
  status:
    | 'answered'
    | 'insufficient_evidence'
    | 'conflicting_evidence'
    | 'clarification_required'
    | 'operational_error';
  retrievalMs: number;
  durationMs: number;
  sourceIds: string[];
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | 'unavailable';
  cost: { amount: number; currency: 'USD'; estimated: true } | 'unavailable';
};
export type SyncTelemetry = {
  runId: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string;
  sources: Array<{
    sourceId: string;
    discovered: number;
    indexed: number;
    changed: number;
    unchanged: number;
    skipped: number;
    failed: number;
    removed: number;
  }>;
};
export type TelemetrySummary = {
  completedQuestions: number;
  insufficientEvidence: number;
  unansweredRate: number;
  operationalErrors: number;
  clarificationRequests: number;
  averageRetrievalMs: number;
  sourceUtilization: Record<string, number>;
  usage: 'unavailable' | 'partial' | { inputTokens: number; outputTokens: number; totalTokens: number };
  cost: QueryTelemetry['cost'];
  syncRuns: Array<Pick<SyncTelemetry, 'runId' | 'status' | 'startedAt' | 'finishedAt' | 'sources'>>;
};

/** Persists operational metadata only. Questions, answers, excerpts and provider payloads never enter this store. */
export class TelemetryStore {
  readonly #client;
  #ready?: Promise<void>;

  constructor(
    databaseUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.#client = createClient({ url: databaseUrl });
  }

  async recordQuery(event: Omit<QueryTelemetry, 'correlationId'> & { correlationId?: string }): Promise<void> {
    await this.#initialize();
    const safe: QueryTelemetry = {
      correlationId: event.correlationId ?? randomUUID(),
      status: event.status,
      retrievalMs: Math.max(0, Math.round(event.retrievalMs)),
      durationMs: Math.max(0, Math.round(event.durationMs)),
      sourceIds: [...new Set(event.sourceIds)].sort(),
      usage: event.usage === 'unavailable' ? 'unavailable' : { ...event.usage },
      cost: event.cost === 'unavailable' ? 'unavailable' : { ...event.cost },
    };
    const at = this.now().toISOString();
    await this.#client.batch(
      [
        {
          sql: 'INSERT OR REPLACE INTO oi_query_telemetry(id,recorded_at,data) VALUES(?,?,?)',
          args: [safe.correlationId, at, JSON.stringify(safe)],
        },
        { sql: 'DELETE FROM oi_query_telemetry WHERE recorded_at < ?', args: [this.#cutoff()] },
      ],
      'write',
    );
  }

  async summary(): Promise<TelemetrySummary> {
    await this.#initialize();
    await this.cleanup();
    const [queries, syncRuns] = await Promise.all([
      this.#client.execute('SELECT data FROM oi_query_telemetry ORDER BY recorded_at ASC'),
      this.#client.execute('SELECT data FROM oi_runs ORDER BY finished_at ASC'),
    ]);
    const events = queries.rows.map(row => JSON.parse(String(row.data)) as QueryTelemetry);
    const completed = events.filter(
      event => event.status !== 'operational_error' && event.status !== 'clarification_required',
    );
    const unanswered = completed.filter(event => event.status === 'insufficient_evidence').length;
    const sources: Record<string, number> = {};
    for (const event of events)
      for (const sourceId of event.sourceIds) sources[sourceId] = (sources[sourceId] ?? 0) + 1;
    const usageEvents = events.filter(
      (event): event is QueryTelemetry & { usage: Exclude<QueryTelemetry['usage'], 'unavailable'> } =>
        event.usage !== 'unavailable',
    );
    const costs = events.filter(
      (event): event is QueryTelemetry & { cost: Exclude<QueryTelemetry['cost'], 'unavailable'> } =>
        event.cost !== 'unavailable',
    );
    return {
      completedQuestions: completed.length,
      insufficientEvidence: unanswered,
      unansweredRate: completed.length ? unanswered / completed.length : 0,
      operationalErrors: events.filter(event => event.status === 'operational_error').length,
      clarificationRequests: events.filter(event => event.status === 'clarification_required').length,
      averageRetrievalMs: events.length
        ? events.reduce((total, event) => total + event.retrievalMs, 0) / events.length
        : 0,
      sourceUtilization: sources,
      usage: !usageEvents.length
        ? 'unavailable'
        : usageEvents.length !== events.length
          ? 'partial'
          : usageEvents.reduce(
              (total, event) => ({
                inputTokens: total.inputTokens + (event.usage.inputTokens ?? 0),
                outputTokens: total.outputTokens + (event.usage.outputTokens ?? 0),
                totalTokens: total.totalTokens + (event.usage.totalTokens ?? 0),
              }),
              { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            ),
      cost: costs.length
        ? { amount: costs.reduce((total, event) => total + event.cost.amount, 0), currency: 'USD', estimated: true }
        : 'unavailable',
      syncRuns: syncRuns.rows.map(row => JSON.parse(String(row.data)) as SyncTelemetry),
    };
  }

  async close(): Promise<void> {
    await this.#ready;
    this.#client.close();
  }
  /** Removes expired operational metadata even when the application has been idle. */
  async cleanup(): Promise<void> {
    await this.#initialize();
    await this.#client.batch(
      [
        { sql: 'DELETE FROM oi_query_telemetry WHERE recorded_at < ?', args: [this.#cutoff()] },
        { sql: 'DELETE FROM oi_runs WHERE finished_at < ?', args: [this.#cutoff()] },
      ],
      'write',
    );
  }
  #cutoff(): string {
    return new Date(this.now().getTime() - TELEMETRY_RETENTION_MS).toISOString();
  }
  async #initialize(): Promise<void> {
    this.#ready ??= this.#client
      .batch(
        [
          'CREATE TABLE IF NOT EXISTS oi_query_telemetry (id TEXT PRIMARY KEY, recorded_at TEXT NOT NULL, data TEXT NOT NULL)',
          'CREATE TABLE IF NOT EXISTS oi_runs (id TEXT PRIMARY KEY, finished_at TEXT NOT NULL, data TEXT NOT NULL)',
          { sql: 'DELETE FROM oi_query_telemetry WHERE recorded_at < ?', args: [this.#cutoff()] },
          { sql: 'DELETE FROM oi_runs WHERE finished_at < ?', args: [this.#cutoff()] },
        ],
        'write',
      )
      .then(() => undefined);
    return this.#ready;
  }
}

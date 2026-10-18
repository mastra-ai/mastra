import { randomUUID } from 'node:crypto';
import type { Client } from '@libsql/client';
import { z } from 'zod';
import { immutableSnapshot, snapshotSchema } from '../config/qualification';
import type { QualificationSnapshot } from '../config/qualification';
import { assessmentSchema, researchRoundSchema, ResearchError } from '../research/contracts';
import type { Assessment, ResearchRound } from '../research/contracts';

export interface Reservation {
  id: string;
  tokens: number;
  bytes: number;
}
export class QualificationStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly client: Client) {}
  async init() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS lead_qualifications (
        run_id TEXT PRIMARY KEY REFERENCES lead_runs(run_id), snapshot_json TEXT NOT NULL,
        started_at INTEGER, deadline_at INTEGER, searches INTEGER NOT NULL DEFAULT 0,
        pages INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
        compressed_bytes INTEGER NOT NULL DEFAULT 0, decoded_bytes INTEGER NOT NULL DEFAULT 0,
        assessment_json TEXT
      );
      CREATE TABLE IF NOT EXISTS lead_research_reservations (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES lead_qualifications(run_id),
        kind TEXT NOT NULL, tokens INTEGER NOT NULL, bytes INTEGER NOT NULL, status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lead_research_rounds (
        run_id TEXT NOT NULL REFERENCES lead_qualifications(run_id), round_index INTEGER NOT NULL,
        result_json TEXT NOT NULL, PRIMARY KEY(run_id,round_index)
      );
    `);
  }
  async get(runId: string) {
    const result = await this.client.execute({
      sql: 'SELECT * FROM lead_qualifications WHERE run_id=?',
      args: [runId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      snapshot: immutableSnapshot(snapshotSchema.parse(JSON.parse(z.string().parse(row.snapshot_json)))),
      assessment:
        row.assessment_json === null ? null : assessmentSchema.parse(JSON.parse(z.string().parse(row.assessment_json))),
      budget: {
        startedAt: row.started_at === null ? null : Number(row.started_at),
        deadlineAt: row.deadline_at === null ? null : Number(row.deadline_at),
        searchCalls: Number(row.searches),
        pageRequests: Number(row.pages),
        outputTokens: Number(row.output_tokens),
        compressedBytes: Number(row.compressed_bytes),
        decodedBytes: Number(row.decoded_bytes),
      },
    };
  }
  async start(runId: string, snapshot: QualificationSnapshot) {
    const now = Date.now();
    await this.client.execute({
      sql: 'UPDATE lead_qualifications SET started_at=?,deadline_at=? WHERE run_id=? AND started_at IS NULL',
      args: [now, now + snapshot.config.research.maxProcessingMs, runId],
    });
    const record = await this.get(runId);
    if (!record) throw new ResearchError('missing_snapshot');
    return record.budget.deadlineAt!;
  }
  reserve(runId: string, kind: 'search' | 'model' | 'page', desiredTokens = 0): Promise<Reservation> {
    const pending = this.queue.then(async () => {
      const record = await this.get(runId);
      if (!record || record.budget.deadlineAt === null || Date.now() >= record.budget.deadlineAt)
        throw new ResearchError('deadline_exhausted');
      if (record.assessment) throw new ResearchError('assessment_already_completed');
      const { research } = record.snapshot.config;
      const budget = record.budget;
      const search = Number(kind === 'search');
      const page = Number(kind === 'page');
      if (
        budget.searchCalls + search > research.maxSearchCalls ||
        budget.pageRequests + page > research.maxPageRequests
      )
        throw new ResearchError('request_budget_exhausted');
      const tokens = page ? 0 : Math.min(desiredTokens, research.maxOutputTokens - budget.outputTokens);
      const bytes = page
        ? Math.min(
            research.maxPageBytes,
            research.maxTotalPageBytes - Math.max(budget.compressedBytes, budget.decodedBytes),
          )
        : 0;
      if ((!page && tokens < 128) || (page && bytes < 1)) throw new ResearchError('resource_budget_exhausted');
      const id = randomUUID();
      // The conditional INSERT and counter update execute in one short SQLite transaction.
      // No JS await holds its write lock while native workflow snapshots are being saved.
      const result = await this.client.batch(
        [
          {
            sql: `INSERT INTO lead_research_reservations(id,run_id,kind,tokens,bytes,status)
          SELECT ?,run_id,?,?,?,'reserved' FROM lead_qualifications
          WHERE run_id=? AND deadline_at>? AND assessment_json IS NULL
          AND searches+?<=? AND pages+?<=? AND output_tokens+?<=?
          AND compressed_bytes+?<=? AND decoded_bytes+?<=?`,
            args: [
              id,
              kind,
              tokens,
              bytes,
              runId,
              Date.now(),
              search,
              research.maxSearchCalls,
              page,
              research.maxPageRequests,
              tokens,
              research.maxOutputTokens,
              bytes,
              research.maxTotalPageBytes,
              bytes,
              research.maxTotalPageBytes,
            ],
          },
          {
            sql: 'UPDATE lead_qualifications SET searches=searches+?,pages=pages+?,output_tokens=output_tokens+?,compressed_bytes=compressed_bytes+?,decoded_bytes=decoded_bytes+? WHERE run_id=? AND EXISTS(SELECT 1 FROM lead_research_reservations WHERE id=?)',
            args: [search, page, tokens, bytes, bytes, runId, id],
          },
        ],
        'write',
      );
      if (result[0]!.rowsAffected !== 1) throw new ResearchError('resource_budget_exhausted');
      return { id, tokens, bytes };
    });
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  settle(reservation: Reservation, usage: { outputTokens?: number; compressedBytes?: number; decodedBytes?: number }) {
    const pending = this.queue.then(async () => {
      const saved = await this.client.execute({
        sql: "SELECT tokens,bytes FROM lead_research_reservations WHERE id=? AND status='reserved'",
        args: [reservation.id],
      });
      const row = saved.rows[0];
      if (!row) return;
      const reservedTokens = Number(row.tokens);
      const reservedBytes = Number(row.bytes);
      const tokens = usage.outputTokens ?? reservedTokens;
      const compressed = usage.compressedBytes ?? reservedBytes;
      const decoded = usage.decodedBytes ?? reservedBytes;
      if (
        ![tokens, compressed, decoded].every(value => Number.isSafeInteger(value) && value >= 0) ||
        tokens > reservedTokens ||
        compressed > reservedBytes ||
        decoded > reservedBytes
      )
        throw new ResearchError('provider_limit_exceeded');
      await this.client.batch(
        [
          {
            sql: `UPDATE lead_qualifications SET output_tokens=output_tokens-?,compressed_bytes=compressed_bytes-?,decoded_bytes=decoded_bytes-?
          WHERE run_id=(SELECT run_id FROM lead_research_reservations WHERE id=? AND status='reserved')`,
            args: [reservedTokens - tokens, reservedBytes - compressed, reservedBytes - decoded, reservation.id],
          },
          {
            sql: "UPDATE lead_research_reservations SET status='settled' WHERE id=? AND status='reserved'",
            args: [reservation.id],
          },
        ],
        'write',
      );
    });
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  async finish(assessment: Assessment) {
    await this.client.execute({
      sql: 'UPDATE lead_qualifications SET assessment_json=? WHERE run_id=? AND assessment_json IS NULL',
      args: [JSON.stringify(assessmentSchema.parse(assessment)), assessment.runId],
    });
    return (await this.get(assessment.runId))!.assessment!;
  }
  async round(runId: string, index: number) {
    const record = await this.client.execute({
      sql: 'SELECT result_json FROM lead_research_rounds WHERE run_id=? AND round_index=?',
      args: [runId, index],
    });
    return record.rows[0] ? researchRoundSchema.parse(JSON.parse(z.string().parse(record.rows[0].result_json))) : null;
  }
  async saveRound(runId: string, round: ResearchRound) {
    await this.client.execute({
      sql: 'INSERT OR IGNORE INTO lead_research_rounds(run_id,round_index,result_json) VALUES(?,?,?)',
      args: [runId, round.diagnostic.index, JSON.stringify(researchRoundSchema.parse(round))],
    });
  }
}

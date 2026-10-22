import type { Client } from '@libsql/client';
import { z } from 'zod';
import {
  authorizationSchema,
  businessStates,
  decisionSchema,
  ownedPatchSchema,
  reviewPacketSchema,
} from '../review/contracts';
import type { Authorization, BusinessState, Decision, OwnedPatch, ReviewPacket } from '../review/contracts';

const json = (value: unknown) => (value === null ? null : (JSON.parse(z.string().parse(value)) as unknown));
export class ReviewStore {
  constructor(readonly client: Client) {}
  async init() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS lead_cycles (
        run_id TEXT PRIMARY KEY REFERENCES lead_runs(run_id), destination_provider TEXT NOT NULL,
        destination_reference TEXT NOT NULL, predecessor_id TEXT, assessment_id TEXT UNIQUE,
        state TEXT NOT NULL DEFAULT 'researching', active INTEGER NOT NULL DEFAULT 1,
        packet_json TEXT, published_at TEXT, expected_json TEXT, decision_json TEXT, authorization_json TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS lead_current_cycle ON lead_cycles(destination_provider,destination_reference) WHERE active=1;
      CREATE TABLE IF NOT EXISTS lead_output_operations (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES lead_cycles(run_id), kind TEXT NOT NULL,
        patch_json TEXT NOT NULL, expected_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
        UNIQUE(run_id,kind)
      );
      CREATE TABLE IF NOT EXISTS lead_review_history (
        run_id TEXT NOT NULL REFERENCES lead_cycles(run_id), revision INTEGER NOT NULL,
        state TEXT NOT NULL, packet_json TEXT, decision_json TEXT, authorization_json TEXT,
        published_at TEXT, expected_json TEXT, expected_revision TEXT, changed_at TEXT NOT NULL,
        PRIMARY KEY(run_id,revision)
      );
      CREATE TABLE IF NOT EXISTS lead_local_destinations (
        reference TEXT PRIMARY KEY, fields_json TEXT NOT NULL, marker TEXT
      );
    `);
  }
  async migrate() {
    const columns = (await this.client.execute('PRAGMA table_info(lead_cycles)')).rows.map(row => row.name);
    for (const [name, definition] of Object.entries({
      attempts: 'INTEGER NOT NULL DEFAULT 0',
      next_retry_at: 'INTEGER NOT NULL DEFAULT 0',
      failure_code: 'TEXT',
      changed_at: "TEXT NOT NULL DEFAULT ''",
      expected_revision: 'TEXT',
    }))
      if (!columns.includes(name))
        await this.client.execute(`ALTER TABLE lead_cycles ADD COLUMN ${name} ${definition}`);
    const operationColumns = (await this.client.execute('PRAGMA table_info(lead_output_operations)')).rows.map(
      row => row.name,
    );
    if (!operationColumns.includes('expected_revision'))
      await this.client.execute('ALTER TABLE lead_output_operations ADD COLUMN expected_revision TEXT');
  }
  async reserveAttempt(runId: string) {
    await this.client.execute({ sql: 'UPDATE lead_cycles SET attempts=attempts+1 WHERE run_id=?', args: [runId] });
  }
  async retry(runId: string, delay: number, code: string, exhausted: boolean) {
    await this.client.execute({
      sql: "UPDATE lead_cycles SET next_retry_at=?,failure_code=?,state=CASE WHEN ? THEN 'failed' ELSE state END WHERE run_id=?",
      args: [Date.now() + delay, code, Number(exhausted), runId],
    });
  }
  async get(runId: string) {
    const row = (await this.client.execute({ sql: 'SELECT * FROM lead_cycles WHERE run_id=?', args: [runId] })).rows[0];
    if (!row) return null;
    const packet = row.packet_json === null ? null : reviewPacketSchema.parse(json(row.packet_json));
    return {
      runId,
      attempts: Number(row.attempts),
      nextRetryAt: Number(row.next_retry_at),
      failureCode: row.failure_code === null ? null : z.string().parse(row.failure_code),
      changedAt: z.string().parse(row.changed_at),
      state: z.enum(businessStates).parse(row.state),
      active: Boolean(row.active),
      assessmentId: row.assessment_id === null ? null : z.string().parse(row.assessment_id),
      predecessorId: row.predecessor_id === null ? null : z.string().parse(row.predecessor_id),
      packet,
      publishedAt: row.published_at === null ? null : z.string().parse(row.published_at),
      expectedRevision: row.expected_revision === null ? undefined : z.string().parse(row.expected_revision),
      revision: packet?.revision ?? 1,
      expected: json(row.expected_json) as Record<string, unknown> | null,
      decision: row.decision_json === null ? null : decisionSchema.parse(json(row.decision_json)),
      authorization: row.authorization_json === null ? null : authorizationSchema.parse(json(row.authorization_json)),
    };
  }
  async state(runId: string, state: BusinessState, terminal = false) {
    await this.client.execute({
      sql: 'UPDATE lead_cycles SET state=?,active=?,changed_at=? WHERE run_id=?',
      args: [state, Number(!terminal), new Date().toISOString(), runId],
    });
  }
  async prepare(runId: string, assessmentId: string, packet: ReviewPacket | null, authorization: Authorization | null) {
    await this.client.execute({
      sql: 'UPDATE lead_cycles SET assessment_id=?,packet_json=?,authorization_json=?,state=? WHERE run_id=? AND assessment_id IS NULL AND active=1',
      args: [
        assessmentId,
        packet ? JSON.stringify(reviewPacketSchema.parse(packet)) : null,
        authorization ? JSON.stringify(authorizationSchema.parse(authorization)) : null,
        packet ? 'publishing_review' : 'applying',
        runId,
      ],
    });
  }
  async published(runId: string, expected: Record<string, unknown>) {
    await this.client.execute({
      sql: "UPDATE lead_cycles SET published_at=?,expected_json=?,expected_revision=NULL,state='awaiting_review',attempts=0,next_retry_at=0,failure_code=NULL WHERE run_id=? AND state='publishing_review'",
      args: [new Date().toISOString(), JSON.stringify(expected), runId],
    });
  }
  async decide(
    runId: string,
    decision: Decision,
    expected: Record<string, unknown>,
    publishedExpected: Record<string, unknown>,
    expectedRevision?: string,
  ) {
    return (
      (
        await this.client.execute({
          sql: "UPDATE lead_cycles SET decision_json=?,expected_json=?,expected_revision=? WHERE run_id=? AND active=1 AND state='awaiting_review' AND published_at IS NOT NULL AND decision_json IS NULL AND json_extract(packet_json,'$.digest')=? AND json_extract(packet_json,'$.expiresAt')>? AND expected_json=?",
          args: [
            JSON.stringify(decisionSchema.parse(decision)),
            JSON.stringify(expected),
            expectedRevision ?? null,
            runId,
            decision.input.digest,
            decision.decidedAt,
            JSON.stringify(publishedExpected),
          ],
        })
      ).rowsAffected === 1
    );
  }
  async authorize(runId: string, authorization: Authorization) {
    await this.client.execute({
      sql: "UPDATE lead_cycles SET authorization_json=?,state='applying' WHERE run_id=? AND active=1 AND decision_json IS NOT NULL",
      args: [JSON.stringify(authorizationSchema.parse(authorization)), runId],
    });
  }
  async journal(
    runId: string,
    kind: 'review' | 'final' | 'closure',
    patch: OwnedPatch,
    expected: Record<string, unknown>,
    expectedRevision?: string,
  ) {
    const revision = patch.reviewRevision ?? 1;
    const key = revision === 1 ? kind : `${kind}:${revision}`;
    await this.client.execute({
      sql: 'INSERT OR IGNORE INTO lead_output_operations(id,run_id,kind,patch_json,expected_json,expected_revision) VALUES(?,?,?,?,?,?)',
      args: [
        `${runId}:${key}`,
        runId,
        key,
        JSON.stringify(ownedPatchSchema.parse(patch)),
        JSON.stringify(expected),
        expectedRevision ?? null,
      ],
    });
    return (await this.operation(runId, kind, revision))!;
  }
  async operation(runId: string, kind: 'review' | 'final' | 'closure', revision = 1) {
    const key = revision === 1 ? kind : `${kind}:${revision}`;
    const row = (
      await this.client.execute({
        sql: 'SELECT * FROM lead_output_operations WHERE run_id=? AND kind=?',
        args: [runId, key],
      })
    ).rows[0];
    return row
      ? {
          id: z.string().parse(row.id),
          state: z.string().parse(row.state),
          patch: ownedPatchSchema.parse(json(row.patch_json)),
          expectedRevision: row.expected_revision === null ? undefined : z.string().parse(row.expected_revision),
          expected: json(row.expected_json) as Record<string, unknown>,
        }
      : null;
  }
  async operationState(id: string, state: 'uncertain' | 'applied' | 'conflict') {
    await this.client.execute({ sql: 'UPDATE lead_output_operations SET state=? WHERE id=?', args: [state, id] });
  }
  async history(runId: string) {
    const rows = (
      await this.client.execute({
        sql: 'SELECT * FROM lead_review_history WHERE run_id=? ORDER BY revision',
        args: [runId],
      })
    ).rows;
    return rows.map(row => ({
      revision: Number(row.revision),
      state: z.enum(businessStates).parse(row.state),
      packet: row.packet_json === null ? null : reviewPacketSchema.parse(json(row.packet_json)),
      decision: row.decision_json === null ? null : decisionSchema.parse(json(row.decision_json)),
      authorization: row.authorization_json === null ? null : authorizationSchema.parse(json(row.authorization_json)),
      publishedAt: row.published_at,
      expected: json(row.expected_json),
      expectedRevision: row.expected_revision,
      changedAt: row.changed_at,
    }));
  }
  async reopen(
    runId: string,
    previous: NonNullable<Awaited<ReturnType<ReviewStore['get']>>>,
    packet: ReviewPacket,
    expected: Record<string, unknown>,
    expectedRevision: string,
  ) {
    const where =
      "run_id=? AND active=0 AND state=? AND changed_at=? AND COALESCE(json_extract(packet_json,'$.id'),'')=?";
    const binding = [runId, previous.state, previous.changedAt, previous.packet?.id ?? ''];
    const results = await this.client.batch(
      [
        {
          sql: `INSERT OR IGNORE INTO lead_review_history SELECT run_id,?,state,packet_json,decision_json,authorization_json,published_at,expected_json,expected_revision,changed_at FROM lead_cycles WHERE ${where}`,
          args: [previous.revision, ...binding],
        },
        {
          sql: `UPDATE lead_cycles SET packet_json=?,decision_json=NULL,authorization_json=NULL,published_at=NULL,expected_json=?,expected_revision=?,state='publishing_review',active=1,attempts=0,next_retry_at=0,failure_code=NULL WHERE ${where}`,
          args: [
            JSON.stringify(reviewPacketSchema.parse(packet)),
            JSON.stringify(expected),
            expectedRevision,
            ...binding,
          ],
        },
      ],
      'write',
    );
    return results[1]!.rowsAffected === 1;
  }
  async pending(limit: number) {
    const rows = (
      await this.client.execute({
        sql: "SELECT run_id FROM lead_cycles WHERE active=1 AND state NOT IN ('researching','conflict','failed') AND next_retry_at<=? ORDER BY run_id LIMIT ?",
        args: [Date.now(), limit],
      })
    ).rows;
    return rows.map(row => z.string().parse(row.run_id));
  }
}

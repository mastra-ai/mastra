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
      CREATE TABLE IF NOT EXISTS lead_local_destinations (
        reference TEXT PRIMARY KEY, fields_json TEXT NOT NULL, marker TEXT
      );
    `);
  }
  async get(runId: string) {
    const row = (await this.client.execute({ sql: 'SELECT * FROM lead_cycles WHERE run_id=?', args: [runId] })).rows[0];
    if (!row) return null;
    return {
      runId,
      state: z.enum(businessStates).parse(row.state),
      active: Boolean(row.active),
      assessmentId: row.assessment_id === null ? null : z.string().parse(row.assessment_id),
      predecessorId: row.predecessor_id === null ? null : z.string().parse(row.predecessor_id),
      packet: row.packet_json === null ? null : reviewPacketSchema.parse(json(row.packet_json)),
      publishedAt: row.published_at === null ? null : z.string().parse(row.published_at),
      expected: json(row.expected_json) as Record<string, unknown> | null,
      decision: row.decision_json === null ? null : decisionSchema.parse(json(row.decision_json)),
      authorization: row.authorization_json === null ? null : authorizationSchema.parse(json(row.authorization_json)),
    };
  }
  async state(runId: string, state: BusinessState, terminal = false) {
    await this.client.execute({
      sql: 'UPDATE lead_cycles SET state=?,active=? WHERE run_id=?',
      args: [state, Number(!terminal), runId],
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
      sql: "UPDATE lead_cycles SET published_at=?,expected_json=?,state='awaiting_review' WHERE run_id=? AND state='publishing_review'",
      args: [new Date().toISOString(), JSON.stringify(expected), runId],
    });
  }
  async decide(runId: string, decision: Decision) {
    return (
      (
        await this.client.execute({
          sql: "UPDATE lead_cycles SET decision_json=? WHERE run_id=? AND active=1 AND state='awaiting_review' AND published_at IS NOT NULL AND decision_json IS NULL AND json_extract(packet_json,'$.digest')=? AND json_extract(packet_json,'$.expiresAt')>?",
          args: [JSON.stringify(decisionSchema.parse(decision)), runId, decision.input.digest, decision.decidedAt],
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
  async operation(
    runId: string,
    kind: 'review' | 'final' | 'closure',
    patch?: OwnedPatch,
    expected?: Record<string, unknown>,
  ) {
    if (patch && expected)
      await this.client.execute({
        sql: 'INSERT OR IGNORE INTO lead_output_operations(id,run_id,kind,patch_json,expected_json) VALUES(?,?,?,?,?)',
        args: [
          `${runId}:${kind}`,
          runId,
          kind,
          JSON.stringify(ownedPatchSchema.parse(patch)),
          JSON.stringify(expected),
        ],
      });
    const row = (
      await this.client.execute({
        sql: 'SELECT * FROM lead_output_operations WHERE run_id=? AND kind=?',
        args: [runId, kind],
      })
    ).rows[0];
    return row
      ? {
          id: z.string().parse(row.id),
          state: z.string().parse(row.state),
          patch: ownedPatchSchema.parse(json(row.patch_json)),
          expected: json(row.expected_json) as Record<string, unknown>,
        }
      : null;
  }
  async operationState(id: string, state: 'uncertain' | 'applied' | 'conflict') {
    await this.client.execute({ sql: 'UPDATE lead_output_operations SET state=? WHERE id=?', args: [state, id] });
  }
  async pending(limit: number) {
    const rows = (
      await this.client.execute({
        sql: "SELECT run_id FROM lead_cycles WHERE active=1 AND state NOT IN ('researching','conflict') ORDER BY run_id LIMIT ?",
        args: [limit],
      })
    ).rows;
    return rows.map(row => z.string().parse(row.run_id));
  }
}

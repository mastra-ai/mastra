import type { Client, InStatement } from '@libsql/client';
import { z } from 'zod';
import { actorSchema } from './client';
import { digestValue } from '../../review/contracts';
export class AttioDeliveryConflictError extends Error {}

export const deliveryIdSchema = z.string().regex(/^[a-zA-Z0-9._:-]{1,180}$/);
export const attioEventSchema = z.object({
  event_type: z.string().max(100),
  id: z.object({
    workspace_id: z.uuid(),
    list_id: z.uuid().optional(),
    entry_id: z.uuid().optional(),
    attribute_id: z.uuid().optional(),
  }),
  actor: actorSchema.optional(),
});
export const attioDeliverySchema = z.object({ events: z.array(attioEventSchema).min(1).max(100) });
export type AttioEvent = z.infer<typeof attioEventSchema>;
export class AttioStore {
  private admission: Promise<unknown> = Promise.resolve();
  constructor(private readonly client: Client) {}
  async init() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS lead_attio_deliveries (id TEXT PRIMARY KEY, digest TEXT NOT NULL, received_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS lead_attio_events (id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL, event_json TEXT NOT NULL,
        received_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER NOT NULL DEFAULT 0, failure_code TEXT, run_id TEXT);
      CREATE TABLE IF NOT EXISTS lead_sales_outcomes (event_id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL,
        cycle_id TEXT NOT NULL, outcome TEXT NOT NULL, occurred_at TEXT NOT NULL);
    `);
  }
  accept(id: string, payload: z.infer<typeof attioDeliverySchema>, receivedAt: string, maxPending: number) {
    const accepted = this.admission.then(() => this.acceptTransaction(id, payload, receivedAt, maxPending));
    this.admission = accepted.catch(() => undefined);
    return accepted;
  }
  private async acceptTransaction(
    id: string,
    payload: z.infer<typeof attioDeliverySchema>,
    receivedAt: string,
    maxPending: number,
  ) {
    const digest = digestValue(payload);
    const previous = (
      await this.client.execute({ sql: 'SELECT digest FROM lead_attio_deliveries WHERE id=?', args: [id] })
    ).rows[0];
    if (previous) {
      if (previous.digest !== digest) throw new AttioDeliveryConflictError('Delivery payload changed');
      return;
    }
    const pending = (await this.client.execute("SELECT count(*) AS total FROM lead_attio_events WHERE state='pending'"))
      .rows[0]!;
    if (Number(pending.total) + payload.events.length > maxPending) throw new Error('attio_inbox_full');
    const statements: InStatement[] = [
      { sql: 'INSERT INTO lead_attio_deliveries(id,digest,received_at) VALUES(?,?,?)', args: [id, digest, receivedAt] },
    ];
    payload.events.forEach((event, index) =>
      statements.push({
        sql: 'INSERT INTO lead_attio_events(id,delivery_id,event_json,received_at) VALUES(?,?,?,?)',
        args: [`${id}:${index}`, id, JSON.stringify(event), receivedAt],
      }),
    );
    await this.client.batch(statements, 'write');
  }
  async delivery(id: string) {
    const delivery = (
      await this.client.execute({ sql: 'SELECT id,received_at FROM lead_attio_deliveries WHERE id=?', args: [id] })
    ).rows[0];
    if (!delivery) return null;
    const events = (
      await this.client.execute({
        sql: 'SELECT id,state,attempts,next_retry_at,failure_code,run_id FROM lead_attio_events WHERE delivery_id=? ORDER BY id',
        args: [id],
      })
    ).rows;
    return {
      id: delivery.id,
      receivedAt: delivery.received_at,
      events: events.map(row => ({
        id: row.id,
        state: row.state,
        attempts: row.attempts,
        nextRetryAt: row.next_retry_at,
        failureCode: row.failure_code,
        runId: row.run_id,
      })),
    };
  }
  async pending(limit: number) {
    const rows = (
      await this.client.execute({
        sql: "SELECT * FROM lead_attio_events WHERE state='pending' AND next_retry_at<=? ORDER BY received_at,id LIMIT ?",
        args: [Date.now(), limit],
      })
    ).rows;
    return rows.map(row => ({
      id: z.string().parse(row.id),
      event: attioEventSchema.parse(JSON.parse(z.string().parse(row.event_json))),
      receivedAt: z.string().parse(row.received_at),
      attempts: Number(row.attempts),
    }));
  }
  async reserve(id: string) {
    await this.client.execute({ sql: 'UPDATE lead_attio_events SET attempts=attempts+1 WHERE id=?', args: [id] });
  }
  async finish(
    id: string,
    state: 'done' | 'ignored' | 'failed' | 'conflict',
    code: string | null = null,
    runId: string | null = null,
  ) {
    await this.client.execute({
      sql: 'UPDATE lead_attio_events SET state=?,failure_code=?,run_id=? WHERE id=?',
      args: [state, code, runId, id],
    });
  }
  async retry(id: string, delay: number, code: string) {
    await this.client.execute({
      sql: 'UPDATE lead_attio_events SET next_retry_at=?,failure_code=? WHERE id=?',
      args: [Date.now() + delay, code, id],
    });
  }
}

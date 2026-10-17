import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import type { Client, Row } from '@libsql/client';
import { z } from 'zod';
import { normalizedEventSchema } from '../contracts';
import type { NormalizedEvent } from '../contracts';

export type RunStatus = 'accepted' | 'dispatching' | 'intake_received' | 'failed';
export interface RunRecord {
  runId: string;
  event: NormalizedEvent;
  status: RunStatus;
  acceptedAt: string;
  updatedAt: string;
  failureCode: string | null;
}

export class AdmissionError extends Error {}
export class DeliveryConflictError extends Error {}

function project(row: Row): RunRecord {
  return {
    runId: z.string().parse(row.run_id),
    event: normalizedEventSchema.parse(JSON.parse(z.string().parse(row.event_json))),
    status: z.enum(['accepted', 'dispatching', 'intake_received', 'failed']).parse(row.status),
    acceptedAt: z.string().parse(row.accepted_at),
    updatedAt: z.string().parse(row.updated_at),
    failureCode: row.failure_code === null ? null : z.string().parse(row.failure_code),
  };
}

export class LeadEventStore {
  readonly client: Client;
  private admission: Promise<unknown> = Promise.resolve();
  constructor(url: string) {
    this.client = createClient({ url });
  }

  async init() {
    await this.client.execute('PRAGMA journal_mode=WAL');
    await this.client.execute('PRAGMA synchronous=FULL');
    await this.client.execute('PRAGMA busy_timeout=5000');
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS lead_runs (
        run_id TEXT PRIMARY KEY,
        event_json TEXT NOT NULL,
        destination_provider TEXT NOT NULL,
        destination_reference TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('accepted', 'dispatching', 'intake_received', 'failed')),
        accepted_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        failure_code TEXT,
        dispatch_attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS lead_active_destination ON lead_runs(destination_provider, destination_reference)
        WHERE status IN ('accepted', 'dispatching');
      CREATE TABLE IF NOT EXISTS lead_deliveries (
        source_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES lead_runs(run_id),
        payload_json TEXT NOT NULL,
        PRIMARY KEY (source_id, event_id)
      );
    `);
  }

  accept(event: NormalizedEvent, maxPendingRuns: number): Promise<RunRecord> {
    const accepted = this.admission.then(() => this.acceptTransaction(event, maxPendingRuns));
    this.admission = accepted.catch(() => undefined);
    return accepted;
  }

  private async acceptTransaction(event: NormalizedEvent, maxPendingRuns: number): Promise<RunRecord> {
    const tx = await this.client.transaction('write');
    try {
      const delivery = await tx.execute({
        sql: 'SELECT r.*, d.payload_json FROM lead_deliveries d JOIN lead_runs r USING (run_id) WHERE d.source_id=? AND d.event_id=?',
        args: [event.sourceId, event.eventId],
      });
      if (delivery.rows[0]) {
        // Receipt time belongs to the original delivery; a replay must preserve its semantic payload.
        const previous = normalizedEventSchema.parse(JSON.parse(z.string().parse(delivery.rows[0].payload_json)));
        if (JSON.stringify({ ...previous, receivedAt: '' }) !== JSON.stringify({ ...event, receivedAt: '' })) {
          throw new DeliveryConflictError('Event identity already belongs to a different payload');
        }
        await tx.commit();
        return project(delivery.rows[0]);
      }
      const active = await tx.execute({
        sql: "SELECT * FROM lead_runs WHERE destination_provider=? AND destination_reference=? AND status IN ('accepted','dispatching')",
        args: [event.destination.providerId, event.destination.reference],
      });
      let record: RunRecord;
      if (active.rows[0]) {
        throw new AdmissionError('Destination already has active work; retry after it completes');
      } else {
        const count = await tx.execute(
          "SELECT count(*) AS total FROM lead_runs WHERE status IN ('accepted','dispatching')",
        );
        if (Number(count.rows[0]!.total) >= maxPendingRuns) throw new AdmissionError('Pending work limit reached');
        const runId = randomUUID();
        await tx.execute({
          sql: 'INSERT INTO lead_runs (run_id,event_json,destination_provider,destination_reference,status,accepted_at,updated_at) VALUES (?,?,?,?,?,?,?)',
          args: [
            runId,
            JSON.stringify(event),
            event.destination.providerId,
            event.destination.reference,
            'accepted',
            event.receivedAt,
            event.receivedAt,
          ],
        });
        record = {
          runId,
          event,
          status: 'accepted',
          acceptedAt: event.receivedAt,
          updatedAt: event.receivedAt,
          failureCode: null,
        };
      }
      await tx.execute({
        sql: 'INSERT INTO lead_deliveries (source_id,event_id,run_id,payload_json) VALUES (?,?,?,?)',
        args: [event.sourceId, event.eventId, record.runId, JSON.stringify(event)],
      });
      await tx.commit();
      return record;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  }

  async get(runId: string) {
    const result = await this.client.execute({ sql: 'SELECT * FROM lead_runs WHERE run_id=?', args: [runId] });
    return result.rows[0] ? project(result.rows[0]) : null;
  }

  async pending(limit: number) {
    const result = await this.client.execute({
      sql: "SELECT * FROM lead_runs WHERE status IN ('accepted','dispatching') ORDER BY accepted_at, run_id LIMIT ?",
      args: [limit],
    });
    return result.rows.map(project);
  }

  async markDispatching(runId: string) {
    await this.client.execute({
      sql: "UPDATE lead_runs SET status='dispatching', updated_at=?, dispatch_attempts=dispatch_attempts+1 WHERE run_id=? AND status IN ('accepted','dispatching')",
      args: [new Date().toISOString(), runId],
    });
  }

  async complete(runId: string) {
    await this.client.execute({
      sql: "UPDATE lead_runs SET status='intake_received', updated_at=?, failure_code=NULL WHERE run_id=? AND status IN ('accepted','dispatching')",
      args: [new Date().toISOString(), runId],
    });
  }

  async fail(runId: string, code: 'workflow_failed') {
    await this.client.execute({
      sql: "UPDATE lead_runs SET status='failed', updated_at=?, failure_code=? WHERE run_id=? AND status IN ('accepted','dispatching')",
      args: [new Date().toISOString(), code, runId],
    });
  }

  close() {
    this.client.close();
  }
}

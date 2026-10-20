import { z } from 'zod';
import type { QualificationConfig } from './config/qualification';
import type { LeadStorage } from './persistence/storage';
import type { OutputProvider } from './providers/output';
import { projectedPatch } from './providers/output';
import { attioRetentionDigest } from './providers/attio/presentation';
import { digestValue, ownedPatchSchema } from './review/contracts';

const day = 86_400_000;
// The installed public compatibility wrapper does not expose its delegate's static descriptors.
// Preview the native event tables explicitly; native prune remains the only deletion API.
const observabilityTables = {
  spans: 'span_events',
  metrics: 'metric_events',
  logs: 'log_events',
  scores: 'score_events',
  feedback: 'feedback_events',
} as const;
const requestSchema = z.strictObject({
  now: z.iso.datetime({ offset: true }),
  limit: z.number().int().min(1).max(1000).default(100),
});
export const maintenancePreviewSchema = z.strictObject({
  version: z.literal(1),
  request: requestSchema,
  policy: z.strictObject({
    assessmentDays: z.number().int().positive(),
    traceDays: z.number().int().positive(),
    deliveryMarkerDays: z.number().int().positive(),
  }),
  operational: z.array(z.uuid()).max(1000),
  nativeSnapshots: z.array(z.uuid()).max(2000),
  salesOutcomes: z.array(z.string().min(1).max(180)).max(1000),
  inbox: z.array(z.string()).max(1000),
  inboxDeliveries: z.array(z.string()).max(1000),
  expiredCycles: z.array(z.uuid()).max(1000),
  protectedOwnershipMarkers: z.number().int().nonnegative(),
  markers: z.array(z.strictObject({ sourceId: z.string(), eventId: z.string() })).max(1000),
  observability: z.array(z.strictObject({ key: z.string(), table: z.string(), count: z.number().int().nonnegative() })),
  protectedRuns: z.number().int().nonnegative(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type MaintenancePreview = z.infer<typeof maintenancePreviewSchema>;

/** Operator-only, offline maintenance. Preview is content-free and apply rechecks all eligibility. */
export class LeadMaintenance {
  constructor(
    private readonly storage: LeadStorage,
    private readonly outputs: ReadonlyMap<string, OutputProvider>,
    private readonly retention: QualificationConfig['retention'],
  ) {}
  async preview(input: z.input<typeof requestSchema>): Promise<MaintenancePreview> {
    const request = requestSchema.parse(input);
    const cutoff = new Date(Date.parse(request.now) - this.retention.assessmentDays * day).toISOString();
    const client = this.storage.leadEvents.client;
    const rows = await client.execute({
      sql: `SELECT r.run_id FROM lead_runs r JOIN lead_cycles c USING(run_id)
        WHERE r.status IN ('intake_received','failed') AND c.active=0 AND c.state IN ('applied','rejected','changes_requested','expired')
        AND max(r.updated_at,c.changed_at,COALESCE((SELECT json_extract(q.assessment_json,'$.completedAt') FROM lead_qualifications q WHERE q.run_id=r.run_id),r.updated_at))<? AND NOT EXISTS(SELECT 1 FROM lead_output_operations o WHERE o.run_id=r.run_id AND o.state!='applied')
        AND NOT EXISTS(SELECT 1 FROM lead_cycles descendant WHERE descendant.destination_provider=c.destination_provider AND descendant.destination_reference=c.destination_reference AND descendant.active=1)
        AND NOT EXISTS(SELECT 1 FROM lead_retention_markers m WHERE m.run_id=r.run_id)
        ORDER BY r.run_id LIMIT ?`,
      args: [cutoff, request.limit],
    });
    const operational = rows.rows.map(row => z.string().parse(row.run_id));
    const pending = (
      await client.execute({
        sql: 'SELECT run_id FROM lead_retention_markers WHERE native_pending=1 ORDER BY run_id LIMIT ?',
        args: [request.limit],
      })
    ).rows.map(row => z.string().parse(row.run_id));
    const hasInbox =
      (await client.execute("SELECT name FROM sqlite_master WHERE name='lead_attio_events'")).rows.length > 0;
    const inbox = hasInbox
      ? (
          await client.execute({
            sql: `SELECT id FROM lead_attio_events e WHERE received_at<? AND state IN ('done','ignored') AND (run_id IS NULL OR EXISTS(SELECT 1 FROM lead_retention_markers m WHERE m.run_id=e.run_id) OR run_id IN (${operational.map(() => '?').join(',') || 'NULL'})) ORDER BY id LIMIT ?`,
            args: [cutoff, ...operational, request.limit],
          })
        ).rows.map(row => z.string().parse(row.id))
      : [];
    const markers = (
      await client.execute({
        sql: 'SELECT source_id,event_id FROM lead_delivery_markers WHERE expires_at<? ORDER BY source_id,event_id LIMIT ?',
        args: [request.now, request.limit],
      })
    ).rows.map(row => ({ sourceId: z.string().parse(row.source_id), eventId: z.string().parse(row.event_id) }));
    const markerCutoff = new Date(Date.parse(request.now) - this.retention.deliveryMarkerDays * day).toISOString();
    const expiredCycles = (
      await client.execute({
        sql: `SELECT m.run_id FROM lead_retention_markers m JOIN lead_cycles c USING(run_id) WHERE m.completed_at<? AND m.native_pending=0 AND c.active=0
      AND EXISTS(SELECT 1 FROM lead_cycles newer WHERE newer.destination_provider=c.destination_provider AND newer.destination_reference=c.destination_reference AND newer.rowid>c.rowid)
      AND NOT EXISTS(SELECT 1 FROM lead_cycles active WHERE active.destination_provider=c.destination_provider AND active.destination_reference=c.destination_reference AND active.active=1)
      ORDER BY m.run_id LIMIT ?`,
        args: [markerCutoff, request.limit],
      })
    ).rows.map(row => z.string().parse(row.run_id));
    const protectedOwnershipMarkers = Number(
      (
        await client.execute(
          `SELECT count(*) AS count FROM lead_retention_markers m JOIN lead_cycles c USING(run_id) WHERE NOT EXISTS(SELECT 1 FROM lead_cycles newer WHERE newer.destination_provider=c.destination_provider AND newer.destination_reference=c.destination_reference AND newer.rowid>c.rowid) OR EXISTS(SELECT 1 FROM lead_cycles active WHERE active.destination_provider=c.destination_provider AND active.destination_reference=c.destination_reference AND active.active=1)`,
        )
      ).rows[0]!.count,
    );
    const inboxDeliveries = hasInbox
      ? (
          await client.execute({
            sql: `SELECT id FROM lead_attio_deliveries d WHERE received_at<? AND NOT EXISTS(SELECT 1 FROM lead_attio_events e WHERE e.delivery_id=d.id AND e.state NOT IN ('done','ignored')) ORDER BY id LIMIT ?`,
            args: [markerCutoff, request.limit],
          })
        ).rows.map(row => z.string().parse(row.id))
      : [];
    const hasSales =
      (await client.execute("SELECT name FROM sqlite_master WHERE name='lead_sales_outcomes'")).rows.length > 0;
    const salesOutcomes = hasSales
      ? (
          await client.execute({
            sql: `SELECT s.event_id FROM lead_sales_outcomes s JOIN lead_sales_receipts receipt USING(event_id)
      WHERE julianday(s.occurred_at)<julianday(?) AND julianday(receipt.received_at)<julianday(?)
      AND NOT EXISTS(SELECT 1 FROM lead_cycles c WHERE c.run_id=s.cycle_id AND (c.active=1 OR c.state IN ('conflict','failed') OR EXISTS(SELECT 1 FROM lead_output_operations o WHERE o.run_id=c.run_id AND o.state!='applied')))
      ORDER BY s.event_id LIMIT ?`,
            args: [cutoff, cutoff, request.limit],
          })
        ).rows.map(row => z.string().parse(row.event_id))
      : [];
    const observability = [];
    for (const [key, table] of Object.entries(observabilityTables)) {
      const result = await this.storage.telemetryStore.db.query<{ count: bigint }>(
        `SELECT count(*) AS count FROM "${table}" WHERE timestamp<?`,
        [new Date(Date.parse(request.now) - this.retention.traceDays * day)],
      );
      observability.push({ key, table, count: Number(result[0]?.count ?? 0) });
    }
    const protectedRuns = Number(
      (
        await client.execute(
          "SELECT count(*) AS count FROM lead_cycles WHERE active=1 OR state IN ('conflict','failed')",
        )
      ).rows[0]!.count,
    );
    const preview = {
      version: 1 as const,
      request,
      policy: this.retention,
      operational,
      nativeSnapshots: [...new Set([...operational, ...pending])].slice(0, 2000),
      salesOutcomes,
      inbox,
      inboxDeliveries,
      expiredCycles,
      protectedOwnershipMarkers,
      markers,
      observability,
      protectedRuns,
    };
    return maintenancePreviewSchema.parse({ ...preview, digest: digestValue(preview) });
  }
  async apply(input: MaintenancePreview) {
    const preview = maintenancePreviewSchema.parse(input);
    const { digest, ...body } = preview;
    if (digestValue(body) !== digest || digestValue(preview.policy) !== digestValue(this.retention))
      throw new Error('maintenance_preview_changed');
    const fresh = await this.preview(preview.request);
    if (fresh.digest !== preview.digest) throw new Error('maintenance_scope_changed_preview_again');
    const client = this.storage.leadEvents.client;
    const cutoff = new Date(Date.parse(preview.request.now) - this.retention.assessmentDays * day).toISOString();
    const progress: {
      operational: string[];
      nativeSnapshots: string[];
      observability: unknown;
      salesOutcomes: number;
      inbox: number;
      markers: number;
      expiredCycles: string[];
      inboxDeliveries: number;
      failures: string[];
    } = {
      operational: [],
      nativeSnapshots: [],
      observability: null,
      salesOutcomes: 0,
      inbox: 0,
      markers: 0,
      expiredCycles: [],
      inboxDeliveries: 0,
      failures: [],
    };
    for (const runId of preview.operational) {
      // Recheck immediately before the short transaction. Maintenance runs with intake stopped.
      const current = await this.preview(preview.request);
      if (!current.operational.includes(runId)) throw new Error('maintenance_run_became_protected');
      const run = await this.storage.leadEvents.get(runId);
      const cycle = await this.storage.leadEvents.reviews.get(runId);
      if (!run || !cycle) throw new Error('maintenance_missing_cycle');
      const provider = this.outputs.get(run.event.destination.providerId);
      const operation = await this.storage.leadEvents.reviews.operation(
        runId,
        cycle.state === 'applied' ? 'final' : 'closure',
        cycle.revision,
      );
      if (!provider || !operation || operation.state !== 'applied') throw new Error('maintenance_output_not_settled');
      const fields = projectedPatch(
        provider,
        ownedPatchSchema.parse(operation.patch),
        operation.id,
        operation.expected,
      );
      const binding =
        provider.id === 'attio' ? attioRetentionDigest(fields, provider.reviewFields ?? []) : digestValue(fields);
      const qualification = await this.storage.leadEvents.qualifications.get(runId);
      const deliveries = (
        await client.execute({
          sql: 'SELECT source_id,event_id,payload_json FROM lead_deliveries WHERE run_id=?',
          args: [runId],
        })
      ).rows;
      const minimalEvent = {
        version: 1,
        type: 'lead.received',
        eventId: run.event.eventId,
        sourceId: run.event.sourceId,
        receivedAt: run.event.receivedAt,
        lead: {
          reference: run.event.destination.reference,
          crm: { providerId: 'retained', recordId: run.event.destination.reference },
        },
        destination: run.event.destination,
      };
      await client.batch(
        [
          {
            sql: 'INSERT INTO lead_retention_markers(run_id,assessment_id,completed_at,pruned_at,operation_id,projection_digest,binding_digest) VALUES(?,?,?,?,?,?,?)',
            args: [
              runId,
              cycle.assessmentId,
              qualification?.assessment?.completedAt ?? run.updatedAt,
              preview.request.now,
              operation.id,
              digestValue(fields),
              binding,
            ],
          },
          ...deliveries.map(row => ({
            sql: 'INSERT OR IGNORE INTO lead_delivery_markers VALUES(?,?,?,?,?)',
            args: [
              z.string().parse(row.source_id),
              z.string().parse(row.event_id),
              runId,
              digestValue({ ...JSON.parse(z.string().parse(row.payload_json)), receivedAt: '' }),
              new Date(Date.parse(run.acceptedAt) + this.retention.deliveryMarkerDays * day).toISOString(),
            ],
          })),
          ...[
            'lead_research_rounds',
            'lead_research_reservations',
            'lead_qualifications',
            'lead_review_history',
            'lead_output_operations',
            'lead_deliveries',
          ].map(table => ({ sql: `DELETE FROM ${table} WHERE run_id=?`, args: [runId] })),
          {
            sql: 'UPDATE lead_cycles SET packet_json=NULL,expected_json=NULL,decision_json=NULL,authorization_json=NULL,expected_revision=NULL,failure_code=NULL WHERE run_id=?',
            args: [runId],
          },
          {
            sql: 'UPDATE lead_runs SET event_json=?,failure_code=NULL WHERE run_id=?',
            args: [JSON.stringify(minimalEvent), runId],
          },
          {
            sql: "DELETE FROM lead_local_destinations WHERE reference=? AND marker=? AND NOT EXISTS(SELECT 1 FROM lead_cycles c WHERE c.destination_provider='local' AND c.destination_reference=? AND c.active=1)",
            args: [run.event.destination.reference, operation.id, run.event.destination.reference],
          },
        ],
        'write',
      );
      progress.operational.push(runId);
    }
    // Native snapshots and DuckDB prune are independently retryable after operational detail expiry.
    for (const runId of preview.nativeSnapshots) {
      try {
        const workflows = await this.storage.getStore('workflows');
        await workflows?.deleteWorkflowRunById({ runId, workflowName: 'lead-intake' });
        await client.execute({
          sql: 'UPDATE lead_retention_markers SET native_pending=0 WHERE run_id=?',
          args: [runId],
        });
        progress.nativeSnapshots.push(runId);
      } catch {
        progress.failures.push('native_snapshot_unavailable');
      }
    }
    for (const id of preview.salesOutcomes) {
      const deleted = await client.batch(
        [
          {
            sql: `DELETE FROM lead_sales_outcomes WHERE event_id=?
      AND julianday(occurred_at)<julianday(?) AND EXISTS(SELECT 1 FROM lead_sales_receipts receipt WHERE receipt.event_id=lead_sales_outcomes.event_id AND julianday(receipt.received_at)<julianday(?))
      AND NOT EXISTS(SELECT 1 FROM lead_cycles c WHERE c.run_id=lead_sales_outcomes.cycle_id AND (c.active=1 OR c.state IN ('conflict','failed') OR EXISTS(SELECT 1 FROM lead_output_operations o WHERE o.run_id=c.run_id AND o.state!='applied')))`,
            args: [id, cutoff, cutoff],
          },
          {
            sql: 'DELETE FROM lead_sales_receipts WHERE event_id=? AND NOT EXISTS(SELECT 1 FROM lead_sales_outcomes WHERE event_id=?)',
            args: [id, id],
          },
        ],
        'write',
      );
      progress.salesOutcomes += deleted[0]!.rowsAffected;
    }
    for (const id of preview.inbox) {
      const result = await client.execute({
        sql: "DELETE FROM lead_attio_events WHERE id=? AND state IN ('done','ignored')",
        args: [id],
      });
      progress.inbox += result.rowsAffected;
    }
    for (const marker of preview.markers) {
      progress.markers += (
        await client.execute({
          sql: 'DELETE FROM lead_delivery_markers WHERE source_id=? AND event_id=? AND expires_at<?',
          args: [marker.sourceId, marker.eventId, preview.request.now],
        })
      ).rowsAffected;
    }
    for (const id of preview.inboxDeliveries)
      progress.inboxDeliveries += (
        await client.execute({
          sql: 'DELETE FROM lead_attio_deliveries WHERE id=? AND NOT EXISTS(SELECT 1 FROM lead_attio_events WHERE delivery_id=?)',
          args: [id, id],
        })
      ).rowsAffected;
    for (const runId of preview.expiredCycles) {
      await client.batch(
        [
          { sql: 'DELETE FROM lead_cycles WHERE run_id=? AND active=0', args: [runId] },
          { sql: 'DELETE FROM lead_runs WHERE run_id=?', args: [runId] },
          { sql: 'DELETE FROM lead_retention_markers WHERE run_id=? AND native_pending=0', args: [runId] },
        ],
        'write',
      );
      progress.expiredCycles.push(runId);
    }
    try {
      // Native prune takes age relative to its own current clock. Pin the approved cutoff.
      const age = 1000 + Date.now() - (Date.parse(preview.request.now) - this.retention.traceDays * day);
      const policies = Object.fromEntries(
        preview.observability.map(item => [item.key, { maxAge: age, batchSize: 100 }]),
      );
      const result = await this.storage.telemetryStore.observability.prune(policies, {
        maxBatches: 1,
        maxRows: preview.request.limit,
      });
      progress.observability = result;
      if (!preview.observability.every(item => result.some(table => table.table === item.table)))
        throw new Error('native_retention_scope_unavailable');
    } catch {
      progress.failures.push('observability_prune_unavailable');
    }
    return progress;
  }
}

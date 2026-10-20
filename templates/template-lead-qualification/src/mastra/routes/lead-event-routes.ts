import { qualificationReport, reportWindowSchema } from '../reporting';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRouteHandler } from '@mastra/core/server';
import { z, ZodError } from 'zod';

import type { IntakeConfig } from '../config/lead-ingestion';
import { runReferenceSchema } from '../contracts';
import type { LeadIntake } from '../intake';
import type { OutputProvider } from '../providers/output';
import { destinationFields, projectedPatch } from '../providers/output';
import { AdmissionError, DeliveryConflictError } from '../persistence/lead-event-store';
import type { LeadEventStore } from '../persistence/lead-event-store';
import type { EventInputProvider } from '../providers/input';
import type { Telemetry } from '../telemetry';
import { ReviewConflictError } from '../review/service';
import type { ReviewService } from '../review/service';
import { decisionInputSchema, digestValue } from '../review/contracts';

const outputFormatSchema = z.enum(['text', 'markdown']).default('markdown');

export class BodyTooLargeError extends Error {}
export async function readRawBody(request: Request, maxBytes: number) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new BodyTooLargeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

async function readBody(request: Request, maxBytes: number) {
  return JSON.parse((await readRawBody(request, maxBytes)).toString('utf8')) as unknown;
}

export function createLeadRoutes(
  store: LeadEventStore,
  config: IntakeConfig,
  telemetry: Telemetry,
  reviews: ReviewService,
  provider: EventInputProvider,
  admission: LeadIntake,
  outputs: ReadonlyMap<string, OutputProvider>,
  salesMapped = false,
) {
  return [
    registerApiRoute('/lead-qualification/report', {
      method: 'GET',
      requiresAuth: true,
      handler: async c => {
        const window = reportWindowSchema.safeParse({
          from: c.req.query('from'),
          to: c.req.query('to'),
          limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        });
        if (!window.success) return c.json({ error: 'invalid_report_window' }, 400);
        try {
          return c.json(await qualificationReport(store.client, window.data, salesMapped));
        } catch {
          return c.json({ error: 'report_unavailable' }, 503);
        }
      },
    }),
    registerApiRoute('/lead-qualification/reviews', {
      method: 'POST',
      requiresAuth: true,
      handler: async c => {
        if (c.req.header('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
          return c.json({ error: 'unsupported_content_type' }, 415);
        try {
          const input = decisionInputSchema.parse(await readBody(c.req.raw, config.limits.maxBodyBytes));
          return c.json(await reviews.decide(input));
        } catch (error) {
          if (error instanceof BodyTooLargeError) return c.json({ error: 'body_too_large' }, 413);
          if (error instanceof ZodError || error instanceof SyntaxError)
            return c.json({ error: 'invalid_decision' }, 400);
          if (error instanceof ReviewConflictError) return c.json({ error: 'review_conflict' }, 409);
          return c.json({ error: 'persistence_unavailable' }, 503);
        }
      },
    }),
    ...(provider.transport === 'custom'
      ? []
      : [
          registerApiRoute('/lead-qualification/events', {
            method: 'POST',
            requiresAuth: true,
            createHandler: async () => {
              const handler: ApiRouteHandler = async c => {
                if (c.req.header('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
                  return c.json({ error: 'unsupported_content_type' }, 415);
                }
                try {
                  const payload = await readBody(c.req.raw, config.limits.maxBodyBytes);
                  const runId = await admission.receive(provider, payload);
                  if (!runId) return c.json({ error: 'invalid_event' }, 400);
                  await telemetry.diagnostic({ code: 'intake.accepted', runId });
                  return c.json({ runId, statusUrl: `/lead-qualification/runs/${runId}` }, 202);
                } catch (error) {
                  await telemetry.diagnostic({ code: 'intake.rejected' });
                  if (error instanceof BodyTooLargeError) return c.json({ error: 'body_too_large' }, 413);
                  if (
                    error instanceof ZodError ||
                    error instanceof SyntaxError ||
                    error instanceof DeliveryConflictError
                  ) {
                    return c.json({ error: 'invalid_event' }, 400);
                  }
                  if (error instanceof AdmissionError) {
                    c.header('Retry-After', '1');
                    return c.json({ error: 'admission_limit' }, 429);
                  }
                  return c.json({ error: 'persistence_unavailable' }, 503);
                }
              };
              return handler;
            },
          }),
        ]),
    registerApiRoute('/lead-qualification/runs/:runId/output', {
      method: 'GET',
      requiresAuth: true,
      handler: async c => {
        const id = runReferenceSchema.safeParse({ runId: c.req.param('runId') });
        if (!id.success) return c.json({ error: 'invalid_run_reference' }, 400);
        const format = outputFormatSchema.safeParse(c.req.query('format'));
        if (!format.success) return c.json({ error: 'invalid_output_format' }, 400);
        try {
          const run = await store.get(id.data.runId);
          if (!run) return c.json({ error: 'run_not_found' }, 404);
          const provider = outputs.get(run.event.destination.providerId)!;
          const cycle = await store.reviews.get(run.runId);
          const kind = cycle?.state === 'awaiting_review' ? 'review' : cycle?.state === 'applied' ? 'final' : 'closure';
          const operation = cycle && (await store.reviews.operation(run.runId, kind, cycle.revision));
          if (!operation || operation.state !== 'applied') return c.json({ error: 'readable_output_unavailable' }, 404);
          const state = await provider.read(run.event.destination);
          if (
            state &&
            (state.marker !== operation.id ||
              digestValue(destinationFields(provider, state.fields)) !==
                digestValue(projectedPatch(provider, operation.patch, operation.id, operation.expected)))
          )
            return c.json({ error: 'output_changed' }, 409);
          if (!state?.content) return c.json({ error: 'readable_output_unavailable' }, 404);
          c.header(
            'Content-Type',
            format.data === 'text' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
          );
          return c.body(state.content[format.data]);
        } catch {
          return c.json({ error: 'output_unavailable' }, 503);
        }
      },
    }),
    registerApiRoute('/lead-qualification/runs/:runId', {
      method: 'GET',
      requiresAuth: true,
      handler: async c => {
        const id = runReferenceSchema.safeParse({ runId: c.req.param('runId') });
        if (!id.success) return c.json({ error: 'invalid_run_reference' }, 400);
        try {
          const run = await store.get(id.data.runId);
          if (!run) return c.json({ error: 'run_not_found' }, 404);
          const qualification = await store.qualifications.get(run.runId);
          const expiry = (
            await store.client.execute({
              sql: 'SELECT assessment_id,pruned_at FROM lead_retention_markers WHERE run_id=?',
              args: [run.runId],
            })
          ).rows[0];
          return c.json({
            runId: run.runId,
            status: run.status,
            sourceId: run.event.sourceId,
            destination: run.event.destination,
            acceptedAt: run.acceptedAt,
            updatedAt: run.updatedAt,
            failureCode: run.failureCode,
            telemetryDegraded: telemetry.isDegraded(),
            retention: expiry
              ? { detailsExpired: true, assessmentId: expiry.assessment_id, prunedAt: expiry.pruned_at }
              : null,
            business: await reviews.read(run.runId),
            qualification: qualification
              ? {
                  snapshotDigest: qualification.snapshot.digest,
                  budget: qualification.budget,
                  status: qualification.assessment?.processingStatus ?? 'pending',
                  assessment: qualification.assessment,
                }
              : null,
          });
        } catch {
          return c.json({ error: 'persistence_unavailable' }, 503);
        }
      },
    }),
  ];
}

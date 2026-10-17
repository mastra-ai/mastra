import { registerApiRoute } from '@mastra/core/server';
import type { ApiRouteHandler } from '@mastra/core/server';
import { ZodError } from 'zod';
import type { IntakeConfig } from '../config/intake';
import { runReferenceSchema } from '../contracts';
import { AdmissionError, DeliveryConflictError } from '../persistence/intake';
import type { IntakeStore } from '../persistence/intake';
import { inputProviders } from '../providers/input';
import type { Telemetry } from '../telemetry';

class BodyTooLargeError extends Error {}
async function readBody(request: Request, maxBytes: number) {
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
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export function intakeRoutes(
  store: IntakeStore,
  config: IntakeConfig,
  telemetry: Telemetry,
  onServerReady: () => void,
) {
  const provider = inputProviders.get(config.source.inputProviderId);
  if (!provider) throw new Error('Configured input provider is unavailable');
  return [
    registerApiRoute('/lead-qualification/events', {
      method: 'POST',
      requiresAuth: true,
      createHandler: async () => {
        onServerReady();
        const handler: ApiRouteHandler = async c => {
          if (c.req.header('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
            return c.json({ error: 'unsupported_content_type' }, 415);
          }
          try {
            const payload = await readBody(c.req.raw, config.limits.maxBodyBytes);
            const event = provider.normalize(payload, config.source, new Date().toISOString());
            if (event.lead.crm && !config.source.crmProviderIds.includes(event.lead.crm.providerId)) {
              return c.json({ error: 'unconfigured_crm_reference' }, 400);
            }
            const run = await store.accept(event, config.limits.maxPendingRuns);
            await telemetry.diagnostic({ code: 'intake.accepted', runId: run.runId });
            return c.json({ runId: run.runId, statusUrl: `/lead-qualification/runs/${run.runId}` }, 202);
          } catch (error) {
            await telemetry.diagnostic({ code: 'intake.rejected' });
            if (error instanceof BodyTooLargeError) return c.json({ error: 'body_too_large' }, 413);
            if (error instanceof ZodError || error instanceof SyntaxError || error instanceof DeliveryConflictError) {
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
    registerApiRoute('/lead-qualification/runs/:runId', {
      method: 'GET',
      requiresAuth: true,
      handler: async c => {
        const id = runReferenceSchema.safeParse({ runId: c.req.param('runId') });
        if (!id.success) return c.json({ error: 'invalid_run_reference' }, 400);
        try {
          const run = await store.get(id.data.runId);
          if (!run) return c.json({ error: 'run_not_found' }, 404);
          return c.json({
            runId: run.runId,
            status: run.status,
            sourceId: run.event.sourceId,
            destination: run.event.destination,
            acceptedAt: run.acceptedAt,
            updatedAt: run.updatedAt,
            failureCode: run.failureCode,
            telemetryDegraded: telemetry.isDegraded(),
          });
        } catch {
          return c.json({ error: 'persistence_unavailable' }, 503);
        }
      },
    }),
  ];
}

import type { Mastra } from '@mastra/core';
import type { Event } from '@mastra/core/events';
import { z } from 'zod/v4';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// Wire shape of an Event delivered through the pubsub. We validate the
// fields `WorkflowEventProcessor` depends on and pass anything else through
// unchanged via passthrough() — broker envelopes routinely carry extra
// metadata that isn't part of `Event` itself.
const workerEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.unknown(),
  runId: z.string(),
  createdAt: z.union([z.string(), z.date()]).transform(v => (v instanceof Date ? v : new Date(v))),
  index: z.number().optional(),
  deliveryAttempt: z.number().optional(),
});

const receiveWorkerEventBodySchema = z.object({
  event: workerEventSchema.passthrough(),
});

interface ReceiveWorkerEventHandlerArgs {
  mastra: Mastra;
  event: Event;
}

const receiveWorkerEventResponseSchema = z.object({
  ok: z.boolean(),
  retry: z.boolean().optional(),
});

/**
 * Generic push receive endpoint for workflow events. A push-mode broker
 * (GCP Pub/Sub push subscription, SNS, EventBridge) — or a per-broker
 * adapter that decodes the broker's envelope first — POSTs each event here
 * and the response code tells the broker whether to retry:
 *
 *   - 200/204 → ack
 *   - 5xx     → transient, retry with backoff
 *   - 4xx     → poison, drop / send to DLQ
 *
 * Auth is enforced through the framework's standard `requiresAuth` flow.
 * Operators MUST configure an `authenticateToken` provider that recognizes
 * whatever credential the broker attaches (e.g. a Google-signed OIDC token
 * for GCP Pub/Sub push). Without an auth provider the endpoint is
 * effectively public — the same caveat that applies to
 * `EXECUTE_WORKFLOW_STEP_ROUTE`.
 */
export const RECEIVE_WORKER_EVENT_ROUTE = createRoute({
  method: 'POST',
  path: '/workers/events',
  responseType: 'json',
  bodySchema: receiveWorkerEventBodySchema,
  responseSchema: receiveWorkerEventResponseSchema,
  summary: 'Receive a workflow event from a push-mode broker',
  description:
    'Push-mode entry point for workflow events. Brokers (GCP Pub/Sub push, SNS, EventBridge) POST each event here; Mastra processes it through the same pipeline as pull-mode workers.',
  tags: ['Workers'],
  requiresAuth: true,
  handler: (async ({ mastra, event }: ReceiveWorkerEventHandlerArgs) => {
    try {
      return await mastra.handleWorkflowEvent(event);
    } catch (error) {
      return handleError(error, 'Error receiving worker event');
    }
  }) as any,
});

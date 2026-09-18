import { bodyLimit } from 'hono/body-limit';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { ZodError } from 'zod';

import { createIncidentFromAlertResult, type OperationDependencies } from '../../db/incident-operations.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { persistStandaloneDeadLetter } from '../../db/webhook-operations.js';
import { DomainError } from '../../domain/errors.js';
import type { ServerConfig, IntegrationConfig } from '../../env.js';
import { persistWorkosSnapshotBeforeIncident, reserveWorkosObservedState } from '../../db/workos-webhook-operations.js';
import { errorResponse } from '../../http-errors.js';
import type { AppEnv } from '../../http-context.js';
import type { StructuredLogger } from '../../logging.js';
import type { Clock } from '../../domain/clock.js';
import { startWorkflowBoundary } from '../../mastra/observability.js';
import { normalizeAlertWebhook, normalizeWorkOsReal } from './normalizers.js';
import { SignatureError, verifyWebhookSignature, WORKOS_WEBHOOK_TOLERANCE_MS } from './signature.js';
import {
  FixedWindowWebhookRateLimiter,
  webhookRateLimitMiddleware,
  type WebhookClientKeyResolver,
  type WebhookRateLimiter,
} from '../../webhook-rate-limit.js';

type WebhookRouteDependencies = Readonly<{
  config: ServerConfig;
  integrationConfig?: IntegrationConfig;
  store: OperationalStore;
  logger: StructuredLogger;
  nowMs?: () => number;
  /** Optional deterministic clock for tests; production omits it. */
  clock?: Clock;
  rateLimiter?: WebhookRateLimiter;
  resolveClient?: WebhookClientKeyResolver;
}>;

class PayloadDecodeError extends Error {}

export function registerWebhookRoutes(app: Hono<AppEnv>, dependencies: WebhookRouteDependencies): void {
  if (!dependencies.config.webhooksEnabled) return;
  const mediaType = requireJsonContentType(dependencies.logger);
  const limit = bodyLimit({
    maxSize: dependencies.config.webhookMaxBodyBytes,
    onError: context => errorResponse(context as never, 'PAYLOAD_TOO_LARGE', 413, false, dependencies.logger),
  });
  const limiter =
    dependencies.rateLimiter ??
    new FixedWindowWebhookRateLimiter({
      maxRequests: 120,
      windowMs: 60_000,
      maxBuckets: 1_024,
      cleanupBatchSize: 64,
      nowMs: dependencies.nowMs ?? Date.now,
    });
  const rateLimit = (route: string) =>
    webhookRateLimitMiddleware({
      limiter,
      route,
      logger: dependencies.logger,
      ...(dependencies.resolveClient ? { resolveClient: dependencies.resolveClient } : {}),
    });
  app.use('/webhooks/alerts', rateLimit('alerts'));
  app.post('/webhooks/alerts', mediaType, limit, async context => {
    return handleWebhook(context, dependencies, {
      signatureHeader: 'X-Alert-Signature',
      secret: dependencies.config.alertWebhookSecret!,
      eventType: 'security.alert.webhook',
      normalize: (value, bytes) => normalizeAlertWebhook(value, bytes, dependencies.config.alertWebhookSources),
    });
  });
  const integrations = dependencies.integrationConfig;
  if (integrations?.workos.enabled) {
    app.use('/webhooks/workos', rateLimit('workos'));
    app.post('/webhooks/workos', mediaType, limit, async context => {
      return handleWebhook(context, dependencies, {
        signatureHeader: 'WorkOS-Signature',
        secrets: [
          integrations.workos.webhookSecret!,
          ...(integrations.workos.previousWebhookSecret ? [integrations.workos.previousWebhookSecret] : []),
        ],
        toleranceMs: WORKOS_WEBHOOK_TOLERANCE_MS,
        eventType: 'workos.webhook',
        normalize: (value, bytes) =>
          normalizeWorkOsReal(value, bytes, {
            organizationId: integrations.workos.organizationId!,
            userIds: integrations.workos.allowedUserIds,
            roleSlugs: integrations.workos.allowedRoleSlugs,
          }),
        preflightAlert: reserveWorkosObservedState,
        beforeIncidentWrite: persistWorkosSnapshotBeforeIncident,
      });
    });
  }
}

async function handleWebhook(
  context: Context<AppEnv>,
  dependencies: WebhookRouteDependencies,
  route: Readonly<{
    signatureHeader: string;
    secret?: string;
    secrets?: readonly string[];
    toleranceMs?: number;
    eventType: string;
    normalize: (value: unknown, rawBody: Uint8Array) => ReturnType<typeof normalizeAlertWebhook>;
    preflightAlert?: OperationDependencies['preflightAlert'];
    beforeIncidentWrite?: OperationDependencies['beforeIncidentWrite'];
  }>,
) {
  let outOfOrderEventRef: string | undefined;
  try {
    const rawBody = new Uint8Array(await context.req.arrayBuffer());
    verifyWebhookSignature({
      header: context.req.header(route.signatureHeader),
      ...(route.secret ? { secret: route.secret } : {}),
      ...(route.secrets ? { secrets: route.secrets } : {}),
      rawBody,
      nowMs: dependencies.nowMs?.(),
      ...(route.toleranceMs ? { toleranceMs: route.toleranceMs } : {}),
    });
    const value = parseJsonStrictUtf8(rawBody);
    const normalized = route.normalize(value, rawBody);
    if (normalized.disposition === 'dead_letter') {
      await persistStandaloneDeadLetter(dependencies.store, {
        eventType: route.eventType,
        eventRef: normalized.eventRef,
        errorCode: normalized.reasonCode,
      });
      return context.json(
        {
          accepted: false,
          disposition: 'dead_lettered',
          reasonCode: normalized.reasonCode,
          requestId: context.get('requestId'),
          correlationId: context.get('correlationId'),
        },
        202,
      );
    }
    outOfOrderEventRef = normalized.alert.rawPayloadRef;
    const requestContextId = context.get('requestId') ?? context.get('correlationId');
    // Test and recovery entrypoints can legitimately bypass HTTP middleware.
    // Bind those events to the signed alert id rather than serializing an
    // incomplete carrier that a later worker could not authenticate.
    const requestId =
      typeof requestContextId === 'string' && requestContextId.length > 0
        ? requestContextId
        : normalized.alert.idempotencyKey;
    const trace = startWorkflowBoundary({
      boundary: 'http.webhook',
      tenantId: normalized.alert.tenantId,
      incidentId: normalized.alert.alertId,
      runId: normalized.alert.alertId,
      correlationId: context.get('correlationId'),
      requestId,
    });
    const normalizationTrace = startWorkflowBoundary({
      boundary: 'webhook.normalize',
      tenantId: normalized.alert.tenantId,
      incidentId: normalized.alert.alertId,
      runId: normalized.alert.alertId,
      correlationId: context.get('correlationId'),
      requestId,
      context: trace.context,
      identifiers: { stepId: 'webhook-normalize' },
    });
    normalizationTrace.span.end({ attributes: { success: true } as never });
    let result;
    let persistenceTrace: ReturnType<typeof startWorkflowBoundary> | undefined;
    try {
      persistenceTrace = startWorkflowBoundary({
        boundary: 'incident.persist',
        tenantId: normalized.alert.tenantId,
        incidentId: normalized.alert.alertId,
        runId: normalized.alert.alertId,
        correlationId: context.get('correlationId'),
        requestId,
        context: normalizationTrace.context,
        identifiers: { stepId: 'webhook-persist' },
      });
      result = await createIncidentFromAlertResult(dependencies.store, normalized.alert, {
        correlationId: context.get('correlationId'),
        traceContext: {
          ...persistenceTrace.context,
          runId: normalized.alert.alertId,
          requestId,
        },
        ...(dependencies.clock ? { clock: dependencies.clock } : {}),
        enforceAlertOrdering: true,
        ...(route.preflightAlert ? { preflightAlert: route.preflightAlert } : {}),
        ...(route.beforeIncidentWrite ? { beforeIncidentWrite: route.beforeIncidentWrite } : {}),
      });
      persistenceTrace.span.end({ attributes: { success: true } as never });
      trace.span.end({ attributes: { success: true } as never });
    } catch (error) {
      persistenceTrace?.span.error({ error: error as Error, endSpan: true });
      trace.span.error({ error: error as Error, endSpan: true });
      throw error;
    }
    context.set('incidentId', result.incident.incidentId);
    dependencies.logger.write({
      event: result.duplicate ? 'webhook.ingest.duplicate' : 'webhook.ingest.committed',
      requestId: context.get('requestId'),
      correlationId: context.get('correlationId'),
      incidentId: result.incident.incidentId,
    });
    return context.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        incidentId: result.incident.incidentId,
        requestId: context.get('requestId'),
        correlationId: context.get('correlationId'),
      },
      202,
    );
  } catch (error) {
    if (error instanceof SignatureError) {
      return errorResponse(context, error.code, 401, false, dependencies.logger);
    }
    if (error instanceof ZodError || error instanceof PayloadDecodeError) {
      return errorResponse(context, 'PAYLOAD_INVALID', 422, false, dependencies.logger);
    }
    if (error instanceof Error && error.message === 'ALERT_SOURCE_UNSUPPORTED') {
      return errorResponse(context, 'PAYLOAD_INVALID', 422, false, dependencies.logger);
    }
    if (error instanceof DomainError) {
      if (error.code === 'EVENT_OUT_OF_ORDER' && outOfOrderEventRef) {
        try {
          await persistStandaloneDeadLetter(dependencies.store, {
            eventType: route.eventType,
            eventRef: outOfOrderEventRef,
            errorCode: 'EVENT_OUT_OF_ORDER',
          });
        } catch (persistenceError) {
          return persistenceError instanceof DomainError && persistenceError.code === 'STORAGE_UNAVAILABLE'
            ? errorResponse(context, 'STORAGE_UNAVAILABLE', 503, true, dependencies.logger)
            : errorResponse(context, 'INTERNAL_ERROR', 500, false, dependencies.logger);
        }
        return context.json(
          {
            accepted: false,
            disposition: 'dead_lettered',
            reasonCode: 'EVENT_OUT_OF_ORDER',
            requestId: context.get('requestId'),
            correlationId: context.get('correlationId'),
          },
          202,
        );
      }
      if (error.code === 'CONFLICT') {
        // A WorkOS object may not use an equal timestamp to replace a
        // different observed role/status.  Keep an auditable, redacted
        // receipt of that fail-closed conflict just as we do for stale order.
        if (outOfOrderEventRef && route.eventType === 'workos.webhook') {
          try {
            await persistStandaloneDeadLetter(dependencies.store, {
              eventType: route.eventType,
              eventRef: outOfOrderEventRef,
              errorCode: 'EVENT_STATE_CONFLICT',
            });
          } catch (persistenceError) {
            return persistenceError instanceof DomainError && persistenceError.code === 'STORAGE_UNAVAILABLE'
              ? errorResponse(context, 'STORAGE_UNAVAILABLE', 503, true, dependencies.logger)
              : errorResponse(context, 'INTERNAL_ERROR', 500, false, dependencies.logger);
          }
        }
        return errorResponse(context, 'ALERT_CONFLICT', 409, false, dependencies.logger);
      }
      if (error.code === 'STORAGE_UNAVAILABLE') {
        return errorResponse(context, 'STORAGE_UNAVAILABLE', 503, true, dependencies.logger);
      }
      if (error.code === 'VALIDATION_FAILED') {
        return errorResponse(context, 'PAYLOAD_INVALID', 422, false, dependencies.logger);
      }
    }
    return errorResponse(context, 'INTERNAL_ERROR', 500, false, dependencies.logger);
  }
}

function requireJsonContentType(logger: StructuredLogger): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const contentType = context.req.header('Content-Type');
    if (contentType?.toLowerCase() !== 'application/json') {
      return errorResponse(context, 'UNSUPPORTED_MEDIA_TYPE', 415, false, logger);
    }
    await next();
  };
}

function parseJsonStrictUtf8(rawBody: Uint8Array): unknown {
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(rawBody);
    return JSON.parse(decoded) as unknown;
  } catch {
    throw new PayloadDecodeError();
  }
}

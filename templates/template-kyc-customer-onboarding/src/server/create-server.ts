import { MastraServer } from '@mastra/hono';
import { SpanType } from '@mastra/core/observability';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import type { FoundationDependencies } from '../create-dependencies.js';
import { publicSchemaVersion } from '../contracts/http/public-api.js';
import { applicationCorrectionsSchema, applicationDataSchema, applicationSchema } from '../domain/application.js';
import { executionContextSchema } from '../domain/context.js';
import { documentSideSchema, documentTypeSchema } from '../domain/documents.js';
import { NotFoundError } from '../domain/errors.js';
import { informationResponseSchema } from '../domain/hitl.js';
import { caseIdSchema, idempotencyKeySchema } from '../domain/identifiers.js';
import { apiTraceOperation, createTraceCorrelationReference } from '../observability/tracing.js';
import { maximumDocumentSizeBytes } from '../services/document-validation.js';
import { KycWorkflowCoordinator } from '../services/kyc-workflow-coordinator.js';
import { createStableIdentifier } from '../services/stable-identifiers.js';
import { fingerprintValue } from '../services/stable-identifiers.js';
import {
  acquireCommand,
  contextForCommand,
  outcomeFromCompletedCommand,
  resumeAcquired,
  validateInformationResponse,
} from '../mastra/tools/resume-kyc-application.js';
import { DemoSessionStore, demoSessionCookieName, demoSessionLifetimeMs } from './demo-session.js';
import { HttpBoundaryError, safeErrorResponse } from './http-errors.js';
import { createApiSecurityMiddleware, FixedWindowRateLimiter, requireRole, type ApiEnv } from './http-security.js';
import {
  caseEventsPageSchema,
  caseEventsQuerySchema,
  caseEventViewSchema,
  caseSummarySchema,
  complianceDecisionWebhookSchema,
  createDemoSessionRequestSchema,
  customerResponseWebhookSchema,
  demoSessionSchema,
  evalMetricsSchema,
  metricsQuerySchema,
  metricsSummarySchema,
  providerMetricsSchema,
  reviewDecisionRequestSchema,
  reviewPageSchema,
  reviewQueueItemSchema,
  reviewPathSchema,
  reviewsQuerySchema,
  submitInformationRequestSchema,
  uploadDocumentResultSchema,
} from './public-schemas.js';
import { decodeReviewCursor, encodeReviewCursor } from './review-cursor.js';
import { createPublicApiRouteMetadata } from './public-api-routes.js';
import { verifyWebhook, webhookHeaderNames, type WebhookKeyring } from './webhook-signing.js';

const createCaseRequestSchema = z
  .object({
    application: applicationDataSchema,
  })
  .strict();

const idempotencyKeyFrom = (value: string | undefined) => idempotencyKeySchema.parse(value);

const jsonBodyLimit = bodyLimit({
  maxSize: 256 * 1024,
  onError: context => {
    const correlationId = z.string().parse(context.get('apiCorrelationId'));
    const response = safeErrorResponse(
      new HttpBoundaryError('REQUEST_TOO_LARGE', 'The request exceeds the JSON body limit', 413),
      correlationId,
    );
    return context.json(response.body, response.status);
  },
});

export const createServer = async (dependencies: FoundationDependencies): Promise<Hono<ApiEnv>> => {
  const app = new Hono<ApiEnv>();
  const sessions = new DemoSessionStore(dependencies.config.tenant.defaultTenantId);
  const workflowCoordinator = new KycWorkflowCoordinator({
    workflow: dependencies.workflows.durableKycOnboarding,
    cases: dependencies.repositories.cases,
    documents: dependencies.repositories.documents,
    informationRequests: dependencies.repositories.informationRequests,
    reviews: dependencies.repositories.complianceReviews,
    commands: dependencies.repositories.workflowResumeCommands,
    jurisdictionPolicy: dependencies.policies.jurisdiction,
    clock: dependencies.clock,
    jurisdiction: dependencies.config.jurisdiction.defaultJurisdiction,
    policyProfile: dependencies.config.jurisdiction.defaultPolicyProfile,
    piiMode: dependencies.config.pii.mode,
    locale: dependencies.config.locale,
  });
  const sseConnections = new Map<string, number>();

  app.use(
    '/api/v1/*',
    cors({
      origin: dependencies.config.server.portalOrigin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: [
        'Accept',
        'Content-Type',
        'Idempotency-Key',
        'Last-Event-ID',
        'X-Correlation-Id',
        'X-CSRF-Token',
        'Kyc-Webhook-Version',
        'Kyc-Webhook-Key-Id',
        'Kyc-Webhook-Timestamp',
        'Kyc-Webhook-Delivery-Id',
        'Kyc-Webhook-Signature',
      ],
      exposeHeaders: ['Retry-After', 'X-Correlation-Id', 'X-RateLimit-Limit'],
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use('/api/v1/*', secureHeaders());
  app.use(
    '/api/v1/*',
    createApiSecurityMiddleware({
      sessions,
      clock: dependencies.clock,
      ids: dependencies.ids,
      portalOrigin: dependencies.config.server.portalOrigin,
      rateLimiter: new FixedWindowRateLimiter(),
    }),
  );
  app.use('/api/v1/*', async (context, next) => {
    const operation = apiTraceOperation(context.req.method, context.req.path);
    const instance = dependencies.mastra.observability.getDefaultInstance();
    const span = instance?.startSpan({
      name: `kyc.api.${operation}`,
      type: SpanType.GENERIC,
      input: { method: context.req.method, operation },
      metadata: {
        operation,
        correlationRef: createTraceCorrelationReference(context.get('apiCorrelationId')),
      },
    });
    try {
      await next();
      span?.end({ output: { status: context.res.status, success: context.res.status < 500 } });
    } catch (error) {
      span?.error({ error: new Error('API request failed'), endSpan: true });
      throw error;
    }
  });

  const jsonResponse = (body: unknown, status: number, headers?: Readonly<Record<string, string>>): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers },
    });

  const processSignedWebhook = async <Payload>(
    input: Readonly<{
      context: Context<ApiEnv>;
      endpoint: 'CUSTOMER_RESPONSE' | 'COMPLIANCE_DECISION';
      keyring: WebhookKeyring;
      schema: z.ZodType<Payload>;
      authorize?: ((payload: Payload, keyId: string) => Promise<void>) | undefined;
      internalRequest: (payload: Payload) => Promise<
        Readonly<{
          persona: 'applicant' | 'reviewer' | 'senior-reviewer';
          path: string;
          body: unknown;
        }>
      >;
    }>,
  ): Promise<Response> => {
    const correlationId = input.context.get('apiCorrelationId');
    let temporarySessionId: string | undefined;
    try {
      const verified = verifyWebhook({
        headers: input.context.req.raw.headers,
        rawBody: await input.context.req.text(),
        keyring: input.keyring,
        now: dependencies.clock.now(),
        schema: input.schema,
      });
      await input.authorize?.(verified.payload, verified.keyId);
      const acquiredAt = dependencies.clock.now();
      const receipt = await dependencies.repositories.webhookReceipts.acquire({
        tenantId: dependencies.config.tenant.defaultTenantId,
        endpoint: input.endpoint,
        deliveryId: verified.deliveryId,
        idempotencyKey: verified.idempotencyKey,
        payloadFingerprint: verified.payloadFingerprint,
        keyId: verified.keyId,
        signedAt: verified.signedAt,
        acquiredAt: acquiredAt.toISOString(),
        leaseExpiresAt: new Date(acquiredAt.getTime() + 30_000).toISOString(),
      });
      if (receipt.replayed) return jsonResponse(receipt.receipt.outcome, 200);
      if (!receipt.acquired) {
        const response = safeErrorResponse(
          new HttpBoundaryError('WEBHOOK_IN_PROGRESS', 'The webhook delivery is already processing', 409),
          correlationId,
        );
        return jsonResponse(response.body, response.status, { 'Retry-After': '30' });
      }
      const internal = await input.internalRequest(verified.payload);
      const session = sessions.create(internal.persona, dependencies.clock.now());
      temporarySessionId = session.sessionId;
      const internalResponse = await app.request(internal.path, {
        method: 'POST',
        headers: {
          Cookie: `${demoSessionCookieName}=${session.sessionId}`,
          Origin: dependencies.config.server.portalOrigin,
          'X-CSRF-Token': session.csrfToken,
          'X-Correlation-Id': correlationId,
          'Content-Type': 'application/json',
          'Idempotency-Key': verified.idempotencyKey,
        },
        body: JSON.stringify(internal.body),
      });
      const outcome = z.json().parse(await internalResponse.json());
      if (!internalResponse.ok) return jsonResponse(outcome, internalResponse.status);
      await dependencies.repositories.webhookReceipts.complete({
        tenantId: dependencies.config.tenant.defaultTenantId,
        endpoint: input.endpoint,
        deliveryId: verified.deliveryId,
        payloadFingerprint: verified.payloadFingerprint,
        outcome,
        completedAt: dependencies.clock.now().toISOString(),
      });
      return jsonResponse(outcome, 200);
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return jsonResponse(response.body, response.status);
    } finally {
      sessions.delete(temporarySessionId);
    }
  };

  app.get('/health/live', context => context.json({ status: 'ok', service: 'mastra-kyc-app' as const }));

  app.get('/health/ready', async context => {
    try {
      await dependencies.storage.checkReadiness();
      return context.json({ status: 'ready' as const });
    } catch {
      return context.json({ status: 'not_ready' as const }, 503);
    }
  });

  app.post('/api/v1/demo/session', jsonBodyLimit, async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      if (context.req.header('Origin') !== dependencies.config.server.portalOrigin) {
        throw new HttpBoundaryError('ORIGIN_NOT_ALLOWED', 'The request origin is not allowed', 403);
      }
      const input = createDemoSessionRequestSchema.parse(await context.req.json());
      const record = sessions.create(input.persona, dependencies.clock.now());
      setCookie(context, demoSessionCookieName, record.sessionId, {
        httpOnly: true,
        maxAge: demoSessionLifetimeMs / 1_000,
        path: '/',
        sameSite: 'Lax',
      });
      return context.json(demoSessionSchema.parse(sessions.toPublic(record)), 201);
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.get('/api/v1/demo/session', context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const record = sessions.get(getCookie(context, demoSessionCookieName), dependencies.clock.now());
      if (record === undefined) {
        throw new HttpBoundaryError('UNAUTHENTICATED', 'A demo session is required', 401);
      }
      return context.json(demoSessionSchema.parse(sessions.toPublic(record)));
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.post('/api/v1/demo/session/logout', context => {
    sessions.delete(getCookie(context, demoSessionCookieName));
    deleteCookie(context, demoSessionCookieName, { path: '/' });
    return context.body(null, 204);
  });

  app.post('/api/v1/kyc/cases', jsonBodyLimit, async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['applicant']);
      const input = createCaseRequestSchema.parse(await context.req.json());
      const idempotencyKey = idempotencyKeyFrom(context.req.header('Idempotency-Key'));
      const policyProfile = dependencies.config.jurisdiction.defaultPolicyProfile;
      const policy = await dependencies.policies.jurisdiction.resolve({
        jurisdiction: dependencies.config.jurisdiction.defaultJurisdiction,
        profile: policyProfile,
      });
      const execution = executionContextSchema.parse({
        tenantId: session.tenantId,
        jurisdiction: dependencies.config.jurisdiction.defaultJurisdiction,
        piiMode: dependencies.config.pii.mode,
        policy: { id: policy.id, version: policy.version, checksum: policy.checksum },
        locale: dependencies.config.locale,
        correlationId,
        actor: session.actor,
      });
      const result = await dependencies.services.applicationIntake.intake({
        execution,
        policyProfile,
        application: input.application,
        idempotencyKey,
        workflowRunId: createStableIdentifier('workflow-run', session.tenantId, idempotencyKey),
      });
      return context.json(
        { schemaVersion: publicSchemaVersion, caseId: result.case.id, status: result.case.status },
        201,
      );
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.post(
    '/api/v1/kyc/cases/:caseId/documents',
    bodyLimit({
      maxSize: maximumDocumentSizeBytes + 64 * 1024,
      onError: context =>
        context.json(
          safeErrorResponse(
            new HttpBoundaryError('DOCUMENT_TOO_LARGE', 'The document exceeds the upload limit', 413),
            z.string().parse(context.get('apiCorrelationId')),
          ).body,
          413,
        ),
    }),
    async context => {
      const correlationId = context.get('apiCorrelationId');
      try {
        const session = context.get('apiSession');
        requireRole(session, ['applicant']);
        const caseId = caseIdSchema.parse(context.req.param('caseId'));
        const body = await context.req.parseBody();
        const file = body.file;
        if (!(file instanceof File)) {
          throw new HttpBoundaryError('DOCUMENT_REQUIRED', 'A document file is required', 400);
        }
        const policy = await dependencies.policies.jurisdiction.resolve({
          jurisdiction: dependencies.config.jurisdiction.defaultJurisdiction,
          profile: dependencies.config.jurisdiction.defaultPolicyProfile,
        });
        const execution = executionContextSchema.parse({
          tenantId: session.tenantId,
          jurisdiction: dependencies.config.jurisdiction.defaultJurisdiction,
          piiMode: dependencies.config.pii.mode,
          policy: { id: policy.id, version: policy.version, checksum: policy.checksum },
          locale: dependencies.config.locale,
          correlationId,
          actor: session.actor,
        });
        const result = await dependencies.services.documentIntake.intake({
          execution,
          caseId,
          documentType: documentTypeSchema.exclude(['UNKNOWN']).parse(body.documentType),
          side: documentSideSchema.parse(body.side),
          declaredMimeType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
          idempotencyKey: idempotencyKeyFrom(context.req.header('Idempotency-Key')),
        });
        return context.json(
          uploadDocumentResultSchema.parse({
            schemaVersion: publicSchemaVersion,
            caseId: result.case.id,
            documentId: result.document.id,
            status: result.case.status,
            mimeType: result.document.content.mimeType,
            sizeBytes: result.document.content.sizeBytes,
            pageCount: result.pageCount,
          }),
          201,
        );
      } catch (error) {
        const response = safeErrorResponse(error, correlationId);
        return context.json(response.body, response.status);
      }
    },
  );

  app.post('/api/v1/kyc/cases/:caseId/start', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['applicant']);
      const result = await workflowCoordinator.start({
        tenantId: session.tenantId,
        caseId: caseIdSchema.parse(context.req.param('caseId')),
        idempotencyKey: idempotencyKeyFrom(context.req.header('Idempotency-Key')),
        session,
        correlationId,
      });
      return context.json(caseSummarySchema.parse(result), 202);
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.get('/api/v1/kyc/cases/:caseId', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['applicant', 'reviewer', 'senior-reviewer']);
      const result = await workflowCoordinator.status(
        session.tenantId,
        caseIdSchema.parse(context.req.param('caseId')),
      );
      return context.json(caseSummarySchema.parse(result));
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.get('/api/v1/kyc/cases/:caseId/events', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['applicant', 'reviewer', 'senior-reviewer']);
      const caseId = caseIdSchema.parse(context.req.param('caseId'));
      const requested = caseEventsQuerySchema.parse(context.req.query());
      const lastEventId = context.req.header('Last-Event-ID');
      const query = caseEventsQuerySchema.parse({
        ...requested,
        ...(lastEventId === undefined ? {} : { cursor: lastEventId }),
      });
      const readPage = async (cursor: string | undefined) => {
        const current = await dependencies.repositories.cases.get({
          tenantId: session.tenantId,
          caseId,
        });
        const events = await dependencies.repositories.caseEvents.list({
          tenantId: session.tenantId,
          caseId,
          ...(cursor === undefined ? {} : { afterEventId: cursor }),
          limit: query.limit,
        });
        const views = events.map(event =>
          caseEventViewSchema.parse({
            schemaVersion: publicSchemaVersion,
            eventId: event.id,
            caseId: event.caseId,
            status: event.nextStatus,
            eventType: event.type,
            reasonCode: event.reasonCode,
            occurredAt: event.occurredAt,
            caseVersion: event.caseVersion,
          }),
        );
        return {
          views,
          terminal: ['ACTIVE', 'REJECTED', 'PROVISIONING_FAILED'].includes(current.status),
        };
      };
      const initialPage = await readPage(query.cursor);
      if (context.req.header('Accept')?.includes('text/event-stream')) {
        const active = sseConnections.get(session.sessionId) ?? 0;
        if (active >= 5) {
          throw new HttpBoundaryError('SSE_CONNECTION_LIMIT', 'The session has too many event streams', 429);
        }
        sseConnections.set(session.sessionId, active + 1);
        return streamSSE(context, async stream => {
          let cursor = query.cursor;
          let prefetched: Awaited<ReturnType<typeof readPage>> | undefined = initialPage;
          let lastHeartbeatAt = Date.now();
          try {
            await stream.write('retry: 2000\n\n');
            while (!stream.aborted) {
              const page = prefetched ?? (await readPage(cursor));
              prefetched = undefined;
              for (const event of page.views) {
                await stream.writeSSE({
                  id: event.eventId,
                  event: 'case-event',
                  data: JSON.stringify(event),
                });
                cursor = event.eventId;
              }
              if (page.terminal) {
                await stream.writeSSE({
                  event: 'terminal',
                  data: JSON.stringify({ schemaVersion: publicSchemaVersion, terminal: true }),
                });
                break;
              }
              if (Date.now() - lastHeartbeatAt >= 15_000) {
                await stream.write(': heartbeat\n\n');
                lastHeartbeatAt = Date.now();
              }
              await stream.sleep(1_000);
            }
          } finally {
            const remaining = (sseConnections.get(session.sessionId) ?? 1) - 1;
            if (remaining <= 0) sseConnections.delete(session.sessionId);
            else sseConnections.set(session.sessionId, remaining);
          }
        });
      }
      const { views, terminal } = initialPage;
      return context.json(
        caseEventsPageSchema.parse({
          schemaVersion: publicSchemaVersion,
          events: views,
          nextCursor: views.length === query.limit ? (views.at(-1)?.eventId ?? null) : null,
          terminal,
        }),
      );
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.post('/api/v1/kyc/cases/:caseId/information', jsonBodyLimit, async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['applicant']);
      const caseId = caseIdSchema.parse(context.req.param('caseId'));
      const input = submitInformationRequestSchema.parse(await context.req.json());
      const routeIdempotencyKey = idempotencyKeyFrom(context.req.header('Idempotency-Key'));
      const commands = await dependencies.repositories.workflowResumeCommands.listForThread({
        tenantId: session.tenantId,
        threadId: `api-${caseId}`,
      });
      const command = commands.find(
        candidate =>
          candidate.actionType === 'MISSING_INFORMATION' &&
          candidate.caseId === caseId &&
          candidate.targetId === input.requestId,
      );
      if (command === undefined) {
        throw new HttpBoundaryError('NOT_FOUND', 'Information command was not found', 404);
      }
      const request = await dependencies.repositories.informationRequests.get({
        tenantId: session.tenantId,
        requestId: input.requestId,
      });
      const corrections = input.applicationCorrections ?? null;
      validateInformationResponse(request, input.responseOption, corrections);
      const documents = await Promise.all(
        input.documentIds.map(documentId =>
          dependencies.repositories.documents.get({ tenantId: session.tenantId, documentId }),
        ),
      );
      if (documents.some(document => document.caseId !== caseId)) {
        throw new HttpBoundaryError(
          'DOCUMENT_BINDING_INVALID',
          'A document does not belong to the requested case',
          409,
        );
      }
      const payloadFingerprint = fingerprintValue({
        actionType: command.actionType,
        commandId: command.id,
        responseOption: input.responseOption,
        applicationCorrections: corrections,
        documentIds: input.documentIds,
      });
      const acquired = await acquireCommand(dependencies.resume, command, session.actor, payloadFingerprint);
      if (acquired.status === 'COMPLETED') {
        await outcomeFromCompletedCommand(dependencies.resume, acquired, session.actor);
        return context.json(caseSummarySchema.parse(await workflowCoordinator.status(session.tenantId, caseId)));
      }
      const trusted = await contextForCommand(dependencies.resume, acquired, session.actor);
      const execution = executionContextSchema.parse({
        tenantId: trusted.value.tenantId,
        jurisdiction: trusted.value.jurisdiction,
        piiMode: trusted.value.piiMode,
        policy: trusted.value.policy,
        locale: trusted.value.locale,
        correlationId,
        actor: session.actor,
      });
      let applicationVersion: number | null = null;
      if (input.responseOption === 'CORRECTED_APPLICATION') {
        const currentCase = await dependencies.repositories.cases.get({
          tenantId: session.tenantId,
          caseId,
        });
        const currentApplication = await dependencies.repositories.applications.get({
          tenantId: session.tenantId,
          applicationId: currentCase.applicationId,
        });
        const correctedApplication = applicationSchema.parse({
          ...currentApplication,
          data: {
            ...currentApplication.data,
            ...applicationCorrectionsSchema.parse(corrections),
          },
          updatedAt: dependencies.clock.now().toISOString(),
          version: currentApplication.version + 1,
        });
        const persisted = await dependencies.repositories.applications.put({
          application: correctedApplication,
          idempotencyKey: `${routeIdempotencyKey}:application-correction`,
          requestFingerprint: payloadFingerprint,
        });
        applicationVersion = persisted.version;
      }
      await Promise.all(
        documents.map(document =>
          dependencies.services.documentExtraction.extract({
            execution,
            document,
            modelId: dependencies.config.model.documentExtraction,
            schemaVersion: '1.0.0',
            timeoutMs: dependencies.config.retry.timeoutMs,
            idempotencyKey: `${routeIdempotencyKey}:extraction:${document.id}`,
            workflowRunId: acquired.workflowRunId,
          }),
        ),
      );
      let response;
      try {
        response = await dependencies.repositories.informationRequests.getResponse({
          tenantId: session.tenantId,
          responseId: acquired.resumePayloadId,
        });
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        const submittedAt = dependencies.clock.now().toISOString();
        response = informationResponseSchema.parse({
          id: acquired.resumePayloadId,
          tenantId: session.tenantId,
          caseId,
          requestId: request.id,
          responseOption: input.responseOption,
          responseQuality: 'COMPLETE',
          applicationCorrections: corrections,
          applicationVersion,
          documentIds: input.documentIds,
          responseFingerprint: payloadFingerprint,
          actor: session.actor,
          submittedAt,
        });
        await dependencies.repositories.informationRequests.respond({
          response,
          expectedVersion: request.version,
          idempotencyKey: `${routeIdempotencyKey}:response`,
        });
      }
      await resumeAcquired(dependencies.resume, acquired, session.actor, {
        commandId: acquired.id,
        responseId: response.id,
      });
      return context.json(caseSummarySchema.parse(await workflowCoordinator.status(session.tenantId, caseId)));
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  const reviewView = (review: Awaited<ReturnType<typeof dependencies.repositories.complianceReviews.get>>) =>
    reviewQueueItemSchema.parse({
      schemaVersion: publicSchemaVersion,
      reviewId: review.id,
      caseId: review.caseId,
      level: review.level,
      riskLevel: review.riskLevel,
      riskRoute: review.riskRoute,
      reasonCodes: review.reasonCodes,
      allowedDecisions: dependencies.services.complianceReview.decisionCapabilities(review),
      expiresAt: review.expiresAt,
      createdAt: review.createdAt,
    });

  app.get('/api/v1/reviews', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['reviewer', 'senior-reviewer']);
      const query = reviewsQuerySchema.parse(context.req.query());
      const cursor = decodeReviewCursor(query.cursor);
      const reviews = await dependencies.repositories.complianceReviews.listQueue({
        tenantId: session.tenantId,
        now: dependencies.clock.now().toISOString(),
        requiredRole: session.persona === 'senior-reviewer' ? 'senior-reviewer' : 'reviewer',
        ...cursor,
        limit: query.limit,
      });
      const views = reviews.map(reviewView);
      const last = reviews.at(-1);
      return context.json(
        reviewPageSchema.parse({
          schemaVersion: publicSchemaVersion,
          reviews: views,
          nextCursor:
            reviews.length === query.limit && last !== undefined ? encodeReviewCursor(last.createdAt, last.id) : null,
        }),
      );
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.get('/api/v1/reviews/:reviewId', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['reviewer', 'senior-reviewer']);
      const { reviewId } = reviewPathSchema.parse(context.req.param());
      const review = await dependencies.repositories.complianceReviews.get({
        tenantId: session.tenantId,
        reviewId,
      });
      requireRole(session, [review.requiredRole]);
      return context.json(reviewView(review));
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.get('/api/v1/metrics/summary', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['reviewer', 'senior-reviewer']);
      const query = metricsQuerySchema.parse(context.req.query());
      return context.json(
        metricsSummarySchema.parse(await dependencies.services.metrics.summary(session.tenantId, query)),
      );
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.get('/api/v1/metrics/providers', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['reviewer', 'senior-reviewer']);
      const query = metricsQuerySchema.parse(context.req.query());
      return context.json(
        providerMetricsSchema.parse(await dependencies.services.metrics.providers(session.tenantId, query)),
      );
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.get('/api/v1/metrics/evals', async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      requireRole(session, ['reviewer', 'senior-reviewer']);
      const query = metricsQuerySchema.parse(context.req.query());
      return context.json(evalMetricsSchema.parse(await dependencies.services.metrics.evals(session.tenantId, query)));
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.post('/api/v1/reviews/:reviewId/decision', jsonBodyLimit, async context => {
    const correlationId = context.get('apiCorrelationId');
    try {
      const session = context.get('apiSession');
      const { reviewId } = reviewPathSchema.parse(context.req.param());
      const input = reviewDecisionRequestSchema.parse(await context.req.json());
      const routeIdempotencyKey = idempotencyKeyFrom(context.req.header('Idempotency-Key'));
      const review = await dependencies.repositories.complianceReviews.get({
        tenantId: session.tenantId,
        reviewId,
      });
      requireRole(session, [review.requiredRole]);
      const commands = await dependencies.repositories.workflowResumeCommands.listForThread({
        tenantId: session.tenantId,
        threadId: review.threadId,
      });
      const command = commands.find(
        candidate => candidate.actionType === 'COMPLIANCE_REVIEW' && candidate.targetId === review.id,
      );
      if (command === undefined) {
        throw new HttpBoundaryError('NOT_FOUND', 'Review command was not found', 404);
      }
      const payloadFingerprint = fingerprintValue({
        actionType: command.actionType,
        commandId: command.id,
        decision: input.decision,
        reasonCode: input.reasonCode,
        safeNote: input.safeNote ?? null,
        feedback: input.feedback ?? null,
      });
      const acquired = await acquireCommand(dependencies.resume, command, session.actor, payloadFingerprint);
      if (acquired.status === 'COMPLETED') {
        await outcomeFromCompletedCommand(dependencies.resume, acquired, session.actor);
        return context.json(caseSummarySchema.parse(await workflowCoordinator.status(session.tenantId, review.caseId)));
      }
      const expectedReason =
        input.decision === 'APPROVE'
          ? ('REVIEW_APPROVED' as const)
          : input.decision === 'REJECT'
            ? ('REVIEW_REJECTED' as const)
            : ('REVIEW_ESCALATED' as const);
      if (input.reasonCode !== expectedReason) {
        throw new HttpBoundaryError(
          'INVALID_DECISION_REASON',
          'The decision reason does not match the selected decision',
          400,
        );
      }
      const decided = await dependencies.services.complianceReview.decide({
        tenantId: session.tenantId,
        reviewId: review.id,
        reviewer: session.actor,
        decision: input.decision,
        reasonCode: expectedReason,
        safeNote: input.safeNote ?? null,
        ...(input.feedback === undefined
          ? {}
          : {
              feedback: {
                extractionUseful: input.feedback.extractionUseful,
                screeningUseful: input.feedback.screeningUseful,
                riskUseful: input.feedback.riskUseful,
                evidenceUseful: input.feedback.evidenceUseful,
                falsePositiveEscalation: input.feedback.falsePositiveEscalation ?? null,
                curatedForDataset: input.feedback.curatedForDataset ?? false,
                note: input.feedback.note ?? null,
              },
            }),
        idempotencyKey: routeIdempotencyKey,
      });
      await resumeAcquired(dependencies.resume, acquired, session.actor, {
        commandId: acquired.id,
        decisionId: decided.decision.id,
      });
      return context.json(caseSummarySchema.parse(await workflowCoordinator.status(session.tenantId, review.caseId)));
    } catch (error) {
      const response = safeErrorResponse(error, correlationId);
      return context.json(response.body, response.status);
    }
  });

  app.post('/api/v1/webhooks/customer-response', jsonBodyLimit, context =>
    processSignedWebhook({
      context,
      endpoint: 'CUSTOMER_RESPONSE',
      keyring: dependencies.webhooks.customerResponse,
      schema: customerResponseWebhookSchema,
      internalRequest: payload =>
        Promise.resolve({
          persona: 'applicant' as const,
          path: `/api/v1/kyc/cases/${payload.caseId}/information`,
          body: {
            requestId: payload.requestId,
            responseOption: payload.responseOption,
            ...(payload.applicationCorrections === undefined
              ? {}
              : { applicationCorrections: payload.applicationCorrections }),
            documentIds: payload.documentIds,
          },
        }),
    }),
  );

  app.post('/api/v1/webhooks/compliance-decision', jsonBodyLimit, context => {
    const suppliedKeyId = context.req.header(webhookHeaderNames.keyId);
    const seniorKeyring = dependencies.webhooks.complianceDecision.seniorReviewer;
    const seniorKeyIds = [seniorKeyring.current.keyId, seniorKeyring.previous?.keyId];
    const authority = seniorKeyIds.includes(suppliedKeyId)
      ? ({ persona: 'senior-reviewer', role: 'senior-reviewer', keyring: seniorKeyring } as const)
      : ({
          persona: 'reviewer',
          role: 'reviewer',
          keyring: dependencies.webhooks.complianceDecision.reviewer,
        } as const);
    return processSignedWebhook({
      context,
      endpoint: 'COMPLIANCE_DECISION',
      keyring: authority.keyring,
      schema: complianceDecisionWebhookSchema,
      authorize: async payload => {
        const review = await dependencies.repositories.complianceReviews.get({
          tenantId: dependencies.config.tenant.defaultTenantId,
          reviewId: payload.reviewId,
        });
        if (review.requiredRole !== authority.role) {
          throw new HttpBoundaryError('WEBHOOK_ROLE_FORBIDDEN', 'The webhook key cannot decide this review level', 403);
        }
      },
      internalRequest: payload =>
        Promise.resolve({
          persona: authority.persona,
          path: `/api/v1/reviews/${payload.reviewId}/decision`,
          body: {
            decision: payload.decision,
            reasonCode: payload.reasonCode,
            ...(payload.safeNote === undefined ? {} : { safeNote: payload.safeNote }),
            ...(payload.feedback === undefined ? {} : { feedback: payload.feedback }),
          },
        }),
    });
  });

  const mastraServer = new MastraServer({
    app,
    mastra: dependencies.mastra,
    prefix: '/api/v1/mastra',
  });
  await mastraServer.init();

  const generatedOpenApiPath = '/_kyc-public-openapi.json';
  const openApiGenerator = new MastraServer({
    app,
    mastra: dependencies.mastra,
    prefix: '/api/v1/mastra',
    customApiRoutes: createPublicApiRouteMetadata(),
  });
  await openApiGenerator.registerOpenAPIRoute(
    app,
    {
      title: 'Mastra KYC API',
      version: publicSchemaVersion,
      description: 'Redacted companion API for local KYC onboarding demonstrations',
      path: generatedOpenApiPath,
    },
    { prefix: '/api/v1/mastra' },
  );
  app.get(dependencies.config.server.openapiPath, async () => {
    const generated = await app.request(`/api/v1/mastra${generatedOpenApiPath}`);
    const document = (await generated.json()) as Record<string, unknown>;
    const components = (document.components ?? {}) as Record<string, unknown>;
    document.components = {
      ...components,
      securitySchemes: {
        demoSessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: demoSessionCookieName,
          description: 'Replaceable local demo session cookie',
        },
        webhookSignature: {
          type: 'apiKey',
          in: 'header',
          name: webhookHeaderNames.signature,
          description: 'HMAC v1 signature with all documented webhook headers',
        },
      },
    };
    return new Response(JSON.stringify(document), {
      status: generated.status,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
    });
  });

  return app;
};

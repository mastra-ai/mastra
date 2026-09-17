import { registerApiRoute, type ApiRoute } from '@mastra/core/server';
import { z } from 'zod';

import {
  caseEventsPageSchema,
  casePathSchema,
  caseSummarySchema,
  complianceDecisionWebhookSchema,
  createCaseRequestSchema,
  createCaseResultSchema,
  createDemoSessionRequestSchema,
  customerResponseWebhookSchema,
  demoSessionSchema,
  evalMetricsSchema,
  metricsQuerySchema,
  metricsSummarySchema,
  providerMetricsSchema,
  publicErrorSchema,
  reviewDecisionRequestSchema,
  reviewPageSchema,
  reviewPathSchema,
  reviewQueueItemSchema,
  reviewsQuerySchema,
  submitInformationRequestSchema,
  uploadDocumentResultSchema,
} from './public-schemas.js';

const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const converted = z.toJSONSchema(schema) as Record<string, unknown>;
  delete converted.$schema;
  return converted;
};

const jsonContent = (schema: z.ZodType) => ({
  'application/json': { schema: jsonSchema(schema) },
});
const response = (description: string, schema?: z.ZodType) => ({
  description,
  ...(schema === undefined ? {} : { content: jsonContent(schema) }),
});
const errorResponses = {
  '400': response('Invalid request', publicErrorSchema),
  '401': response('Demo session required', publicErrorSchema),
  '403': response('Persona or CSRF denied', publicErrorSchema),
  '409': response('State or idempotency conflict', publicErrorSchema),
  '404': response('Tenant-scoped resource not found', publicErrorSchema),
  '429': response('Rate limit exceeded', publicErrorSchema),
  '500': response('Safe internal error', publicErrorSchema),
};
const sessionSecurity = [{ demoSessionCookie: [] }];
const webhookSecurity = [{ webhookSignature: [] }];
const header = (name: string, required = true) => ({
  name,
  in: 'header' as const,
  required,
  schema: { type: 'string', minLength: 1 },
});
const originHeader = header('Origin');
const csrfHeader = header('X-CSRF-Token');
const webhookHeaders = [
  header('Kyc-Webhook-Version'),
  header('Kyc-Webhook-Key-Id'),
  header('Kyc-Webhook-Timestamp'),
  header('Kyc-Webhook-Delivery-Id'),
  header('Idempotency-Key'),
  header('Kyc-Webhook-Signature'),
];
const casePathParameter = {
  name: 'caseId',
  in: 'path' as const,
  required: true,
  schema: jsonSchema(casePathSchema.shape.caseId),
};
const reviewPathParameter = {
  name: 'reviewId',
  in: 'path' as const,
  required: true,
  schema: jsonSchema(reviewPathSchema.shape.reviewId),
};
const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header' as const,
  required: true,
  schema: { type: 'string', minLength: 1, maxLength: 128 },
};
const metricsWindowParameters = [
  { name: 'from', in: 'query' as const, schema: jsonSchema(metricsQuerySchema.shape.from) },
  { name: 'to', in: 'query' as const, schema: jsonSchema(metricsQuerySchema.shape.to) },
];
const unusedHandler = (): Response => new Response(null, { status: 501 });

const route = (
  path: string,
  method: 'GET' | 'POST',
  openapi: NonNullable<Parameters<typeof registerApiRoute>[1]['openapi']>,
): ApiRoute => registerApiRoute(path, { method, openapi, handler: unusedHandler, requiresAuth: false });

export const createPublicApiRouteMetadata = (): ApiRoute[] => [
  route('/health/live', 'GET', {
    operationId: 'getLiveness',
    summary: 'Check process liveness',
    tags: ['Health'],
    responses: { '200': response('Process is live') },
  }),
  route('/health/ready', 'GET', {
    operationId: 'getReadiness',
    summary: 'Check storage readiness',
    tags: ['Health'],
    responses: { '200': response('Storage is ready'), '503': response('Storage is not ready') },
  }),
  route('/api/v1/demo/session', 'POST', {
    operationId: 'createDemoSession',
    summary: 'Create an allowlisted local demo session',
    tags: ['Demo session'],
    parameters: [originHeader],
    requestBody: { required: true, content: jsonContent(createDemoSessionRequestSchema) },
    responses: {
      '201': response('Session created', demoSessionSchema),
      '400': errorResponses['400'],
      '403': errorResponses['403'],
      '429': errorResponses['429'],
      '413': response('Request too large', publicErrorSchema),
      '500': errorResponses['500'],
    },
  }),
  route('/api/v1/demo/session', 'GET', {
    operationId: 'getDemoSession',
    summary: 'Read the current local demo session',
    tags: ['Demo session'],
    security: sessionSecurity,
    responses: { '200': response('Current session', demoSessionSchema), ...errorResponses },
  }),
  route('/api/v1/demo/session/logout', 'POST', {
    operationId: 'logoutDemoSession',
    summary: 'Invalidate the current local demo session',
    tags: ['Demo session'],
    security: sessionSecurity,
    parameters: [originHeader, csrfHeader],
    responses: { '204': response('Session invalidated'), ...errorResponses },
  }),
  route('/api/v1/kyc/cases', 'POST', {
    operationId: 'createKycCase',
    summary: 'Create an idempotent KYC case',
    tags: ['Applicant'],
    security: sessionSecurity,
    parameters: [originHeader, csrfHeader, idempotencyHeader],
    requestBody: { required: true, content: jsonContent(createCaseRequestSchema) },
    responses: {
      '201': response('Case created', createCaseResultSchema),
      '413': response('Request too large', publicErrorSchema),
      ...errorResponses,
    },
  }),
  route('/api/v1/kyc/cases/:caseId/documents', 'POST', {
    operationId: 'uploadKycDocument',
    summary: 'Upload a validated KYC document',
    tags: ['Applicant'],
    security: sessionSecurity,
    parameters: [casePathParameter, originHeader, csrfHeader, idempotencyHeader],
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['file', 'documentType', 'side'],
            properties: {
              file: { type: 'string', format: 'binary' },
              documentType: {
                type: 'string',
                enum: ['PASSPORT', 'DRIVER_LICENSE', 'NATIONAL_ID', 'PROOF_OF_ADDRESS'],
              },
              side: { type: 'string', enum: ['SINGLE', 'FRONT', 'BACK'] },
            },
          },
        },
      },
    },
    responses: {
      '201': response('Document stored', uploadDocumentResultSchema),
      '413': response('Document too large', publicErrorSchema),
      ...errorResponses,
    },
  }),
  route('/api/v1/kyc/cases/:caseId/start', 'POST', {
    operationId: 'startKycCase',
    summary: 'Start or replay the durable KYC workflow',
    tags: ['Applicant'],
    security: sessionSecurity,
    parameters: [casePathParameter, originHeader, csrfHeader, idempotencyHeader],
    responses: { '202': response('Workflow accepted', caseSummarySchema), ...errorResponses },
  }),
  route('/api/v1/kyc/cases/:caseId', 'GET', {
    operationId: 'getKycCase',
    summary: 'Read a redacted KYC case summary',
    tags: ['Applicant', 'Review'],
    security: sessionSecurity,
    parameters: [casePathParameter],
    responses: { '200': response('Case summary', caseSummarySchema), ...errorResponses },
  }),
  route('/api/v1/kyc/cases/:caseId/events', 'GET', {
    operationId: 'getKycCaseEvents',
    summary: 'Page or stream redacted persisted case events',
    tags: ['Applicant', 'Review'],
    security: sessionSecurity,
    parameters: [
      casePathParameter,
      { name: 'cursor', in: 'query', schema: { type: 'string' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200 } },
      { name: 'Last-Event-ID', in: 'header', schema: { type: 'string' } },
      {
        name: 'Accept',
        in: 'header',
        schema: { type: 'string', enum: ['application/json', 'text/event-stream'] },
      },
    ],
    responses: {
      '200': {
        description: 'Event page or text/event-stream selected by Accept',
        content: {
          ...jsonContent(caseEventsPageSchema),
          'text/event-stream': { schema: { type: 'string' } },
        },
      },
      ...errorResponses,
    },
  }),
  route('/api/v1/kyc/cases/:caseId/information', 'POST', {
    operationId: 'submitKycInformation',
    summary: 'Submit missing information to the durable workflow',
    tags: ['Applicant'],
    security: sessionSecurity,
    parameters: [casePathParameter, originHeader, csrfHeader, idempotencyHeader],
    requestBody: { required: true, content: jsonContent(submitInformationRequestSchema) },
    responses: { '200': response('Updated case summary', caseSummarySchema), ...errorResponses },
  }),
  route('/api/v1/reviews', 'GET', {
    operationId: 'listKycReviews',
    summary: 'List the tenant-scoped pending review queue',
    tags: ['Review'],
    security: sessionSecurity,
    parameters: [
      { name: 'cursor', in: 'query', schema: jsonSchema(reviewsQuerySchema.shape.cursor) },
      { name: 'limit', in: 'query', schema: jsonSchema(reviewsQuerySchema.shape.limit) },
      { name: 'status', in: 'query', schema: jsonSchema(reviewsQuerySchema.shape.status) },
    ],
    responses: { '200': response('Pending review page', reviewPageSchema), ...errorResponses },
  }),
  route('/api/v1/reviews/:reviewId', 'GET', {
    operationId: 'getKycReview',
    summary: 'Read a redacted review detail',
    tags: ['Review'],
    security: sessionSecurity,
    parameters: [reviewPathParameter],
    responses: { '200': response('Review detail', reviewQueueItemSchema), ...errorResponses },
  }),
  route('/api/v1/reviews/:reviewId/decision', 'POST', {
    operationId: 'decideKycReview',
    summary: 'Submit an authorized review decision',
    tags: ['Review'],
    security: sessionSecurity,
    parameters: [reviewPathParameter, originHeader, csrfHeader, idempotencyHeader],
    requestBody: { required: true, content: jsonContent(reviewDecisionRequestSchema) },
    responses: { '200': response('Updated case summary', caseSummarySchema), ...errorResponses },
  }),
  route('/api/v1/webhooks/customer-response', 'POST', {
    operationId: 'receiveCustomerResponseWebhook',
    summary: 'Receive a signed customer response',
    tags: ['Webhooks'],
    security: webhookSecurity,
    parameters: webhookHeaders,
    requestBody: { required: true, content: jsonContent(customerResponseWebhookSchema) },
    responses: {
      '200': response('Safe durable outcome', caseSummarySchema),
      '413': response('Request too large', publicErrorSchema),
      ...errorResponses,
    },
  }),
  route('/api/v1/webhooks/compliance-decision', 'POST', {
    operationId: 'receiveComplianceDecisionWebhook',
    summary: 'Receive a signed compliance decision',
    tags: ['Webhooks'],
    security: webhookSecurity,
    parameters: webhookHeaders,
    requestBody: { required: true, content: jsonContent(complianceDecisionWebhookSchema) },
    responses: {
      '200': response('Safe durable outcome', caseSummarySchema),
      '413': response('Request too large', publicErrorSchema),
      ...errorResponses,
    },
  }),
  route('/api/v1/metrics/summary', 'GET', {
    operationId: 'getKycMetricsSummary',
    summary: 'Read tenant-scoped KYC outcome metrics',
    tags: ['Metrics'],
    security: sessionSecurity,
    parameters: metricsWindowParameters,
    responses: { '200': response('Metrics summary', metricsSummarySchema), ...errorResponses },
  }),
  route('/api/v1/metrics/providers', 'GET', {
    operationId: 'getKycProviderMetrics',
    summary: 'Read tenant-scoped provider reliability, latency, usage, and cost metrics',
    tags: ['Metrics'],
    security: sessionSecurity,
    parameters: metricsWindowParameters,
    responses: { '200': response('Provider metrics', providerMetricsSchema), ...errorResponses },
  }),
  route('/api/v1/metrics/evals', 'GET', {
    operationId: 'getKycEvalMetrics',
    summary: 'Read tenant-scoped evaluation quality metrics',
    tags: ['Metrics'],
    security: sessionSecurity,
    parameters: metricsWindowParameters,
    responses: { '200': response('Evaluation metrics', evalMetricsSchema), ...errorResponses },
  }),
];

import { createHash } from 'node:crypto';

import type { TracingOptions } from '@mastra/core/observability';

export const createTraceCorrelationReference = (correlationId: string): string =>
  `correlation-${createHash('sha256')
    .update('kyc-trace-correlation-v1')
    .update('\0')
    .update(correlationId)
    .digest('hex')
    .slice(0, 32)}`;

export const kycTracingOptions = (input: {
  operation: string;
  tenantId: string;
  correlationId: string;
  caseId?: string | undefined;
}): TracingOptions => ({
  hideInput: true,
  hideOutput: true,
  metadata: {
    operation: input.operation,
    tenantRef: input.tenantId,
    correlationRef: createTraceCorrelationReference(input.correlationId),
    ...(input.caseId === undefined ? {} : { caseRef: input.caseId }),
  },
});

export const apiTraceOperation = (method: string, path: string): string => {
  if (path === '/api/v1/demo/session') return `demo.session.${method.toLowerCase()}`;
  if (path === '/api/v1/demo/session/logout') return 'demo.session.logout';
  if (path === '/api/v1/kyc/cases') return 'kyc.case.create';
  if (/^\/api\/v1\/kyc\/cases\/[^/]+\/documents$/u.test(path)) return 'kyc.document.upload';
  if (/^\/api\/v1\/kyc\/cases\/[^/]+\/start$/u.test(path)) return 'kyc.workflow.start';
  if (/^\/api\/v1\/kyc\/cases\/[^/]+\/events$/u.test(path)) return 'kyc.events.read';
  if (/^\/api\/v1\/kyc\/cases\/[^/]+\/information$/u.test(path)) return 'kyc.information.submit';
  if (/^\/api\/v1\/kyc\/cases\/[^/]+$/u.test(path)) return 'kyc.case.read';
  if (path === '/api/v1/reviews') return 'kyc.reviews.list';
  if (/^\/api\/v1\/reviews\/[^/]+\/decision$/u.test(path)) return 'kyc.review.decide';
  if (/^\/api\/v1\/reviews\/[^/]+$/u.test(path)) return 'kyc.review.read';
  if (path.startsWith('/api/v1/webhooks/')) return 'kyc.webhook.receive';
  if (path.startsWith('/api/v1/metrics/')) return 'kyc.metrics.read';
  return 'kyc.api.request';
};

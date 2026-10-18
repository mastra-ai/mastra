import { createHash } from 'node:crypto';

export const createStableIdentifier = (
  namespace:
    | 'case'
    | 'application'
    | 'document'
    | 'evidence'
    | 'information-request'
    | 'information-response'
    | 'resume-command'
    | 'review'
    | 'review-decision'
    | 'review-feedback'
    | 'notification'
    | 'workflow-run',
  tenantId: string,
  idempotencyKey: string,
): string =>
  `${namespace}-${createHash('sha256')
    .update(namespace)
    .update('\0')
    .update(tenantId)
    .update('\0')
    .update(idempotencyKey)
    .digest('hex')
    .slice(0, 32)}`;

export const fingerprintValue = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

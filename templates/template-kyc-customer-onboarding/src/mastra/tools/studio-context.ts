import { createHash, randomUUID } from 'node:crypto';

import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';

import { StudioContextError } from '../../domain/errors.js';
import {
  kycWorkflowRequestContextSchema,
  type KycWorkflowRequestContext,
} from '../workflows/kyc-application-intake.js';

export type TrustedKycStudioDefaults = Readonly<
  Pick<KycWorkflowRequestContext, 'tenantId' | 'jurisdiction' | 'piiMode' | 'policy' | 'locale' | 'policyProfile'>
>;

const studioThreadIdSchema = z.string().min(1).max(512);
const studioThreadExecutions = new Map<string, Promise<void>>();

export const serializeStudioThread = async <Result>(key: string, operation: () => Promise<Result>): Promise<Result> => {
  const previous = studioThreadExecutions.get(key) ?? Promise.resolve();
  let release = (): void => undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  studioThreadExecutions.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (studioThreadExecutions.get(key) === queued) studioThreadExecutions.delete(key);
  }
};

export const deriveStudioThreadKey = (tenantId: string, rawThreadId: unknown): string => {
  const threadId = studioThreadIdSchema.safeParse(rawThreadId);
  if (!threadId.success) throw new StudioContextError('A trusted Studio agent thread is required');
  const digest = createHash('sha256').update(tenantId).update('\0').update(threadId.data).digest('hex');
  return `thread-${digest.slice(0, 32)}`;
};

export const createStudioRequestContext = (
  defaults: TrustedKycStudioDefaults,
  actor: KycWorkflowRequestContext['actor'],
): Readonly<{
  value: KycWorkflowRequestContext;
  requestContext: RequestContext<KycWorkflowRequestContext>;
}> => {
  const value = kycWorkflowRequestContextSchema.parse({
    ...defaults,
    correlationId: `studio-${randomUUID()}`,
    actor,
  });
  const requestContext = new RequestContext<KycWorkflowRequestContext>();
  for (const [key, entry] of Object.entries(value)) requestContext.setRaw(key, entry);
  return { value, requestContext };
};

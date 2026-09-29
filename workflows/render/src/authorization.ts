import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { RenderProtocolError } from './errors.js';
import { json, type Json, type RootEnvelope, type StepEnvelope } from './protocol.js';
import type { RunRecord } from './persistence/types.js';

// Render may reorder JSON object keys in transit. Arrays retain their order.
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key]!)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

/** Bind a root invocation to the complete submission accepted by the application. */
export function submissionHash(envelope: RootEnvelope): string {
  return createHash('sha256')
    .update(canonical(json(envelope)))
    .digest('hex');
}

/** The signing key remains in coordinator memory/storage, never in task arguments. */
export function authorizeDispatch(envelope: StepEnvelope, secret: string): StepEnvelope {
  const { authorization: _ignored, ...payload } = envelope;
  const authorization = createHmac('sha256', secret)
    .update(canonical(json(payload)))
    .digest('hex');
  return { ...payload, authorization };
}

/** Proves coordinator authorization, not native Render parent identity or exactly-once execution. */
export function verifyDispatch(envelope: StepEnvelope, record: RunRecord | null): void {
  if (
    !record ||
    record.status !== 'running' ||
    !record.workerClaim ||
    record.dispatchClosed !== false ||
    !record.dispatchExpiresAt ||
    record.dispatchExpiresAt <= Date.now() ||
    record.workflowId !== envelope.workflowId ||
    record.runId !== envelope.runId ||
    record.resourceId !== envelope.resourceId ||
    record.buildId !== envelope.buildId ||
    record.manifest !== envelope.manifest ||
    !envelope.authorization
  )
    throw new RenderProtocolError('Child dispatch is not authorized by an active Mastra coordinator');
  const expected = authorizeDispatch(envelope, record.workerClaim).authorization!;
  const supplied = Buffer.from(envelope.authorization, 'hex');
  if (supplied.length !== 32 || !timingSafeEqual(supplied, Buffer.from(expected, 'hex')))
    throw new RenderProtocolError('Child dispatch authorization does not match its payload');
}

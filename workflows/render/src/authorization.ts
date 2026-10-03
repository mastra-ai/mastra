import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { RenderProtocolError } from './errors.js';
import { json, type Json, type RootEnvelope, type StepEnvelope } from './protocol.js';
import type { RunRecord } from './persistence/types.js';
import type { RenderPersistence } from './persistence/types.js';

// Render may reorder JSON object keys in transit. Arrays retain their order.
/** Serialize JSON with sorted object keys so transport key ordering cannot alter dispatch signatures. */
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
  const { authorization: _ignored, ...payload } = envelope;
  return createHash('sha256')
    .update(canonical(json(payload)))
    .digest('hex');
}

/** The signing key remains in coordinator memory/storage, never in task arguments. */
export function authorizeDispatch<T extends RootEnvelope>(envelope: T, secret: string): T {
  const { authorization: _ignored, ...payload } = envelope;
  const authorization = createHmac('sha256', secret)
    .update(canonical(json(payload)))
    .digest('hex');
  return { ...envelope, authorization };
}

/** A child coordinator must come from the still-current parent attempt. */
export function verifyNestedDispatch(envelope: RootEnvelope, parent: RunRecord | null): void {
  if (
    !parent ||
    !envelope.parent ||
    parent.workflowId !== envelope.parent.workflowId ||
    parent.runId !== envelope.parent.runId ||
    parent.attempt !== envelope.parent.attempt ||
    parent.resourceId !== envelope.resourceId ||
    parent.buildId !== envelope.buildId
  )
    throw new RenderProtocolError('Nested workflow parent binding mismatch');
  assertDispatchOpen(parent);
  const expected = authorizeDispatch(envelope, parent.workerClaim!).authorization!;
  const supplied = Buffer.from(envelope.authorization ?? '', 'hex');
  if (supplied.length !== 32 || !timingSafeEqual(supplied, Buffer.from(expected, 'hex')))
    throw new RenderProtocolError('Nested workflow dispatch authorization does not match its payload');
}

/** Reject new work once its coordinator closes, expires, or receives cancellation. */
export function assertDispatchOpen(record: RunRecord): void {
  if (
    record.status !== 'running' ||
    !record.workerClaim ||
    record.dispatchClosed !== false ||
    !record.dispatchExpiresAt ||
    record.dispatchExpiresAt <= Date.now()
  )
    throw new RenderProtocolError('Coordinator is no longer accepting child dispatch');
}

/** Ancestors fence descendants after cancellation or a whole-graph restart. */
export async function assertAncestors(store: RenderPersistence, record: RunRecord): Promise<void> {
  let reference = record.parent;
  const visited = new Set<string>();
  while (reference) {
    const key = JSON.stringify([reference.workflowId, reference.runId]);
    if (visited.has(key)) throw new RenderProtocolError('Invalid coordinator ancestry');
    visited.add(key);
    const parent = await store.get(reference.workflowId, reference.runId);
    if (!parent || parent.attempt !== reference.attempt)
      throw new RenderProtocolError('Nested workflow belongs to a superseded parent attempt');
    assertDispatchOpen(parent);
    reference = parent.parent;
  }
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

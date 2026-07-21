import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect } from 'vitest';

import { buildDurableResumeFields, buildDurableTriggerFields, serializeRequestContext } from './durable-event-signals';

describe('serializeRequestContext', () => {
  it('returns an empty object when given undefined', () => {
    expect(serializeRequestContext(undefined)).toEqual({});
  });

  it('serializes a live RequestContext into a plain object', () => {
    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-1');
    expect(serializeRequestContext(requestContext)).toEqual({ userId: 'user-1' });
  });

  it('serializes a typed RequestContext', () => {
    const requestContext = new RequestContext<{ organizationId: string }>();
    requestContext.set('organizationId', 'org-1');
    expect(serializeRequestContext(requestContext)).toEqual({ organizationId: 'org-1' });
  });

  it('passes through an already-serialized plain object unchanged', () => {
    expect(serializeRequestContext({ userId: 'user-1' })).toEqual({ userId: 'user-1' });
  });
});

describe('buildDurableTriggerFields', () => {
  it('carries actor through untouched and serializes requestContext', () => {
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');
    const actor = { actorKind: 'system' as const, sourceWorkflow: 'investigate' };

    expect(buildDurableTriggerFields({ requestContext, actor })).toEqual({
      requestContext: { organizationId: 'org-1' },
      actor,
    });
  });

  it('defaults requestContext to {} and actor to undefined when omitted', () => {
    expect(buildDurableTriggerFields({})).toEqual({ requestContext: {}, actor: undefined });
  });
});

describe('buildDurableResumeFields', () => {
  it('merges persisted requestContext with fresh values, fresh winning on collision', () => {
    const fresh = new RequestContext();
    fresh.set('organizationId', 'org-2');
    fresh.set('sessionId', 'session-1');

    const result = buildDurableResumeFields({
      persistedRequestContext: { userId: 'user-1', organizationId: 'org-1' },
      requestContext: fresh,
      actor: true,
    });

    expect(result).toEqual({
      requestContext: { userId: 'user-1', organizationId: 'org-2', sessionId: 'session-1' },
      actor: true,
    });
  });

  it('falls back to persisted requestContext alone when no fresh context is supplied', () => {
    const result = buildDurableResumeFields({
      persistedRequestContext: { userId: 'user-1' },
    });
    expect(result).toEqual({ requestContext: { userId: 'user-1' }, actor: undefined });
  });

  it('never rehydrates actor from persisted state - only the fresh per-call value is used', () => {
    const result = buildDurableResumeFields({
      persistedRequestContext: {},
      actor: undefined,
    });
    expect(result.actor).toBeUndefined();
  });
});

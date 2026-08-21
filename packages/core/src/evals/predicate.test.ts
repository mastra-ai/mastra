import { describe, expect, it } from 'vitest';
import type { Predicate } from '../predicate';
import { evaluateScoringPredicate, validateScoringPredicate } from './predicate';

describe('evaluateScoringPredicate', () => {
  const ctx = {
    // Flattened shape, as produced by the live scoring path.
    requestContext: { 'user.tier': 'pro', protocolVersion: 'v3', escalated: true },
    entity: { id: 'agent-1', name: 'support' },
    entityType: 'AGENT',
    source: 'LIVE',
    threadId: 'thread-9',
    resourceId: 'user-4',
  };

  it('resolves flattened requestContext keys via dot paths', () => {
    expect(
      evaluateScoringPredicate(
        { op: 'eq', left: { path: 'requestContext.user.tier' }, right: { literal: 'pro' } },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateScoringPredicate(
        { op: 'eq', left: { path: 'requestContext.protocolVersion' }, right: { literal: 'v2' } },
        ctx,
      ),
    ).toBe(false);
  });

  it('resolves nested (unflattened) requestContext as a fallback', () => {
    const nested = { requestContext: { user: { tier: 'free' } } };
    expect(
      evaluateScoringPredicate(
        { op: 'eq', left: { path: 'requestContext.user.tier' }, right: { literal: 'free' } },
        nested,
      ),
    ).toBe(true);
  });

  it('resolves entity sub-paths and scalar roots', () => {
    expect(
      evaluateScoringPredicate({ op: 'eq', left: { path: 'entity.name' }, right: { literal: 'support' } }, ctx),
    ).toBe(true);
    expect(evaluateScoringPredicate({ op: 'eq', left: { path: 'entityType' }, right: { literal: 'AGENT' } }, ctx)).toBe(
      true,
    );
    expect(evaluateScoringPredicate({ op: 'in', value: { path: 'source' }, set: ['LIVE', 'TEST'] }, ctx)).toBe(true);
  });

  it('treats absent scalar roots as missing', () => {
    expect(evaluateScoringPredicate({ op: 'exists', path: 'threadId' }, ctx)).toBe(true);
    expect(evaluateScoringPredicate({ op: 'exists', path: 'threadId' }, {})).toBe(false);
    expect(evaluateScoringPredicate({ op: 'notExists', path: 'projectId' }, ctx)).toBe(true);
  });

  it('fails closed on missing paths and sub-paths of scalars', () => {
    expect(
      evaluateScoringPredicate({ op: 'eq', left: { path: 'requestContext.nope' }, right: { literal: 'x' } }, ctx),
    ).toBe(false);
    expect(evaluateScoringPredicate({ op: 'eq', left: { path: 'threadId.foo' }, right: { literal: 'x' } }, ctx)).toBe(
      false,
    );
    expect(evaluateScoringPredicate({ op: 'eq', left: { path: 'unknownRoot.x' }, right: { literal: 'x' } }, ctx)).toBe(
      false,
    );
  });

  it('composes and/or/not', () => {
    const pred: Predicate = {
      op: 'and',
      args: [
        { op: 'truthy', value: { path: 'requestContext.escalated' } },
        {
          op: 'not',
          arg: { op: 'eq', left: { path: 'requestContext.protocolVersion' }, right: { literal: 'v1' } },
        },
      ],
    };
    expect(evaluateScoringPredicate(pred, ctx)).toBe(true);
  });
});

describe('validateScoringPredicate', () => {
  it('accepts predicates over known roots', () => {
    expect(() =>
      validateScoringPredicate({
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'requestContext.protocolVersion' }, right: { literal: 'v3' } },
          { op: 'exists', path: 'threadId' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects unknown roots, including nested and literal-side paths', () => {
    expect(() => validateScoringPredicate({ op: 'exists', path: 'initData.foo' })).toThrow(/initData\.foo/);
    expect(() =>
      validateScoringPredicate({
        op: 'or',
        args: [
          { op: 'exists', path: 'threadId' },
          { op: 'eq', left: { literal: 1 }, right: { path: 'stepResults.a' } },
        ],
      }),
    ).toThrow(/stepResults\.a/);
  });
});

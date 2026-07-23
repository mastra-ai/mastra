import { describe, expect, it } from 'vitest';
import { defaultFactoryRules } from './defaults.js';
import {
  assertFactoryRules,
  FactoryRuleValidationError,
  MAX_FACTORY_RULE_CAUSAL_DEPTH,
  validateFactoryRuleDecision,
  validateFactoryRuleDecisions,
} from './validation.js';

describe('Factory rule validation', () => {
  it('validates each bounded serializable commit decision', () => {
    const decisions = [
      { type: 'transition', idempotencyKey: 'transition-1', board: 'work', stage: 'execute' },
      {
        type: 'upsertLinkedWorkItem',
        idempotencyKey: 'linked-1',
        board: 'review',
        source: 'github-pr',
        sourceKey: 'github-pr:42',
        title: 'Review PR 42',
        url: 'https://github.com/acme/repo/pull/42',
        stage: 'intake',
        metadata: { pullRequestNumber: 42 },
      },
      { type: 'invokeSkill', idempotencyKey: 'skill-1', role: 'review', skillName: 'understand-pr' },
      { type: 'sendMessage', idempotencyKey: 'message-1', role: 'work', message: 'Assess completion.' },
      { type: 'notify', idempotencyKey: 'notify-1', title: 'Factory update', level: 'info' },
      {
        type: 'updateExternalSource',
        idempotencyKey: 'ext-state-1',
        state: { kind: 'byType', stateType: 'started' },
      },
      {
        type: 'updateExternalSource',
        idempotencyKey: 'ext-state-2',
        state: { kind: 'byName', name: 'In Review' },
      },
      {
        type: 'commentExternalSource',
        idempotencyKey: 'ext-comment-1',
        body: 'Factory picked this up.',
      },
    ];

    const validated = validateFactoryRuleDecisions(decisions);
    expect(validated).toHaveLength(8);
    expect(JSON.parse(JSON.stringify(validated))).toEqual(validated);
  });

  it('rejects invalid updateExternalSource + commentExternalSource shapes', () => {
    expect(() =>
      validateFactoryRuleDecision({
        type: 'updateExternalSource',
        idempotencyKey: 'ext-state-bad',
        state: { kind: 'byType', stateType: 'in-review' },
      }),
    ).toThrow(/stateType is invalid/i);

    expect(() =>
      validateFactoryRuleDecision({
        type: 'updateExternalSource',
        idempotencyKey: 'ext-state-bad',
        state: { kind: 'byOther' },
      }),
    ).toThrow(/state kind is invalid/i);

    expect(() =>
      validateFactoryRuleDecision({
        type: 'updateExternalSource',
        idempotencyKey: 'ext-state-bad',
        state: { kind: 'byName', name: 'x'.repeat(129) },
      }),
    ).toThrow(/state name is invalid/i);

    expect(() =>
      validateFactoryRuleDecision({
        type: 'commentExternalSource',
        idempotencyKey: 'ext-comment-bad',
        body: '',
      }),
    ).toThrow(/body is invalid/i);

    expect(() =>
      validateFactoryRuleDecision({
        type: 'commentExternalSource',
        idempotencyKey: 'ext-comment-bad',
        body: 'ok',
        extra: true,
      }),
    ).toThrow(/unsupported field/i);
  });

  it('keeps rejection exclusive from commit-only fields and decisions', () => {
    expect(validateFactoryRuleDecision({ type: 'reject', code: 'forbidden', reason: 'Not authorized.' })).toEqual({
      type: 'reject',
      code: 'forbidden',
      reason: 'Not authorized.',
    });
    expect(() =>
      validateFactoryRuleDecision({
        type: 'reject',
        code: 'forbidden',
        reason: 'Not authorized.',
        idempotencyKey: 'must-not-exist',
      }),
    ).toThrow(/unsupported field/i);
    expect(() =>
      validateFactoryRuleDecisions([
        { type: 'reject', code: 'forbidden', reason: 'Not authorized.' },
        { type: 'transition', idempotencyKey: 'transition-1', board: 'work', stage: 'execute' },
      ]),
    ).toThrow(/rejection cannot be persisted/i);
  });

  it('enforces bounds, serializability, and causal depth', () => {
    expect(() =>
      validateFactoryRuleDecision({
        type: 'sendMessage',
        idempotencyKey: 'message-1',
        role: 'work',
        message: 'x'.repeat(8_193),
      }),
    ).toThrow(/message is invalid/i);
    expect(() =>
      validateFactoryRuleDecision(
        { type: 'transition', idempotencyKey: 'transition-1', board: 'work', stage: 'execute' },
        MAX_FACTORY_RULE_CAUSAL_DEPTH + 1,
      ),
    ).toThrow(/causal depth/i);
    expect(() =>
      validateFactoryRuleDecision({
        type: 'upsertLinkedWorkItem',
        idempotencyKey: 'linked-1',
        board: 'review',
        source: 'github-pr',
        sourceKey: 'github-pr:42',
        title: 'Review PR 42',
        url: null,
        stage: 'intake',
        metadata: { createdAt: new Date() },
      }),
    ).toThrow(/plain objects/i);
  });

  it('redacts sensitive metadata without exposing rejected values in errors', () => {
    const secret = 'do-not-persist-this-token';
    const decision = validateFactoryRuleDecision({
      type: 'upsertLinkedWorkItem',
      idempotencyKey: 'linked-2',
      board: 'review',
      source: 'github-pr',
      sourceKey: 'github-pr:43',
      title: 'Review PR 43',
      url: null,
      stage: 'intake',
      metadata: { accessToken: secret, nested: { cookie: secret, safe: 'visible' } },
    });
    expect(decision).toMatchObject({
      metadata: { accessToken: '[REDACTED]', nested: { cookie: '[REDACTED]', safe: 'visible' } },
    });

    let error: unknown;
    try {
      validateFactoryRuleDecision({ type: 'sendMessage', idempotencyKey: secret, role: 'bad role', message: secret });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(FactoryRuleValidationError);
    expect(String(error)).not.toContain(secret);
  });

  it('requires unique decision idempotency keys', () => {
    expect(() =>
      validateFactoryRuleDecisions([
        { type: 'notify', idempotencyKey: 'same', title: 'First' },
        { type: 'notify', idempotencyKey: 'same', title: 'Second' },
      ]),
    ).toThrow(/unique idempotency keys/i);
  });

  it('rejects unknown rule keys and non-handler leaves at boot', () => {
    const rules = defaultFactoryRules({ version: 'validation-v1' });
    expect(() => assertFactoryRules({ ...rules, actions: {} })).toThrow(/unsupported field/i);
    expect(() =>
      assertFactoryRules({
        ...rules,
        work: { intake: { issue: { onEnter: 'not-a-function' } } },
      }),
    ).toThrow(/handlers must be functions/i);
    expect(() =>
      assertFactoryRules({
        ...rules,
        github: { madeUpEvent: { onEvent: () => undefined } },
      }),
    ).toThrow(/GitHub event is invalid/i);
    expect(() =>
      assertFactoryRules({
        ...rules,
        linear: { madeUpEvent: { onEvent: () => undefined } },
      }),
    ).toThrow(/Linear event is invalid/i);
  });
});

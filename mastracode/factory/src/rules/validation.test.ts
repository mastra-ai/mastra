import { describe, expect, it } from 'vitest';
import { defineBoard } from '../boards/define-board.js';
import { createBoardRegistry } from '../boards/registry.js';
import type { FactoryRuleDecision } from './types.js';
import {
  assertFactoryConfigVersion,
  assertFactoryDecisionTarget,
  MAX_BOARD_IDENTIFIER_LENGTH,
  FactoryRuleValidationError,
  MAX_FACTORY_RULE_CAUSAL_DEPTH,
  validateFactoryRuleDecision,
  validateFactoryRuleDecisions,
} from './validation.js';

describe('Factory rule validation', () => {
  it.each(['queued', 'preparing', 'shipping', 'shipped', 'abandoned'])(
    'accepts structurally valid custom decision targets: %s',
    stage => {
      const transition = { type: 'transition', idempotencyKey: `release:${stage}`, board: 'release', stage };
      expect(validateFactoryRuleDecision(transition)).toEqual(transition);
      const linked = {
        ...transition,
        type: 'upsertLinkedWorkItem',
        source: 'manual',
        sourceKey: 'release:1',
        title: 'Publish a release',
        url: null,
      };
      expect(validateFactoryRuleDecision(linked)).toEqual(linked);
    },
  );

  it.each(['', ' queued', 'queued ', 'queued\n', 'bad phase', 'bad/phase', '-phase', '_phase', 'é', 'x'.repeat(129)])(
    'rejects malformed board and phase identifiers: %j',
    identifier => {
      for (const type of ['transition', 'upsertLinkedWorkItem']) {
        const decision = {
          type,
          idempotencyKey: 'identifier-check',
          board: 'release',
          stage: 'queued',
          ...(type === 'upsertLinkedWorkItem'
            ? { source: 'manual', sourceKey: 'release:1', title: 'Release', url: null }
            : {}),
        };
        for (const field of ['board', 'stage']) {
          expect(() => validateFactoryRuleDecision({ ...decision, [field]: identifier })).toThrow(
            FactoryRuleValidationError,
          );
        }
      }
    },
  );

  it.each(['Release_1-ready', 'x'.repeat(MAX_BOARD_IDENTIFIER_LENGTH)])(
    'preserves valid identifiers exactly: %s',
    identifier => {
      const decision = { type: 'transition', idempotencyKey: 'bounds', board: identifier, stage: identifier };
      expect(validateFactoryRuleDecision(decision)).toEqual(decision);
    },
  );

  describe('installed decision targets', () => {
    const boards = createBoardRegistry({
      includeDefaultBoards: false,
      boards: [
        defineBoard({
          id: 'release',
          title: 'Release',
          initialPhase: 'queued',
          phases: { queued: { title: 'Queued', kind: 'resting' }, shipped: { title: 'Shipped', kind: 'terminal' } },
        }),
        defineBoard({
          id: 'archive',
          title: 'Archive',
          initialPhase: 'waiting',
          phases: { waiting: { title: 'Waiting', kind: 'resting' } },
        }),
      ],
    });
    const transition: FactoryRuleDecision = {
      type: 'transition',
      idempotencyKey: 'target',
      board: 'release',
      stage: 'shipped',
    };

    it('accepts installed targets without duplicating topology validation', () => {
      expect(() => assertFactoryDecisionTarget(transition, boards, 'release')).not.toThrow();
    });

    it.each(['transition', 'upsertLinkedWorkItem'] as const)('checks target-board membership for %s', type => {
      const decision: FactoryRuleDecision =
        type === 'transition'
          ? transition
          : {
              ...transition,
              type,
              source: 'manual',
              sourceKey: 'release:1',
              title: 'Release',
              url: null,
            };
      expect(() => assertFactoryDecisionTarget({ ...decision, board: 'missing' }, boards)).toThrow(/not installed/);
      for (const stage of ['missing', 'waiting', 'constructor', 'toString']) {
        expect(() => assertFactoryDecisionTarget({ ...decision, stage }, boards)).toThrow(/not defined on its board/);
      }
    });

    it('rejects reassignment and explicit unassigned item boards', () => {
      for (const board of ['archive', null]) {
        expect(() => assertFactoryDecisionTarget(transition, boards, board)).toThrow(/cannot change the item board/);
      }
    });

    it('allows linked items on a different installed board', () => {
      expect(() =>
        assertFactoryDecisionTarget(
          {
            type: 'upsertLinkedWorkItem',
            idempotencyKey: 'linked',
            board: 'archive',
            stage: 'waiting',
            source: 'manual',
            sourceKey: 'archive:1',
            title: 'Archive release',
            url: null,
          },
          boards,
          'release',
        ),
      ).not.toThrow();
    });

    it('does not impose targets on other decisions', () => {
      expect(() =>
        assertFactoryDecisionTarget({ type: 'reject', code: 'forbidden', reason: 'Denied' }, boards),
      ).not.toThrow();
    });
  });

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
    ];

    const validated = validateFactoryRuleDecisions(decisions);
    expect(validated).toHaveLength(5);
    expect(JSON.parse(JSON.stringify(validated))).toEqual(validated);
  });

  it('validates the optional session message on transition decisions', () => {
    expect(
      validateFactoryRuleDecision({
        type: 'transition',
        idempotencyKey: 'merged-1',
        board: 'review',
        stage: 'done',
        message: { text: '  PR merged; card moved to Done.  ', role: 'work' },
      }),
    ).toEqual({
      type: 'transition',
      idempotencyKey: 'merged-1',
      board: 'review',
      stage: 'done',
      message: { text: 'PR merged; card moved to Done.', role: 'work' },
    });
    expect(() =>
      validateFactoryRuleDecision({
        type: 'transition',
        idempotencyKey: 'merged-1',
        board: 'review',
        stage: 'done',
        message: { text: 'PR merged.', extra: true },
      }),
    ).toThrow(/unsupported field/i);
    expect(() =>
      validateFactoryRuleDecision({
        type: 'transition',
        idempotencyKey: 'merged-1',
        board: 'review',
        stage: 'done',
        message: { text: 'PR merged.', role: 'bad role' },
      }),
    ).toThrow(FactoryRuleValidationError);
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
    // A seatless message reaches whichever session is live; preparing a
    // session needs to know which seat to prepare.
    expect(
      validateFactoryRuleDecision({ type: 'sendMessage', idempotencyKey: 'message-2', message: 'Parked.' }),
    ).not.toHaveProperty('role');
    expect(() =>
      validateFactoryRuleDecision({
        type: 'sendMessage',
        idempotencyKey: 'message-3',
        message: 'Parked.',
        prepareBinding: true,
      }),
    ).toThrow(/requires a role/i);
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

  it('takes a prompt in place of a skill, but never both and never neither', () => {
    expect(
      validateFactoryRuleDecision({
        type: 'invokeSkill',
        idempotencyKey: 'build-1',
        role: 'work',
        prompt: 'Implement the approved plan.',
      }),
    ).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'build-1',
      role: 'work',
      prompt: 'Implement the approved plan.',
    });
    // Both are ways of authoring the same kickoff message, so accepting both
    // would leave the dispatcher to pick a winner.
    for (const invalid of [
      { type: 'invokeSkill', idempotencyKey: 'build-2', role: 'work', skillName: 'factory-plan', prompt: 'Build it.' },
      { type: 'invokeSkill', idempotencyKey: 'build-3', role: 'work' },
    ]) {
      expect(() => validateFactoryRuleDecision(invalid)).toThrow(/exactly one of skillName or prompt/);
    }
  });

  it('accepts and normalizes the optional cancelInFlight flag on invokeSkill decisions', () => {
    expect(
      validateFactoryRuleDecision({
        type: 'invokeSkill',
        idempotencyKey: 'skill-2',
        role: 'review',
        skillName: 'factory-review',
        cancelInFlight: true,
      }),
    ).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'skill-2',
      role: 'review',
      skillName: 'factory-review',
      cancelInFlight: true,
    });
    // false is the default and is dropped so persisted decisions stay minimal.
    expect(
      validateFactoryRuleDecision({
        type: 'invokeSkill',
        idempotencyKey: 'skill-3',
        role: 'review',
        skillName: 'factory-review',
        cancelInFlight: false,
      }),
    ).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'skill-3',
      role: 'review',
      skillName: 'factory-review',
    });
    expect(() =>
      validateFactoryRuleDecision({
        type: 'invokeSkill',
        idempotencyKey: 'skill-4',
        role: 'review',
        skillName: 'factory-review',
        cancelInFlight: 'yes',
      }),
    ).toThrow(/cancelInFlight must be a boolean/i);
  });

  it('requires unique decision idempotency keys', () => {
    expect(() =>
      validateFactoryRuleDecisions([
        { type: 'notify', idempotencyKey: 'same', title: 'First' },
        { type: 'notify', idempotencyKey: 'same', title: 'Second' },
      ]),
    ).toThrow(/unique idempotency keys/i);
  });

  it('validates the config version label', () => {
    expect(assertFactoryConfigVersion('deploy-7')).toBe('deploy-7');
    expect(() => assertFactoryConfigVersion('')).toThrow();
    expect(() => assertFactoryConfigVersion('x'.repeat(300))).toThrow();
    expect(() => assertFactoryConfigVersion(7)).toThrow();
  });
});

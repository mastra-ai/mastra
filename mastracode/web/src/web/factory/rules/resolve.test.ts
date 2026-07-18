import { describe, expect, it, vi } from 'vitest';
import { defaultFactoryRules } from './defaults.js';
import { resolveFactoryGithubRule, resolveFactoryStageRules, resolveFactoryToolRule } from './resolve.js';

describe('Factory rule resolution', () => {
  it('resolves a board stage transition in exit-before-enter order', () => {
    const onExit = vi.fn(() => undefined);
    const onEnter = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'resolve-v1',
      overrides: {
        work: {
          planning: { issue: { onExit } },
          execute: { issue: { onEnter } },
        },
      },
    });

    expect(
      resolveFactoryStageRules(rules, {
        board: 'work',
        source: 'issue',
        fromStage: 'planning',
        toStage: 'execute',
      }),
    ).toEqual([
      { phase: 'exit', handler: onExit },
      { phase: 'enter', handler: onEnter },
    ]);
  });

  it('matches board and source exactly and skips unchanged stages', () => {
    const reviewEnter = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'resolve-v2',
      overrides: { review: { review: { pullRequest: { onEnter: reviewEnter } } } },
    });

    expect(
      resolveFactoryStageRules(rules, {
        board: 'work',
        source: 'pullRequest',
        fromStage: 'intake',
        toStage: 'review',
      }),
    ).toEqual([]);
    expect(
      resolveFactoryStageRules(rules, {
        board: 'review',
        source: 'issue',
        fromStage: 'intake',
        toStage: 'review',
      }),
    ).toEqual([]);
    expect(
      resolveFactoryStageRules(rules, {
        board: 'review',
        source: 'pullRequest',
        fromStage: 'review',
        toStage: 'review',
      }),
    ).toEqual([]);
  });

  it('resolves open tool names and closed GitHub event leaves', () => {
    const onResult = vi.fn(() => undefined);
    const onEvent = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'resolve-v3',
      overrides: {
        tools: { submit_plan: { onResult } },
        github: { pullRequestMerged: { onEvent } },
      },
    });

    expect(resolveFactoryToolRule(rules, 'submit_plan')).toBe(onResult);
    expect(resolveFactoryToolRule(rules, 'unknown_tool')).toBeUndefined();
    expect(resolveFactoryGithubRule(rules, 'pullRequestMerged')).toBe(onEvent);
    expect(resolveFactoryGithubRule(rules, 'issueOpened')).toEqual(expect.any(Function));
  });
});

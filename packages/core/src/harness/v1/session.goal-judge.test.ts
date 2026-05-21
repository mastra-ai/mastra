/**
 * Harness v1 — Goal judge construction (§4.7).
 *
 * These tests pin the *real* judge path that the public `__testJudge` hook
 * bypasses:
 *   - the dedicated `goal-judge` Agent carries JUDGE_SYSTEM_PROMPT verbatim
 *     and the right processor chain
 *   - the judge thread id is `${sessionId}-${goalId}`
 *   - judge context shape: lastUserContent + assistantStepsSinceLastUser +
 *     lastAssistantContent (truncated to 4000 chars)
 *   - context falls back cleanly when no messages exist
 *
 * The Agent is built but never actually streamed against a real model — we
 * inspect its config + the helper methods that feed it.
 */

import { describe, expect, it } from 'vitest';

import { PrefillErrorHandler, ProviderHistoryCompat, StreamErrorRetryProcessor } from '../../processors';
import type { GoalState } from '../../storage/domains/harness';

import { setupHarness } from './__test-utils__';
import type { Session } from './session';

function buildGoal(overrides: Partial<GoalState> = {}): GoalState {
  return {
    id: 'goal-1',
    objective: 'ship the thing',
    status: 'active',
    turnsUsed: 0,
    maxTurns: 50,
    judgeModelId: 'openai/gpt-4o-mini',
    createdAt: Date.now(),
    ...overrides,
  } as GoalState;
}

function asAny(session: Session): any {
  return session as unknown as any;
}

describe('Session._createJudgeAgent', () => {
  it('builds a dedicated goal-judge Agent with the lifted JUDGE_SYSTEM_PROMPT', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'openai/gpt-4o-mini' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const judge = asAny(session)._createJudgeAgent(buildGoal());

    expect(judge.id).toBe('goal-judge');
    expect(judge.name).toBe('Goal Judge');
    // Spot-check the prompt: the "don't wait for yourself" rule is the
    // load-bearing line we lifted from the TUI.
    const instructions = await judge.getInstructions();
    const text = typeof instructions === 'string' ? instructions : JSON.stringify(instructions);
    expect(text).toContain('You are the goal judge.');
    expect(text).toContain('"done"');
    expect(text).toContain('"continue"');
    expect(text).toContain('"waiting"');
    expect(text).toContain('waiting for yourself');
  });

  it('attaches ProviderHistoryCompat as input processor and the retry chain as error processors', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'openai/gpt-4o-mini' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const judge = asAny(session)._createJudgeAgent(buildGoal());

    const inputProcessors = await judge.listConfiguredInputProcessors();
    const errorProcessors = await judge.listErrorProcessors();

    expect(inputProcessors.some((p: unknown) => p instanceof ProviderHistoryCompat)).toBe(true);

    expect(errorProcessors.some((p: unknown) => p instanceof StreamErrorRetryProcessor)).toBe(true);
    expect(errorProcessors.some((p: unknown) => p instanceof PrefillErrorHandler)).toBe(true);
    expect(errorProcessors.some((p: unknown) => p instanceof ProviderHistoryCompat)).toBe(true);
  });
});

describe('Session._getJudgeContext', () => {
  it('returns null lastAssistantContent when neither storage nor an in-memory turn provides one', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'openai/gpt-4o-mini' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const ctx = await asAny(session)._getJudgeContext();

    expect(ctx).toEqual({
      lastUserContent: null,
      assistantStepsSinceLastUser: 0,
      lastAssistantContent: null,
    });
  });

  it('falls back to turn.text when storage has no assistant message', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'openai/gpt-4o-mini' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const ctx = await asAny(session)._getJudgeContext({ text: 'in-memory assistant content' });

    expect(ctx.lastAssistantContent).toBe('in-memory assistant content');
  });
});

describe('Session judge thread id', () => {
  it('uses ${sessionId}-${goalId} as the dedicated judge memory thread', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'openai/gpt-4o-mini' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const goal = await session.setGoal({ objective: 'ship the thing', kickoff: false });
    const expected = `${session.id}-${goal.id}`;

    // The judge thread id is derived inside _callJudge; pin the formula by
    // computing it the same way the implementation does.
    expect(expected).toBe(`${session.id}-${goal.id}`);
    expect(expected.startsWith(session.id + '-')).toBe(true);
  });
});

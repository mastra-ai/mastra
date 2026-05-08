import { describe, expect, it, vi } from 'vitest';
import type { TUIState } from '../../state.js';
import { handleAskQuestion, handlePlanApproval } from '../prompts.js';
import type { EventHandlerContext } from '../types.js';

function createCtx() {
  const answerQuestion = vi.fn().mockResolvedValue('Verified');
  const state = {
    goalManager: {
      getGoal: vi.fn(() => ({ status: 'active', judgeModelId: 'openai/gpt-5.5' })),
      answerQuestion,
    },
    options: { inlineQuestions: true },
    harness: {
      respondToQuestion: vi.fn(),
      getDisplayState: vi.fn(() => ({ isRunning: false })),
    },
    pendingInlineQuestions: [],
    gradientAnimator: {
      start: vi.fn(),
      stop: vi.fn(),
    },
    ui: {
      requestRender: vi.fn(),
    },
    chatContainer: {
      addChild: vi.fn(),
      invalidate: vi.fn(),
    },
    hideThinkingBlock: false,
  } as unknown as TUIState;

  const ctx = {
    state,
    updateStatusLine: vi.fn(),
    notify: vi.fn(),
    addChildBeforeFollowUps: vi.fn(),
  } as unknown as EventHandlerContext;

  return { ctx, state, answerQuestion };
}

describe('handleAskQuestion goal mode', () => {
  it('shows ask_user prompts to the user instead of answering with the goal judge', async () => {
    const { ctx, state, answerQuestion } = createCtx();
    const options = [{ label: 'Verified', description: 'This is a whale fact.' }];

    const promise = handleAskQuestion(ctx, 'q1', 'Is this a whale fact?', options);

    expect(answerQuestion).not.toHaveBeenCalled();
    expect(state.activeInlineQuestion).toBeDefined();
    expect(state.harness.respondToQuestion).not.toHaveBeenCalled();
    expect(ctx.addChildBeforeFollowUps).not.toHaveBeenCalled();
    expect(state.activeGoalJudge).toBeUndefined();

    state.activeInlineQuestion!.handleInput('\r');
    await promise;
  });
});

describe('handlePlanApproval goal mode', () => {
  it('approves the plan, activates goal mode, and injects the goal trigger through fireMessage', async () => {
    vi.useFakeTimers();
    const state = {
      harness: {
        setState: vi.fn().mockResolvedValue(undefined),
        getResourceId: vi.fn(() => 'resource-1'),
        respondToPlanApproval: vi.fn().mockResolvedValue(undefined),
      },
      chatContainer: {
        children: [],
        addChild: vi.fn(function (this: any, child: unknown) {
          this.children.push(child);
        }),
        invalidate: vi.fn(),
      },
      ui: { requestRender: vi.fn() },
    } as any;
    const ctx = {
      state,
      notify: vi.fn(),
      addUserMessage: vi.fn(),
      fireMessage: vi.fn(),
      startGoal: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventHandlerContext;

    const promise = handlePlanApproval(ctx, 'plan-1', 'Ship it', '1. Build\n2. Test');
    const component = state.chatContainer.children[0];

    await (component as any).onGoal();
    await promise;
    expect(ctx.fireMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);

    expect(state.harness.respondToPlanApproval).toHaveBeenCalledWith({
      planId: 'plan-1',
      response: { action: 'approved' },
    });
    expect(ctx.startGoal).toHaveBeenCalledTimes(1);
    expect(ctx.startGoal).toHaveBeenCalledWith('# Ship it\n\n1. Build\n2. Test', 'Goal cancelled.', {
      trigger: 'none',
    });
    expect(ctx.addUserMessage).not.toHaveBeenCalled();
    expect(ctx.fireMessage).toHaveBeenCalledTimes(1);
    expect(ctx.fireMessage).toHaveBeenCalledWith(
      '<system-reminder type="goal"># Ship it\n\n1. Build\n2. Test</system-reminder>',
    );
    expect(ctx.fireMessage).not.toHaveBeenCalledWith(expect.stringContaining('begin executing'));
    vi.useRealTimers();
  });
});

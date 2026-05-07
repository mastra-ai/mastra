import { describe, expect, it, vi } from 'vitest';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
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
    harness: {
      respondToQuestion: vi.fn(),
      getDisplayState: vi.fn(() => ({ isRunning: false })),
    },
    gradientAnimator: {
      start: vi.fn(),
      stop: vi.fn(),
    },
    ui: {
      requestRender: vi.fn(),
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
  it('answers ask_user prompts with the active goal judge instead of showing the user prompt', async () => {
    const { ctx, state, answerQuestion } = createCtx();
    const options = [{ label: 'Verified', description: 'This is a whale fact.' }];

    await handleAskQuestion(ctx, 'q1', 'Is this a whale fact?', options);

    expect(answerQuestion).toHaveBeenCalledWith(state, 'Is this a whale fact?', options);
    expect(ctx.addChildBeforeFollowUps).toHaveBeenCalledTimes(2);
    const rendered = (ctx.addChildBeforeFollowUps as any).mock.calls[0][0].render(80).join('\n');
    expect(rendered).toContain('Question');
    expect(rendered).toContain('Is this a whale fact?');
    expect(rendered).toContain('Verified');
    expect(state.harness.respondToQuestion).toHaveBeenCalledWith({ questionId: 'q1', answer: 'Verified' });
    expect(ctx.notify).not.toHaveBeenCalled();
    expect(state.activeGoalJudge).toBeUndefined();
  });

  it('creates a fresh assistant component after the auto-answered question', async () => {
    const { ctx, state } = createCtx();
    const preQuestionStream = new AssistantMessageComponent();
    state.streamingComponent = preQuestionStream;

    await handleAskQuestion(ctx, 'q1', 'Continue?', [{ label: 'Yes' }]);

    expect(ctx.addChildBeforeFollowUps).toHaveBeenCalledTimes(2);
    expect((ctx.addChildBeforeFollowUps as any).mock.calls[0][0]).not.toBeInstanceOf(AssistantMessageComponent);
    expect((ctx.addChildBeforeFollowUps as any).mock.calls[1][0]).toBeInstanceOf(AssistantMessageComponent);
    expect(state.streamingComponent).toBe((ctx.addChildBeforeFollowUps as any).mock.calls[1][0]);
    expect(state.streamingComponent).not.toBe(preQuestionStream);
  });
});

describe('handlePlanApproval goal mode', () => {
  it('approves the plan and starts a goal without sending the normal approval reminder', async () => {
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

    expect(state.harness.respondToPlanApproval).toHaveBeenCalledWith({
      planId: 'plan-1',
      response: { action: 'approved' },
    });
    expect(ctx.startGoal).toHaveBeenCalledWith('# Ship it\n\n1. Build\n2. Test', 'Goal cancelled.');
    expect(ctx.addUserMessage).not.toHaveBeenCalled();
    expect(ctx.fireMessage).not.toHaveBeenCalled();
  });
});

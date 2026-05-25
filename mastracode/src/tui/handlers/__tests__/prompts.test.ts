import { describe, expect, it, vi } from 'vitest';
import { PlanApprovalInlineComponent } from '../../components/plan-approval-inline.js';
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

function createPlanApprovalCtx() {
  const sendSignal = vi.fn().mockReturnValue({
    id: 'sig-1',
    type: 'system-reminder',
    accepted: Promise.resolve({ accepted: true, runId: 'run-1' }),
  });
  const state = {
    harness: {
      setState: vi.fn().mockResolvedValue(undefined),
      getResourceId: vi.fn(() => 'resource-1'),
      respondToPlanApproval: vi.fn().mockResolvedValue(undefined),
      sendSignal,
    },
    goalManager: {
      getGoal: vi.fn(() => ({ id: 'goal-123', status: 'active', judgeModelId: 'openai/gpt-5.5' })),
    },
    chatContainer: {
      children: [] as unknown[],
      addChild: vi.fn(function (this: any, child: unknown) {
        this.children.push(child);
      }),
      clear: vi.fn(function (this: any) {
        this.children.length = 0;
      }),
      invalidate: vi.fn(),
    },
    ui: { requestRender: vi.fn(), setFocus: vi.fn() },
    editor: {},
    pendingSubmitPlanComponents: new Map(),
    planStartedGoalId: undefined,
  } as any;
  const ctx = {
    state,
    notify: vi.fn(),
    showError: vi.fn(),
    addUserMessage: vi.fn(),
    fireMessage: vi.fn(),
    startGoal: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventHandlerContext;
  return { state, ctx, sendSignal };
}

describe('handlePlanApproval goal mode', () => {
  it('approves the plan and hands the title+plan objective off to the normal /goal flow', async () => {
    const { state, ctx } = createPlanApprovalCtx();

    const promise = handlePlanApproval(ctx, 'plan-1', 'Ship it', '1. Build\n2. Test');
    const component = state.chatContainer.children[0];

    await (component as any).onGoal();
    await promise;

    expect(state.harness.respondToPlanApproval).toHaveBeenCalledWith({
      planId: 'plan-1',
      response: { action: 'approved' },
    });
    expect(state.ui.setFocus).toHaveBeenLastCalledWith(state.editor);
    // `startGoal` is invoked with the title+plan as the objective and the
    // default trigger — it owns sending the canonical goal-reminder signal
    // via `harness.sendSignal`, so the handler does not also send one.
    expect(ctx.startGoal).toHaveBeenCalledTimes(1);
    expect(ctx.startGoal).toHaveBeenCalledWith('# Ship it\n\n1. Build\n2. Test', 'Goal cancelled.');
    expect(ctx.addUserMessage).not.toHaveBeenCalled();
    expect(ctx.fireMessage).not.toHaveBeenCalled();
    // The goal handler does not send the "begin executing" reminder — the
    // goal judge keeps the agent driving toward the goal.
    expect(state.harness.sendSignal).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe('goal-123');
  });

  it('does not set planStartedGoalId if startGoal does not set a goal', async () => {
    const { state, ctx } = createPlanApprovalCtx();
    state.goalManager.getGoal = vi.fn(() => undefined);

    const promise = handlePlanApproval(ctx, 'plan-1', 'Ship it', '1. Build\n2. Test');
    const component = state.chatContainer.children[0];

    await (component as any).onGoal();
    await promise;

    expect(ctx.startGoal).toHaveBeenCalledTimes(1);
    expect(state.planStartedGoalId).toBeUndefined();
  });
});

describe('handlePlanApproval regular approval', () => {
  it('activates an existing streamed submit_plan component in place', async () => {
    const { state, ctx } = createPlanApprovalCtx();
    const streamedComponent = PlanApprovalInlineComponent.createStreaming(state.ui);
    streamedComponent.updateArgs({ title: 'Ship it', plan: 'Build the feature' });
    state.lastSubmitPlanComponent = streamedComponent;
    state.chatContainer.children.push(streamedComponent);

    handlePlanApproval(ctx, 'plan-1', 'Ship it', 'Build the feature');

    expect(state.chatContainer.children.filter((child: unknown) => child === streamedComponent)).toHaveLength(1);
    expect(state.activeInlinePlanApproval).toBe(streamedComponent);
    expect(state.ui.setFocus).toHaveBeenCalledWith(streamedComponent);
    expect(streamedComponent.render(80).join('\n')).toContain('Use as /goal');
  });

  it('approves the plan and sends a single begin-executing system-reminder through harness.sendSignal', async () => {
    const { state, ctx, sendSignal } = createPlanApprovalCtx();

    const promise = handlePlanApproval(ctx, 'plan-1', 'Ship it', '1. Build\n2. Test');
    const component = state.chatContainer.children[0];

    await (component as any).onApprove();
    await promise;

    expect(state.harness.respondToPlanApproval).toHaveBeenCalledWith({
      planId: 'plan-1',
      response: { action: 'approved' },
    });
    expect(state.ui.setFocus).toHaveBeenLastCalledWith(state.editor);
    // The trigger goes through the structured signal pathway. We do not
    // also call `addUserMessage` or `fireMessage` — either would render
    // the reminder a second time.
    expect(ctx.addUserMessage).not.toHaveBeenCalled();
    expect(ctx.fireMessage).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith({
      type: 'system-reminder',
      contents: 'The user has approved the plan, begin executing.',
    });
    // Regular approval should not enter goal mode or set the return flag.
    expect(ctx.startGoal).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBeUndefined();
  });
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentPlanPath } from '../../../utils/plans.js';
import { createMockState } from '../../__tests__/harness-mock.js';
import { PlanApprovalInlineComponent } from '../../components/plan-approval-inline.js';
import type { TUIState } from '../../state.js';
import { handleAskQuestion, handlePlanApproval, shouldShowDiff } from '../prompts.js';
import type { EventHandlerContext } from '../types.js';

const tmpProjects: string[] = [];
const TEST_THREAD_ID = 'thread-test-plan-approval';

function createTmpProjectWithPlan(title: string, plan: string, threadId = TEST_THREAD_ID): string {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plan-test-'));
  tmpProjects.push(projectPath);
  const planPath = getCurrentPlanPath(projectPath, threadId);
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, `# ${title}\n\n${plan}\n`, 'utf-8');
  return projectPath;
}

afterEach(() => {
  while (tmpProjects.length) {
    const dir = tmpProjects.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createCtx() {
  const answerQuestion = vi.fn().mockResolvedValue('Verified');
  const state = createMockState({
    session: {
      respondToToolSuspension: vi.fn(),
      displayState: { get: vi.fn(() => ({ isRunning: false })) },
    },
    extra: {
      goalManager: {
        getGoal: vi.fn(() => ({ status: 'active', judgeModelId: 'openai/gpt-5.5' })),
        answerQuestion,
      },
      options: { inlineQuestions: true },
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
    },
  }) as unknown as TUIState;

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
    expect(state.session.respondToToolSuspension).not.toHaveBeenCalled();
    expect(ctx.addChildBeforeFollowUps).not.toHaveBeenCalled();
    expect(state.activeGoalJudge).toBeUndefined();

    state.activeInlineQuestion!.handleInput('\r');
    await promise;
  });

  it('resolves a multi_select prompt with an array of every toggled option label', async () => {
    const { ctx, state } = createCtx();
    const options = [{ label: 'React' }, { label: 'Vue' }, { label: 'Svelte' }];

    const promise = handleAskQuestion(ctx, 'q1', 'Which apply?', options, 'multi_select');

    const component = state.activeInlineQuestion!;
    // Toggle React (space), move down twice to Svelte, toggle it, then confirm (enter).
    component.handleInput(' ');
    component.handleInput('\x1b[B');
    component.handleInput('\x1b[B');
    component.handleInput(' ');
    component.handleInput('\r');

    await promise;

    expect(state.session.respondToToolSuspension).toHaveBeenCalledWith({
      toolCallId: 'q1',
      resumeData: ['React', 'Svelte'],
    });
  });
});

function createPlanApprovalCtx(projectPath?: string, threadId = TEST_THREAD_ID) {
  const sendSignal = vi.fn().mockReturnValue({
    id: 'sig-1',
    type: 'system-reminder',
    accepted: Promise.resolve({ accepted: true, runId: 'run-1' }),
  });
  const state = {
    ...createMockState({
      threadId,
      session: {
        state: { get: vi.fn(() => ({ projectPath, threadId })), set: vi.fn().mockResolvedValue(undefined) },
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        respondToToolSuspension: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn(),
        sendSignal,
      },
    }),
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

async function renderPlanApproval(ctx: EventHandlerContext, state: any, title: string, plan = '') {
  const promise = handlePlanApproval(ctx, 'plan-1', title, plan);
  for (let i = 0; i < 10 && state.chatContainer.children.length === 0; i++) {
    await new Promise(r => setTimeout(r, 5));
  }
  return { promise, component: state.chatContainer.children[0] as PlanApprovalInlineComponent };
}

describe('handlePlanApproval goal mode', () => {
  it('approves the plan and hands the title+plan objective off to the normal /goal flow', async () => {
    const projectPath = createTmpProjectWithPlan('Ship it', '1. Build\n2. Test');
    const { state, ctx } = createPlanApprovalCtx(projectPath);

    const promise = handlePlanApproval(ctx, 'plan-1', 'Ship it', '');
    // The handler reads the plan from disk asynchronously before creating the
    // component, so wait for it to be added to the chat container.
    for (let i = 0; i < 10 && state.chatContainer.children.length === 0; i++) {
      await new Promise(r => setTimeout(r, 5));
    }
    const component = state.chatContainer.children[0];

    await (component as any).onGoal();
    await promise;

    expect(state.session.respondToToolSuspension).toHaveBeenCalledWith({
      toolCallId: 'plan-1',
      resumeData: { action: 'approved' },
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
    expect(state.session.sendSignal).not.toHaveBeenCalled();
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

  it('approves the plan without sending a handoff signal', async () => {
    const { state, ctx, sendSignal } = createPlanApprovalCtx();

    const promise = handlePlanApproval(ctx, 'plan-1', 'Ship it', '1. Build\n2. Test');
    const component = state.chatContainer.children[0];

    await (component as any).onApprove();
    await promise;

    expect(state.session.respondToToolSuspension).toHaveBeenCalledWith({
      toolCallId: 'plan-1',
      resumeData: { action: 'approved' },
    });
    expect(state.ui.setFocus).toHaveBeenLastCalledWith(state.editor);
    expect(ctx.addUserMessage).not.toHaveBeenCalled();
    expect(ctx.fireMessage).not.toHaveBeenCalled();
    expect(sendSignal).not.toHaveBeenCalled();
    // Regular approval should not enter goal mode or set the return flag.
    expect(ctx.startGoal).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBeUndefined();
  });

  it('rejects the plan by resuming with a rejection then aborting the run host-side', async () => {
    const { state, ctx } = createPlanApprovalCtx();

    const promise = handlePlanApproval(ctx, 'plan-1', 'Ship it', '1. Build\n2. Test');
    const component = state.chatContainer.children[0];

    await (component as any).onReject();
    // onReject resumes fire-and-forget then aborts; let the async IIFE settle.
    await new Promise(r => setTimeout(r, 0));
    await promise;

    expect(state.session.respondToToolSuspension).toHaveBeenCalledWith({
      toolCallId: 'plan-1',
      resumeData: { action: 'rejected' },
    });
    // Host-side abort stops the resumed loop before it can emit trailing text,
    // and the flag suppresses the "Interrupted" UI.
    expect(state.session.abort).toHaveBeenCalledTimes(1);
    expect(state.planRejectionAbort).toBe(true);
    expect(state.ui.setFocus).toHaveBeenLastCalledWith(state.editor);
    expect(state.activeInlinePlanApproval).toBeUndefined();
  });

  it('renders a full plan instead of diffing against a stale snapshot with a different title', async () => {
    const projectPath = createTmpProjectWithPlan('New Plan', 'Build the new thing\nRun tests');
    const { state, ctx } = createPlanApprovalCtx(projectPath);
    state.previousPlanSnapshot = { title: 'Old Plan', plan: 'Delete something unrelated\nRewrite old feature' };

    const { component } = await renderPlanApproval(ctx, state, 'New Plan');
    const output = component.render(100).join('\n');

    expect(output).toContain('Build the new thing');
    expect(output).not.toContain('Changes from previous plan:');
    expect(state.previousPlanSnapshot).toEqual({ title: 'New Plan', plan: 'Build the new thing\nRun tests' });
  });

  it('clears a stale snapshot and renders a full plan when current-plan.md is missing', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plan-test-'));
    tmpProjects.push(projectPath);
    const { state, ctx } = createPlanApprovalCtx(projectPath);
    state.previousPlanSnapshot = { title: 'Old Plan', plan: 'Old stale plan' };

    const { component } = await renderPlanApproval(ctx, state, 'New Plan', 'Fallback plan body');
    const output = component.render(100).join('\n');

    expect(output).toContain('Fallback plan body');
    expect(output).not.toContain('Changes from previous plan:');
    expect(state.previousPlanSnapshot).toBeUndefined();
  });

  it('renders a diff for a small resubmission of the same active plan', async () => {
    const projectPath = createTmpProjectWithPlan('Same Plan', 'Build the feature\nAdd focused tests\nUpdate docs');
    const { state, ctx } = createPlanApprovalCtx(projectPath);
    state.previousPlanSnapshot = { title: 'Same Plan', plan: 'Build the feature\nRun tests\nUpdate docs' };

    const { component } = await renderPlanApproval(ctx, state, 'Same Plan');
    const output = component.render(100).join('\n');

    expect(output).toContain('Changes from previous plan:');
    expect(output).toContain('Add focused tests');
    expect(state.previousPlanSnapshot).toEqual({
      title: 'Same Plan',
      plan: 'Build the feature\nAdd focused tests\nUpdate docs',
    });
  });
});

describe('shouldShowDiff (size-gated diff)', () => {
  it('shows a diff for a small targeted edit', () => {
    const previous = ['Build the feature', 'Run tests', 'Update docs'].join('\n');
    const next = ['Build the feature', 'Add tests', 'Update docs'].join('\n');
    expect(shouldShowDiff(previous, next)).toBe(true);
  });

  it('shows a diff when no more than 50% of the new plan changed', () => {
    const previous = ['Old line 1', 'Old line 2', 'Keep 1', 'Keep 2'].join('\n');
    const next = ['New line 1', 'New line 2', 'Keep 1', 'Keep 2'].join('\n');
    expect(shouldShowDiff(previous, next)).toBe(true);
  });

  it('falls back to the full plan when more than 50% of the new plan changed', () => {
    const previous = ['Old line 1', 'Old line 2', 'Old line 3', 'Keep'].join('\n');
    const next = ['New line 1', 'New line 2', 'New line 3', 'Keep'].join('\n');
    expect(shouldShowDiff(previous, next)).toBe(false);
  });

  it('returns false when there is no previous plan or no change', () => {
    expect(shouldShowDiff('', 'New plan')).toBe(false);
    expect(shouldShowDiff('Same plan', 'Same plan')).toBe(false);
  });
});

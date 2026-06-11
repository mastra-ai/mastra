/**
 * Test for GitHub issue #13642: Parallel interactive tool calls (ask_user,
 * request_access) should all be answerable, not just the most recent.
 *
 * Root cause: state.activeInlineQuestion is a single property that gets
 * overwritten when multiple ask_question events arrive concurrently.
 * The Harness dispatches events fire-and-forget (no await), so multiple
 * interactive handlers run concurrently, and the last one wins — earlier
 * prompts become unreachable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { handleAskQuestion, handleSandboxAccessRequest } from '../handlers/prompts.js';
import type { EventHandlerContext } from '../handlers/types.js';
import type { TUIState } from '../state.js';

/**
 * Create a minimal mock state for testing interactive prompts.
 */
function createMockState(): TUIState {
  const chatContainer = {
    children: [] as any[],
    addChild: vi.fn(function (this: any, child: any) {
      this.children.push(child);
    }),
    clear: vi.fn(function (this: any) {
      this.children = [];
    }),
    invalidate: vi.fn(),
  };
  chatContainer.addChild = chatContainer.addChild.bind(chatContainer);
  chatContainer.clear = chatContainer.clear.bind(chatContainer);

  return {
    options: { inlineQuestions: true, harness: {} as any },
    harness: {
      respondToToolSuspension: vi.fn(),
      respondToPlanApproval: vi.fn(),
    },
    chatContainer,
    ui: {
      requestRender: vi.fn(),
    },
    activeInlineQuestion: undefined,
    activeInlinePlanApproval: undefined,
    pendingInlineQuestions: [],
    lastAskUserComponent: undefined,
    pendingAskUserComponents: new Map(),
    pendingApprovalDismiss: null,
  } as unknown as TUIState;
}

function createMockContext(state: TUIState): EventHandlerContext {
  return {
    state,
    showInfo: vi.fn(),
    showError: vi.fn(),
    showFormattedError: vi.fn(),
    updateStatusLine: vi.fn(),
    notify: vi.fn(),
    handleSlashCommand: vi.fn(),
    addUserMessage: vi.fn(),
    addChildBeforeFollowUps: vi.fn(),
    fireMessage: vi.fn(),
    queueFollowUpMessage: vi.fn(),
    renderExistingMessages: vi.fn(),
    renderCompletedTasksInline: vi.fn(),
    renderClearedTasksInline: vi.fn(),
    refreshModelAuthStatus: vi.fn(),
  };
}

describe('Parallel interactive tool calls (issue #13642)', () => {
  let state: TUIState;
  let ctx: EventHandlerContext;

  beforeEach(() => {
    state = createMockState();
    ctx = createMockContext(state);
  });

  describe('multiple concurrent ask_user calls', () => {
    it('should not overwrite activeInlineQuestion when a second ask_question arrives while first is pending', async () => {
      // Start first question - this sets state.activeInlineQuestion
      const p1 = handleAskQuestion(ctx, 'q1', 'First question?');

      const firstComponent = state.activeInlineQuestion;
      expect(firstComponent).toBeDefined();

      // Start second question while first is still pending
      // In the buggy code, this overwrites activeInlineQuestion
      const p2 = handleAskQuestion(ctx, 'q2', 'Second question?');

      // CRITICAL: The first component should still be the active one
      // (second should be queued), OR both should be tracked
      expect(state.activeInlineQuestion).toBe(firstComponent);

      // Cleanup: resolve both pending prompts
      state.activeInlineQuestion!.handleInput('y');
      state.activeInlineQuestion!.handleInput('\r');
      await p1;
      state.activeInlineQuestion!.handleInput('y');
      state.activeInlineQuestion!.handleInput('\r');
      await p2;
    });

    it('leaves ask_user choices for the user while a goal is active', async () => {
      const answerQuestion = vi.fn();
      state.goalManager = {
        getGoal: vi.fn(() => ({ status: 'active', judgeModelId: 'openai/gpt-5.5' })),
        answerQuestion,
      } as any;

      const prompt = handleAskQuestion(ctx, 'q1', 'Choose a review action?', [
        { label: 'Request changes', description: 'Submit a blocking review.' },
        { label: 'Skip', description: 'Move to the next PR.' },
      ]);

      expect(state.activeInlineQuestion).toBeDefined();
      expect(answerQuestion).not.toHaveBeenCalled();
      expect(state.harness.respondToToolSuspension).not.toHaveBeenCalled();

      state.activeInlineQuestion!.handleInput('\r');
      await prompt;
    });

    it('should allow answering all parallel questions sequentially', async () => {
      const respondToToolSuspension = state.harness.respondToToolSuspension as ReturnType<typeof vi.fn>;

      // Fire 3 concurrent ask_question events (simulating parallel tool calls)
      const p1 = handleAskQuestion(ctx, 'q1', 'Question 1?');
      const p2 = handleAskQuestion(ctx, 'q2', 'Question 2?');
      const p3 = handleAskQuestion(ctx, 'q3', 'Question 3?');

      // First question should be active
      expect(state.activeInlineQuestion).toBeDefined();

      // Simulate answering first question via its select/input
      // The onSubmit callback should call respondToToolSuspension and resolve the promise
      // We need to trigger the component's internal submission mechanism
      // Since AskQuestionInlineComponent uses Input with onSubmit,
      // we simulate by directly triggering the select list or sending Enter
      const comp1 = state.activeInlineQuestion!;

      // For free-text input questions, type text and press Enter
      comp1.handleInput('a');
      comp1.handleInput('n');
      comp1.handleInput('s');
      comp1.handleInput('1');
      comp1.handleInput('\r'); // Enter to submit

      // Wait for the first promise to resolve
      await p1;

      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q1', resumeData: 'ans1' });

      // Second question should now be active
      expect(state.activeInlineQuestion).toBeDefined();
      const comp2 = state.activeInlineQuestion!;
      expect(comp2).not.toBe(comp1);

      comp2.handleInput('a');
      comp2.handleInput('n');
      comp2.handleInput('s');
      comp2.handleInput('2');
      comp2.handleInput('\r');

      await p2;

      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q2', resumeData: 'ans2' });

      // Third question should now be active
      expect(state.activeInlineQuestion).toBeDefined();
      const comp3 = state.activeInlineQuestion!;

      comp3.handleInput('a');
      comp3.handleInput('n');
      comp3.handleInput('s');
      comp3.handleInput('3');
      comp3.handleInput('\r');

      await p3;

      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q3', resumeData: 'ans3' });
    });

    it('activates the streaming component matching each toolCallId, not the last one (#13642)', async () => {
      // Simulate handleToolInputStart having created one streaming component per
      // parallel ask_user call. The single-field lastAskUserComponent points at
      // the LAST one (toppings); the bug overwrote every prompt with it.
      const colorComp = AskQuestionInlineComponent.createStreaming();
      const sizeComp = AskQuestionInlineComponent.createStreaming();
      const toppingsComp = AskQuestionInlineComponent.createStreaming();
      state.pendingAskUserComponents.set('color', colorComp);
      state.pendingAskUserComponents.set('size', sizeComp);
      state.pendingAskUserComponents.set('toppings', toppingsComp);
      // lastAskUserComponent reflects the last streaming start (the buggy source of truth)
      state.lastAskUserComponent = toppingsComp;

      const activateSpy = vi.spyOn(colorComp, 'activate');
      const sizeSpy = vi.spyOn(sizeComp, 'activate');
      const toppingsSpy = vi.spyOn(toppingsComp, 'activate');

      handleAskQuestion(ctx, 'color', "What's your favorite color?");
      handleAskQuestion(ctx, 'size', 'Pick a size:', [{ label: 'small' }, { label: 'medium' }, { label: 'large' }]);
      handleAskQuestion(ctx, 'toppings', 'Pick toppings:', [{ label: 'cheese' }, { label: 'onion' }], 'multi_select');

      // First (color) activates immediately on ITS own component.
      expect(activateSpy).toHaveBeenCalledTimes(1);
      expect(activateSpy.mock.calls[0][0].question).toBe("What's your favorite color?");
      expect(state.activeInlineQuestion).toBe(colorComp);

      // The other two are queued — not activated yet.
      expect(sizeSpy).not.toHaveBeenCalled();
      expect(toppingsSpy).not.toHaveBeenCalled();
      expect(state.pendingInlineQuestions).toHaveLength(2);

      // Answer color → size activates on the size component with the size question.
      colorComp.handleInput('b');
      colorComp.handleInput('\r');
      await Promise.resolve();
      expect(sizeSpy).toHaveBeenCalledTimes(1);
      expect(sizeSpy.mock.calls[0][0].question).toBe('Pick a size:');
      expect(state.activeInlineQuestion).toBe(sizeComp);

      // Answer size → toppings activates on the toppings component, multi-select.
      sizeComp.handleInput('\r');
      await Promise.resolve();
      expect(toppingsSpy).toHaveBeenCalledTimes(1);
      expect(toppingsSpy.mock.calls[0][0].question).toBe('Pick toppings:');
      expect(toppingsSpy.mock.calls[0][0].selectionMode).toBe('multi_select');
      expect(state.activeInlineQuestion).toBe(toppingsComp);
    });

    it('should resolve all promises even when questions arrive concurrently', async () => {
      const respondToToolSuspension = state.harness.respondToToolSuspension as ReturnType<typeof vi.fn>;

      // Fire concurrent questions
      const p1 = handleAskQuestion(ctx, 'q1', 'Q1?');
      const p2 = handleAskQuestion(ctx, 'q2', 'Q2?');

      // Answer first
      const comp1 = state.activeInlineQuestion!;
      comp1.handleInput('y');
      comp1.handleInput('\r');
      await p1;

      // Answer second
      const comp2 = state.activeInlineQuestion!;
      comp2.handleInput('n');
      comp2.handleInput('\r');
      await p2;

      // Both should have been answered
      expect(respondToToolSuspension).toHaveBeenCalledTimes(2);
      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q1', resumeData: 'y' });
      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q2', resumeData: 'n' });
    });
  });

  describe('concurrent sandbox_access_request calls', () => {
    it('should queue parallel sandbox access requests', async () => {
      const respondToToolSuspension = state.harness.respondToToolSuspension as ReturnType<typeof vi.fn>;

      const p1 = handleSandboxAccessRequest(ctx, 'sa1', '/path/a', 'reason A');
      const p2 = handleSandboxAccessRequest(ctx, 'sa2', '/path/b', 'reason B');

      // First should be active (it has select options: Yes/No)
      expect(state.activeInlineQuestion).toBeDefined();
      const comp1 = state.activeInlineQuestion!;

      // Select "Yes" via Enter on the first item in select list
      comp1.handleInput('\r'); // Enter selects first option ("Yes")
      await p1;

      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'sa1', resumeData: 'Yes' });

      // Second should now be active
      expect(state.activeInlineQuestion).toBeDefined();
      const comp2 = state.activeInlineQuestion!;
      expect(comp2).not.toBe(comp1);

      // Select "No" by pressing down then Enter
      comp2.handleInput('\x1b[B'); // Down arrow
      comp2.handleInput('\r'); // Enter selects "No"
      await p2;

      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'sa2', resumeData: 'No' });
    });
  });

  describe('abort clears queued prompts', () => {
    it('should clear the queue and not activate pending questions after abort', async () => {
      const respondToToolSuspension = state.harness.respondToToolSuspension as ReturnType<typeof vi.fn>;

      // Fire two concurrent questions: first is active, second is queued
      handleAskQuestion(ctx, 'q1', 'Active question?');
      handleAskQuestion(ctx, 'q2', 'Queued question?');

      expect(state.activeInlineQuestion).toBeDefined();
      expect(state.pendingInlineQuestions).toHaveLength(1);

      // Simulate abort: clear state the same way setup.ts does on Ctrl+C
      state.activeInlineQuestion = undefined;
      state.pendingInlineQuestions.length = 0;

      // The queue should stay empty and no new question should activate
      expect(state.activeInlineQuestion).toBeUndefined();
      expect(state.pendingInlineQuestions).toHaveLength(0);

      // respondToToolSuspension should not have been called (nothing was answered)
      expect(respondToToolSuspension).not.toHaveBeenCalled();
    });

    it('should not activate queued questions if the active one is cancelled after abort', async () => {
      // Fire two concurrent questions
      handleAskQuestion(ctx, 'q1', 'First?');
      handleAskQuestion(ctx, 'q2', 'Second?');

      const comp1 = state.activeInlineQuestion!;
      expect(state.pendingInlineQuestions).toHaveLength(1);

      // Abort: clear everything
      state.activeInlineQuestion = undefined;
      state.pendingInlineQuestions.length = 0;

      // Even if comp1's onCancel fires after abort (e.g. cleanup), the queue is empty
      // so processNextInlineQuestion should be a no-op
      comp1.handleInput('\x1b'); // Esc to cancel

      // Queue should still be empty, no new active question
      expect(state.activeInlineQuestion).toBeUndefined();
      expect(state.pendingInlineQuestions).toHaveLength(0);
    });
  });

  describe('serialized ask_user flow (real backend ordering)', () => {
    // The agent serializes suspend-capable tools: when the model emits three
    // ask_user calls in one step, only the FIRST suspends and emits tool_suspended.
    // The streamed boxes for all three are created up front, but the size/toppings
    // tool_suspended events arrive ONLY after the prior question is answered and
    // the run resumes. This test mirrors that exact ordering — the bug the user hit
    // ("answering one doesn't activate the next") only reproduces with this timing,
    // not when all three handleAskQuestion calls fire synchronously together.
    it('activates the next streamed question when its tool_suspended arrives after resume', async () => {
      const respondToToolSuspension = state.harness.respondToToolSuspension as ReturnType<typeof vi.fn>;

      // All three streamed boxes exist from the initial step's tool-call chunks.
      const colorComp = AskQuestionInlineComponent.createStreaming();
      const sizeComp = AskQuestionInlineComponent.createStreaming();
      const toppingsComp = AskQuestionInlineComponent.createStreaming();
      state.pendingAskUserComponents.set('color', colorComp);
      state.pendingAskUserComponents.set('size', sizeComp);
      state.pendingAskUserComponents.set('toppings', toppingsComp);
      state.lastAskUserComponent = toppingsComp;

      // Resume emits the NEXT question's tool_suspended only after the prior answer.
      respondToToolSuspension.mockImplementation(({ toolCallId }: { toolCallId: string }) => {
        if (toolCallId === 'color') {
          handleAskQuestion(ctx, 'size', 'Pick a size:', [{ label: 'small' }, { label: 'medium' }]);
        } else if (toolCallId === 'size') {
          handleAskQuestion(
            ctx,
            'toppings',
            'Pick toppings:',
            [{ label: 'cheese' }, { label: 'onion' }],
            'multi_select',
          );
        }
      });

      // Initial run: only the first question's tool_suspended fires.
      handleAskQuestion(ctx, 'color', "What's your favorite color?");
      expect(state.activeInlineQuestion).toBe(colorComp);

      // Answer color → resume fires size's tool_suspended → size must activate.
      colorComp.handleInput('b');
      colorComp.handleInput('\r');
      await Promise.resolve();
      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'color', resumeData: 'b' });
      expect(state.activeInlineQuestion).toBe(sizeComp);

      // Answer size → resume fires toppings' tool_suspended → toppings must activate.
      sizeComp.handleInput('\r');
      await Promise.resolve();
      expect(state.activeInlineQuestion).toBe(toppingsComp);
      expect((toppingsComp as any).multiSelect).toBe(true);
    });
  });

  describe('mixed interactive tool calls', () => {
    it('should handle ask_question and sandbox_access_request arriving concurrently', async () => {
      const respondToToolSuspension = state.harness.respondToToolSuspension as ReturnType<typeof vi.fn>;

      const p1 = handleAskQuestion(ctx, 'q1', 'Pick one', [{ label: 'A' }, { label: 'B' }]);
      const p2 = handleSandboxAccessRequest(ctx, 'sa1', '/some/path', 'need access');

      // First should be the ask_question
      expect(state.activeInlineQuestion).toBeDefined();
      const comp1 = state.activeInlineQuestion!;

      // Select first option
      comp1.handleInput('\r');
      await p1;
      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q1', resumeData: 'A' });

      // Sandbox request should now be active
      expect(state.activeInlineQuestion).toBeDefined();
      state.activeInlineQuestion!.handleInput('\r'); // Yes
      await p2;
      expect(respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'sa1', resumeData: 'Yes' });
    });
  });
});

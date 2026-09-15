/**
 * When a run dies after `tool_suspended` was emitted (e.g. persisting the
 * suspended snapshot failed with `RangeError: Invalid string length`), the
 * session cancels the parked suspension via `tool_suspension_cancelled` because
 * the answer could never be resumed. The TUI must retract the rendered prompt
 * out-of-band — the serialized event queue is parked on the question's own
 * promise, so the cancellation cannot arrive through the normal dispatch path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAskQuestion } from '../handlers/prompts.js';
import type { EventHandlerContext } from '../handlers/types.js';
import type { TUIState } from '../state.js';

function createMockState(): { state: TUIState; emitSessionEvent: (event: any) => void } {
  const chatContainer = {
    children: [] as any[],
    addChild: vi.fn(function (this: any, child: any) {
      this.children.push(child);
    }),
    invalidate: vi.fn(),
  };
  chatContainer.addChild = chatContainer.addChild.bind(chatContainer);

  const listeners = new Set<(event: any) => void>();
  const session = {
    respondToToolSuspension: vi.fn(),
    subscribe: vi.fn((listener: (event: any) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };

  const state = {
    options: { inlineQuestions: true, controller: {} as any },
    controller: { session },
    session,
    chatContainer,
    ui: { requestRender: vi.fn() },
    activeInlineQuestion: undefined,
    activeInlinePlanApproval: undefined,
    pendingInlineQuestions: [],
    lastAskUserComponent: undefined,
    pendingAskUserComponents: new Map(),
    pendingApprovalDismiss: null,
  } as unknown as TUIState;

  return {
    state,
    emitSessionEvent: event => {
      for (const listener of [...listeners]) listener(event);
    },
  };
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
    renderClearedTasksInline: vi.fn(),
    renderCompletedTasksInline: vi.fn(),
    renderTaskDeltaInline: vi.fn(),
    refreshModelAuthStatus: vi.fn(),
    startGoal: vi.fn(),
  } as unknown as EventHandlerContext;
}

describe('ask_user prompt retraction on tool_suspension_cancelled', () => {
  let state: TUIState;
  let ctx: EventHandlerContext;
  let emitSessionEvent: (event: any) => void;

  beforeEach(() => {
    const mock = createMockState();
    state = mock.state;
    emitSessionEvent = mock.emitSessionEvent;
    ctx = createMockContext(state);
  });

  it('retracts the active question and resolves without answering', async () => {
    const promise = handleAskQuestion(ctx, 'q1', 'Your name?');

    const component = state.activeInlineQuestion!;
    expect(component).toBeDefined();

    emitSessionEvent({
      type: 'tool_suspension_cancelled',
      toolCallId: 'q1',
      toolName: 'ask_user',
      reason: 'Invalid string length',
    });

    await promise;

    expect(state.activeInlineQuestion).toBeUndefined();
    expect((component as any).answered).toBe(true);
    expect(state.session.respondToToolSuspension).not.toHaveBeenCalled();

    // Late input on the dismissed component must not submit an answer.
    component.handleInput('y');
    component.handleInput('\r');
    expect(state.session.respondToToolSuspension).not.toHaveBeenCalled();
  });

  it('ignores cancellations for other toolCallIds', async () => {
    const promise = handleAskQuestion(ctx, 'q1', 'Your name?');
    const component = state.activeInlineQuestion!;

    emitSessionEvent({
      type: 'tool_suspension_cancelled',
      toolCallId: 'other',
      toolName: 'ask_user',
      reason: 'Invalid string length',
    });

    expect(state.activeInlineQuestion).toBe(component);

    component.handleInput('A');
    component.handleInput('\r');
    await promise;
    expect(state.session.respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q1', resumeData: 'A' });
  });

  it('drops a queued question that is cancelled before activation', async () => {
    const p1 = handleAskQuestion(ctx, 'q1', 'First?');
    const p2 = handleAskQuestion(ctx, 'q2', 'Second?');

    const firstComponent = state.activeInlineQuestion!;
    expect(state.pendingInlineQuestions).toHaveLength(1);

    // Second question is retracted while still queued.
    emitSessionEvent({
      type: 'tool_suspension_cancelled',
      toolCallId: 'q2',
      toolName: 'ask_user',
      reason: 'Invalid string length',
    });
    await p2;

    // Answering the first question must not activate the cancelled second one.
    firstComponent.handleInput('A');
    firstComponent.handleInput('\r');
    await p1;

    expect(state.activeInlineQuestion).toBeUndefined();
    expect(state.session.respondToToolSuspension).toHaveBeenCalledTimes(1);
    expect(state.session.respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'q1', resumeData: 'A' });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../request-context';

import { askUserTool, submitPlanTool } from './tools';
import type { HarnessEvent, HarnessQuestionAnswer, HarnessRequestContext } from './types';

function createAskUserContext() {
  const events: HarnessEvent[] = [];
  let resolveQuestion: ((answer: HarnessQuestionAnswer) => void) | undefined;

  const requestContext = new RequestContext();
  const harnessCtx: Partial<HarnessRequestContext> = {
    emitEvent: event => events.push(event),
    registerQuestion: ({ resolve }) => {
      resolveQuestion = resolve;
    },
  };
  requestContext.set('harness', harnessCtx);

  return {
    events,
    requestContext,
    answer: (answer: HarnessQuestionAnswer) => {
      expect(resolveQuestion).toBeDefined();
      resolveQuestion?.(answer);
    },
  };
}

describe('askUserTool', () => {
  it('emits single-select questions by default when options are provided', async () => {
    const ctx = createAskUserContext();

    const resultPromise = (askUserTool as any).execute(
      {
        question: 'Pick one?',
        options: [{ label: 'A' }, { label: 'B' }],
      },
      { requestContext: ctx.requestContext },
    );

    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0]).toMatchObject({
      type: 'ask_question',
      question: 'Pick one?',
      selectionMode: 'single_select',
    });

    ctx.answer('A');

    await expect(resultPromise).resolves.toEqual({
      content: 'User answered: A',
      isError: false,
    });
  });

  it('emits multi-select questions and accepts multiple answers', async () => {
    const ctx = createAskUserContext();

    const resultPromise = (askUserTool as any).execute(
      {
        question: 'Pick any?',
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
        selectionMode: 'multi_select',
      },
      { requestContext: ctx.requestContext },
    );

    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0]).toMatchObject({
      type: 'ask_question',
      question: 'Pick any?',
      options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      selectionMode: 'multi_select',
    });

    ctx.answer(['A', 'C']);

    await expect(resultPromise).resolves.toEqual({
      content: 'User answered: A, C',
      isError: false,
    });
  });

  it('rejects selection mode without options', async () => {
    const requestContext = new RequestContext();
    const emitEvent = vi.fn();
    requestContext.set('harness', { emitEvent, registerQuestion: vi.fn() });

    await expect(
      (askUserTool as any).execute(
        {
          question: 'Pick any?',
          selectionMode: 'multi_select',
        },
        { requestContext },
      ),
    ).resolves.toEqual({
      content: 'Failed to ask user: selectionMode requires options.',
      isError: true,
    });

    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('uses durable suspension without a live question resolver', async () => {
    const events: HarnessEvent[] = [];
    const requestContext = new RequestContext();
    const suspend = vi.fn(async () => undefined);
    requestContext.set('harness', {
      durableAwaitingInputs: true,
      emitEvent: event => events.push(event),
    } satisfies Partial<HarnessRequestContext>);

    await expect(
      (askUserTool as any).execute(
        {
          question: 'Pick any?',
          options: [{ label: 'A' }, { label: 'B' }],
          selectionMode: 'multi_select',
        },
        { requestContext, suspend, toolCallId: 'ask-call' },
      ),
    ).resolves.toEqual({
      content: '[Question for user]: Pick any?',
      isError: false,
    });

    expect(events[0]).toMatchObject({
      type: 'ask_question',
      question: 'Pick any?',
      options: [{ label: 'A' }, { label: 'B' }],
      selectionMode: 'multi_select',
    });
    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'question',
        toolCallId: 'ask-call',
        toolName: 'ask_user',
        question: 'Pick any?',
        options: [{ label: 'A' }, { label: 'B' }],
        selectionMode: 'multi_select',
      }),
      expect.objectContaining({
        resumeLabel: expect.stringMatching(/^q_/),
        resumeSchema: expect.any(String),
      }),
    );
  });

  it('uses durable plan suspension without a live plan resolver', async () => {
    const events: HarnessEvent[] = [];
    const requestContext = new RequestContext();
    const suspend = vi.fn(async () => undefined);
    requestContext.set('harness', {
      durableAwaitingInputs: true,
      emitEvent: event => events.push(event),
    } satisfies Partial<HarnessRequestContext>);

    await expect(
      (submitPlanTool as any).execute(
        {
          title: 'Plan',
          plan: '# Plan',
        },
        { requestContext, suspend, toolCallId: 'plan-call' },
      ),
    ).resolves.toEqual({
      content: '[Plan submitted for review]\n\nTitle: Plan\n\n# Plan',
      isError: false,
    });

    expect(events[0]).toMatchObject({
      type: 'plan_approval_required',
      title: 'Plan',
      plan: '# Plan',
    });
    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'plan_approval',
        toolCallId: 'plan-call',
        toolName: 'submit_plan',
        title: 'Plan',
        plan: '# Plan',
      }),
      expect.objectContaining({
        resumeLabel: expect.stringMatching(/^plan_/),
        resumeSchema: expect.any(String),
      }),
    );
  });
});

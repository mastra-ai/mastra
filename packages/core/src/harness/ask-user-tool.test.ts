import { describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../request-context';

import { askUserTool } from './tools';
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
});

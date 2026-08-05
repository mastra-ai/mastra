import { describe, expect, it, vi } from 'vitest';

import { askUserTool } from './ask-user';

function makeAgentContext(overrides: Record<string, any> = {}) {
  return {
    agent: {
      agentId: 'agent-1',
      toolCallId: 'tc-1',
      messages: [],
      suspend: vi.fn(async () => undefined),
      ...overrides,
    },
  };
}

describe('askUserTool (native suspend)', () => {
  it('suspends with the question payload when no resumeData is present', async () => {
    const ctx = makeAgentContext();

    const result = await (askUserTool as any).execute(
      {
        question: 'Pick one?',
        options: [{ label: 'A' }, { label: 'B' }],
      },
      ctx,
    );

    expect(ctx.agent.suspend).toHaveBeenCalledTimes(1);
    expect((ctx.agent.suspend as any).mock.calls[0][0]).toEqual({
      question: 'Pick one?',
      options: [{ label: 'A' }, { label: 'B' }],
      selectionMode: 'single_select',
    });
    // suspend short-circuits the step; the tool returns no output.
    expect(result).toBeUndefined();
  });

  it('suspends with multi_select when requested', async () => {
    const ctx = makeAgentContext();

    await (askUserTool as any).execute(
      {
        question: 'Pick any?',
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
        selectionMode: 'multi_select',
      },
      ctx,
    );

    expect((ctx.agent.suspend as any).mock.calls[0][0]).toEqual({
      question: 'Pick any?',
      options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      selectionMode: 'multi_select',
    });
  });

  it('returns the formatted answer from resumeData (string)', async () => {
    const ctx = makeAgentContext({ resumeData: 'A' });

    const result = await (askUserTool as any).execute({ question: 'Pick one?', options: [{ label: 'A' }] }, ctx);

    expect(ctx.agent.suspend).not.toHaveBeenCalled();
    expect(result).toEqual({ content: 'User answered: A', isError: false });
  });

  it('returns the formatted answer from resumeData (string[])', async () => {
    const ctx = makeAgentContext({ resumeData: ['A', 'C'] });

    const result = await (askUserTool as any).execute(
      { question: 'Pick any?', options: [{ label: 'A' }, { label: 'C' }], selectionMode: 'multi_select' },
      ctx,
    );

    expect(result).toEqual({ content: 'User answered: A, C', isError: false });
  });

  it('rejects selection mode without options', async () => {
    const ctx = makeAgentContext();

    const result = await (askUserTool as any).execute({ question: 'Pick any?', selectionMode: 'multi_select' }, ctx);

    expect(result).toEqual({
      content: 'Failed to ask user: selectionMode requires options.',
      isError: true,
    });
    expect(ctx.agent.suspend).not.toHaveBeenCalled();
  });

  it('falls back to a readable prompt when no agent suspend is available', async () => {
    const result = await (askUserTool as any).execute(
      { question: 'What is your name?' },
      { requestContext: undefined },
    );

    expect(result).toEqual({
      content: '[Question for user]: What is your name?',
      isError: false,
    });
  });

  it('includes options in the static fallback', async () => {
    const result = await (askUserTool as any).execute(
      { question: 'Pick one?', options: [{ label: 'A' }, { label: 'B' }] },
      {},
    );

    expect(result).toEqual({
      content: '[Question for user]: Pick one?\nOptions: A, B\nSelection mode: single_select',
      isError: false,
    });
  });
});

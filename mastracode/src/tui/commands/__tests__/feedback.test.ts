import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/project.js', () => ({
  getUserName: vi.fn(() => 'test-user'),
}));

import { handleFeedbackCommand } from '../feedback';

function createCtx(options?: {
  traceId?: string | null;
  runId?: string | null;
  threadId?: string | null;
  addFeedback?: any;
}) {
  const addFeedback = options?.addFeedback ?? vi.fn().mockResolvedValue(undefined);
  const session = {
    run: { getTraceId: vi.fn(() => (options && 'traceId' in options ? options.traceId : 'trace-123')) },
    getCurrentRunId: vi.fn(() => (options && 'runId' in options ? options.runId : 'run-123')),
    thread: {
      getId: vi.fn(() => (options && 'threadId' in options ? options.threadId : 'thread-123')),
    },
  };
  return {
    state: { session },
    session,
    harness: {
      getMastra: vi.fn(() => ({ observability: { addFeedback } })),
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
    addFeedback,
  } as any;
}

describe('handleFeedbackCommand', () => {
  it('requires trace, run, or thread context before recording feedback', async () => {
    const ctx = createCtx({ traceId: null, runId: null, threadId: null });

    await handleFeedbackCommand(ctx, ['up']);

    expect(ctx.addFeedback).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('No active session to attach feedback to.');
  });

  it('records numeric feedback with trace correlation and thread metadata', async () => {
    const ctx = createCtx({ traceId: 'trace-abc', runId: 'run-def', threadId: 'thread-ghi' });

    await handleFeedbackCommand(ctx, ['7', 'helpful', 'but', 'verbose']);

    expect(ctx.addFeedback).toHaveBeenCalledWith({
      traceId: 'trace-abc',
      correlationContext: {
        traceId: 'trace-abc',
        runId: 'run-def',
      },
      feedback: {
        feedbackType: 'rating',
        feedbackSource: 'mastracode',
        feedbackUserId: 'test-user',
        value: 7,
        comment: 'helpful but verbose',
        metadata: {
          threadId: 'thread-ghi',
          runId: 'run-def',
        },
      },
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Feedback recorded: 7/10 — "helpful but verbose"');
  });

  it('records comment-only feedback without requiring a trace id when run context exists', async () => {
    const ctx = createCtx({ traceId: null, runId: 'run-only', threadId: 'thread-only' });

    await handleFeedbackCommand(ctx, ['comment', 'great', 'answer']);

    expect(ctx.addFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: undefined,
        correlationContext: { traceId: undefined, runId: 'run-only' },
        feedback: expect.objectContaining({
          feedbackType: 'comment',
          value: 'great answer',
          comment: 'great answer',
          metadata: { threadId: 'thread-only', runId: 'run-only' },
        }),
      }),
    );
    expect(ctx.showInfo).toHaveBeenCalledWith('Comment recorded.');
  });

  it('rejects invalid feedback ratings', async () => {
    const ctx = createCtx();

    await handleFeedbackCommand(ctx, ['11']);

    expect(ctx.addFeedback).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('Unknown feedback type: "11". Use up, down, comment, or a number 0-10.');
  });
});

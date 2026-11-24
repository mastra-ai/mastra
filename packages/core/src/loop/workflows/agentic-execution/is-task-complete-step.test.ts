import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import * as validation from '../../network/validation';
import { createIsTaskCompleteStep } from './is-task-complete-step';

function baseParams() {
  return {
    isTaskComplete: {
      scorers: [{ id: 'test-scorer' } as any],
      strategy: 'any' as const,
    },
    maxSteps: 10,
    messageList: new MessageList(),
    requestContext: new RequestContext(),
    mastra: { generateId: () => 'test-id' } as any,
    controller: { enqueue: vi.fn() } as any,
    runId: 'run-1',
    _internal: {},
    agentId: 'agent-1',
    agentName: 'agent-1',
  };
}

function executeStep(step: any, inputData: any) {
  return step.execute({ inputData });
}

function makeInput(opts: { toolCalls?: Array<{ toolName: string }>; isContinued?: boolean; bgPending?: boolean } = {}) {
  return {
    backgroundTaskPending: opts.bgPending ?? false,
    stepResult: { isContinued: opts.isContinued ?? false },
    output: {
      text: 'done',
      toolCalls: opts.toolCalls ?? [],
      toolResults: [],
    },
  };
}

describe('isTaskCompleteStep — working memory skip', () => {
  let runScorersSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    runScorersSpy = vi
      .spyOn(validation, 'runStreamCompletionScorers')
      .mockResolvedValue({ complete: true, scorers: [] } as any);
    vi.spyOn(validation, 'formatStreamCompletionFeedback').mockReturnValue('' as any);
  });

  it('does not advance scorer iterations or completion feedback for signal-discarded attempts', async () => {
    const params = baseParams();
    params.maxSteps = 2;
    const step = createIsTaskCompleteStep(params as any);
    runScorersSpy.mockResolvedValue({ complete: false, scorers: [] });
    const feedback = vi.spyOn(validation, 'formatStreamCompletionFeedback');
    for (let attempt = 0; attempt < 5; attempt++) {
      const input = { ...makeInput({ isContinued: true }), stepResult: { isContinued: true, signalPreempted: true } };
      expect(await executeStep(step, input)).toBe(input);
    }
    expect(runScorersSpy).not.toHaveBeenCalled();
    expect(params.controller.enqueue).not.toHaveBeenCalled();
    expect(params.messageList.get.response.db()).toEqual([]);
    await executeStep(step, makeInput());
    await executeStep(step, makeInput());
    expect(runScorersSpy.mock.calls.map(([, context]) => context.iteration)).toEqual([1, 2]);
    expect(feedback.mock.calls.map(([, maxIterationReached]) => maxIterationReached)).toEqual([false, true]);
    expect(params.controller.enqueue.mock.calls.map(([chunk]) => chunk.payload)).toEqual([
      expect.objectContaining({ iteration: 1, maxIterationReached: false }),
      expect.objectContaining({ iteration: 2, maxIterationReached: true }),
    ]);
  });

  it('skips scorers when only tool call was updateWorkingMemory', async () => {
    const step = createIsTaskCompleteStep(baseParams() as any);

    await executeStep(step, makeInput({ toolCalls: [{ toolName: 'updateWorkingMemory' }] }));

    expect(runScorersSpy).not.toHaveBeenCalled();
  });

  it('skips scorers for the kebab-case id too', async () => {
    const step = createIsTaskCompleteStep(baseParams() as any);

    await executeStep(step, makeInput({ toolCalls: [{ toolName: 'update-working-memory' }] }));

    expect(runScorersSpy).not.toHaveBeenCalled();
  });

  it('runs scorers when a non-working-memory tool is also called', async () => {
    const step = createIsTaskCompleteStep(baseParams() as any);

    await executeStep(step, makeInput({ toolCalls: [{ toolName: 'updateWorkingMemory' }, { toolName: 'searchWeb' }] }));

    expect(runScorersSpy).toHaveBeenCalled();
  });

  it('runs scorers when no tool calls were made', async () => {
    const step = createIsTaskCompleteStep(baseParams() as any);

    await executeStep(step, makeInput({ toolCalls: [] }));

    expect(runScorersSpy).toHaveBeenCalled();
  });
});

describe('isTaskCompleteStep — completion feedback message', () => {
  beforeEach(() => {
    vi.spyOn(validation, 'formatStreamCompletionFeedback').mockReturnValue('#### Completion Check Results' as any);
  });

  it('does not append the feedback message when the check passes', async () => {
    vi.spyOn(validation, 'runStreamCompletionScorers').mockResolvedValue({ complete: true, scorers: [] } as any);
    const params = baseParams();
    const step = createIsTaskCompleteStep(params as any);

    await executeStep(step, makeInput());

    const responseMessages = params.messageList.get.response.db();
    expect(responseMessages.filter(m => m.content?.metadata?.completionResult)).toHaveLength(0);
  });

  it('appends the feedback message when the check fails so the next iteration can course-correct', async () => {
    vi.spyOn(validation, 'runStreamCompletionScorers').mockResolvedValue({ complete: false, scorers: [] } as any);
    const params = baseParams();
    const step = createIsTaskCompleteStep(params as any);

    await executeStep(step, makeInput());

    const feedbackMessages = params.messageList.get.response.db().filter(m => m.content?.metadata?.completionResult);
    expect(feedbackMessages).toHaveLength(1);
    expect(feedbackMessages[0]?.role).toBe('assistant');
  });
});

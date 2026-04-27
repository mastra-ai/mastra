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
    runScorersSpy = vi
      .spyOn(validation, 'runStreamCompletionScorers')
      .mockResolvedValue({ complete: true, scorers: [] } as any);
    vi.spyOn(validation, 'formatStreamCompletionFeedback').mockReturnValue('' as any);
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

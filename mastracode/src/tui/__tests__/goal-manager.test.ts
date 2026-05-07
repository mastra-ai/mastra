import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  agentConstructor: vi.fn(),
}));

vi.mock('@mastra/core/agent', () => ({
  Agent: mocks.agentConstructor,
}));

vi.mock('@mastra/core/processors', () => ({
  PrefillErrorHandler: class {
    readonly id = 'prefill-error-handler';
  },
  ProviderHistoryCompat: class {
    readonly id = 'provider-history-compat';
  },
  StreamErrorRetryProcessor: class {
    readonly id = 'stream-error-retry-processor';
  },
}));

vi.mock('../../agents/model.js', () => ({
  resolveModel: vi.fn(() => 'mock-model'),
}));

import { GoalManager } from '../goal-manager.js';
import type { TUIState } from '../state.js';

function createState(overrides: Partial<TUIState['harness']> = {}): TUIState {
  return {
    harness: {
      listMessages: vi.fn().mockResolvedValue([
        {
          role: 'user',
          content: [{ type: 'text', text: 'Can you explain what kind of feedback you need?' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'I completed part of the work.' }],
        },
      ]),
      setThreadSetting: vi.fn(),
      getCurrentThreadId: vi.fn(() => 'parent-thread'),
      getResourceId: vi.fn(() => 'resource-1'),
      ...overrides,
    },
  } as unknown as TUIState;
}

describe('GoalManager', () => {
  beforeEach(() => {
    mocks.stream.mockReset();
    mocks.agentConstructor.mockReset();
  });

  it('preserves turn count when resuming a paused goal', () => {
    const manager = new GoalManager();
    const goal = manager.setGoal('finish the task', 'openai/gpt-5.5');
    goal.turnsUsed = 3;
    manager.pause();

    manager.resume();

    expect(manager.getGoal()).toMatchObject({ status: 'active', turnsUsed: 3 });
  });

  it('updates judge defaults on the current goal without resetting progress', () => {
    const manager = new GoalManager();
    const goal = manager.setGoal('finish the task', 'openai/gpt-5.5', 50);
    goal.turnsUsed = 3;

    manager.updateJudgeDefaults('anthropic/claude-sonnet-4-5', 25);

    expect(manager.getGoal()).toMatchObject({
      judgeModelId: 'anthropic/claude-sonnet-4-5',
      maxTurns: 25,
      turnsUsed: 3,
    });
  });

  it('pauses instead of continuing when no judge model is available', async () => {
    const manager = new GoalManager();
    manager.setGoal('finish the task', '');

    const result = await manager.evaluateAfterTurn(createState());

    expect(result.continuation).toBeNull();
    expect(result.judgeResult).toEqual({ decision: 'paused', reason: 'Judge model could not be initialized.' });
    expect(manager.getGoal()?.status).toBe('paused');
    expect(manager.getGoal()?.turnsUsed).toBe(0);
  });

  it('pauses with a specific reason when the judge returns no structured output', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: undefined }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    const result = await manager.evaluateAfterTurn(createState());

    expect(result.continuation).toBeNull();
    expect(result.judgeResult).toEqual({ decision: 'paused', reason: 'Judge returned no structured decision.' });
    expect(manager.getGoal()?.status).toBe('paused');
    expect(manager.getGoal()?.turnsUsed).toBe(0);
  });

  it('uses stream with structured output and judge memory thread parent-goalId', async () => {
    let turnsUsedWhileJudging: number | undefined;
    mocks.stream.mockImplementation(async () => {
      turnsUsedWhileJudging = manager.getGoal()?.turnsUsed;
      return {
        consumeStream: vi.fn().mockResolvedValue(undefined),
        getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'continue', reason: 'Need one more step.' } }),
      };
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const memory = {
      getThreadById: vi.fn().mockResolvedValue(null),
      createThread: vi.fn().mockResolvedValue(undefined),
    };
    const state = createState({
      getResolvedMemory: vi.fn().mockResolvedValue(memory),
    } as Partial<TUIState['harness']>);
    const manager = new GoalManager();
    const goal = manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    const result = await manager.evaluateAfterTurn(state);

    const expectedThreadId = `parent-thread-${goal.id}`;
    expect(mocks.stream).toHaveBeenCalledWith(expect.stringContaining('Latest assistant message'), {
      memory: { thread: expectedThreadId, resource: 'resource-1' },
      structuredOutput: { schema: expect.any(Object) },
    });
    expect(mocks.stream).toHaveBeenCalledWith(expect.stringContaining('Latest user message'), expect.any(Object));
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.stringContaining('Can you explain what kind of feedback you need?'),
      expect.any(Object),
    );
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.stringContaining('Assistant steps since that user message: 1'),
      expect.any(Object),
    );
    expect(memory.createThread).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: expectedThreadId,
        resourceId: 'resource-1',
        metadata: {
          forkedSubagent: true,
          goalJudge: true,
          parentThreadId: 'parent-thread',
          goalId: goal.id,
        },
      }),
    );
    expect(turnsUsedWhileJudging).toBe(0);
    expect(manager.getGoal()?.turnsUsed).toBe(1);
    expect(result.continuation).toContain('<system-reminder type="goal-judge">');
    expect(result.continuation).toContain('Need one more step.');
  });

  it('configures provider compatibility and retry processors on the judge agent', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'done', reason: 'Complete.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    await manager.evaluateAfterTurn(createState());

    const agentConfig = mocks.agentConstructor.mock.calls[0]?.[0] as
      | { inputProcessors?: Array<{ id?: string }>; errorProcessors?: Array<{ id?: string }> }
      | undefined;
    expect(agentConfig?.inputProcessors?.map(processor => processor.id)).toEqual(['provider-history-compat']);
    expect(agentConfig?.errorProcessors?.map(processor => processor.id)).toEqual([
      'stream-error-retry-processor',
      'prefill-error-handler',
      'provider-history-compat',
    ]);
  });

  it('answers goal-mode questions with the judge using exact option labels', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { answer: 'Verified' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('tell whale facts and wait for judge verification', 'openai/gpt-5.4-mini');

    const answer = await manager.answerQuestion(createState(), 'Is this a whale fact?', [
      { label: 'Verified', description: 'This is a whale fact.' },
      { label: 'Reject', description: 'This is not a whale fact.' },
    ]);

    expect(answer).toBe('Verified');
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.stringContaining('verify it yourself unless the goal explicitly requires human/user verification'),
      expect.objectContaining({ structuredOutput: { schema: expect.any(Object) } }),
    );
  });

  it('rejects goal-mode question answers outside the provided option labels', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { answer: 'Looks good' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('tell whale facts and wait for judge verification', 'openai/gpt-5.4-mini');

    const answer = await manager.answerQuestion(createState(), 'Is this a whale fact?', [
      { label: 'Verified', description: 'This is a whale fact.' },
      { label: 'Reject', description: 'This is not a whale fact.' },
    ]);

    expect(answer).toBe('(judge could not answer: returned "Looks good" outside available answers.)');
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ structuredOutput: { schema: expect.any(Object) } }),
    );
  });

  it('does not auto-continue when the judge says the assistant is waiting on the user', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({
        object: {
          decision: 'waiting',
          reason: 'The assistant correctly stopped after the first story and is waiting for feedback.',
        },
      }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('tell two stories and wait for feedback after each', 'openai/gpt-5.4-mini');

    const result = await manager.evaluateAfterTurn(createState());

    expect(result.continuation).toBeNull();
    expect(result.judgeResult).toEqual({
      decision: 'waiting',
      reason: 'The assistant correctly stopped after the first story and is waiting for feedback.',
    });
    expect(manager.getGoal()?.status).toBe('active');
    expect(manager.getGoal()?.turnsUsed).toBe(0);
  });

  it('tells the judge to keep waiting when the last waiting checkpoint gets a user question', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({
        object: {
          decision: 'waiting',
          reason: 'The required user feedback has not been provided yet.',
        },
      }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('write a draft and wait for user feedback before revising', 'openai/gpt-5.4-mini');

    const result = await manager.evaluateAfterTurn(createState());

    expect(mocks.agentConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining(
          'keep choosing "waiting" when the user\'s latest response asks a question',
        ),
      }),
    );
    expect(result.continuation).toBeNull();
    expect(result.judgeResult?.decision).toBe('waiting');
  });

  it('tells the judge that judge-controlled checkpoints should continue rather than wait', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({
        object: {
          decision: 'continue',
          reason: 'The judge is the continuation signal; provide the second fact now.',
        },
      }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal(
      'tell three facts. after each fact stop until the goal judge tells you to continue',
      'openai/gpt-5.4-mini',
    );

    const result = await manager.evaluateAfterTurn(createState());

    expect(mocks.agentConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('treat your own decision as that judge response'),
      }),
    );
    expect(result.continuation).toContain('The judge is the continuation signal; provide the second fact now.');
    expect(result.judgeResult?.decision).toBe('continue');
  });

  it('ignores a judge result when the evaluated goal is paused before the judge returns', async () => {
    let resolveOutput: ((value: { object: { decision: 'done'; reason: string } }) => void) | undefined;
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn(
        () =>
          new Promise(resolve => {
            resolveOutput = resolve;
          }),
      ),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    const evaluation = manager.evaluateAfterTurn(createState());
    await vi.waitFor(() => expect(resolveOutput).toBeDefined());
    manager.pause();
    resolveOutput?.({ object: { decision: 'done', reason: 'Looks complete.' } });

    await expect(evaluation).resolves.toEqual({ continuation: null, judgeResult: null });
    expect(manager.getGoal()?.status).toBe('paused');
    expect(manager.getGoal()?.turnsUsed).toBe(0);
  });

  it('ignores a judge result when the evaluated goal is cleared before the judge returns', async () => {
    let resolveOutput: ((value: { object: { decision: 'continue'; reason: string } }) => void) | undefined;
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn(
        () =>
          new Promise(resolve => {
            resolveOutput = resolve;
          }),
      ),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    const evaluation = manager.evaluateAfterTurn(createState());
    await vi.waitFor(() => expect(resolveOutput).toBeDefined());
    manager.clear();
    resolveOutput?.({ object: { decision: 'continue', reason: 'Keep going.' } });

    await expect(evaluation).resolves.toEqual({ continuation: null, judgeResult: null });
    expect(manager.getGoal()).toBeNull();
  });

  it('ignores a judge result when a different goal replaces the evaluated goal before the judge returns', async () => {
    let resolveOutput: ((value: { object: { decision: 'done'; reason: string } }) => void) | undefined;
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn(
        () =>
          new Promise(resolve => {
            resolveOutput = resolve;
          }),
      ),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('old goal', 'openai/gpt-5.4-mini');

    const evaluation = manager.evaluateAfterTurn(createState());
    await vi.waitFor(() => expect(resolveOutput).toBeDefined());
    const newGoal = manager.setGoal('new goal', 'openai/gpt-5.4-mini');
    resolveOutput?.({ object: { decision: 'done', reason: 'Old goal done.' } });

    await expect(evaluation).resolves.toEqual({ continuation: null, judgeResult: null });
    expect(manager.getGoal()).toEqual(newGoal);
    expect(manager.getGoal()?.status).toBe('active');
    expect(manager.getGoal()?.turnsUsed).toBe(0);
  });
});

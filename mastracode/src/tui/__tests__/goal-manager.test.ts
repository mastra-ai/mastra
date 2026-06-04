import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  agentConstructor: vi.fn(),
  createWorkspaceTools: vi.fn(),
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

vi.mock('@mastra/core/workspace', () => ({
  createWorkspaceTools: mocks.createWorkspaceTools,
  WORKSPACE_TOOLS: {
    FILESYSTEM: {
      READ_FILE: 'filesystem.read_file',
      WRITE_FILE: 'filesystem.write_file',
      EDIT_FILE: 'filesystem.edit_file',
      DELETE_FILE: 'filesystem.delete_file',
      LIST_FILES: 'filesystem.list_files',
      CREATE_DIRECTORY: 'filesystem.create_directory',
      GET_FILE_INFO: 'filesystem.get_file_info',
      SEARCH_FILES: 'filesystem.search_files',
      AST_EDIT: 'filesystem.ast_edit',
    },
    SANDBOX: {
      EXECUTE_COMMAND: 'sandbox.execute_command',
      GET_PROCESS_OUTPUT: 'sandbox.get_process_output',
      KILL_PROCESS: 'sandbox.kill_process',
    },
    LSP: { INSPECT: 'lsp.inspect' },
    SKILLS: {
      ACTIVATE: 'skills.activate',
      SEARCH: 'skills.search',
      READ: 'skills.read',
    },
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
    mocks.createWorkspaceTools.mockReset();
  });

  it('preserves turn count and accumulated active duration when resuming a paused goal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    const manager = new GoalManager();
    const goal = manager.setGoal('finish the task', 'openai/gpt-5.5');
    goal.turnsUsed = 3;
    vi.setSystemTime(new Date('2026-05-15T10:05:00.000Z'));
    manager.pause();

    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    manager.resume();
    vi.setSystemTime(new Date('2026-05-15T12:02:00.000Z'));
    manager.stopActiveTimer();

    expect(manager.getGoal()).toMatchObject({ status: 'active', turnsUsed: 3, activeDurationMs: 7 * 60_000 });
    vi.useRealTimers();
  });

  it('does not keep counting a persisted active timer after restart', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T15:00:00.000Z'));
    const manager = new GoalManager();

    manager.loadFromThreadMetadata({
      goal: {
        id: 'goal-1',
        objective: 'finish the task',
        status: 'active',
        turnsUsed: 1,
        maxTurns: 20,
        judgeModelId: 'openai/gpt-5.5',
        startedAt: '2026-05-15T10:00:00.000Z',
        activeStartedAt: '2026-05-15T10:00:00.000Z',
        activeDurationMs: 10 * 60_000,
      },
    });

    expect(manager.getGoal()).toMatchObject({ activeDurationMs: 10 * 60_000, activeStartedAt: undefined });
    vi.useRealTimers();
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

  it('pauses instead of sending a continuation when judge resume has no assistant response to evaluate', async () => {
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    const result = await manager.evaluateAfterTurn(
      createState({
        listMessages: vi.fn().mockResolvedValue([
          {
            role: 'user',
            content: [{ type: 'text', text: 'Continue the goal.' }],
          },
        ]),
      }),
      { requireAssistantMessage: true },
    );

    expect(result.continuation).toBeNull();
    expect(result.judgeResult).toEqual({
      decision: 'paused',
      reason: 'Judge could not evaluate this turn: no assistant response.',
    });
    expect(manager.getGoal()).toMatchObject({ status: 'paused', lastPauseWasJudgeFailure: true });
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('clears stale judge-failure state when budget exhaustion pauses without an assistant response', async () => {
    const manager = new GoalManager();
    const goal = manager.setGoal('finish the task', 'openai/gpt-5.4-mini', 1);
    goal.turnsUsed = 1;
    goal.lastPauseWasJudgeFailure = true;

    const result = await manager.evaluateAfterTurn(
      createState({
        listMessages: vi.fn().mockResolvedValue([{ role: 'user', content: [{ type: 'text', text: 'resume goal' }] }]),
      }),
    );

    expect(result).toEqual({ continuation: null, judgeResult: null });
    expect(manager.getGoal()).toMatchObject({ status: 'paused', lastPauseWasJudgeFailure: false });
  });

  it('clears stale judge-failure state when budget exhaustion pauses after judge continuation', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'continue', reason: 'Keep going.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    const goal = manager.setGoal('finish the task', 'openai/gpt-5.4-mini', 1);
    goal.lastPauseWasJudgeFailure = true;

    const result = await manager.evaluateAfterTurn(createState());

    expect(result.continuation).toBeNull();
    expect(result.judgeResult).toEqual({ decision: 'continue', reason: 'Keep going.' });
    expect(manager.getGoal()).toMatchObject({ status: 'paused', lastPauseWasJudgeFailure: false, turnsUsed: 1 });
  });

  it('pauses with a specific reason when the judge returns no structured output after retry', async () => {
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
    // Both the initial and retry calls should have been made
    expect(mocks.stream).toHaveBeenCalledTimes(2);
    expect(manager.getGoal()?.lastPauseWasJudgeFailure).toBe(true);
  });

  it('returns interrupted instead of retrying when aborted after empty output', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: undefined }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const abortController = new AbortController();
    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    abortController.abort();
    const result = await manager.evaluateAfterTurn(createState(), { abortSignal: abortController.signal });

    expect(result.judgeResult).toEqual({ decision: 'paused', reason: 'Judge evaluation was interrupted.' });
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(manager.getGoal()?.status).toBe('paused');
  });

  it('recovers via the retry follow-up prompt when the first stream has no structured output', async () => {
    let callCount = 0;
    mocks.stream.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          consumeStream: vi.fn().mockResolvedValue(undefined),
          getFullOutput: vi.fn().mockResolvedValue({ object: undefined }),
        };
      }
      return {
        consumeStream: vi.fn().mockResolvedValue(undefined),
        getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'continue', reason: 'Still working.' } }),
      };
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    const result = await manager.evaluateAfterTurn(createState());

    expect(result.judgeResult).toEqual({ decision: 'continue', reason: 'Still working.' });
    expect(result.continuation).toBeTruthy();
    expect(manager.getGoal()?.status).toBe('active');
    // The retry prompt should ask for JSON without tools
    expect(mocks.stream.mock.calls[1][0]).toContain('JSON');
  });

  it('passes maxSteps: 50 to the judge stream call', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'done', reason: 'Finished.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    await manager.evaluateAfterTurn(createState());

    expect(mocks.stream).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxSteps: 50 }));
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
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.stringContaining('Latest assistant message'),
      expect.objectContaining({
        memory: { thread: expectedThreadId, resource: 'resource-1' },
        structuredOutput: expect.objectContaining({ schema: expect.any(Object) }),
      }),
    );
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
    expect(result.continuation).toContain('[Goal attempt 1/50]');
    expect(result.continuation).toContain('Need one more step.');
  });

  it('passes full assistant content to the judge without truncating', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'done', reason: 'Complete.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });
    const longAssistant = 'x'.repeat(4500);
    const state = createState({
      listMessages: vi.fn().mockResolvedValue([
        { role: 'user', content: [{ type: 'text', text: 'Finish this.' }] },
        { role: 'assistant', content: [{ type: 'text', text: longAssistant }] },
      ]),
    } as Partial<TUIState['harness']>);
    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    await manager.evaluateAfterTurn(state);

    expect(mocks.stream).toHaveBeenCalledWith(expect.stringContaining(longAssistant), expect.any(Object));
    expect(mocks.stream.mock.calls[0]?.[0]).not.toContain('[truncated]');
  });

  it('configures the judge with only readonly workspace tools and disables approvals', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'done', reason: 'Complete.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });
    mocks.createWorkspaceTools.mockResolvedValue({
      view: { id: 'view', requireApproval: true, needsApprovalFn: vi.fn() },
      search_content: { id: 'search_content', requireApproval: true },
      find_files: { id: 'find_files', requireApproval: false },
      file_stat: { id: 'file_stat', requireApproval: true },
      lsp_inspect: { id: 'lsp_inspect', requireApproval: true },
      write_file: { id: 'write_file', requireApproval: false },
      execute_command: { id: 'execute_command', requireApproval: false },
    });
    const workspace = { id: 'workspace' };
    const state = createState({ getWorkspace: vi.fn(() => workspace) } as Partial<TUIState['harness']>);
    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    await manager.evaluateAfterTurn(state);

    expect(mocks.createWorkspaceTools).toHaveBeenCalledWith(workspace, { requestContext: {}, workspace });
    const agentConfig = mocks.agentConstructor.mock.calls[0]?.[0] as { tools?: Record<string, any> } | undefined;
    expect(Object.keys(agentConfig?.tools ?? {}).sort()).toEqual([
      'file_stat',
      'find_files',
      'lsp_inspect',
      'search_content',
      'view',
    ]);
    expect(agentConfig?.tools?.view.requireApproval).toBe(false);
    expect(agentConfig?.tools?.view.needsApprovalFn).toBeUndefined();
  });

  it('reports judge activity for readonly tool calls and passes abort signal', async () => {
    const fullStream = (async function* () {
      yield { type: 'tool-call', payload: { toolName: 'view', args: { path: 'src/file.ts' } } };
      yield { type: 'tool-call', payload: { toolName: 'search_content', args: { pattern: 'TODO' } } };
      yield { type: 'tool-call', toolName: 'find_files', input: { pattern: '**/*.ts' } };
    })();
    mocks.stream.mockResolvedValue({
      fullStream,
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'done', reason: 'Complete.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });
    const abortController = new AbortController();
    const onActivity = vi.fn();
    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    await manager.evaluateAfterTurn(createState(), { abortSignal: abortController.signal, onActivity });

    expect(onActivity).toHaveBeenCalledWith('read src/file.ts');
    expect(onActivity).toHaveBeenCalledWith('search "TODO"');
    expect(onActivity).toHaveBeenCalledWith('find files **/*.ts');
    expect(mocks.stream.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ abortSignal: abortController.signal }));
  });

  it('includes guidance to wait after answering a user question', async () => {
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'waiting', reason: 'Answered user question.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });
    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.4-mini');

    await manager.evaluateAfterTurn(createState());

    expect(mocks.agentConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('latest user message asks a question or requests clarification'),
      }),
    );
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

  it('keeps active goal timing running when the judge says to continue', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    mocks.stream.mockResolvedValue({
      consumeStream: vi.fn().mockResolvedValue(undefined),
      getFullOutput: vi.fn().mockResolvedValue({ object: { decision: 'continue', reason: 'Need one more step.' } }),
    });
    mocks.agentConstructor.mockImplementation(function () {
      return { stream: mocks.stream };
    });

    const manager = new GoalManager();
    manager.setGoal('finish the task', 'openai/gpt-5.5');
    vi.setSystemTime(new Date('2026-05-15T10:05:00.000Z'));

    const result = await manager.evaluateAfterTurn(createState());

    expect(result.continuation).toContain('Need one more step.');
    expect(manager.getGoal()).toMatchObject({ status: 'active', turnsUsed: 1, activeDurationMs: 0 });
    expect(manager.getGoal()?.activeStartedAt).toBe('2026-05-15T10:00:00.000Z');
    vi.useRealTimers();
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
    expect(manager.getGoal()?.activeStartedAt).toBeUndefined();
    expect(manager.getGoal()?.activeDurationMs).toBeGreaterThanOrEqual(0);
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

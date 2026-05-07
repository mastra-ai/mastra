import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent';
import { RequestContext } from '../../request-context';
import { MessageList } from '../message-list';

describe('Agent#executeOnFinish single-flight', () => {
  let agent: Agent;
  let handles: ReturnType<Agent['__testHandles']>;
  let coreSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    agent = new Agent({
      id: 'test-single-flight-agent',
      name: 'Test Single Flight Agent',
      instructions: 'test',
    });

    handles = agent.__testHandles();
    coreSpy = vi.spyOn(handles, 'executeOnFinishCore');
  });

  afterEach(() => {
    coreSpy.mockRestore();
  });

  const createMinimalOptions = (runId: string) => ({
    runId,
    result: {
      text: 'test',
      object: undefined,
      toolResults: [],
      toolCalls: [],
      usage: { totalTokens: 0 },
      steps: [],
    },
    thread: null,
    readOnlyMemory: true,
    threadId: 'thread-1',
    resourceId: 'resource-1',
    requestContext: new RequestContext(),
    agentSpan: undefined,
    memoryConfig: undefined,
    outputText: 'test',
    messageList: new MessageList(),
    threadExists: false,
    structuredOutput: false,
  });

  it('should only call executeOnFinishCore once when called concurrently with same runId', async () => {
    const runId = 'run-1-single-flight';
    const options = createMinimalOptions(runId);

    const [result1, result2] = await Promise.all([handles.executeOnFinish(options), handles.executeOnFinish(options)]);

    expect(coreSpy).toHaveBeenCalledTimes(1);
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();

    expect(handles.inProgressRunIds.has(runId)).toBe(false);
    expect(handles.completedRunIds.has(runId)).toBe(true);
  });

  it('should wait for in-flight execution and return when second call awaits same runId', async () => {
    const runId = 'run-2-wait-same';
    const options = createMinimalOptions(runId);

    let coreCompleted = false;
    coreSpy.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      coreCompleted = true;
    });

    const [result1, result2] = await Promise.all([handles.executeOnFinish(options), handles.executeOnFinish(options)]);

    expect(coreSpy).toHaveBeenCalledTimes(1);
    expect(coreCompleted).toBe(true);
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
  });

  it('should propagate error from in-flight execution to all callers', async () => {
    const runId = 'run-3-error-propagation';
    const options = createMinimalOptions(runId);
    const error = new Error('Test error from core');

    coreSpy.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      throw error;
    });

    const [promise1, promise2] = await Promise.allSettled([
      handles.executeOnFinish(options),
      handles.executeOnFinish(options),
    ]);

    expect(coreSpy).toHaveBeenCalledTimes(1);

    expect(promise1.status).toBe('rejected');
    expect(promise2.status).toBe('rejected');
    expect((promise1 as any).reason).toBe(error);
    expect((promise2 as any).reason).toBe(error);

    expect(handles.inProgressRunIds.has(runId)).toBe(false);
  });

  it('should allow retry after first execution failed', async () => {
    const runId = 'run-4-retry-after-failure';
    const options = createMinimalOptions(runId);
    const error = new Error('First attempt failed');

    coreSpy.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);

    const firstAttempt = handles.executeOnFinish(options);
    await expect(firstAttempt).rejects.toBe(error);

    expect(handles.completedRunIds.has(runId)).toBe(false);

    const secondAttempt = handles.executeOnFinish(options);
    await expect(secondAttempt).resolves.toBeUndefined();

    expect(coreSpy).toHaveBeenCalledTimes(2);
    expect(handles.completedRunIds.has(runId)).toBe(true);
  });

  it('should track different runIds independently', async () => {
    const runIdA = 'run-5a-independent';
    const runIdB = 'run-5b-independent';

    const optionsA = createMinimalOptions(runIdA);
    const optionsB = createMinimalOptions(runIdB);

    await Promise.all([handles.executeOnFinish(optionsA), handles.executeOnFinish(optionsB)]);

    expect(coreSpy).toHaveBeenCalledTimes(2);

    expect(handles.completedRunIds.has(runIdA)).toBe(true);
    expect(handles.completedRunIds.has(runIdB)).toBe(true);
  });

  it('should skip execution for already completed runId', async () => {
    const runId = 'run-6-skip-completed';
    const options = createMinimalOptions(runId);

    await handles.executeOnFinish(options);
    expect(coreSpy).toHaveBeenCalledTimes(1);

    await handles.executeOnFinish(options);
    expect(coreSpy).toHaveBeenCalledTimes(1);
  });
});

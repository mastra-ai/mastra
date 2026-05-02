import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { MessageList } from '../message-list';
import { MockLanguageModelV2 } from './mock-model';

function createMockModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    }),
  });
}

describe('Agent#executeOnFinish single-flight', () => {
  let agent: Agent;
  let handles: ReturnType<Agent['__testHandles']>;
  let listScorersSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    agent = new Agent({
      id: 'test-single-flight-agent',
      name: 'Test Single Flight Agent',
      instructions: 'test',
      model: createMockModel() as any,
    });

    handles = agent.__testHandles();
    listScorersSpy = vi.spyOn(agent, 'listScorers').mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createAgentSpan = () =>
    ({
      end: vi.fn(),
      error: vi.fn(),
    }) as any;

  const createMinimalOptions = (runId: string, agentSpan = createAgentSpan()) => ({
    runId,
    result: {
      text: 'test',
      object: undefined,
      files: [],
      toolResults: [],
      toolCalls: [],
      usage: { totalTokens: 0 },
      totalUsage: { totalTokens: 0 },
      steps: [],
      response: {
        id: `${runId}-response`,
        messages: [],
        dbMessages: [],
      },
    } as any,
    thread: null,
    readOnlyMemory: true,
    threadId: 'thread-1',
    resourceId: 'resource-1',
    requestContext: new RequestContext(),
    agentSpan,
    memoryConfig: undefined,
    outputText: 'test',
    messageList: new MessageList(),
    threadExists: false,
    structuredOutput: false,
  });

  it('only runs finish side effects once for concurrent calls with the same runId', async () => {
    const runId = 'run-1-single-flight';
    const agentSpan = createAgentSpan();
    const options = createMinimalOptions(runId, agentSpan);

    const [result1, result2] = await Promise.all([handles.executeOnFinish(options), handles.executeOnFinish(options)]);

    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
    expect(listScorersSpy).toHaveBeenCalledTimes(1);
    expect(agentSpan.end).toHaveBeenCalledTimes(1);
    expect(handles.inProgressRunIds.has(runId)).toBe(false);
    expect(handles.completedRunIds.has(runId)).toBe(true);
  });

  it('waits for the in-flight execution before the second call returns', async () => {
    const runId = 'run-2-wait-same';
    const agentSpan = createAgentSpan();
    const options = createMinimalOptions(runId, agentSpan);
    let scorerLookupCompleted = false;

    listScorersSpy.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      scorerLookupCompleted = true;
      return {};
    });

    const [result1, result2] = await Promise.all([handles.executeOnFinish(options), handles.executeOnFinish(options)]);

    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
    expect(scorerLookupCompleted).toBe(true);
    expect(listScorersSpy).toHaveBeenCalledTimes(1);
    expect(agentSpan.end).toHaveBeenCalledTimes(1);
  });

  it('propagates an in-flight execution error to all callers', async () => {
    const runId = 'run-3-error-propagation';
    const options = createMinimalOptions(runId);
    const invalidOptions = {
      ...options,
      result: {
        ...options.result,
        steps: undefined,
      },
    } as any;

    const [promise1, promise2] = await Promise.allSettled([
      handles.executeOnFinish(invalidOptions),
      handles.executeOnFinish(invalidOptions),
    ]);

    expect(promise1.status).toBe('rejected');
    expect(promise2.status).toBe('rejected');
    expect(handles.inProgressRunIds.has(runId)).toBe(false);
    expect(handles.completedRunIds.has(runId)).toBe(false);
  });

  it('allows retry after the first execution failed', async () => {
    const runId = 'run-4-retry-after-failure';
    const options = createMinimalOptions(runId);
    const invalidOptions = {
      ...options,
      result: {
        ...options.result,
        steps: undefined,
      },
    } as any;

    await expect(handles.executeOnFinish(invalidOptions)).rejects.toThrow();
    expect(handles.completedRunIds.has(runId)).toBe(false);

    await expect(handles.executeOnFinish(options)).resolves.toBeUndefined();

    expect(listScorersSpy).toHaveBeenCalledTimes(1);
    expect(handles.completedRunIds.has(runId)).toBe(true);
  });

  it('does not append duplicate response messages when retrying after a partial finish failure', async () => {
    const runId = 'run-4b-retry-after-partial-failure';
    const agentSpan = createAgentSpan();
    const options = createMinimalOptions(runId, agentSpan);
    options.result.response.dbMessages = [
      {
        id: 'assistant-response-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'hello' }],
      },
    ] as any;
    agentSpan.end.mockImplementationOnce(() => {
      throw new Error('span export failed after message append');
    });

    await expect(handles.executeOnFinish(options)).rejects.toThrow('span export failed after message append');
    expect(handles.completedRunIds.has(runId)).toBe(false);
    expect(options.messageList.get.all.db().filter(message => message.id === 'assistant-response-1')).toHaveLength(1);

    await expect(handles.executeOnFinish(options)).resolves.toBeUndefined();

    expect(options.messageList.get.all.db().filter(message => message.id === 'assistant-response-1')).toHaveLength(1);
    expect(agentSpan.end).toHaveBeenCalledTimes(2);
    expect(handles.completedRunIds.has(runId)).toBe(true);
  });

  it('tracks different runIds independently', async () => {
    const runIdA = 'run-5a-independent';
    const runIdB = 'run-5b-independent';

    await Promise.all([
      handles.executeOnFinish(createMinimalOptions(runIdA)),
      handles.executeOnFinish(createMinimalOptions(runIdB)),
    ]);

    expect(listScorersSpy).toHaveBeenCalledTimes(2);
    expect(handles.completedRunIds.has(runIdA)).toBe(true);
    expect(handles.completedRunIds.has(runIdB)).toBe(true);
  });

  it('skips side effects for an already completed runId', async () => {
    const runId = 'run-6-skip-completed';
    const agentSpan = createAgentSpan();
    const options = createMinimalOptions(runId, agentSpan);

    await handles.executeOnFinish(options);
    expect(listScorersSpy).toHaveBeenCalledTimes(1);
    expect(agentSpan.end).toHaveBeenCalledTimes(1);

    await handles.executeOnFinish(options);
    expect(listScorersSpy).toHaveBeenCalledTimes(1);
    expect(agentSpan.end).toHaveBeenCalledTimes(1);
  });
});

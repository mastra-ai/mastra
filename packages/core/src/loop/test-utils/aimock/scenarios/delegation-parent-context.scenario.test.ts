import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import type { MessageFilterContext } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines, anyToolResult } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: what a delegated sub-agent inherits from its supervisor.
 *
 * - transient prompt additions from `processLLMRequest` reach `messageFilter`
 * - observational-memory continuation hints are not forwarded, but OM system context is
 * - sub-agent memory identity is derived from the caller (#23903)
 * - `onDelegationStart` request-context mutations reach the delegated run
 */
describeForAllEngines('AIMock loop scenario: delegation parent context', engine => {
  const getMock = useLoopScenarioAimock();

  function delegateFixtures(llm: any) {
    llm.on(
      { endpoint: 'chat', predicate: req => !anyToolResult(req) },
      { toolCalls: [{ id: 'call_worker', name: 'agent-worker', arguments: { prompt: 'go' } }] },
    );
    llm.on({ endpoint: 'chat', predicate: req => !anyToolResult(req), sequenceIndex: 1 }, { content: 'Finished' });
    llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'Done.' });
  }

  function makeWorker(mock: { url: string }, instructions: any = 'You work.') {
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    return new Agent({
      id: 'worker',
      name: 'worker',
      description: 'Does the work',
      instructions,
      model: openai(SCENARIO_MODEL_ID),
    });
  }

  it('forwards transient request-processor messages to messageFilter', async () => {
    const mock = getMock();
    const messageFilter = vi.fn(({ messages }: MessageFilterContext) => messages);

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Original user message',
      agents: { worker: makeWorker(mock) },
      stopWhen: stepCountIs(3),
      inputProcessors: [
        {
          id: 'transient-context',
          processLLMRequest: ({ prompt }: any) => ({
            prompt: [...prompt, { role: 'user', content: [{ type: 'text', text: 'Transient parent context' }] }],
          }),
        },
      ],
      delegation: { messageFilter },
      fixtures: delegateFixtures,
    });

    expect(messageFilter).toHaveBeenCalledTimes(1);
    const forwarded = JSON.stringify(messageFilter.mock.calls[0]![0].messages);
    expect(forwarded).toContain('Transient parent context');
    expect(forwarded).toContain('Original user message');
  });

  it('excludes observational-memory continuation hints from delegated context', async () => {
    const mock = getMock();
    const messageFilter = vi.fn(({ messages }: MessageFilterContext) => messages);

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Real user request',
      agents: { worker: makeWorker(mock) },
      stopWhen: stepCountIs(3),
      inputProcessors: [
        {
          id: 'observational-memory',
          processInput: ({ messages, systemMessages }: any) => ({
            messages: [
              ...messages,
              {
                id: 'om-continuation',
                role: 'user',
                content: { format: 2, parts: [{ type: 'text', text: 'Synthetic continuation hint' }] },
                createdAt: new Date(),
              },
            ],
            systemMessages: [...systemMessages, { role: 'system', content: 'Observed parent history' }],
          }),
        },
      ],
      delegation: { messageFilter },
      fixtures: delegateFixtures,
    });

    const forwarded = JSON.stringify(messageFilter.mock.calls[0]![0].messages);
    expect(forwarded).toContain('Observed parent history');
    expect(forwarded).toContain('Real user request');
    expect(forwarded).not.toContain('Synthetic continuation hint');
  });

  it('derives sub-agent thread/resource identity from the caller (#23903)', async () => {
    const mock = getMock();
    const worker = makeWorker(mock);
    const streamSpy = vi.spyOn(worker, 'stream');

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Research dolphins',
      agents: { worker },
      memory: new MockMemory(),
      threadId: 'thread-1',
      resourceId: 'user-1',
      stopWhen: stepCountIs(3),
      fixtures: delegateFixtures,
    });

    expect(streamSpy).toHaveBeenCalledTimes(1);
    const options = streamSpy.mock.calls[0]![1] as { memory?: { thread?: unknown; resource?: unknown } };
    expect(options.memory?.resource).toBe('user-1-worker');
    expect(options.memory?.thread).toMatch(/^thread-1-/);
  });

  it('applies onDelegationStart request-context mutations to the delegated run', async () => {
    const mock = getMock();
    let seen: unknown;
    const worker = makeWorker(mock, (({ requestContext }: any) => {
      seen = requestContext.get('specialty');
      return 'You work.';
    }) as any);

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Do the work',
      agents: { worker },
      stopWhen: stepCountIs(3),
      delegation: {
        onDelegationStart: (context: any) => {
          context.requestContext.set('specialty', context.primitiveId);
        },
      },
      fixtures: delegateFixtures,
    });

    expect(seen).toBe('worker');
  });
});

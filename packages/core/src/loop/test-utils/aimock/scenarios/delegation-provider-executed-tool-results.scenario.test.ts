import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import type { MessageFilterContext } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines, anyToolResult } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: provider-executed tool parts must not survive into the delegated context.
 *
 * A provider-executed tool call and its result are two parts of the SAME assistant message
 * (AI SDK v5 puts `tool_result` inline, unlike a client tool whose result lives in a separate
 * `role: 'tool'` message). Stripping only the call therefore left an orphaned result, and OpenAI
 * rejected the sub-agent request with
 * "No tool call found for tool search output with call_id tsc_..." (#30092).
 *
 * A wire-level assertion is not needed here: AIMock does not validate call/result pairing, so a
 * broken request is served rather than rejected. The delegated context itself is the invariant.
 */
describeForAllEngines('AIMock loop scenario: delegation strips provider-executed tool results', engine => {
  const getMock = useLoopScenarioAimock();

  function makeWorker(mock: { url: string }) {
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    return new Agent({
      id: 'worker',
      name: 'worker',
      description: 'Does the work',
      instructions: 'You work.',
      model: openai(SCENARIO_MODEL_ID),
    });
  }

  function delegateFixtures(llm: any) {
    llm.on(
      { endpoint: 'chat', predicate: (req: any) => !anyToolResult(req) },
      { toolCalls: [{ id: 'call_worker', name: 'agent-worker', arguments: { prompt: 'go' } }] },
    );
    llm.on(
      { endpoint: 'chat', predicate: (req: any) => !anyToolResult(req), sequenceIndex: 1 },
      { content: 'Finished' },
    );
    llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'Done.' });
  }

  /**
   * A supervisor turn holding a completed OpenAI hosted tool search. Both Responses item ids are
   * required: without them the converter already drops the part as unreplayable, which would hide
   * the delegation bug behind a different one.
   */
  const supervisorHistory = () =>
    [
      { role: 'user', content: 'Look something up.' },
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-tool_search',
            toolCallId: 'tsc_1',
            state: 'output-available',
            input: { arguments: { paths: ['some-tool'] }, call_id: null },
            output: { tools: [] },
            providerExecuted: true,
            callProviderMetadata: { openai: { itemId: 'tsc_1', resultItemId: 'tso_1' } },
          },
          { type: 'text', text: 'Found it.' },
        ],
      },
      { role: 'user', content: 'Now delegate.' },
    ] as any;

  const partsOf = (messages: MessageFilterContext['messages']) =>
    messages.flatMap(message => (Array.isArray(message.content) ? message.content : []));

  it('does not forward an orphaned provider-executed tool result to the sub-agent', async () => {
    const mock = getMock();
    const messageFilter = vi.fn(({ messages }: MessageFilterContext) => messages);

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: supervisorHistory(),
      agents: { worker: makeWorker(mock) },
      stopWhen: stepCountIs(3),
      delegation: { messageFilter },
      fixtures: delegateFixtures,
    });

    expect(messageFilter).toHaveBeenCalledTimes(1);
    const forwardedMessages = messageFilter.mock.calls[0]![0].messages;
    const forwardedParts = partsOf(forwardedMessages);

    // The provider-executed result must not outlive its stripped call, and neither half survives.
    expect(forwardedParts.filter(part => part.type === 'tool-result')).toEqual([]);
    expect(forwardedParts.filter(part => part.type === 'tool-call')).toEqual([]);

    // ...while the rest of the parent context still reaches the sub-agent.
    const forwarded = JSON.stringify(forwardedMessages);
    expect(forwarded).toContain('Found it.');
    expect(forwarded).toContain('Look something up.');
    expect(forwarded).toContain('Now delegate.');
  });
});

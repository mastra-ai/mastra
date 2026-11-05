/** Value-bearing business objects must survive tool execution, persistence, and the next provider request. */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: tool output sibling fields', engine => {
  const getMock = useLoopScenarioAimock();

  it.each([
    { value: 20, unit: 'celsius' },
    { type: 'measurement', value: 20, unit: 'celsius' },
  ])('keeps the full measurement %j (#25191, #25680)', async measurement => {
    const memory = new MockMemory({ storage: new InMemoryStore(), options: { lastMessages: 100 } });
    const threadId = 'measurement-thread';
    const resourceId = 'measurement-customer';
    await memory.createThread({ threadId, resourceId });
    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Read the temperature and include its unit.',
      memory,
      threadId,
      resourceId,
      maxSteps: 2,
      collectChunks: true,
      tools: {
        measure: createTool({
          id: 'measure',
          description: 'Read a temperature',
          inputSchema: z.object({}),
          execute: async () => measurement,
        }),
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'measurement-call', name: 'measure', arguments: {} }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: '20 celsius' });
      },
    });
    expect(await output.text).toBe('20 celsius');
    expect(requests).toHaveLength(2);
    const toolMessages = requests[1]!.body.messages.filter(message => message.role === 'tool');
    expect(toolMessages).toHaveLength(1);
    expect(JSON.parse(String(toolMessages[0]!.content))).toEqual(measurement);
    const results = (chunks ?? []).filter(chunk => chunk.type === 'tool-result');
    expect(results).toHaveLength(1);
    expect(results[0]!.payload.result).toEqual(measurement);
    const { messages } = await memory.recall({ threadId, resourceId, perPage: false });
    const invocations = messages.flatMap(message =>
      (message.content.parts ?? []).flatMap(part => (part.type === 'tool-invocation' ? [part.toolInvocation] : [])),
    );
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({ state: 'result', result: measurement });
  });
});

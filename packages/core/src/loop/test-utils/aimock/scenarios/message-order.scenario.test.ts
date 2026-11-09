import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * The model must see the conversation in the order it happened: system
 * instructions first, then caller-supplied history, then memory history, then
 * the new user turn, with each tool call immediately followed by its result.
 *
 * Replaces the hash-matched `stream.e2e` recordings, which asserted the same
 * ordering against the OpenAI request body.
 */

type Summary = { role: string; text?: string; toolCallIds?: string[]; toolCallId?: string };

function textOf(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part: any) => (typeof part === 'string' ? part : (part?.text ?? ''))).join('');
  }
  return undefined;
}

function summarize(messages: any[]): Summary[] {
  return messages.map(m => {
    const summary: Summary = { role: m.role };
    const text = textOf(m.content);
    if (text) summary.text = text;
    if (m.tool_calls?.length) summary.toolCallIds = m.tool_calls.map((c: any) => c.id);
    if (m.tool_call_id) summary.toolCallId = m.tool_call_id;
    return summary;
  });
}

async function saveThread(memory: MockMemory, threadId: string, resourceId: string) {
  await memory.saveThread({
    thread: { id: threadId, title: threadId, resourceId, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
  });
}

describeForAllEngines('AIMock loop scenario: message order sent to the model', engine => {
  const getMock = useLoopScenarioAimock();

  it('sends caller-supplied multi-turn input after the system message, in order', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Doing well, thanks.' });
    const { agent } = await createSharedAgent(llm, { engine, instructions: 'test!' });

    const stream = await agent.stream([
      { role: 'user', content: 'hello!' },
      { role: 'assistant', content: 'hi, how are you?' },
      { role: 'user', content: "I'm good, how are you?" },
    ]);
    let text = '';
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'text-delta') text += chunk.payload?.text ?? '';
    }
    expect(text).toBe('Doing well, thanks.');

    const requests = llm.getRequests();
    expect(requests).toHaveLength(1);
    expect(summarize(requests[0]?.body?.messages ?? [])).toEqual([
      { role: 'system', text: 'test!' },
      { role: 'user', text: 'hello!' },
      { role: 'assistant', text: 'hi, how are you?' },
      { role: 'user', text: "I'm good, how are you?" },
    ]);
  });

  it('places recalled memory history between the system message and the new user turn', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = `order-memory-${engine}`;
    const resourceId = 'order-memory-user';
    await saveThread(memory, threadId, resourceId);

    await runLoopScenario({
      engine,
      llm,
      instructions: 'test!',
      prompt: 'hello!',
      memory,
      threadId,
      resourceId,
      fixtures: m => {
        m.on({ endpoint: 'chat' }, { content: 'hi, how are you?' });
      },
    });

    llm.clearRequests();
    llm.clearFixtures();
    llm.resetMatchCounts();

    const { requests } = await runLoopScenario({
      engine,
      llm,
      instructions: 'test!',
      prompt: "I'm good, how are you?",
      memory,
      threadId,
      resourceId,
      fixtures: m => {
        m.on({ endpoint: 'chat' }, { content: 'Doing well.' });
      },
    });

    expect(requests).toHaveLength(1);
    expect(summarize(requests[0]?.body?.messages ?? [])).toEqual([
      { role: 'system', text: 'test!' },
      { role: 'user', text: 'hello!' },
      // Recalled assistant turns go out as Responses API item references, so only the role is visible here.
      { role: 'assistant' },
      { role: 'user', text: "I'm good, how are you?" },
    ]);
  });

  it('keeps each tool call next to its result in the response and in recalled history', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = `order-tools-${engine}`;
    const resourceId = 'order-tools-user';
    await saveThread(memory, threadId, resourceId);

    const tools = {
      get_weather: {
        parameters: { type: 'object', properties: { postalCode: { type: 'string' } }, required: ['postalCode'] },
        execute: async ({ postalCode }: { postalCode: string }) => `The weather in ${postalCode} is 70, feels like 65.`,
      },
    };

    const first = await runLoopScenario({
      engine,
      llm,
      instructions: 'Testing tool calls!',
      prompt: 'What is the weather in London?',
      memory,
      threadId,
      resourceId,
      tools,
      fixtures: m => {
        m.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_weather_1', name: 'get_weather', arguments: { postalCode: 'London' } }] },
        );
        m.on({ endpoint: 'chat', hasToolResult: true }, { content: 'It feels like 65 in London.' });
      },
    });

    const response = await first.output.response;
    expect(
      (response.messages ?? []).map((m: any) => ({
        role: m.role,
        types: (Array.isArray(m.content) ? m.content : [{ type: 'text' }]).map((p: any) => p.type),
      })),
    ).toEqual([
      { role: 'assistant', types: ['tool-call'] },
      { role: 'tool', types: ['tool-result'] },
      { role: 'assistant', types: ['text'] },
    ]);

    llm.clearRequests();
    llm.clearFixtures();
    llm.resetMatchCounts();

    const { requests } = await runLoopScenario({
      engine,
      llm,
      instructions: 'Testing tool calls!',
      prompt: 'What was the tool you just used?',
      memory,
      threadId,
      resourceId,
      tools,
      fixtures: m => {
        m.on({ endpoint: 'chat' }, { content: 'I used get_weather.' });
      },
    });

    const history = summarize(requests[0]?.body?.messages ?? []);
    expect(history.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant', 'user']);
    expect(history[2]?.toolCallIds).toEqual(['call_weather_1']);
    expect(history[3]).toMatchObject({ toolCallId: 'call_weather_1', text: expect.stringContaining('feels like 65') });
    expect(history[5]?.text).toBe('What was the tool you just used?');
  });
});

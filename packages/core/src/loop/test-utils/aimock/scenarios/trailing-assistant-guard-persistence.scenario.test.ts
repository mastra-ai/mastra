/**
 * AIMock Scenario: TrailingAssistantGuard persistence (#27520)
 *
 * Gemini 3+ rejects requests that end on a model turn, and Anthropic 4.6+ rejects
 * an assistant prefill with structured output, so TrailingAssistantGuard appends a
 * synthetic user turn ("Continue." / "Generate the structured response.") when the
 * input ends on an assistant prefill. That turn exists only for the provider request. The reply that follows
 * is the continuation of the prefill, so it must be saved into the same assistant
 * message, exactly as it is for providers that need no guard.
 *
 * Runs go through `agent.stream` directly because `runLoopScenario` only takes a
 * string prompt and this needs an input that ends on an assistant message.
 */

import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

function textOf(message: { content: { parts?: Array<{ type: string; text?: string }> } }) {
  return (message.content.parts ?? []).map(part => (part.type === 'text' ? part.text : '')).join('');
}

describeForAllEngines('AIMock loop scenario: trailing assistant guard persistence', engine => {
  const getMock = useLoopScenarioAimock();

  it('saves the reply into the prefilled assistant message when the guard fires', async () => {
    const llm = getMock();
    llm.on({}, { content: ' Alfama in the morning.' });
    const gemini = createGoogleGenerativeAI({
      apiKey: 'aimock-test-key',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1beta`,
    });
    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, {
      engine,
      memory,
      model: () => gemini('gemini-3-flash'),
    });
    const threadId = `thread-guard-prefill-${engine}`;
    const resourceId = 'guard-resource';

    const result = await agent.stream(
      [
        { role: 'user', content: 'Plan a weekend in Lisbon.' },
        { role: 'assistant', content: 'Day 1:' },
      ],
      { memory: { thread: threadId, resource: resourceId } },
    );
    const output = isDurableEngineVariant(engine) ? result.output : result;
    await output.consumeStream();

    // Guard: the guard really fired, so the provider request ended on the synthetic user turn.
    const [request] = llm.getRequests();
    expect(request!.path).toContain('gemini-3-flash:streamGenerateContent');
    expect(request!.body.messages.map(message => [message.role, message.content])).toEqual([
      ['system', expect.any(String)],
      ['user', 'Plan a weekend in Lisbon.'],
      ['assistant', 'Day 1:'],
      ['user', 'Continue.'],
    ]);

    await vi.waitFor(async () => {
      const { messages } = await memory.recall({ threadId, resourceId });
      expect(messages.map(message => [message.role, textOf(message)])).toEqual([
        ['user', 'Plan a weekend in Lisbon.'],
        ['assistant', 'Day 1: Alfama in the morning.'],
      ]);
    });
  });

  it('keeps a tool step and the final reply in the prefilled assistant message', async () => {
    const llm = getMock();
    llm.on({ hasToolResult: false }, { toolCalls: [{ id: 'call_weather', name: 'weather', arguments: {} }] });
    llm.on({ hasToolResult: true }, { content: ' Sunny, so start at Alfama.' });
    const weather = createTool({
      id: 'weather',
      description: 'Get the weather',
      inputSchema: z.object({}),
      execute: async () => 'sunny',
    });
    const gemini = createGoogleGenerativeAI({
      apiKey: 'aimock-test-key',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1beta`,
    });
    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, {
      engine,
      memory,
      tools: { weather },
      model: () => gemini('gemini-3-flash'),
    });
    const threadId = `thread-guard-prefill-tool-${engine}`;
    const resourceId = 'guard-resource';

    const result = await agent.stream(
      [
        { role: 'user', content: 'Plan a weekend in Lisbon.' },
        { role: 'assistant', content: 'Day 1:' },
      ],
      { memory: { thread: threadId, resource: resourceId } },
    );
    const output = isDurableEngineVariant(engine) ? result.output : result;
    await output.consumeStream();

    const requests = llm.getRequests();
    expect(requests).toHaveLength(2);
    expect(requests[0]!.body.messages.at(-1)).toEqual({ role: 'user', content: 'Continue.' });
    // The second request ends on the tool result, so the guard does not fire and the
    // synthetic turn from the first request is not replayed.
    expect(requests[1]!.body.messages.map(message => message.role)).toEqual(['system', 'user', 'assistant', 'tool']);

    await vi.waitFor(async () => {
      const { messages } = await memory.recall({ threadId, resourceId });
      expect(messages.map(message => [message.role, textOf(message)])).toEqual([
        ['user', 'Plan a weekend in Lisbon.'],
        ['assistant', 'Day 1: Sunny, so start at Alfama.'],
      ]);
      expect(messages[1]!.content.parts.some(part => part.type === 'tool-invocation')).toBe(true);
    });
  });
  it('saves the structured reply into the prefilled assistant message on Anthropic 4.6+', async () => {
    const llm = getMock();
    // @ai-sdk/anthropic sends structured output as a forced `json` tool and reads the object from its input.
    llm.on({}, { toolCalls: [{ id: 'toolu_plan', name: 'json', arguments: { plan: 'Alfama' } }] });
    // aimock normalizes Anthropic requests to chat format, so capture the raw wire body.
    const sentBodies: Array<{ messages: Array<{ role: string; content: Array<{ text?: string }> }> }> = [];
    const anthropic = createAnthropic({
      apiKey: 'aimock-test-key',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
      fetch: async (url, init) => {
        sentBodies.push(JSON.parse(init!.body as string));
        return fetch(url, init);
      },
    });
    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, {
      engine,
      memory,
      model: () => anthropic('claude-sonnet-4-6'),
    });
    const threadId = `thread-guard-prefill-structured-${engine}`;
    const resourceId = 'guard-resource';

    const result = await agent.stream(
      [
        { role: 'user', content: 'Plan a weekend in Lisbon.' },
        { role: 'assistant', content: 'Day 1:' },
      ],
      {
        memory: { thread: threadId, resource: resourceId },
        structuredOutput: { schema: z.object({ plan: z.string() }) },
      },
    );
    const output = isDurableEngineVariant(engine) ? result.output : result;
    await output.consumeStream();
    expect(await output.object).toEqual({ plan: 'Alfama' });

    // Guard: the request ended on the synthetic structured-output turn.
    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0]!.messages.map(message => [message.role, message.content[0]?.text])).toEqual([
      ['user', 'Plan a weekend in Lisbon.'],
      ['assistant', 'Day 1:'],
      ['user', 'Generate the structured response.'],
    ]);

    await vi.waitFor(async () => {
      const { messages } = await memory.recall({ threadId, resourceId });
      expect(messages.map(message => [message.role, textOf(message)])).toEqual([
        ['user', 'Plan a weekend in Lisbon.'],
        ['assistant', 'Day 1:{"plan":"Alfama"}'],
      ]);
    });
  });
});

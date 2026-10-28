import { jsonSchema, stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { useScriptedProviders } from '../scripted-sse';

/**
 * Ported from the AI SDK tools suite (formerly test-utils/tools.ts), which drove
 * loop() with hand-built stream parts. Function tools run through aimock's
 * OpenAI chat fixtures; provider-executed tools run through a real v6 Anthropic
 * provider parsing scripted `server_tool_use` / `web_search_tool_result` blocks.
 * The PTC case (tool input stream with no final tool-call) lives in
 * streamed-tool-call-fallback.scenario.test.ts.
 */

const resourceId = 'ported-user';

async function assistantParts(memory: MockMemory, threadId: string) {
  const { messages } = await memory.recall({ threadId, resourceId });
  return messages.filter(m => m.role === 'assistant').flatMap(m => m.content.parts) as any[];
}

describeForAllEngines('AIMock loop scenario: ported tools (function tools)', engine => {
  const getMock = useLoopScenarioAimock();

  it('calls onInputStart, onInputDelta and onInputAvailable in order with the streamed input', async () => {
    const calls: { type: string; options: any }[] = [];
    const tool = createTool({
      id: 'test-tool',
      description: 'Records input callbacks',
      inputSchema: z.object({ value: z.string() }),
      onInputStart: options => void calls.push({ type: 'onInputStart', options }),
      onInputDelta: options => void calls.push({ type: 'onInputDelta', options }),
      onInputAvailable: options => void calls.push({ type: 'onInputAvailable', options }),
      execute: async ({ value }) => `${value}-result`,
    });

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'test-input',
      tools: { 'test-tool': tool },
      stopWhen: stepCountIs(1),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call-1', name: 'test-tool', arguments: { value: 'Sparkle Day' } }] },
        );
      },
    });

    const types = calls.map(c => c.type);
    expect(types[0]).toBe('onInputStart');
    expect(types.at(-1)).toBe('onInputAvailable');
    expect(types.slice(1, -1).every(t => t === 'onInputDelta')).toBe(true);
    expect(types.length).toBeGreaterThan(2);
    expect(calls.every(c => c.options.toolCallId === 'call-1')).toBe(true);
    expect(
      calls
        .filter(c => c.type === 'onInputDelta')
        .map(c => c.options.inputTextDelta)
        .join(''),
    ).toBe('{"value":"Sparkle Day"}');
    expect(calls.at(-1)!.options.input).toEqual({ value: 'Sparkle Day' });
    const userText = calls[0]!.options.messages
      .filter((m: any) => m.role === 'user')
      .flatMap((m: any) => m.content)
      .map((p: any) => p.text);
    expect(userText).toContain('test-input');
  });

  it('sends a tool declared with a raw JSON schema and runs its call', async () => {
    const executed: unknown[] = [];
    const tool1 = {
      inputSchema: jsonSchema<{ value: string }>({
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: false,
      }),
      execute: async (input: { value: string }) => {
        executed.push(input);
        return 'ok';
      },
    };

    const { requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'test-input',
      tools: { tool1 } as any,
      toolChoice: 'required',
      stopWhen: stepCountIs(1),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call-1', name: 'tool1', arguments: { value: 'value' } }] },
        );
      },
    });

    const body = requests[0]!.body as any;
    expect(body.tool_choice).toBe('required');
    expect(body.tools).toEqual([
      expect.objectContaining({
        type: 'function',
        function: expect.objectContaining({
          name: 'tool1',
          parameters: expect.objectContaining({
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
          }),
        }),
      }),
    ]);
    expect(executed).toEqual([{ value: 'value' }]);
    const result = (chunks as any[]).find(c => c.type === 'tool-result');
    expect(result?.payload).toMatchObject({ toolCallId: 'call-1', toolName: 'tool1', result: 'ok' });
  });

  it('separates tool calls from consecutive tool-only steps with a step-start', async () => {
    const memory = new MockMemory();
    const weather = createTool({
      id: 'weather',
      description: 'Weather lookup',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, temperature: 72 }),
    });

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'test-input',
      tools: { weather },
      memory,
      threadId: 'tool-only-steps',
      resourceId,
      stopWhen: stepCountIs(4),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call-1', name: 'weather', arguments: { city: 'London' } }] },
        );
        llm.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call-2', name: 'weather', arguments: { city: 'Paris' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Both cities are nice.' });
      },
    } as any);

    const parts = (await assistantParts(memory, 'tool-only-steps')).map(p =>
      p.type === 'tool-invocation' ? `tool:${p.toolInvocation.toolCallId}` : p.type,
    );
    const call1 = parts.indexOf('tool:call-1');
    const call2 = parts.indexOf('tool:call-2');
    expect(call1).toBeGreaterThanOrEqual(0);
    expect(call2).toBeGreaterThan(call1);
    expect(parts.slice(call1 + 1, call2)).toContain('step-start');
  });
});

const webSearchResult = {
  type: 'web_search_result',
  url: 'https://example.com',
  title: 'Example',
  encrypted_content: 'enc',
};

function anthropicWebSearch() {
  return [
    {
      type: 'message_start',
      message: { id: 'msg_a', model: 'claude-sonnet-4-5', usage: { input_tokens: 3, output_tokens: 0 } },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Before the search.' } },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} },
    },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"query":"mastra"}' } },
    { type: 'content_block_stop', index: 1 },
    {
      type: 'content_block_start',
      index: 2,
      content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [webSearchResult] },
    },
    { type: 'content_block_stop', index: 2 },
    { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: 'After the search.' } },
    { type: 'content_block_stop', index: 3 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
}

describeForAllEngines('AIMock loop scenario: ported tools (provider-executed)', engine => {
  const p = useScriptedProviders();

  it('streams a provider-executed call and result without running a local tool, and persists them in stream order', async () => {
    const memory = new MockMemory();
    p.anthropic.responses.push(anthropicWebSearch());

    const { chunks, output } = await runLoopScenario({
      engine,
      llm: p.llm,
      model: p.anthropicModel,
      prompt: 'test-input',
      memory,
      threadId: 'provider-executed',
      resourceId,
      collectChunks: true,
      fixtures: () => {},
    } as any);

    const all = chunks as any[];
    expect(all.some(c => c.type === 'error')).toBe(false);
    const call = all.find(c => c.type === 'tool-call');
    expect(call?.payload).toMatchObject({
      toolCallId: 'srvtoolu_1',
      toolName: 'web_search',
      args: { query: 'mastra' },
      providerExecuted: true,
    });
    const result = all.find(c => c.type === 'tool-result');
    // v6 tool-result parts carry no providerExecuted flag (every model-emitted result is provider-executed);
    // the flag comes from the call and is what memory persists.
    expect(result?.payload).toMatchObject({ toolCallId: 'srvtoolu_1', toolName: 'web_search' });
    expect(result?.payload.result).toEqual([
      {
        url: 'https://example.com',
        title: 'Example',
        pageAge: null,
        encryptedContent: 'enc',
        type: 'web_search_result',
      },
    ]);
    expect(await output.text).toBe('Before the search.After the search.');
    expect(p.anthropic.requests).toHaveLength(1);

    const parts = await assistantParts(memory, 'provider-executed');
    expect(parts.filter(part => !['step-start', 'source'].includes(part.type)).map(part => part.type)).toEqual([
      'text',
      'tool-invocation',
      'text',
    ]);
    const toolPart = parts.find(part => part.type === 'tool-invocation');
    expect(toolPart.providerExecuted).toBe(true);
    expect(toolPart.toolInvocation).toMatchObject({
      state: 'result',
      toolCallId: 'srvtoolu_1',
      toolName: 'web_search',
    });
    expect(toolPart.toolInvocation.result).toEqual(result?.payload.result);
  });
});

import { createOpenAI } from '@ai-sdk/openai-v6';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, isDurableEngineVariant, runLoopScenario } from '../aimock-scenario';
import { geminiChunk, geminiFinal, useScriptedProviders } from '../scripted-sse';

/**
 * Ported from the AI SDK loop options suite (formerly test-utils/options.ts),
 * which drove loop() with hand-built stream parts. Here real v6 providers parse
 * scripted wire responses (Gemini for tool calls, reasoning and sources, OpenAI
 * Responses for interleaved items) and build the requests, and every case runs
 * on every engine. Cases that need call-time options runLoopScenario does not
 * forward (onChunk on durable engines, includeRawChunks, prepareStep) call
 * agent.stream() on a shared scenario agent directly.
 */

const types = (chunks: any[], ...keep: string[]) => chunks.filter(c => keep.includes(c.type));

const toolCallStep = [
  geminiChunk([{ thought: true, text: 'thinking' }]),
  geminiFinal([{ functionCall: { name: 'tool1', args: { value: 'value' } } }]),
];
const textStep = [geminiChunk([{ text: 'Hello, ' }]), geminiFinal([{ text: 'world!' }])];

function responsesEvents(events: unknown[]) {
  return [
    { type: 'response.created', response: { id: 'resp_1', created_at: 1, model: 'gpt-5' } },
    ...events,
    {
      type: 'response.completed',
      response: { incomplete_details: null, usage: { input_tokens: 3, output_tokens: 10 } },
    },
  ];
}

describeForAllEngines('AIMock loop scenario: ported loop options (real providers)', engine => {
  const p = useScriptedProviders();
  const durable = isDurableEngineVariant(engine);

  const tool1 = (execute: (input: { value: string }, context?: any) => unknown = async () => 'result1') =>
    createTool({
      id: 'tool1',
      description: 'Tool one',
      inputSchema: z.object({ value: z.string() }),
      execute: execute as any,
    });

  async function streamAgent(tools: Record<string, any>, options: Record<string, unknown>, model = p.geminiModel) {
    const { agent } = await createSharedAgent(p.llm, { engine, tools, model: () => model() });
    const result: any = await (agent as any).stream('test-input', options);
    const output = durable ? result.output : result;
    const chunks: any[] = [];
    try {
      for await (const chunk of output.fullStream) chunks.push(chunk);
    } catch {
      // Durable streams can reject with AbortError after the abort chunk.
    }
    result.cleanup?.();
    return { output, chunks };
  }

  it('hands the tool a signal that aborts when the caller aborts', async () => {
    p.gemini.responses.push(toolCallStep, textStep);
    const controller = new AbortController();
    const seen: { context?: any; before?: boolean; after?: boolean } = {};

    await streamAgent(
      {
        tool1: tool1(async (_input, context) => {
          // The tool gets a signal derived from the caller's, so assert it follows the caller.
          seen.context = context;
          seen.before = context?.abortSignal?.aborted;
          controller.abort();
          seen.after = context?.abortSignal?.aborted;
          return 'tool result';
        }),
      },
      { abortSignal: controller.signal, maxSteps: 3 },
    );

    expect(seen.context?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(seen.context?.abortSignal).not.toBe(controller.signal);
    expect(seen.context?.agent?.toolCallId).toEqual(expect.any(String));
    expect(seen.before).toBe(false);
    expect(seen.after).toBe(true);
  });

  it('passes provider options through to the provider request', async () => {
    p.gemini.responses.push([geminiFinal([{ text: 'provider metadata test' }])]);

    const { output } = await runLoopScenario({
      engine,
      llm: p.llm,
      model: () => p.geminiModel(),
      prompt: 'test-input',
      fixtures: () => {},
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 7 } } },
    });

    expect(await output.text).toBe('provider metadata test');
    expect(p.gemini.requests[0].generationConfig.thinkingConfig).toEqual({ thinkingBudget: 7 });
  });

  it('runs two steps, sending the tool call and its result back, and reports both steps', async () => {
    p.gemini.responses.push(toolCallStep, textStep);
    const onStepFinish: any[] = [];
    const onFinish: any[] = [];

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: p.llm,
      model: () => p.geminiModel(),
      prompt: 'test-input',
      fixtures: () => {},
      collectChunks: true,
      tools: { tool1: tool1() },
      stopWhen: stepCountIs(3),
      onStepFinish: (event: any) => void onStepFinish.push(event),
      onFinish: (event: any) => void onFinish.push(event),
    });

    // Both step inputs declare the tool; the second one carries the call and its result.
    expect(p.gemini.requests).toHaveLength(2);
    for (const request of p.gemini.requests) {
      expect(request.tools[0].functionDeclarations.map((d: any) => d.name)).toEqual(['tool1']);
    }
    const second = p.gemini.requests[1].contents;
    expect(second.map((c: any) => c.role)).toEqual(['user', 'model', 'user']);
    expect(second[1].parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ functionCall: expect.objectContaining({ name: 'tool1', args: { value: 'value' } }) }),
      ]),
    );
    expect(second[2].parts[0].functionResponse).toMatchObject({
      name: 'tool1',
      response: { name: 'tool1', content: 'result1' },
    });

    expect(
      types(
        chunks!,
        'step-start',
        'reasoning-delta',
        'tool-call',
        'tool-result',
        'text-delta',
        'step-finish',
        'finish',
      ).map(c => [c.type, c.payload.text ?? c.payload.toolName ?? c.payload.stepResult?.reason]),
    ).toEqual([
      ['step-start', undefined],
      ['reasoning-delta', 'thinking'],
      ['tool-call', 'tool1'],
      ['tool-result', 'tool1'],
      ['step-finish', 'tool-calls'],
      ['step-start', undefined],
      ['text-delta', 'Hello, '],
      ['text-delta', 'world!'],
      ['step-finish', 'stop'],
      ['finish', 'stop'],
    ]);

    expect(onStepFinish.map(s => s.finishReason)).toEqual(['tool-calls', 'stop']);
    expect(onFinish).toHaveLength(1);
    expect(onFinish[0].steps).toHaveLength(2);
    expect(onFinish[0].text).toBe('Hello, world!');

    const messages = ((await output.response) as any).messages;
    expect(messages.map((m: any) => [m.role, m.content.map((c: any) => c.type)])).toEqual([
      ['assistant', ['reasoning', 'tool-call']],
      ['tool', ['tool-result']],
      ['assistant', ['text']],
    ]);
  });

  it('calls prepareStep with the step number, previous steps, messages and model', async () => {
    p.gemini.responses.push(toolCallStep, textStep);
    const calls: any[] = [];

    await streamAgent(
      { tool1: tool1() },
      {
        maxSteps: 3,
        prepareStep: (args: any) => {
          calls.push({
            stepNumber: args.stepNumber,
            steps: args.steps.map((s: any) => s.finishReason),
            roles: args.messages.map((m: any) => m.role),
            modelId: args.model.modelId,
          });
          return args.stepNumber === 1 ? { activeTools: [] } : undefined;
        },
      },
    );

    expect(calls).toEqual([
      { stepNumber: 0, steps: [], roles: ['user'], modelId: 'gemini-2.5-flash' },
      { stepNumber: 1, steps: ['tool-calls'], roles: ['user', 'assistant'], modelId: 'gemini-2.5-flash' },
    ]);
    // The second step's activeTools: [] reached the provider.
    expect(p.gemini.requests[0].tools).toBeDefined();
    expect(p.gemini.requests[1].tools).toBeUndefined();
  });

  it('still forwards the model error to the stream when onFinish is defined', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: p.llm,
      // No endpoint is mounted here, so the provider call fails with a 404.
      model: () => createOpenAI({ apiKey: 'aimock', baseURL: `${p.llm.url}/missing` }).responses('gpt-5'),
      prompt: 'test-input',
      fixtures: () => {},
      collectChunks: true,
      maxRetries: 0,
      errorProcessors: [],
      modelSettings: { maxRetries: 0 },
      expectStreamError: true,
      onFinish: () => {},
      onError: () => {},
    });

    expect(chunks!.slice(0, 3).map(c => c.type)).toEqual(['start', 'step-start', 'error']);
    expect(String(chunks![2].payload.error?.message ?? chunks![2].payload.error)).toContain('No fixture matched');
  });

  it('passes every chunk to onChunk in stream order', async () => {
    p.gemini.responses.push(
      [
        geminiChunk([{ text: 'Hello' }]),
        geminiChunk([{ thought: true, text: 'Feeling clever' }]),
        geminiChunk([{ functionCall: { name: 'tool1', args: { value: 'test' } } }]),
        geminiFinal([{ text: ' World' }], {
          groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com', title: 'Example' } }] },
        }),
      ],
      [geminiFinal([{ text: 'done' }])],
    );
    const seen: any[] = [];

    const { chunks } = await streamAgent(
      { tool1: tool1(async ({ value }) => `${value}-result`) },
      { maxSteps: 1, onChunk: (chunk: any) => void seen.push(chunk) },
    );

    const pick = (list: any[]) =>
      types(list, 'text-delta', 'reasoning-delta', 'tool-call', 'tool-result', 'source').map(c => [
        c.type,
        c.payload.text ?? c.payload.url ?? (c.payload.result as string) ?? c.payload.toolName,
      ]);
    expect(pick(seen)).toEqual([
      ['text-delta', 'Hello'],
      ['reasoning-delta', 'Feeling clever'],
      ['tool-call', 'tool1'],
      // Gemini emits the grounding sources of a chunk ahead of its text.
      ['source', 'https://example.com'],
      ['text-delta', ' World'],
      ['tool-result', 'test-result'],
    ]);
    expect(pick(seen)).toEqual(pick(chunks));
  });

  it('forwards raw provider chunks to the stream and onChunk only when includeRawChunks is enabled', async () => {
    const reply = () => [geminiChunk([{ text: 'Hello' }]), geminiFinal([{ text: ', world!' }])];
    p.gemini.responses.push(reply(), reply(), reply());

    const onChunk: any[] = [];
    const enabled = await streamAgent({}, { includeRawChunks: true, onChunk: (c: any) => void onChunk.push(c) });
    const disabled = await streamAgent({}, { includeRawChunks: false });
    const unset = await streamAgent({}, {});

    // The provider only emits raw parts when the flag reaches it, so these also prove it is forwarded.
    expect(types(enabled.chunks, 'raw').map(c => c.payload)).toEqual(reply());
    expect(types(onChunk, 'raw').map(c => c.payload)).toEqual(reply());
    expect(types(disabled.chunks, 'raw')).toEqual([]);
    expect(types(unset.chunks, 'raw')).toEqual([]);
    expect(await unset.output.text).toBe('Hello, world!');
  });

  it('streams interleaved text and reasoning items under their own ids', async () => {
    const reasoning = (id: string, index: number) => ({
      type: 'response.output_item.added',
      output_index: index,
      item: { type: 'reasoning', id, encrypted_content: null, summary: [] },
    });
    const reasoningDone = (id: string, index: number, text: string) => ({
      type: 'response.output_item.done',
      output_index: index,
      item: { type: 'reasoning', id, encrypted_content: null, summary: [{ type: 'summary_text', text }] },
    });
    const summary = (id: string, delta: string) => ({
      type: 'response.reasoning_summary_text.delta',
      item_id: id,
      summary_index: 0,
      delta,
    });
    const message = (id: string, index: number, done = false) => ({
      type: done ? 'response.output_item.done' : 'response.output_item.added',
      output_index: index,
      item: { type: 'message', id },
    });
    const text = (id: string, delta: string) => ({ type: 'response.output_text.delta', item_id: id, delta });
    p.openai.responses.push(
      responsesEvents([
        reasoning('rs_0', 0),
        { type: 'response.reasoning_summary_part.added', item_id: 'rs_0', summary_index: 0 },
        message('msg_1', 1),
        summary('rs_0', 'Thinking...'),
        text('msg_1', 'Hello, '),
        message('msg_2', 2),
        text('msg_2', 'This is '),
        reasoning('rs_3', 3),
        { type: 'response.reasoning_summary_part.added', item_id: 'rs_3', summary_index: 0 },
        summary('rs_3', 'Separate thoughts'),
        text('msg_2', 'a test.'),
        text('msg_1', 'world!'),
        reasoningDone('rs_0', 0, 'Thinking...'),
        message('msg_2', 2, true),
        reasoningDone('rs_3', 3, 'Separate thoughts'),
        message('msg_1', 1, true),
      ]),
    );

    const { chunks, output } = await runLoopScenario({
      engine,
      llm: p.llm,
      model: () => p.openaiModel(),
      prompt: 'test-input',
      fixtures: () => {},
      collectChunks: true,
    });

    const streamed = types(chunks!, 'text-start', 'text-delta', 'text-end', 'reasoning-delta').map(c => [
      c.type,
      c.payload.id,
      c.payload.text,
    ]);
    expect(streamed).toEqual([
      ['text-start', 'msg_1', undefined],
      ['reasoning-delta', 'rs_0:0', 'Thinking...'],
      ['text-delta', 'msg_1', 'Hello, '],
      ['text-start', 'msg_2', undefined],
      ['text-delta', 'msg_2', 'This is '],
      ['reasoning-delta', 'rs_3:0', 'Separate thoughts'],
      ['text-delta', 'msg_2', 'a test.'],
      ['text-delta', 'msg_1', 'world!'],
      ['text-end', 'msg_2', undefined],
      ['text-end', 'msg_1', undefined],
    ]);
    expect(await output.text).toBe('Hello, This is a test.world!');
  });

  it('stops the stream at the abort and fires onAbort with the streamed text', async () => {
    p.llm.on(
      { endpoint: 'chat' },
      { content: 'Hello there, this reply gets cut short.' },
      { chunkSize: 4, latency: 30 },
    );
    const controller = new AbortController();
    const onAbort = vi.fn();
    const { agent } = await createSharedAgent(p.llm, { engine });
    const result: any = await (agent as any).stream('test-input', { abortSignal: controller.signal, onAbort });
    const output = durable ? result.output : result;
    const chunks: any[] = [];
    try {
      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
        if (chunk.type === 'text-delta') controller.abort();
      }
    } catch {
      // Durable streams can reject with AbortError after the abort chunk.
    }
    result.cleanup?.();

    const seq = chunks.map(c => c.type).filter((t, i, all) => t !== all[i - 1]);
    expect(seq.slice(0, 5)).toEqual(['start', 'step-start', 'text-start', 'text-delta', 'abort']);
    expect(seq).not.toContain('error');
    expect(seq).not.toContain('step-finish');
    await vi.waitFor(() => expect(onAbort).toHaveBeenCalledTimes(1));
    expect(onAbort.mock.calls[0]![0].text.length).toBeGreaterThan(0);
  });

  it('keeps the first step in the stream when the abort lands in the second step', async () => {
    p.llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'tool1', arguments: { value: 'value' } }] },
    );
    p.llm.on(
      { endpoint: 'chat', hasToolResult: true },
      { content: 'Hello there, this reply gets cut short.' },
      { chunkSize: 4, latency: 30 },
    );
    const controller = new AbortController();
    const { agent } = await createSharedAgent(p.llm, { engine, tools: { tool1: tool1() } });
    const result: any = await (agent as any).stream('test-input', { abortSignal: controller.signal, maxSteps: 3 });
    const output = durable ? result.output : result;
    const chunks: any[] = [];
    try {
      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
        if (chunk.type === 'text-delta') controller.abort();
      }
    } catch {
      // Durable streams can reject with AbortError after the abort chunk.
    }
    result.cleanup?.();

    const seq = types(chunks, 'step-start', 'tool-call', 'tool-result', 'step-finish', 'text-delta', 'abort', 'error')
      .map(c => c.type)
      .filter((t, i, all) => t !== all[i - 1]);
    expect(seq).toEqual(['step-start', 'tool-call', 'tool-result', 'step-finish', 'step-start', 'text-delta', 'abort']);
    expect(types(chunks, 'tool-result')[0].payload.result).toBe('result1');
  });
});

import type { LanguageModelV2, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { ToolSearchProcessor } from '../../../processors';
import type { Processor } from '../../../processors';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { prepareForDurableExecution } from '../preparation';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
});

function processor(id: string, seen: string[]) {
  return {
    id,
    processInput: ({ messages }) => {
      seen.push(`${id}:input`);
      return messages;
    },
    processLLMRequest: ({ prompt }) => {
      seen.push(`${id}:request`);
      return { prompt };
    },
  } satisfies Processor;
}

function model() {
  const doStream = vi.fn<LanguageModelV2['doStream']>(async () => ({
    stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: 'text' },
      { type: 'text-delta', id: 'text', delta: 'OK' },
      { type: 'text-end', id: 'text' },
      { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    ]),
    warnings: [],
  }));
  return { model: new MockLanguageModelV2({ doStream }), doStream };
}

describe('durable input configuration', () => {
  it('preserves explicit and omitted configuration through the durable wrapper', async () => {
    const inputs = vi.fn(async () => [processor('configured', [])]);
    const base = new Agent({
      id: 'wrapper',
      name: 'Wrapper',
      instructions: 'Test.',
      model: model().model,
      inputProcessors: inputs,
    });
    const durable = createDurableAgent({ agent: base });
    const context = new RequestContext();
    expect(await durable.listInputProcessors(context, [])).toEqual([]);
    expect(inputs).not.toHaveBeenCalled();
    expect(await durable.listInputProcessors(context)).toHaveLength(1);
    expect(inputs).toHaveBeenCalledTimes(1);
  });

  it('resolves constructor configuration once and preserves input and provider hook order', async () => {
    const seen: string[] = [];
    const inputs = vi.fn(async () => [processor('first', seen), processor('second', seen)]);
    const fixture = model();
    const base = new Agent({
      id: 'ordered',
      name: 'Ordered',
      instructions: 'Test.',
      model: fixture.model,
      inputProcessors: inputs,
    });
    const durable = createDurableAgent({ agent: base });
    const mastra = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    cleanups.push(() => mastra.shutdown());
    // Mastra also inspects configured workflows at registration, outside this invocation.
    inputs.mockClear();

    const response = await durable.stream('Hello');
    const chunks = [];
    for await (const chunk of response.fullStream) chunks.push(chunk);

    expect(inputs).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['first:input', 'second:input', 'first:request', 'second:request']);
    expect(fixture.doStream).toHaveBeenCalledTimes(1);
    expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload.text === 'OK')).toBe(true);
  });

  it.each(['default', 'call'] as const)(
    'honors %s input overrides in hooks and native processor tools',
    async source => {
      const seen: string[] = [];
      const inputs = vi.fn(async () => [processor('constructor', seen)]);
      const search = new ToolSearchProcessor({ tools: {}, ttl: 0 });
      cleanups.push(async () => {
        await search.clearAllState();
      });
      const override = [processor('override', seen), search];
      const defaults = vi.fn(async () => ({ inputProcessors: override }));
      const base = new Agent({
        id: `override-${source}`,
        name: 'Override',
        instructions: 'Test.',
        model: model().model,
        inputProcessors: inputs,
        ...(source === 'default' ? { defaultOptions: defaults } : {}),
      });
      const result = await prepareForDurableExecution({
        agent: base,
        messages: 'Hello',
        ...(source === 'call' ? { options: { inputProcessors: override } } : {}),
      });
      expect(inputs).not.toHaveBeenCalled();
      expect(seen).toEqual(['override:input']);
      expect(result.registryEntry.llmRequestInputProcessors?.map(p => p.id)).toEqual(['override', search.id]);
      expect(result.registryEntry.tools).toHaveProperty('search_tools');
      expect(result.registryEntry.tools).toHaveProperty('load_tool');
    },
  );

  it('keeps automatic working memory and output hooks when an empty input override removes configured tools', async () => {
    const search = new ToolSearchProcessor({ tools: {}, ttl: 0 });
    cleanups.push(async () => {
      await search.clearAllState();
    });
    const inputs = vi.fn(async () => [search]);
    const memory = new MockMemory({ storage: new InMemoryStore(), options: { workingMemory: { enabled: false } } });
    await memory.updateWorkingMemory({
      threadId: 'unused',
      resourceId: 'resource',
      workingMemory: 'The saved room is Cedar Nine.',
      memoryConfig: { workingMemory: { enabled: true, scope: 'resource' } },
    });
    const output = { id: 'output', processOutputResult: ({ messages }) => messages } satisfies Processor;
    const base = new Agent({
      id: 'empty',
      name: 'Empty',
      instructions: 'Test.',
      model: model().model,
      memory,
      inputProcessors: inputs,
      defaultOptions: { inputProcessors: [search] },
    });
    const result = await prepareForDurableExecution({
      agent: base,
      messages: 'Hello',
      options: {
        inputProcessors: [],
        outputProcessors: [output],
        memory: {
          thread: 'thread',
          resource: 'resource',
          options: { workingMemory: { enabled: true, scope: 'resource' } },
        },
      },
    });
    expect(inputs).not.toHaveBeenCalled();
    expect(result.registryEntry.tools).not.toHaveProperty('search_tools');
    expect(result.registryEntry.outputProcessors).toEqual([output]);
    expect(JSON.stringify(result.messageList.getAllSystemMessages())).toContain('The saved room is Cedar Nine.');
  });

  it('resolves fresh permissions across preparations and rejects a revoked request before calling the model', async () => {
    const seen: string[] = [];
    const context = new RequestContext();
    context.set('allowed', true);
    const inputs = vi.fn(async ({ requestContext }: { requestContext: RequestContext }) => {
      if (!requestContext.get('allowed')) throw new Error('PERMISSION_DENIED');
      return [processor('allowed', seen)];
    });
    const fixture = model();
    const base = new Agent({
      id: 'permissions',
      name: 'Permissions',
      instructions: 'Test.',
      model: fixture.model,
      inputProcessors: inputs,
    });
    const prepare = () => prepareForDurableExecution({ agent: base, messages: 'Hello', requestContext: context });
    await prepare();
    context.set('allowed', false);
    await expect(prepare()).rejects.toThrow('PERMISSION_DENIED');
    context.set('allowed', true);
    await prepare();
    expect(inputs).toHaveBeenCalledTimes(3);
    expect(seen).toEqual(['allowed:input', 'allowed:input']);
    expect(fixture.doStream).not.toHaveBeenCalled();
  });

  it('honors output overrides while executing a per-call input override', async () => {
    const seen: string[] = [];
    const inputs = vi.fn(async () => [processor('constructor', seen)]);
    const fixture = model();
    const output = vi.fn(({ part }) => part);
    const base = new Agent({
      id: 'output',
      name: 'Output',
      instructions: 'Test.',
      model: fixture.model,
      inputProcessors: inputs,
    });
    const durable = createDurableAgent({ agent: base });
    const mastra = new Mastra({ agents: { durable }, storage: new InMemoryStore(), logger: false });
    cleanups.push(() => mastra.shutdown());
    inputs.mockClear();
    const response = await durable.stream('Hello', {
      inputProcessors: [processor('call', seen)],
      outputProcessors: [{ id: 'output', processOutputStream: output }],
    });
    for await (const _chunk of response.fullStream) {
      /* Drain native completion. */
    }
    expect(inputs).not.toHaveBeenCalled();
    expect(seen).toEqual(['call:input', 'call:request']);
    expect(output.mock.calls.some(([args]) => args.part.type === 'text-delta')).toBe(true);
  });

  it('rechecks configuration on cold preparation without replaying saved input hooks', async () => {
    const seen: string[] = [];
    const context = new RequestContext();
    context.set('allowed', true);
    const search = new ToolSearchProcessor({ tools: {}, ttl: 0 });
    cleanups.push(async () => {
      await search.clearAllState();
    });
    const inputs = vi.fn(async ({ requestContext }: { requestContext: RequestContext }) => {
      if (!requestContext.get('allowed')) throw new Error('PERMISSION_DENIED');
      return [processor('saved', seen), search];
    });
    const fixture = model();
    const base = new Agent({
      id: 'cold',
      name: 'Cold',
      instructions: 'Test.',
      model: fixture.model,
      inputProcessors: inputs,
    });
    const first = await prepareForDurableExecution({
      agent: base,
      messages: 'Keep this message.',
      requestContext: context,
    });
    const resumeMessageListState = first.messageList.serialize();
    const resume = () =>
      prepareForDurableExecution({
        agent: base,
        messages: [],
        requestContext: context,
        resumeMessageListState,
      });
    const restored = await resume();
    expect(inputs).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(['saved:input']);
    expect(restored.messageList.get.all.db()).toEqual(first.messageList.get.all.db());
    expect(restored.registryEntry.tools).toHaveProperty('search_tools');
    context.set('allowed', false);
    await expect(resume()).rejects.toThrow('PERMISSION_DENIED');
    expect(inputs).toHaveBeenCalledTimes(3);
    expect(seen).toEqual(['saved:input']);
    expect(fixture.doStream).not.toHaveBeenCalled();
  });
});

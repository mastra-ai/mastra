import { describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../../logger/noop-logger';
import { isProcessorWorkflow } from '../../processors';
import type { Processor, ProcessorStreamWriter } from '../../processors';
import { ProcessorRunner } from '../../processors/runner';
import type { ProcessorState } from '../../processors/runner';
import { ProcessorStepSchema } from '../../processors/step-schema';
import { RequestContext } from '../../request-context';
import { ChunkFrom } from '../../stream/types';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';
import { MessageList } from '../message-list';

function textPart(text: string) {
  return {
    type: 'text-delta' as const,
    runId: 'run',
    from: ChunkFrom.AGENT,
    payload: { id: 'text', text },
  };
}

async function setup(processors: Processor[], nested: boolean) {
  let reference = createWorkflow({
    id: 'reference',
    options: { validateInputs: false },
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
  });
  for (const processor of processors) reference = reference.then(createStep(processor));
  const agent = new Agent({
    id: 'parity',
    name: 'parity',
    instructions: 'test',
    model: 'openai/gpt-4o',
    outputProcessors: nested ? [reference.commit()] : processors,
  });
  const resolved = await agent.listResolvedOutputProcessors();
  const workflow = resolved[0]!;
  if (!isProcessorWorkflow(workflow)) throw new Error('Expected processor workflow');
  const runner = new ProcessorRunner({
    agent,
    agentName: agent.name,
    logger: noopLogger,
    inputProcessors: [],
    outputProcessors: resolved,
  });
  const states = new Map<string, ProcessorState<unknown>>();
  const messages = new MessageList();
  return { agent, runner, states, messages, workflow };
}

describe.each([false, true])('stream adapter parity (explicit workflow: %s)', nested => {
  it.each([null, undefined])('preserves transform order and stops on %s', async dropped => {
    const last = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const second = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => {
      if (part.type !== 'text-delta') return part;
      return part.payload.text === 'DROP'
        ? dropped
        : { ...part, payload: { ...part.payload, text: `${part.payload.text}!` } };
    });
    const { runner, states, messages } = await setup(
      [
        {
          id: 'upper',
          processOutputStream: ({ part }) =>
            part.type === 'text-delta'
              ? { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } }
              : part,
        },
        { id: 'filter', processOutputStream: second },
        { id: 'last', processOutputStream: last },
      ],
      nested,
    );
    expect((await runner.processPart(textPart('hello'), states, undefined, undefined, messages)).part).toEqual(
      textPart('HELLO!'),
    );
    expect((await runner.processPart(textPart('drop'), states, undefined, undefined, messages)).part).toBe(dropped);
    expect(second.mock.calls.map(([{ part }]) => part.type === 'text-delta' && part.payload.text)).toEqual([
      'HELLO',
      'DROP',
    ]);
    expect(last).toHaveBeenCalledTimes(1);
  });

  it('retains per-processor state and original chunk history through outputResult', async () => {
    const histories: string[][] = [];
    const final = vi.fn<NonNullable<Processor['processOutputResult']>>(({ messages }) => messages);
    const { runner, states, messages } = await setup(
      [
        {
          id: 'counter',
          processOutputStream: ({ part, state, streamParts }) => {
            state.count = Number(state.count ?? 0) + 1;
            histories.push(streamParts.map(chunk => (chunk.type === 'text-delta' ? chunk.payload.text : chunk.type)));
            return part.type === 'text-delta'
              ? { ...part, payload: { ...part.payload, text: `${part.payload.text}${state.count}` } }
              : part;
          },
          processOutputResult: final,
        },
        {
          id: 'isolated',
          processOutputStream: ({ part, state }) => {
            expect(state.count).toBeUndefined();
            return part;
          },
        },
      ],
      nested,
    );
    expect((await runner.processPart(textPart('a'), states, undefined, undefined, messages)).part).toEqual(
      textPart('a1'),
    );
    expect((await runner.processPart(textPart('b'), states, undefined, undefined, messages)).part).toEqual(
      textPart('b2'),
    );
    await runner.runOutputProcessors(messages);
    expect(histories).toEqual([['a'], ['a', 'b']]);
    expect(final).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ count: 2 }) }));
  });

  it('creates a shared request context per chunk when none is supplied', async () => {
    const contexts: RequestContext[] = [];
    const writer = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part, requestContext }) => {
      expect(requestContext).toBeInstanceOf(RequestContext);
      expect(requestContext?.get('chunk')).toBeUndefined();
      requestContext?.set('chunk', part);
      return part;
    });
    const reader = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part, requestContext }) => {
      expect(requestContext).toBeInstanceOf(RequestContext);
      expect(requestContext?.get('chunk')).toBe(part);
      if (requestContext) contexts.push(requestContext);
      return part;
    });
    const { runner, states, messages } = await setup(
      [
        { id: 'writer', processOutputStream: writer },
        { id: 'reader', processOutputStream: reader },
      ],
      nested,
    );
    for (const text of ['one', 'two']) {
      const part = textPart(text);
      expect((await runner.processPart(part, states, undefined, undefined, messages)).part).toEqual(part);
    }
    expect(writer).toHaveBeenCalledTimes(2);
    expect(reader).toHaveBeenCalledTimes(2);
    expect(contexts).toHaveLength(2);
    expect(contexts[0]).not.toBe(contexts[1]);
  });

  it('retains data-part opt-in, request context, retry count, custom writes and signals', async () => {
    const skipped = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const requestContext = new RequestContext();
    requestContext.set('tenant', 'test-tenant');
    const custom = vi.fn<ProcessorStreamWriter['custom']>().mockResolvedValue(undefined);
    const optedIn = vi.fn<NonNullable<Processor['processOutputStream']>>(
      async ({ part, requestContext: context, retryCount, writer, sendSignal, agent }) => {
        expect(context).toBe(requestContext);
        expect(context?.get('tenant')).toBe('test-tenant');
        expect(retryCount).toBe(2);
        expect(agent?.id).toBe('parity');
        await writer?.custom({ type: 'data-derived', data: { source: part.type } });
        await sendSignal?.({ type: 'system-reminder', contents: 'Review output' });
        return part;
      },
    );
    const { runner, states, messages } = await setup(
      [
        { id: 'opted-in', processDataParts: true, processOutputStream: optedIn },
        { id: 'skipped', processOutputStream: skipped },
      ],
      nested,
    );
    const part = { type: 'data-source' as const, runId: 'run', from: ChunkFrom.AGENT, data: { value: 1 } };
    expect((await runner.processPart(part, states, undefined, requestContext, messages, 2, { custom })).part).toEqual(
      part,
    );
    expect(optedIn).toHaveBeenCalledTimes(1);
    expect(skipped).not.toHaveBeenCalled();
    expect(custom).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data-derived', data: { source: 'data-source' } }),
    );
    expect(messages.get.all.db().some(message => message.role === 'signal')).toBe(true);
    expect(custom).toHaveBeenCalledTimes(1);
  });

  it('preserves TripWire identity, retry metadata and stops the chain', async () => {
    const last = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const { runner, states, messages } = await setup(
      [
        {
          id: 'guard',
          processOutputStream: ({ abort }) => abort('blocked', { retry: true, metadata: { rule: 'test' } }),
        },
        { id: 'last', processOutputStream: last },
      ],
      nested,
    );
    expect(await runner.processPart(textPart('unsafe'), states, undefined, undefined, messages)).toEqual({
      part: null,
      blocked: true,
      reason: 'blocked',
      processorId: 'guard',
      tripwireOptions: { retry: true, metadata: { rule: 'test' } },
    });
    expect(last).not.toHaveBeenCalled();
  });

  it('retains the original part and stops remaining adapters on generic failure', async () => {
    const last = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const failing = vi.fn<NonNullable<Processor['processOutputStream']>>(() => {
      throw new Error('test failure');
    });
    const { runner, states, messages } = await setup(
      [
        {
          id: 'transform',
          processOutputStream: ({ part }) =>
            part.type === 'text-delta' ? { ...part, payload: { ...part.payload, text: 'changed' } } : part,
        },
        { id: 'failing', processOutputStream: failing },
        { id: 'last', processOutputStream: last },
      ],
      nested,
    );
    expect(await runner.processPart(textPart('original'), states, undefined, undefined, messages)).toEqual({
      part: textPart('original'),
      blocked: false,
    });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(last).not.toHaveBeenCalled();
  });
});

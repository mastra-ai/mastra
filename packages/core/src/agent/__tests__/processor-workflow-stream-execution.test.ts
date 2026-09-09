import { describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../../logger';
import type { Processor } from '../../processors';
import { isProcessorWorkflow } from '../../processors';
import { ProcessorRunner, ProcessorState } from '../../processors/runner';
import { RequestContext } from '../../request-context';
import { ChunkFrom } from '../../stream/types';
import { Agent } from '../agent';
import { MessageList } from '../message-list';

function textPart(text: string) {
  return { type: 'text-delta' as const, runId: 'run', from: ChunkFrom.AGENT, payload: { id: 'text', text } };
}

async function setup(processors: Processor[]) {
  const agent = new Agent({
    id: 'stream-processors',
    name: 'stream-processors',
    instructions: 'test',
    model: 'openai/gpt-4o',
    outputProcessors: processors,
  });
  const resolved = await agent.listResolvedOutputProcessors();
  const workflow = resolved[0]!;
  if (!isProcessorWorkflow(workflow)) throw new Error('Expected generated workflow');
  const createRun = vi.spyOn(workflow, 'createRun');
  const states = new Map<string, ProcessorState<unknown>>();
  const runner = new ProcessorRunner({
    outputProcessors: resolved,
    inputProcessors: [],
    agentName: 'test',
    logger: noopLogger,
    processorStates: states,
    agent,
  });
  return { agent, workflow, createRun, states, runner, messages: new MessageList() };
}

describe('generated processor workflows with stream hooks', () => {
  it.each([1, 100])('runs hooks without creating workflow runs for %i chunks', async count => {
    const received: number[] = [];
    const stream = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part, state, streamParts }) => {
      state.count = Number(state.count ?? 0) + 1;
      received.push(streamParts.length);
      return part;
    });
    const final = vi.fn<NonNullable<Processor['processOutputResult']>>(({ messages, state }) => {
      expect(state.count).toBe(count);
      return messages;
    });
    const otherFinal = vi.fn<NonNullable<Processor['processOutputResult']>>(({ messages }) => messages);
    const { runner, states, messages, createRun } = await setup([
      { id: 'stream', processOutputStream: stream, processOutputResult: final },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `final-${i}`, processOutputResult: otherFinal })),
    ]);

    for (let i = 0; i < count; i++) {
      const part = textPart('x');
      expect(await runner.processPart(part, states, undefined, undefined, messages)).toEqual({ part, blocked: false });
    }
    expect(stream).toHaveBeenCalledTimes(count);
    expect(received).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    expect(createRun.mock.calls).toHaveLength(0);
    expect(final).not.toHaveBeenCalled();
    await runner.runOutputProcessors(messages);
    expect(createRun).toHaveBeenCalledTimes(1);
    expect(final).toHaveBeenCalledTimes(1);
    expect(otherFinal).toHaveBeenCalledTimes(6);
  });

  it('preserves order, shared stream history, request context, writer and dropped parts', async () => {
    const context = new RequestContext();
    context.set('test', 'value');
    const custom = vi.fn(async () => {});
    const seen: string[] = [];
    const { runner, states, messages, createRun } = await setup([
      {
        id: 'first',
        async processOutputStream({ part, writer, requestContext, messageList, retryCount }) {
          expect(requestContext).toBe(context);
          expect(messageList).toBe(messages);
          expect(retryCount).toBe(2);
          if (part.type !== 'text-delta') return part;
          await writer?.custom({ type: 'data-status', data: { phase: 'streaming' } });
          if (part.payload.text === 'drop') return null;
          return { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } };
        },
      },
      {
        id: 'second',
        processOutputStream({ part, streamParts }) {
          if (part.type === 'text-delta') seen.push(part.payload.text);
          expect(streamParts[0]).toEqual(textPart('hello'));
          return part;
        },
      },
    ]);
    const first = await runner.processPart(textPart('hello'), states, undefined, context, messages, 2, { custom });
    expect(first.part).toEqual(textPart('HELLO'));
    const dropped = await runner.processPart(textPart('drop'), states, undefined, context, messages, 2, { custom });
    expect(dropped.part).toBeNull();
    expect(seen).toEqual(['HELLO']);
    expect(custom).toHaveBeenCalledTimes(2);
    expect(createRun.mock.calls).toHaveLength(0);
  });

  it('preserves tripwire details and does not run downstream hooks', async () => {
    const downstream = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const { runner, states, messages, createRun } = await setup([
      {
        id: 'guard',
        processOutputStream({ abort }) {
          return abort('blocked', { retry: true, metadata: { rule: 'test' } });
        },
      },
      { id: 'downstream', processOutputStream: downstream },
    ]);
    expect(await runner.processPart(textPart('hello'), states, undefined, undefined, messages)).toEqual({
      part: null,
      blocked: true,
      reason: 'blocked',
      tripwireOptions: { retry: true, metadata: { rule: 'test' } },
      processorId: 'guard',
    });
    expect(downstream).not.toHaveBeenCalled();
    expect(createRun.mock.calls).toHaveLength(0);
  });

  it.each([null, undefined])('stops the chain when a hook returns %s', async dropped => {
    const downstream = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const { runner, states, messages } = await setup([
      { id: 'drop', processOutputStream: () => dropped },
      { id: 'downstream', processOutputStream: downstream },
    ]);
    expect((await runner.processPart(textPart('hello'), states, undefined, undefined, messages)).part).toBe(dropped);
    expect(downstream).not.toHaveBeenCalled();
  });

  it('keeps the original part on a hook error and does not run downstream hooks', async () => {
    const downstream = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const { runner, states, messages } = await setup([
      {
        id: 'throws',
        processOutputStream() {
          throw new Error('processor failed');
        },
      },
      { id: 'downstream', processOutputStream: downstream },
    ]);
    const part = textPart('hello');
    expect(await runner.processPart(part, states, undefined, undefined, messages)).toEqual({ part, blocked: false });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('reprocesses stashed parts through the complete chain and provides sendSignal', async () => {
    const { runner, states, messages, createRun } = await setup([
      {
        id: 'stash',
        async processOutputStream({ part, state, sendSignal }) {
          if (part.type === 'text-delta' && part.payload.text === 'hello') {
            state.__mastraReprocessPart = textPart('stashed');
            await sendSignal?.({ type: 'system-reminder', contents: 'synthetic reminder' });
          }
          return part;
        },
      },
      {
        id: 'uppercase',
        processOutputStream({ part }) {
          return part.type === 'text-delta'
            ? { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } }
            : part;
        },
      },
    ]);
    const addSignal = vi.spyOn(messages, 'addSignal');
    expect((await runner.processPart(textPart('hello'), states, undefined, undefined, messages)).part).toEqual(
      textPart('HELLO'),
    );
    expect(addSignal).toHaveBeenCalledTimes(1);
    expect(await runner.drainReprocessParts(states, undefined, undefined, messages)).toEqual([
      { part: textPart('STASHED'), blocked: false },
    ]);
    expect(states.get('stash')?.customState.__mastraReprocessPart).toBeUndefined();
    expect(createRun.mock.calls).toHaveLength(0);
  });
});

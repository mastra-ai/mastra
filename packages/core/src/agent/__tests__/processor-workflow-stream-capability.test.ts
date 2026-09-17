import { describe, expect, it, vi } from 'vitest';
import { isProcessorWorkflow } from '../../processors';
import type { Processor } from '../../processors';
import { ProcessorRunner } from '../../processors/runner';
import type { ProcessorState } from '../../processors/runner';
import { ProcessorStepSchema } from '../../processors/step-schema';
import { ChunkFrom } from '../../stream/types';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';
import { MessageList } from '../message-list';

describe('final-only processor streaming', () => {
  it.each([1, 10, 100])('does not execute a workflow for %i chunks', async chunkCount => {
    const final = vi.fn<NonNullable<Processor['processOutputResult']>>(({ messages }) => messages);
    const processor: Processor = { id: 'final', processOutputResult: final };
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: 'openai/gpt-4o',
      outputProcessors: [processor],
    });
    const processors = await agent.listResolvedOutputProcessors();
    const workflow = processors[0]!;
    if (!isProcessorWorkflow(workflow)) throw new Error('Expected generated workflow');
    const createRun = vi.spyOn(workflow, 'createRun');
    const runner = new ProcessorRunner({ outputProcessors: processors, inputProcessors: [], agentName: 'test' });
    const states = new Map<string, ProcessorState<unknown>>();
    const messages = new MessageList();
    for (let i = 0; i < chunkCount; i++) {
      const part = {
        type: 'text-delta' as const,
        runId: 'run',
        from: ChunkFrom.AGENT,
        payload: { id: 'text', text: 'x'.repeat(100 / chunkCount) },
      };
      expect(await runner.processPart(part, states, undefined, undefined, messages)).toEqual({ part, blocked: false });
    }
    const finish = {
      type: 'finish' as const,
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason: 'stop' as const },
        output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
        metadata: {},
        messages: { all: [], user: [], nonUser: [] },
      },
    };
    expect(await runner.processPart(finish, states, undefined, undefined, messages)).toEqual({
      part: finish,
      blocked: false,
    });
    expect(createRun).not.toHaveBeenCalled();
    expect(final).not.toHaveBeenCalled();
    await runner.runOutputProcessors(messages);
    expect(final).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledTimes(1);
    expect(states.get(workflow.id)?.streamParts).toHaveLength(chunkCount + 1);
  });

  it.each([false, true])('preserves opaque workflows (nested: %s)', async nested => {
    const execute = vi.fn(async ({ inputData }) => inputData);
    const opaque = createWorkflow({ id: 'opaque', inputSchema: ProcessorStepSchema, outputSchema: ProcessorStepSchema })
      .then(
        createStep({ id: 'side-effect', inputSchema: ProcessorStepSchema, outputSchema: ProcessorStepSchema, execute }),
      )
      .commit();
    const final: Processor = { id: 'final', processOutputResult: ({ messages }) => messages };
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: 'openai/gpt-4o',
      outputProcessors: nested ? [final, opaque] : [opaque],
    });
    const processors = await agent.listResolvedOutputProcessors();
    const runner = new ProcessorRunner({ outputProcessors: processors, inputProcessors: [], agentName: 'test' });
    const part = {
      type: 'text-delta' as const,
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: { id: 'text', text: 'hello' },
    };
    expect((await runner.processPart(part, new Map(), undefined, undefined, new MessageList())).part).toEqual(part);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('recomputes capability for dynamic processors and preserves stream transformations', async () => {
    const final: Processor = { id: 'final', processOutputResult: ({ messages }) => messages };
    const stream: Processor = {
      id: 'stream',
      processOutputStream: ({ part, state }) => {
        state.count = Number(state.count ?? 0) + 1;
        return part.type === 'text-delta'
          ? { ...part, payload: { ...part.payload, text: `${part.payload.text.toUpperCase()}${state.count}` } }
          : part;
      },
    };
    let configured = [final];
    const agent = new Agent({
      id: 'test',
      name: 'test',
      instructions: 'test',
      model: 'openai/gpt-4o',
      outputProcessors: () => configured,
    });
    const initial = (await agent.listResolvedOutputProcessors())[0]!;
    expect(isProcessorWorkflow(initial) && initial.__processOutputStream).toBe(false);
    configured = [final, stream];
    const processors = await agent.listResolvedOutputProcessors();
    const runner = new ProcessorRunner({ outputProcessors: processors, inputProcessors: [], agentName: 'test' });
    const states = new Map<string, ProcessorState<unknown>>();
    for (let i = 1; i <= 2; i++) {
      const part = {
        type: 'text-delta' as const,
        runId: 'run',
        from: ChunkFrom.AGENT,
        payload: { id: 'text', text: 'hello' },
      };
      expect((await runner.processPart(part, states, undefined, undefined, new MessageList())).part).toEqual({
        ...part,
        payload: { ...part.payload, text: `HELLO${i}` },
      });
    }
  });
});

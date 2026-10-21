import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import type { Processor, ProcessOutputStreamArgs } from '../../processors/index';
import { InMemoryStore } from '../../storage';
import type { ChunkType } from '../../stream';
import { Agent } from '../agent';

/**
 * Verifies that output processors on a supervisor agent can observe and filter
 * chunks forwarded from sub-agents delegated via the `agents:` option.
 *
 * Sub-agent chunks are forwarded through the parent stream's writer (not the
 * LLM's own fullStream). Previously the writer only routed `data-*` chunks
 * through output processors; everything else (including the `tool-output`
 * wrapper that the synthetic agent-* tool emits around sub-agent chunks)
 * bypassed `processOutputStream`. This test locks in the fix that runs every
 * writer-injected chunk through processors.
 */

function makeSubAgent() {
  const subAgentModel = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sub-id-0', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'sub-text-1' },
        { type: 'text-delta', id: 'sub-text-1', delta: 'sub-agent says hi' },
        { type: 'text-end', id: 'sub-text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        },
      ]),
    }),
  });

  return new Agent({
    id: 'sub-agent',
    name: 'sub-agent',
    description: 'A sub-agent.',
    instructions: 'You answer briefly.',
    model: subAgentModel,
  });
}

function makeSupervisorModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sup-id-0', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'sup-call-1',
              toolName: 'agent-subAgent',
              input: JSON.stringify({ prompt: 'do the thing' }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sup-id-1', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'sup-text-1' },
          { type: 'text-delta', id: 'sup-text-1', delta: 'all done' },
          { type: 'text-end', id: 'sup-text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

describe('Supervisor pattern: output processor stream visibility', () => {
  it('routes nested-agent tool-output chunks through processOutputStream', async () => {
    const capturedChunkTypes: string[] = [];

    class RecordingProcessor implements Processor {
      readonly id = 'recording-processor';
      readonly name = 'Recording Processor';

      async processOutputStream({ part }: ProcessOutputStreamArgs) {
        capturedChunkTypes.push(part.type);
        return part;
      }
    }

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel(),
      agents: { subAgent: makeSubAgent() },
      outputProcessors: [new RecordingProcessor()],
    });

    new Mastra({
      agents: { supervisor },
      storage: new InMemoryStore(),
    });

    const stream = await supervisor.stream('Please delegate', { maxSteps: 5 });
    for await (const _chunk of stream.fullStream) {
      // drain
    }

    // Sub-agent chunks are wrapped as `tool-output` by the synthetic agent-*
    // tool's ToolStream (prefix: 'tool'). With the fix, these reach
    // processOutputStream so processors can observe and filter them.
    expect(capturedChunkTypes).toContain('tool-output');
  });

  it('lets a processor drop nested-agent chunks before they reach the consumer', async () => {
    class FilterNestedAgentChunks implements Processor {
      readonly id = 'filter-nested-agent-chunks';
      readonly name = 'Filter Nested Agent Chunks';

      async processOutputStream({ part }: ProcessOutputStreamArgs) {
        // tool-output chunks where the wrapped output is itself an agent chunk
        // (i.e. a chunk that has a `from` field of 'AGENT') indicate forwarded
        // sub-agent stream content. Drop them.
        if (part?.type === 'tool-output' && part?.payload?.output?.from === 'AGENT') {
          return null;
        }
        return part;
      }
    }

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel(),
      agents: { subAgent: makeSubAgent() },
      outputProcessors: [new FilterNestedAgentChunks()],
    });

    new Mastra({
      agents: { supervisor },
      storage: new InMemoryStore(),
    });

    const stream = await supervisor.stream('Please delegate', { maxSteps: 5 });
    const consumerChunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      consumerChunks.push(chunk);
    }

    // The consumer must NOT see any forwarded sub-agent chunks.
    const forwardedSubAgentChunks = consumerChunks.filter(
      c => c.type === 'tool-output' && c?.payload?.output?.from === 'AGENT',
    );
    expect(forwardedSubAgentChunks).toHaveLength(0);

    // The surrounding tool-call / tool-result envelope (from the supervisor's
    // own LLM stream) must still pass through unaffected.
    const consumerChunkTypes = consumerChunks.map(c => c.type);
    expect(consumerChunkTypes).toContain('tool-call');
    expect(consumerChunkTypes).toContain('tool-result');
  });

  it('passes nested-agent chunks through unchanged when no output processors are configured', async () => {
    // No outputProcessors: dataChunkProcessorRunner is undefined and the new
    // branch must short-circuit to the original safeEnqueue fallthrough so
    // existing behavior is preserved.
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel(),
      agents: { subAgent: makeSubAgent() },
    });

    new Mastra({
      agents: { supervisor },
      storage: new InMemoryStore(),
    });

    const stream = await supervisor.stream('Please delegate', { maxSteps: 5 });
    const consumerChunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      consumerChunks.push(chunk);
    }

    const forwardedSubAgentChunks = consumerChunks.filter(
      c => c.type === 'tool-output' && c?.payload?.output?.from === 'AGENT',
    );
    // Sub-agent chunks must still reach the consumer when no processors are configured.
    expect(forwardedSubAgentChunks.length).toBeGreaterThan(0);
  });

  it('lets a processor rewrite a nested-agent chunk before it reaches the consumer', async () => {
    class RewriteNestedAgentChunks implements Processor {
      readonly id = 'rewrite-nested-agent-chunks';
      readonly name = 'Rewrite Nested Agent Chunks';

      async processOutputStream({ part }: ProcessOutputStreamArgs) {
        if (part?.type === 'tool-output' && part?.payload?.output?.from === 'AGENT') {
          return {
            ...part,
            payload: { ...part.payload, rewritten: true },
          };
        }
        return part;
      }
    }

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel(),
      agents: { subAgent: makeSubAgent() },
      outputProcessors: [new RewriteNestedAgentChunks()],
    });

    new Mastra({
      agents: { supervisor },
      storage: new InMemoryStore(),
    });

    const stream = await supervisor.stream('Please delegate', { maxSteps: 5 });
    const consumerChunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      consumerChunks.push(chunk);
    }

    const forwardedSubAgentChunks = consumerChunks.filter(
      c => c.type === 'tool-output' && c?.payload?.output?.from === 'AGENT',
    );
    expect(forwardedSubAgentChunks.length).toBeGreaterThan(0);
    // Every forwarded sub-agent chunk must carry the rewritten marker.
    for (const chunk of forwardedSubAgentChunks) {
      expect(chunk.payload.rewritten).toBe(true);
    }
  });

  it('emits a tripwire when a processor aborts on a nested-agent chunk', async () => {
    class TripwireOnNestedAgentChunks implements Processor {
      readonly id = 'tripwire-on-nested-agent-chunks';
      readonly name = 'Tripwire On Nested Agent Chunks';

      async processOutputStream({ part, abort }: ProcessOutputStreamArgs) {
        if (
          part?.type === 'tool-output' &&
          part?.payload?.output?.from === 'AGENT' &&
          part?.payload?.output?.type === 'text-delta'
        ) {
          abort('nested agent chunk blocked');
        }
        return part;
      }
    }

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel(),
      agents: { subAgent: makeSubAgent() },
      outputProcessors: [new TripwireOnNestedAgentChunks()],
    });

    new Mastra({
      agents: { supervisor },
      storage: new InMemoryStore(),
    });

    const stream = await supervisor.stream('Please delegate', { maxSteps: 5 });
    const consumerChunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      consumerChunks.push(chunk);
    }

    const tripwireChunks = consumerChunks.filter(c => c.type === 'tripwire');
    expect(tripwireChunks.length).toBeGreaterThan(0);
    expect(tripwireChunks[0].payload.reason).toBe('nested agent chunk blocked');
    expect(tripwireChunks[0].payload.processorId).toBe('tripwire-on-nested-agent-chunks');

    // The specific blocked sub-agent text delta must NOT reach the consumer.
    const forwardedSubAgentTextDeltas = consumerChunks.filter(
      c =>
        c.type === 'tool-output' && c?.payload?.output?.from === 'AGENT' && c?.payload?.output?.type === 'text-delta',
    );
    expect(forwardedSubAgentTextDeltas).toHaveLength(0);
  });
});

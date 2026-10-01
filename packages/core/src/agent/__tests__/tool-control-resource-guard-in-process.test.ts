import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const mismatch = { id: 'AGENT_MEMORY_THREAD_RESOURCE_MISMATCH', category: 'USER' };

function keyed(resourceId: string) {
  const ctx = new RequestContext();
  ctx.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return ctx;
}

function toolCallModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'guarded', input: '{"x":"y"}', providerExecuted: false },
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

describe('in-process (non-durable) tool-control caller-resource guard', () => {
  it('rejects a mismatched caller on every tool-control entry and leaves the run suspended', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const guarded = createTool({
      id: 'guarded',
      description: 'needs approval',
      inputSchema: z.object({ x: z.string() }),
      requireApproval: true,
      execute,
    });
    const agent = new Agent({
      id: 'plain-agent',
      name: 'Plain Agent',
      instructions: 'x',
      model: toolCallModel(),
      tools: { guarded },
      memory: new MockMemory(),
    });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
    const plain = mastra.getAgent('agent');

    const stream = await plain.stream('go', { memory: { thread: 't-alice', resource: 'alice' } });
    let toolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
    }
    expect(toolCallId).toBe('call-1');

    for (const call of [
      () => plain.approveToolCall({ runId: stream.runId, toolCallId, requestContext: keyed('mallory') }),
      () => plain.declineToolCall({ runId: stream.runId, toolCallId, requestContext: keyed('mallory') }),
      () => plain.approveToolCallGenerate({ runId: stream.runId, toolCallId, requestContext: keyed('mallory') }),
      () => plain.declineToolCallGenerate({ runId: stream.runId, toolCallId, requestContext: keyed('mallory') }),
    ]) {
      const error = await call().catch(e => e);
      expect(error).toMatchObject(mismatch);
      expect(error.message).toBe(
        'Resource "mallory" was provided but this session belongs to resource "alice". A thread can only be used by the resource that owns it.',
      );
    }
    expect(execute).not.toHaveBeenCalled();

    // The run is still suspended: the owner can approve it.
    const resumed = await plain.approveToolCall({ runId: stream.runId, toolCallId, requestContext: keyed('alice') });
    for await (const _chunk of resumed.fullStream) {
    }
    expect(execute).toHaveBeenCalledOnce();
  });

  it('keeps the existing no-snapshot error for a keyed caller on an unknown run', async () => {
    const agent = new Agent({ id: 'plain-agent', name: 'Plain Agent', instructions: 'x', model: toolCallModel() });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
    await expect(agent.approveToolCall({ runId: 'ghost-run', requestContext: keyed('mallory') })).rejects.toMatchObject({
      id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
    });
  });
});

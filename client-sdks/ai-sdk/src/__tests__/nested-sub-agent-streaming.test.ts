import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { convertFullStreamChunkToUIMessageStream } from '../helpers';
import { AgentStreamToAISDKTransformer } from '../transformers';

/** Regression coverage for https://github.com/mastra-ai/mastra/issues/15013. */
describe('nested sub-agent streaming', () => {
  const onError = (error: unknown) => String(error);

  function convert(part: any) {
    return convertFullStreamChunkToUIMessageStream({ part, onError });
  }

  function envelope(output: any, toolCallId: string, toolName: string) {
    return {
      type: 'tool-output',
      runId: 'outer-run',
      from: ChunkFrom.USER,
      payload: { toolCallId, toolName, output },
    };
  }

  function outer(output: any, toolCallId: string, toolName: string) {
    return { type: 'tool-output', toolCallId, toolName, output };
  }

  function agentPath(...agentIds: string[]) {
    return agentIds.map(agentId => ({
      toolCallId: `call-${agentId}`,
      toolName: `agent-${agentId}`,
      agentId,
    }));
  }

  function wrapAgentPath(output: any, agentIds: string[]) {
    const [outerAgentId, ...nestedAgentIds] = agentIds;
    let wrapped = output;

    for (const agentId of nestedAgentIds.toReversed()) {
      wrapped = envelope(wrapped, `call-${agentId}`, `agent-${agentId}`);
    }

    return outer(wrapped, `call-${outerAgentId}`, `agent-${outerAgentId}`);
  }

  const agentDelta = {
    type: 'text-delta',
    runId: 'inner-run',
    from: ChunkFrom.AGENT,
    payload: { id: 'text-1', text: 'hello' },
  };

  it.each([
    ['direct', ['resumeAgent']],
    ['three-level', ['applicationAgent', 'resumeAgent']],
    ['four-level', ['accountAgent', 'applicationAgent', 'resumeAgent']],
  ])('preserves the exact ancestry for a %s delegation', (_name, agentIds) => {
    expect(convert(wrapAgentPath(agentDelta, agentIds))).toEqual({
      type: 'tool-agent',
      toolCallId: `call-${agentIds[0]}`,
      payload: agentDelta,
      ancestry: agentPath(...agentIds),
    });
  });

  it('does not impose a valid nesting-depth limit', () => {
    const agentIds = Array.from({ length: 12 }, (_, index) => `agent${index + 1}`);

    expect(convert(wrapAgentPath(agentDelta, agentIds))).toMatchObject({
      type: 'tool-agent',
      payload: agentDelta,
      ancestry: agentPath(...agentIds),
    });
  });

  it('maps nested workflow and network leaves without changing their classification', () => {
    const workflowChunk = {
      type: 'workflow-step-start',
      runId: 'workflow-run',
      from: ChunkFrom.WORKFLOW,
      payload: { id: 'step-1' },
    };
    const networkChunk = {
      type: 'network-start',
      runId: 'network-run',
      from: ChunkFrom.NETWORK,
      payload: { id: 'network-1' },
    };

    expect(
      convert(
        outer(
          envelope(workflowChunk, 'call-resumeWorkflow', 'workflow-resumeWorkflow'),
          'call-applicationAgent',
          'agent-applicationAgent',
        ),
      ),
    ).toEqual({
      type: 'tool-workflow',
      toolCallId: 'call-applicationAgent',
      payload: workflowChunk,
    });
    expect(
      convert(
        outer(
          envelope(networkChunk, 'call-candidateNetwork', 'network-candidateNetwork'),
          'call-applicationAgent',
          'agent-applicationAgent',
        ),
      ),
    ).toEqual({
      type: 'tool-network',
      toolCallId: 'call-applicationAgent',
      payload: networkChunk,
    });
  });

  it('maps a nested data chunk to its data part', () => {
    const dataChunk = { type: 'data-progress', data: { percent: 42 }, id: 'progress-1' };

    expect(convert(wrapAgentPath(dataChunk, ['applicationAgent', 'resumeAgent']))).toEqual({
      type: 'data-progress',
      data: { percent: 42 },
      id: 'progress-1',
    });
  });

  it('ignores malformed, cyclic, and plain writer outputs', () => {
    const cyclic: any = envelope(undefined, 'call-resumeAgent', 'agent-resumeAgent');
    cyclic.payload.output = cyclic;

    expect(convert(outer({ status: 'working' }, 'call-resumeAgent', 'agent-resumeAgent'))).toBeUndefined();
    expect(
      convert(
        outer(
          envelope({ status: 'working' }, 'call-resumeAgent', 'agent-resumeAgent'),
          'call-applicationAgent',
          'agent-applicationAgent',
        ),
      ),
    ).toBeUndefined();
    expect(
      convert(outer(envelope(undefined, 'call-resumeAgent', 'agent-resumeAgent'), 'call-app', 'agent-app')),
    ).toBeUndefined();
    expect(
      convert(
        outer(
          { type: 'tool-output', payload: { toolName: 'agent-resumeAgent', output: agentDelta } },
          'call-applicationAgent',
          'agent-applicationAgent',
        ),
      ),
    ).toBeUndefined();
    expect(convert(outer(cyclic, 'call-applicationAgent', 'agent-applicationAgent'))).toBeUndefined();
  });

  it('counts a custom streaming tool as a delegation boundary', async () => {
    const stream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-nested-agent',
            toolName: 'nested-agent-stream',
            output: { type: 'start', runId: 'nested-run', from: ChunkFrom.AGENT, payload: { id: 'nested-agent' } },
          },
        });
        controller.close();
      },
    });

    const chunks = [];
    for await (const chunk of stream.pipeThrough(
      AgentStreamToAISDKTransformer({ sendStart: false, sendFinish: false, includeSubAgentMetadata: true }),
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      type: 'data-tool-agent',
      id: 'nested-run',
      ancestry: [{ toolCallId: 'call-nested-agent', toolName: 'nested-agent-stream' }],
      depth: 1,
    });
    expect(chunks[0]).not.toHaveProperty('parentAgentId');
  });

  it('emits direct agent snapshots at depth one without guessing a parent', async () => {
    const stream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-resumeAgent',
            toolName: 'agent-resumeAgent',
            output: { type: 'start', runId: 'resume-run', from: ChunkFrom.AGENT, payload: { id: 'resume-agent' } },
          },
        });
        controller.close();
      },
    });

    const chunks = [];
    for await (const chunk of stream.pipeThrough(
      AgentStreamToAISDKTransformer({ sendStart: false, sendFinish: false, includeSubAgentMetadata: true }),
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      type: 'data-tool-agent',
      id: 'resume-run',
      ancestry: agentPath('resumeAgent'),
      depth: 1,
    });
    expect(chunks[0]).not.toHaveProperty('parentAgentId');
  });

  it('streams progressive snapshots and step details with stable leaf identity and ancestry', async () => {
    const path = ['applicationAgent', 'resumeAgent'];
    const innerChunks = [
      { type: 'start', runId: 'resume-run', from: ChunkFrom.AGENT, payload: { id: 'resume-agent' } },
      { type: 'text-delta', runId: 'resume-run', from: ChunkFrom.AGENT, payload: { id: 'text-1', text: 'Draft ' } },
      {
        type: 'step-finish',
        runId: 'resume-run',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'step-1',
          stepResult: { reason: 'tool-calls', warnings: [] },
          output: { usage: {} },
          metadata: {},
        },
      },
      { type: 'text-delta', runId: 'resume-run', from: ChunkFrom.AGENT, payload: { id: 'text-2', text: 'ready.' } },
      {
        type: 'finish',
        runId: 'resume-run',
        from: ChunkFrom.AGENT,
        payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
      },
    ];

    const stream = new ReadableStream<any>({
      start(controller) {
        for (const inner of innerChunks) {
          controller.enqueue({
            type: 'tool-output',
            runId: 'supervisor-run',
            from: ChunkFrom.AGENT,
            payload: {
              toolCallId: 'call-applicationAgent',
              toolName: 'agent-applicationAgent',
              output: envelope(inner, 'call-resumeAgent', 'agent-resumeAgent'),
            },
          });
        }
        controller.enqueue({
          type: 'tool-result',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-applicationAgent',
            toolName: 'agent-applicationAgent',
            result: { text: 'Draft ready.' },
          },
        });
        controller.close();
      },
    });

    const chunks: any[] = [];
    for await (const chunk of stream.pipeThrough(
      AgentStreamToAISDKTransformer({ sendStart: false, sendFinish: false, includeSubAgentMetadata: true }),
    )) {
      chunks.push(chunk);
    }

    const agentParts = chunks.filter(chunk => chunk.type === 'data-tool-agent');
    const stepParts = chunks.filter(chunk => chunk.type === 'data-tool-agent-step');
    const toolResultIndex = chunks.findIndex(chunk => chunk.type === 'tool-output-available');
    const expectedMetadata = {
      ancestry: agentPath(...path),
      depth: 2,
      parentAgentId: 'applicationAgent',
    };

    expect(agentParts.length).toBeGreaterThan(0);
    expect(chunks.findIndex(chunk => chunk.type === 'data-tool-agent')).toBeLessThan(toolResultIndex);
    expect(agentParts.every(part => part.id === 'resume-run')).toBe(true);
    for (const part of agentParts) {
      expect(part).toMatchObject(expectedMetadata);
    }
    expect(agentParts.map(part => part.data.text)).toEqual(expect.arrayContaining(['Draft ', 'Draft ready.']));
    expect(agentParts.at(-1)!.data.status).toBe('finished');
    expect(stepParts).toHaveLength(1);
    expect(stepParts[0]).toMatchObject({
      id: 'resume-run:0',
      ...expectedMetadata,
      data: { runId: 'resume-run', stepIndex: 0 },
    });
  });
});

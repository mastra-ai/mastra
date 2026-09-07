import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { convertFullStreamChunkToUIMessageStream } from '../helpers';
import { AgentStreamToAISDKTransformer } from '../transformers';

/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/15013
 *
 * Every level of agent-as-tool delegation wraps the sub-agent's chunks in another
 * `tool-output` envelope carrying `from: 'USER'`. A two-level chain (supervisor ->
 * sub-agent) is wrapped once, so the payload is the sub-agent chunk itself and the
 * `from === 'AGENT'` check matches. A three-level chain is wrapped twice, so the
 * payload is another `tool-output` envelope, the check failed, and the chunk was
 * dropped — the client saw nothing until the outermost tool call resolved.
 */
describe('nested sub-agent streaming', () => {
  const onError = (error: unknown) => String(error);

  function convert(part: any) {
    return convertFullStreamChunkToUIMessageStream({ part, onError });
  }

  function wrap(output: any, toolCallId: string) {
    return {
      type: 'tool-output',
      runId: 'outer-run',
      from: ChunkFrom.USER,
      payload: { toolCallId, toolName: 'agent-tool', output },
    };
  }

  const agentDelta = {
    type: 'text-delta',
    runId: 'inner-run',
    from: ChunkFrom.AGENT,
    payload: { id: 'text-1', text: 'hello' },
  };

  it('maps a two-level sub-agent chunk to tool-agent', () => {
    expect(convert({ type: 'tool-output', toolCallId: 'call-1', output: agentDelta })).toEqual({
      type: 'tool-agent',
      toolCallId: 'call-1',
      payload: agentDelta,
    });
  });

  it('maps a three-level sub-agent chunk to tool-agent', () => {
    expect(convert({ type: 'tool-output', toolCallId: 'call-1', output: wrap(agentDelta, 'call-2') })).toEqual({
      type: 'tool-agent',
      toolCallId: 'call-1',
      payload: agentDelta,
    });
  });

  it('maps a four-level sub-agent chunk to tool-agent', () => {
    const output = wrap(wrap(agentDelta, 'call-3'), 'call-2');

    expect(convert({ type: 'tool-output', toolCallId: 'call-1', output })).toEqual({
      type: 'tool-agent',
      toolCallId: 'call-1',
      payload: agentDelta,
    });
  });

  it('maps a nested workflow chunk to tool-workflow', () => {
    const workflowChunk = {
      type: 'workflow-step-start',
      runId: 'workflow-run',
      from: ChunkFrom.WORKFLOW,
      payload: { id: 'step-1' },
    };

    expect(convert({ type: 'tool-output', toolCallId: 'call-1', output: wrap(workflowChunk, 'call-2') })).toEqual({
      type: 'tool-workflow',
      toolCallId: 'call-1',
      payload: workflowChunk,
    });
  });

  it('maps a nested data chunk to its data part', () => {
    const dataChunk = { type: 'data-progress', data: { percent: 42 }, id: 'progress-1' };

    expect(convert({ type: 'tool-output', toolCallId: 'call-1', output: wrap(dataChunk, 'call-2') })).toEqual({
      type: 'data-progress',
      data: { percent: 42 },
      id: 'progress-1',
    });
  });

  it('still ignores plain tool writer output', () => {
    expect(convert({ type: 'tool-output', toolCallId: 'call-1', output: { status: 'working' } })).toBeUndefined();
    expect(
      convert({ type: 'tool-output', toolCallId: 'call-1', output: wrap({ status: 'working' }, 'call-2') }),
    ).toBeUndefined();
  });

  it('streams progressive data-tool-agent parts for a three-level delegation chain', async () => {
    // Supervisor -> application agent -> resume agent. Everything the innermost agent
    // emits arrives doubly wrapped, long before the supervisor's tool-result.
    const innerChunks = [
      { type: 'start', runId: 'resume-run', from: ChunkFrom.AGENT, payload: { id: 'resume-agent' } },
      { type: 'text-delta', runId: 'resume-run', from: ChunkFrom.AGENT, payload: { id: 'text-1', text: 'Draft ' } },
      { type: 'text-delta', runId: 'resume-run', from: ChunkFrom.AGENT, payload: { id: 'text-1', text: 'ready.' } },
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
              toolCallId: 'agent-applicationAgent',
              toolName: 'agent-applicationAgent',
              output: wrap(inner, 'agent-resumeAgent'),
            },
          });
        }
        controller.enqueue({
          type: 'tool-result',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'agent-applicationAgent',
            toolName: 'agent-applicationAgent',
            result: { text: 'Draft ready.' },
          },
        });
        controller.close();
      },
    });

    const chunks: any[] = [];
    for await (const chunk of stream.pipeThrough(
      AgentStreamToAISDKTransformer({ sendStart: false, sendFinish: false }),
    )) {
      chunks.push(chunk);
    }

    const agentParts = chunks.filter(chunk => chunk.type === 'data-tool-agent');
    const toolResultIndex = chunks.findIndex(chunk => chunk.type === 'tool-output-available');

    expect(agentParts.length).toBeGreaterThan(0);
    // The progress must reach the client before the outer tool call resolves.
    expect(chunks.findIndex(chunk => chunk.type === 'data-tool-agent')).toBeLessThan(toolResultIndex);
    expect(agentParts.every(part => part.id === 'resume-run')).toBe(true);
    expect(agentParts.map(part => part.data.text)).toEqual(expect.arrayContaining(['Draft ', 'Draft ready.']));
    expect(agentParts.at(-1)!.data.status).toBe('finished');
  });
});

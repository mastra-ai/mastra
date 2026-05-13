import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { AgentStreamToAISDKTransformer, transformAgent } from '../transformers';

describe('transformAgent tool input streaming (issue #16422)', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  it('emits data-tool-agent updates while a sub-agent tool input is streaming', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);

    const start = transformAgent(
      makePayload('tool-call-input-streaming-start', runId, {
        toolCallId: 'call-1',
        toolName: 'planTool',
        providerExecuted: false,
        providerMetadata: { provider: 'test' },
        dynamic: true,
      }),
      bufferedSteps,
    );

    expect(start).toMatchObject({
      type: 'data-tool-agent',
      data: {
        pendingToolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'planTool',
            argsText: '',
            state: 'input-streaming',
            providerExecuted: false,
            providerMetadata: { provider: 'test' },
            dynamic: true,
          },
        ],
        toolCalls: [],
      },
    });

    const firstDelta = transformAgent(
      makePayload('tool-call-delta', runId, {
        toolCallId: 'call-1',
        argsTextDelta: '{"items":[',
        providerMetadata: { provider: 'test' },
      }),
      bufferedSteps,
    );

    expect(firstDelta).toMatchObject({
      type: 'data-tool-agent',
      data: {
        pendingToolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'planTool',
            argsText: '{"items":[',
            state: 'input-streaming',
          },
        ],
        toolCalls: [],
      },
    });

    const secondDelta = transformAgent(
      makePayload('tool-call-delta', runId, {
        toolCallId: 'call-1',
        argsTextDelta: '{"title":"Draft"}]}',
      }),
      bufferedSteps,
    );

    expect(secondDelta).toMatchObject({
      type: 'data-tool-agent',
      data: {
        pendingToolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'planTool',
            argsText: '{"items":[{"title":"Draft"}]}',
            state: 'input-streaming',
          },
        ],
        toolCalls: [],
      },
    });
  });

  it('marks pending input available and then replaces it with the completed tool call', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);
    transformAgent(
      makePayload('tool-call-input-streaming-start', runId, {
        toolCallId: 'call-1',
        toolName: 'planTool',
      }),
      bufferedSteps,
    );
    transformAgent(
      makePayload('tool-call-delta', runId, {
        toolCallId: 'call-1',
        argsTextDelta: '{"items":[]}',
      }),
      bufferedSteps,
    );

    const inputEnd = transformAgent(
      makePayload('tool-call-input-streaming-end', runId, {
        toolCallId: 'call-1',
        providerMetadata: { ended: true },
      }),
      bufferedSteps,
    );

    expect(inputEnd).toMatchObject({
      type: 'data-tool-agent',
      data: {
        pendingToolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'planTool',
            argsText: '{"items":[]}',
            state: 'input-available',
            providerMetadata: { ended: true },
          },
        ],
        toolCalls: [],
      },
    });

    const toolCall = transformAgent(
      makePayload('tool-call', runId, {
        toolCallId: 'call-1',
        toolName: 'planTool',
        args: { items: [] },
      }),
      bufferedSteps,
    );

    expect(toolCall).toMatchObject({
      type: 'data-tool-agent',
      data: {
        pendingToolCalls: [],
        toolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'planTool',
            args: { items: [] },
          },
        ],
      },
    });
  });

  it('does not duplicate pending calls for repeated starts or deltas without a start', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);
    transformAgent(
      makePayload('tool-call-input-streaming-start', runId, {
        toolCallId: 'call-1',
        toolName: 'firstName',
      }),
      bufferedSteps,
    );
    transformAgent(
      makePayload('tool-call-delta', runId, {
        toolCallId: 'call-1',
        argsTextDelta: '{"name":"kept"}',
      }),
      bufferedSteps,
    );
    transformAgent(
      makePayload('tool-call-input-streaming-start', runId, {
        toolCallId: 'call-1',
        toolName: 'updatedName',
      }),
      bufferedSteps,
    );

    const orphanDelta = transformAgent(
      makePayload('tool-call-delta', runId, {
        toolCallId: 'call-2',
        toolName: 'lateTool',
        argsTextDelta: '{"value":',
      }),
      bufferedSteps,
    );

    expect(orphanDelta).toMatchObject({
      data: {
        pendingToolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'updatedName',
            argsText: '{"name":"kept"}',
            state: 'input-streaming',
          },
          {
            toolCallId: 'call-2',
            toolName: 'lateTool',
            argsText: '{"value":',
            state: 'input-streaming',
          },
        ],
      },
    });
    expect(orphanDelta?.data.pendingToolCalls).toHaveLength(2);
  });

  it('clears pending tool calls after a tool result or step finish', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);
    transformAgent(
      makePayload('tool-call-input-streaming-start', runId, {
        toolCallId: 'call-1',
        toolName: 'planTool',
      }),
      bufferedSteps,
    );

    const toolResult = transformAgent(
      makePayload('tool-result', runId, {
        toolCallId: 'call-1',
        toolName: 'planTool',
        result: { ok: true },
      }),
      bufferedSteps,
    );

    expect(toolResult).toMatchObject({
      data: {
        pendingToolCalls: [],
        toolResults: [
          {
            toolCallId: 'call-1',
            toolName: 'planTool',
            result: { ok: true },
          },
        ],
      },
    });

    transformAgent(
      makePayload('tool-call-input-streaming-start', runId, {
        toolCallId: 'call-2',
        toolName: 'secondTool',
      }),
      bufferedSteps,
    );

    const stepFinish = transformAgent(
      makePayload('step-finish', runId, {
        id: 'step-1',
        stepResult: { reason: 'tool-calls', warnings: [] },
        output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        metadata: { timestamp: new Date(), modelId: 'test-model' },
      }),
      bufferedSteps,
    );

    expect(stepFinish).toMatchObject({
      data: {
        pendingToolCalls: [],
        steps: [
          {
            pendingToolCalls: [],
          },
        ],
      },
    });
  });

  it('emits pending tool input updates through the nested tool-output transformer route', async () => {
    const stream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'agent-subAgent',
            output: {
              type: 'start',
              runId: 'sub-agent-run',
              from: ChunkFrom.AGENT,
              payload: { id: 'agent-1' },
            },
          },
        });
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'agent-subAgent',
            output: {
              type: 'tool-call-input-streaming-start',
              runId: 'sub-agent-run',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'planTool',
              },
            },
          },
        });
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'agent-subAgent',
            output: {
              type: 'tool-call-delta',
              runId: 'sub-agent-run',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                argsTextDelta: '{"items":[]}',
              },
            },
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

    expect(chunks).toEqual([
      expect.objectContaining({
        type: 'data-tool-agent',
        id: 'sub-agent-run',
      }),
      expect.objectContaining({
        type: 'data-tool-agent',
        id: 'sub-agent-run',
        data: expect.objectContaining({
          pendingToolCalls: [
            expect.objectContaining({
              toolCallId: 'call-1',
              toolName: 'planTool',
              argsText: '',
              state: 'input-streaming',
            }),
          ],
        }),
      }),
      expect.objectContaining({
        type: 'data-tool-agent',
        id: 'sub-agent-run',
        data: expect.objectContaining({
          pendingToolCalls: [
            expect.objectContaining({
              toolCallId: 'call-1',
              toolName: 'planTool',
              argsText: '{"items":[]}',
              state: 'input-streaming',
            }),
          ],
        }),
      }),
    ]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import type {
  ClientObservabilityPayload,
  ClientObservabilityCarrier,
  ClientObservabilityProxy,
} from '../../observability';
import { Agent } from '../index';

describe('Agent client observability extraction (v6 toolMetadata)', () => {
  it('forwards toolMetadata.__mastraObservability to the proxy and strips it', async () => {
    const receive = vi.fn();
    const proxy: ClientObservabilityProxy = {
      inject: () => ({ traceparent: 'unused' }),
      receive: receive as any,
    };

    const mastra = new Mastra({
      logger: false,
      observability: {
        getDefaultInstance: () => undefined,
        getSelectedInstance: () => undefined,
        setLogger: () => undefined,
        setMastraContext: () => undefined,
        getClientObservabilityProxy: () => proxy,
      } as any,
      agents: {
        a: new Agent({
          id: 'a',
          name: 'a',
          instructions: 'a',
          model: {
            specificationVersion: 'v2',
            provider: 'mock',
            modelId: 'mock',
            doGenerate: async () => ({
              content: [{ type: 'text', text: 'ok' }],
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          } as any,
        }),
      },
    });

    const agent = mastra.getAgent('a');

    const parentContext: ClientObservabilityCarrier = {
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      baggage: 'k=v',
    };
    const payload: ClientObservabilityPayload = {
      spans: [{ name: 'client-span' }],
      executionDurationMs: 12,
      toolName: 'clientTool',
    };

    const messages: any[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'clientTool',
            toolCallId: 'call-1',
            state: 'output-available',
            output: 'hello',
            toolMetadata: {
              __mastraObservability: {
                parentContext,
                payload,
              },
            },
          },
        ],
      },
    ];

    await agent.generate(messages);

    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith(payload, parentContext);
    expect(messages[0].parts[0].toolMetadata.__mastraObservability).toBeUndefined();
  });
});

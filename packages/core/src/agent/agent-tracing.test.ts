import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { MockLanguageModelV1 } from 'ai/test';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';

import { Mastra } from '../mastra';

import { Agent } from './index';

config();

describe('agent telemetry', () => {
  it('should use telemetry options when generating a response', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Donald Trump won the 2016 U.S. presidential election, defeating Hillary Clinton.`,
        }),
      }),
    });

    const memoryExporter = new InMemorySpanExporter();
    const tracerProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
    });
    tracerProvider.register();

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
      telemetry: {
        enabled: true,
        serviceName: 'test-seppe',
        export: {
          type: 'custom',
          exporter: memoryExporter,
        },
      },
    });
    const agentOne = mastra.getAgent('electionAgent');

    await agentOne.generate('Who won the 2016 US presidential election?', {
      telemetry: { functionId: 'test-function-id', metadata: { test: 'test' } },
    });

    const spans = memoryExporter.getFinishedSpans();
    const aiSpan = spans.find(span => span.name === 'ai.generateText');
    expect(aiSpan).toBeDefined();
    expect(aiSpan?.attributes['ai.telemetry.metadata.test']).toBe('test');
    expect(aiSpan?.attributes['resource.name']).toBe('test-function-id');
    await tracerProvider.shutdown();
  });
});

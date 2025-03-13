import { createOpenAI } from '@ai-sdk/openai';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { config } from 'dotenv';
import { describe, expect, it, vi } from 'vitest';

import { Mastra } from '../mastra';

import { Agent } from './index';

config();

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('agent telemetry', () => {
  it('should use telemetry options when generating a response', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const memoryExporter = new InMemorySpanExporter();
    const tracerProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
    });
    tracerProvider.register();

    const mastra = new Mastra({
      agents: { electionAgent },
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

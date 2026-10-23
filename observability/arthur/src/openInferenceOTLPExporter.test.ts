import { SemanticConventions } from '@arizeai/openinference-semantic-conventions';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const exportedSpans: ReadableSpan[] = [];

// Mock the OTLP exporter base class so export() collects spans instead of sending them.
// The mocked export is a prototype method so the subclass override still runs first.
vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => {
  class MockOTLPTraceExporter {
    export(spans: ReadableSpan[], resultCallback?: (result: unknown) => void) {
      exportedSpans.push(...spans);
      resultCallback?.({});
    }
    shutdown() {
      return Promise.resolve();
    }
  }
  return { OTLPTraceExporter: MockOTLPTraceExporter };
});

import { OpenInferenceOTLPTraceExporter } from './openInferenceOTLPExporter';

function span(name: string, attributes: Record<string, unknown>): ReadableSpan {
  return { name, attributes } as unknown as ReadableSpan;
}

describe('OpenInferenceOTLPTraceExporter span kind', () => {
  beforeEach(() => {
    exportedSpans.length = 0;
  });

  it('maps the chat call to LLM with token counts and the generation loop and steps to CHAIN', () => {
    const exporter = new OpenInferenceOTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' });

    exporter.export(
      [
        span('chat gpt-5', {
          'mastra.span.type': 'model_inference',
          'gen_ai.operation.name': 'chat',
          'gen_ai.request.model': 'gpt-5',
          'gen_ai.usage.input_tokens': 61,
          'gen_ai.usage.output_tokens': 14,
        }),
        span('agent_step weather-agent', {
          'mastra.span.type': 'model_step',
          'gen_ai.operation.name': 'agent_step',
        }),
        span('model_generation gpt-5', {
          'mastra.span.type': 'model_generation',
          'gen_ai.operation.name': 'model_generation',
        }),
      ],
      () => {},
    );

    const summary = exportedSpans.map(s => [
      s.name,
      s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND],
      s.attributes[SemanticConventions.LLM_TOKEN_COUNT_PROMPT],
    ]);
    expect(summary).toEqual([
      ['chat gpt-5', 'LLM', 61],
      ['agent_step weather-agent', 'CHAIN', undefined],
      ['model_generation gpt-5', 'CHAIN', undefined],
    ]);
  });

  it('keeps the generation loop as the LLM span when it is exported as the chat call', () => {
    const exporter = new OpenInferenceOTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' });

    exporter.export(
      [
        span('chat gpt-5', {
          'mastra.span.type': 'model_generation',
          'gen_ai.operation.name': 'chat',
          'gen_ai.request.model': 'gpt-5',
          'gen_ai.usage.input_tokens': 146,
        }),
      ],
      () => {},
    );

    expect(exportedSpans[0]!.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('LLM');
    expect(exportedSpans[0]!.attributes[SemanticConventions.LLM_TOKEN_COUNT_PROMPT]).toBe(146);
  });
});

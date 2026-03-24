import {
  INPUT_MIME_TYPE,
  INPUT_VALUE,
  LLM_TOKEN_COUNT_COMPLETION,
  LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO,
  LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING,
  LLM_TOKEN_COUNT_PROMPT,
  LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO,
  LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ,
  LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE,
  LLM_TOKEN_COUNT_TOTAL,
  METADATA,
  OUTPUT_MIME_TYPE,
  OUTPUT_VALUE,
  SemanticConventions,
  SESSION_ID,
  TAG_TAGS,
  USER_ID,
} from '@arizeai/openinference-semantic-conventions';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
} from '@opentelemetry/semantic-conventions/incubating';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenInferenceOTLPTraceExporter } from './openInferenceOTLPExporter';

// Capture spans exported by the mocked OTLP base class
const exportedSpans: any[] = [];

vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => {
  class MockOTLPTraceExporter {
    export(spans: any[], resultCallback?: (result: any) => void) {
      exportedSpans.push(...spans);
      if (resultCallback) resultCallback({});
    }
    shutdown() {
      return Promise.resolve();
    }
  }
  return { OTLPTraceExporter: MockOTLPTraceExporter };
});

function makeSpan(overrides: Partial<ReadableSpan> & { attributes: Record<string, any> }): ReadableSpan {
  return {
    name: 'test-span',
    kind: 0,
    spanContext: () => ({ traceId: 'trace-1', spanId: 'span-1', traceFlags: 1 }),
    startTime: [0, 0],
    endTime: [1, 0],
    status: { code: 0 },
    resource: { attributes: {} },
    instrumentationLibrary: { name: 'test' },
    events: [],
    links: [],
    duration: [1, 0],
    ended: true,
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    ...overrides,
  } as unknown as ReadableSpan;
}

describe('OpenInferenceOTLPTraceExporter', () => {
  let exporter: OpenInferenceOTLPTraceExporter;

  beforeEach(() => {
    exportedSpans.length = 0;
    exporter = new OpenInferenceOTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' });
  });

  describe('Span Kind Mapping', () => {
    it('maps model_generation to LLM span kind', () => {
      const span = makeSpan({ attributes: { 'mastra.span.type': 'model_generation' } });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('LLM');
    });

    it('maps model_step to LLM span kind', () => {
      const span = makeSpan({ attributes: { 'mastra.span.type': 'model_step' } });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('LLM');
    });

    it('maps model_chunk to LLM span kind', () => {
      const span = makeSpan({ attributes: { 'mastra.span.type': 'model_chunk' } });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('LLM');
    });

    it('maps tool_call to TOOL span kind', () => {
      const span = makeSpan({ attributes: { 'mastra.span.type': 'tool_call' } });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('TOOL');
    });

    it('maps mcp_tool_call to TOOL span kind', () => {
      const span = makeSpan({ attributes: { 'mastra.span.type': 'mcp_tool_call' } });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('TOOL');
    });

    it('maps agent_run to AGENT span kind', () => {
      const span = makeSpan({ attributes: { 'mastra.span.type': 'agent_run' } });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('AGENT');
    });

    it('defaults unknown span types to CHAIN', () => {
      const span = makeSpan({ attributes: { 'mastra.span.type': 'some_future_type' } });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe('CHAIN');
    });
  });

  describe('Session and User Mapping', () => {
    it('maps mastra.metadata.threadId to SESSION_ID', () => {
      const span = makeSpan({
        attributes: {
          'mastra.metadata.threadId': 'thread-123',
          'mastra.span.type': 'agent_run',
        },
      });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[SESSION_ID]).toBe('thread-123');
    });

    it('maps mastra.metadata.userId to USER_ID', () => {
      const span = makeSpan({
        attributes: {
          'mastra.metadata.userId': 'user-456',
          'mastra.span.type': 'agent_run',
        },
      });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[USER_ID]).toBe('user-456');
    });

    it('removes threadId and userId from metadata after mapping', () => {
      const span = makeSpan({
        attributes: {
          'mastra.metadata.threadId': 'thread-123',
          'mastra.metadata.userId': 'user-456',
          'mastra.span.type': 'agent_run',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      // Should not appear in the serialized metadata
      if (attrs[METADATA]) {
        const parsed = JSON.parse(attrs[METADATA]);
        expect(parsed.threadId).toBeUndefined();
        expect(parsed.userId).toBeUndefined();
      }
    });
  });

  describe('Metadata Mapping', () => {
    it('serializes custom mastra.metadata.* into OpenInference metadata', () => {
      const span = makeSpan({
        attributes: {
          'mastra.metadata.companyId': 'acme-co',
          'mastra.metadata.featureFlag': 'beta',
          'mastra.span.type': 'agent_run',
        },
      });
      exporter.export([span], () => {});

      const metadata = exportedSpans[0].attributes[METADATA];
      expect(typeof metadata).toBe('string');
      const parsed = JSON.parse(metadata);
      expect(parsed).toMatchObject({
        companyId: 'acme-co',
        featureFlag: 'beta',
      });
    });

    it('does not include metadata key when no custom metadata exists', () => {
      const span = makeSpan({
        attributes: {
          'mastra.span.type': 'agent_run',
        },
      });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[METADATA]).toBeUndefined();
    });
  });

  describe('Tags Mapping', () => {
    it('maps mastra.tags to OpenInference tag.tags', () => {
      const tagsJson = JSON.stringify(['production', 'experiment-v2']);
      const span = makeSpan({
        attributes: {
          'mastra.tags': tagsJson,
          'mastra.span.type': 'agent_run',
        },
      });
      exporter.export([span], () => {});

      expect(exportedSpans[0].attributes[TAG_TAGS]).toBe(tagsJson);
      expect(exportedSpans[0].attributes['mastra.tags']).toBeUndefined();
    });
  });

  describe('Usage Metrics Conversion', () => {
    it('converts core token counts to OpenInference attributes', () => {
      const span = makeSpan({
        attributes: {
          [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: 100,
          [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: 50,
          'mastra.span.type': 'model_generation',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      expect(attrs[LLM_TOKEN_COUNT_PROMPT]).toBe(100);
      expect(attrs[LLM_TOKEN_COUNT_COMPLETION]).toBe(50);
      expect(attrs[LLM_TOKEN_COUNT_TOTAL]).toBe(150);
    });

    it('handles partial usage metrics (input only)', () => {
      const span = makeSpan({
        attributes: {
          [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: 100,
          'mastra.span.type': 'model_generation',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      expect(attrs[LLM_TOKEN_COUNT_PROMPT]).toBe(100);
      expect(attrs[LLM_TOKEN_COUNT_COMPLETION]).toBeUndefined();
      expect(attrs[LLM_TOKEN_COUNT_TOTAL]).toBeUndefined();
    });

    it('converts detailed usage metrics (cache, reasoning, audio)', () => {
      const span = makeSpan({
        attributes: {
          [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: 100,
          [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: 50,
          'gen_ai.usage.cached_input_tokens': 80,
          'gen_ai.usage.cache_write_tokens': 20,
          'gen_ai.usage.reasoning_tokens': 30,
          'gen_ai.usage.audio_input_tokens': 10,
          'gen_ai.usage.audio_output_tokens': 5,
          'mastra.span.type': 'model_generation',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      expect(attrs[LLM_TOKEN_COUNT_PROMPT]).toBe(100);
      expect(attrs[LLM_TOKEN_COUNT_COMPLETION]).toBe(50);
      expect(attrs[LLM_TOKEN_COUNT_TOTAL]).toBe(150);
      expect(attrs[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ]).toBe(80);
      expect(attrs[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE]).toBe(20);
      expect(attrs[LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING]).toBe(30);
      expect(attrs[LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO]).toBe(10);
      expect(attrs[LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO]).toBe(5);
    });

    it('coerces string token values to numbers for total', () => {
      const span = makeSpan({
        attributes: {
          [ATTR_GEN_AI_USAGE_INPUT_TOKENS]: '100',
          [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]: '50',
          'mastra.span.type': 'model_generation',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      expect(attrs[LLM_TOKEN_COUNT_TOTAL]).toBe(150);
    });
  });

  describe('Input/Output Mapping', () => {
    it('maps mastra.model_step.input/output to OpenInference input/output', () => {
      const span = makeSpan({
        attributes: {
          'mastra.model_step.input': '{"prompt": "hello"}',
          'mastra.model_step.output': '{"text": "hi"}',
          'mastra.span.type': 'model_step',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      expect(attrs[INPUT_MIME_TYPE]).toBe('application/json');
      expect(attrs[INPUT_VALUE]).toBe('{"prompt": "hello"}');
      expect(attrs[OUTPUT_MIME_TYPE]).toBe('application/json');
      expect(attrs[OUTPUT_VALUE]).toBe('{"text": "hi"}');
    });

    it('maps generic mastra .input/.output attributes as fallback', () => {
      const span = makeSpan({
        attributes: {
          'mastra.workflow_run.input': '{"data": [1,2]}',
          'mastra.workflow_run.output': '{"result": true}',
          'mastra.span.type': 'workflow_run',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      expect(attrs[INPUT_VALUE]).toBe('{"data": [1,2]}');
      expect(attrs[OUTPUT_VALUE]).toBe('{"result": true}');
    });
  });

  describe('splitMastraAttributes', () => {
    it('preserves mastra.* attributes alongside OpenInference attributes', () => {
      const span = makeSpan({
        attributes: {
          'mastra.span.type': 'agent_run',
          'mastra.custom.key': 'value',
        },
      });
      exporter.export([span], () => {});

      const attrs = exportedSpans[0].attributes;
      // mastra.* attributes should still be present
      expect(attrs['mastra.span.type']).toBe('agent_run');
      expect(attrs['mastra.custom.key']).toBe('value');
    });
  });
});

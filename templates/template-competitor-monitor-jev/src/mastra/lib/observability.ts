import type { AnySpan, SpanOutputProcessor } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { MastraStorageExporter, Observability, SensitiveDataFilter } from '@mastra/observability';

const APPLICATION_SENSITIVE_FIELDS = [
  'body',
  'content',
  'evidence',
  'headers',
  'html',
  'input',
  'output',
  'page',
  'profile',
];

/**
 * Native SensitiveDataFilter redacts values reached through sensitive keys and JSON strings, but provider
 * exceptions can contain unstructured page text in their message or stack. Redact those text fields before
 * the storage exporter while retaining the safe error classification and native attempt/usage attributes.
 */
class ProviderErrorTextRedactor implements SpanOutputProcessor {
  name = 'provider-error-text-redactor';

  process(span?: AnySpan) {
    if (span?.errorInfo) {
      const { category, domain, id, name } = span.errorInfo;
      span.errorInfo = {
        message: '[REDACTED]',
        ...(span.errorInfo.stack === undefined ? {} : { stack: '[REDACTED]' }),
        ...(id === undefined ? {} : { id }),
        ...(name === undefined ? {} : { name }),
        ...(domain === undefined ? {} : { domain }),
        ...(category === undefined ? {} : { category }),
      };
    }
    return span;
  }

  async shutdown() {}
}

/**
 * Stores only compact classifier telemetry locally. Chat, tool, workflow and model spans can contain
 * collected page text or operator profile data, so they are never exported.
 */
export function createLocalObservability() {
  return new Observability({
    sensitiveDataFilter: false,
    configs: {
      local: {
        serviceName: 'competitor-monitor',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
          new SensitiveDataFilter({
            sensitiveFields: APPLICATION_SENSITIVE_FIELDS,
          }),
          new ProviderErrorTextRedactor(),
        ],
        excludeSpanTypes: [
          SpanType.AGENT_RUN,
          SpanType.TOOL_CALL,
          SpanType.WORKFLOW_RUN,
          SpanType.WORKFLOW_STEP,
          SpanType.WORKFLOW_PARALLEL,
          SpanType.WORKFLOW_CONDITIONAL,
          SpanType.WORKFLOW_CONDITIONAL_EVAL,
          SpanType.WORKFLOW_LOOP,
          SpanType.MODEL_GENERATION,
          SpanType.MODEL_STEP,
          SpanType.MODEL_INFERENCE,
          SpanType.MODEL_CHUNK,
        ],
        logging: { enabled: false },
      },
    },
  });
}

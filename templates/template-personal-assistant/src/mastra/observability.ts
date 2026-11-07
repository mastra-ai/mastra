import type { AnySpan, SpanOutputProcessor } from '@mastra/core/observability';
import {
  Observability,
  MastraPlatformExporter,
  MastraStorageExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import type { AssistantConfig } from './config';

// Conversations remain in native memory. Traces retain execution correlation rather than another copy of personal content.
const operationalFields = new Set([
  'runId',
  'threadId',
  'resourceId',
  'scheduleId',
  'occurrenceId',
  'toolCallId',
  'toolName',
  'success',
  'status',
  'finishReason',
  'modelId',
  'provider',
  'sourceMessageId',
  'documentId',
  'revisionId',
  'actualFireAt',
  'triggerKind',
]);
function operational(value?: object) {
  return (
    value &&
    Object.fromEntries(
      Object.entries(value).filter(
        ([key, item]) =>
          operationalFields.has(key) &&
          (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'),
      ),
    )
  );
}
const minimize: SpanOutputProcessor = {
  name: 'assistant-operational-traces',
  process(span?: AnySpan) {
    if (!span) return;
    span.input = operational(span.input);
    span.output = operational(span.output);
    span.inputPreview = '';
    span.outputPreview = '';
    span.errorPreview = span.errorInfo ? 'Operation failed; inspect the conversation for details.' : '';
    span.attributes = operational(span.attributes);
    span.metadata = operational(span.metadata);
    span.requestContext = undefined;
    span.tags = undefined;
    span.stopReasonContext = operational(span.stopReasonContext ?? undefined);
    if (span.errorInfo) span.errorInfo = { message: 'Operation failed; inspect the conversation for details.' };
    return span;
  },
  async shutdown() {},
};

export function createObservability(config: AssistantConfig) {
  return new Observability({
    configs: {
      default: {
        serviceName: 'personal-assistant',
        requestContextKeys: ['scheduleId', 'actualFireAt', 'triggerKind'],
        exporters: [
          new MastraStorageExporter(),
          ...(config.runtime.mode === 'hosted' && config.platformTracing ? [new MastraPlatformExporter()] : []),
        ],
        spanOutputProcessors: [new SensitiveDataFilter(), minimize],
      },
    },
  });
}

import { ConsoleLogger } from '@mastra/core/logger';
import type { ConsoleLoggerOptions, LoggerAdapterContext, RegisteredLogger } from '@mastra/core/logger';
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
  'claimId',
  'category',
]);
/** Keep only explicitly permitted operational metadata in logs and traces. */
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
  /** Remove source content and raw failures from spans while retaining safe operation references. */
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

// Native schedule workers also log outside prepare (including failed trigger persistence).
// Sanitize before ConsoleLogger writes or exports, and preserve that policy in native children.
/** Filter application diagnostics while retaining safe execution identifiers. */
export class AssistantLogger extends ConsoleLogger {
  private adapter?: LoggerAdapterContext;
  constructor(options: ConsoleLoggerOptions = {}) {
    super({ name: 'personal-assistant', level: 'info', ...options });
  }
  override __attachObservability(context: LoggerAdapterContext) {
    this.adapter = context;
    super.__attachObservability(context);
  }
  override child(bindings: RegisteredLogger | Record<string, unknown>) {
    const component = typeof bindings === 'string' ? bindings : (bindings.component ?? this.component);
    const child = new AssistantLogger({ name: this.name, level: this.level, component: component as RegisteredLogger });
    if (this.adapter) child.__attachObservability(this.adapter);
    return child;
  }
  private diagnostic(message: string, args: unknown[]): [string, ...unknown[]] {
    if (
      message.startsWith('AgentScheduleWorker:') ||
      message.startsWith('agent-schedule ') ||
      (this.component === 'STORAGE' &&
        (/fail|error/i.test(message) ||
          args.some(value => value instanceof Error || (value && typeof value === 'object' && 'error' in value))))
    ) {
      const category =
        message === 'AgentScheduleWorker: failed to record trigger'
          ? 'schedule-outcome-recording'
          : message.includes('load schedule row')
            ? 'schedule-read'
            : this.component === 'STORAGE'
              ? 'storage'
              : 'schedule-dispatch';
      return [
        category === 'schedule-outcome-recording'
          ? 'Schedule outcome could not be persisted.'
          : 'Schedule dependency operation failed.',
        {
          ...Object.assign(
            {},
            ...args.filter(value => value && typeof value === 'object').map(value => operational(value as object)),
          ),
          category,
        },
      ];
    }
    return [message, ...args];
  }
  override debug(message: string, ...args: unknown[]) {
    super.debug(...this.diagnostic(message, args));
  }
  override info(message: string, ...args: unknown[]) {
    super.info(...this.diagnostic(message, args));
  }
  override warn(message: string, ...args: unknown[]) {
    super.warn(...this.diagnostic(message, args));
  }
  override error(message: string, ...args: unknown[]) {
    super.error(...this.diagnostic(message, args));
  }
  override trackException(_error: Error, metadata?: Record<string, unknown>) {
    super.trackException(new Error('Operation failed; inspect the conversation for details.'), operational(metadata));
  }
}

/** Persist filtered native traces and enable Platform export only when explicitly configured. */
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

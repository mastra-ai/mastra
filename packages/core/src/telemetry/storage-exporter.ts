import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

import { Logger } from '../logger';

export class OTLPTraceExporter implements SpanExporter {
  private queue: ReadableSpan[] = [];
  private serializer: typeof JsonTraceSerializer;
  private logger: Logger;
  private flushing: boolean = false;

  constructor({ logger }: { logger: Logger }) {
    this.serializer = JsonTraceSerializer;
    this.logger = logger;
  }

  export(internalRepresentation: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.logger.debug('items to be sent', internalRepresentation);

    // don't do any work if too many exports are in progress.
    // if (this._promiseQueue.hasReachedLimit()) {
    //   resultCallback({
    //     code: ExportResultCode.FAILED,
    //     error: new Error('Concurrent export limit reached'),
    //   });
    //   return;
    // }

    const serializedRequest = this.serializer.serializeRequest(internalRepresentation);

    if (serializedRequest == null) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error('Nothing to send'),
      });
      return;
    }

    this.logger.debug('queueing items');
    this.queue.push(...internalRepresentation);

    if (!this.flushing) {
      this.flushing = true;
      this.flush();
    }
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  flush(): Promise<void> {
    const items = this.queue;
    this.queue = [];

    console.log('flushing items', items);

    // TODO: actually flush

    this.flushing = false;
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    if (!this.queue.length) {
      return Promise.resolve();
    }

    this.flushing = false;
    return this.flush();
  }

  __setLogger(logger: Logger) {
    this.logger = logger;
  }
}

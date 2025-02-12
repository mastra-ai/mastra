import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

import { Logger } from '../logger/index.js';
import { MastraStorage } from '../storage/index.js';

export class OTLPTraceExporter implements SpanExporter {
  private storage: MastraStorage;
  private queue: ReadableSpan[] = [];
  private serializer: typeof JsonTraceSerializer;
  private logger: Logger;
  private activeFlush: Promise<void> | undefined = undefined;

  constructor({ logger, storage }: { logger: Logger; storage: MastraStorage }) {
    this.storage = storage;
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

    this.queue.push(...internalRepresentation);

    resultCallback({
      code: ExportResultCode.SUCCESS,
    });

    if (!this.activeFlush) {
      this.activeFlush = this.flush().finally(() => {
        this.activeFlush = undefined;
      });
    }
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  flush(): Promise<void> {
    const items = this.queue;
    this.queue = [];

    return this.storage.batchInsert({ tableName: MastraStorage.TABLE_TRACES, records: items });
  }
  async forceFlush(): Promise<void> {
    if (!this.queue.length) {
      return;
    }

    if (this.activeFlush) {
      await this.activeFlush;
    }

    return this.flush();
  }

  __setLogger(logger: Logger) {
    this.logger = logger;
  }
}

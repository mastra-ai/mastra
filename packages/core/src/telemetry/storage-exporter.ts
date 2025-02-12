import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

import { Logger } from '../logger/index.js';
import { MastraStorage } from '../storage/index.js';

export class OTLPTraceExporter implements SpanExporter {
  private storage: MastraStorage;
  private queue: { data: any[]; resultCallback: (result: ExportResult) => void }[] = [];
  private serializer: typeof JsonTraceSerializer;
  private logger: Logger;
  private activeFlush: Promise<void> | undefined = undefined;

  constructor({ logger, storage }: { logger: Logger; storage: MastraStorage }) {
    this.storage = storage;
    this.serializer = JsonTraceSerializer;
    this.logger = logger;
  }

  export(internalRepresentation: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    // don't do any work if too many exports are in progress.
    // if (this._promiseQueue.hasReachedLimit()) {
    //   resultCallback({
    //     code: ExportResultCode.FAILED,
    //     error: new Error('Concurrent export limit reached'),
    //   });
    //   return;
    // }

    const serializedRequest = this.serializer.serializeRequest(internalRepresentation);
    // @ts-ignore
    const payload = JSON.parse(Buffer.from(serializedRequest.buffer, 'utf8'));
    console.dir(payload, { depth: 555 });
    const items = payload?.resourceSpans?.[0]?.scopeSpans;
    this.logger.debug('items to be sent: ' + items.length);

    this.queue.push({ data: items, resultCallback });

    if (!this.activeFlush) {
      this.activeFlush = this.flush();
    }
  }
  shutdown(): Promise<void> {
    return this.forceFlush();
  }

  flush(): Promise<void> {
    const now = Date.now();
    const items = this.queue.shift();
    if (!items) return Promise.resolve();

    const allSpans: any[] = items.data.reduce((acc, scopedSpans) => {
      const { scope, spans } = scopedSpans;
      for (const span of spans) {
        const {
          spanId,
          parentSpanId,
          traceId,
          name,
          kind,
          attributes,
          status,
          events,
          links,
          startTimeUnixNano,
          endTimeUnixNano,
          ...rest
        } = span;

        acc.push({
          id: spanId,
          parentSpanId,
          traceId,
          name,
          scope,
          kind,
          status,
          events,
          links,
          attributes: attributes.reduce((acc: Record<string, any>, attr: any) => {
            const valueKey = Object.keys(attr.value)[0];
            if (valueKey) {
              acc[attr.key] = attr.value[valueKey];
            }
            return acc;
          }, {}),
          startTime: Number(startTimeUnixNano),
          endTime: Number(endTimeUnixNano),
          other: rest,
          createdAt: now,
        });
      }
      return acc;
    }, []);

    return this.storage
      .batchInsert({
        tableName: MastraStorage.TABLE_TRACES,
        records: allSpans,
      })
      .then(() => {
        items.resultCallback({
          code: ExportResultCode.SUCCESS,
        });
      })
      .catch(e => {
        console.log('span err', e);
        items.resultCallback({
          code: ExportResultCode.FAILED,
          error: e,
        });
      })
      .finally(() => {
        this.activeFlush = undefined;
      });
  }
  async forceFlush(): Promise<void> {
    if (!this.queue.length) {
      return;
    }

    await this.activeFlush;
    while (this.queue.length) {
      await this.flush();
    }
  }

  __setLogger(logger: Logger) {
    this.logger = logger;
  }
}

import { ExportResultCode } from '@opentelemetry/core';
import type { ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

export class CompositeExporter implements SpanExporter {
  private exporters: SpanExporter[];

  constructor(exporters: SpanExporter[]) {
    this.exporters = exporters;
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    // First collect all traceIds from telemetry endpoint spans
    const telemetryTraceIds = new Set(
      spans
        .filter(span => {
          const attrs = span.attributes || {};
          const httpTarget = attrs['http.target'] as string;
          return httpTarget === '/api/telemetry';
        })
        .map(span => span.spanContext().traceId),
    );

    // Then filter out any spans that have those traceIds
    const filteredSpans = spans.filter(span => !telemetryTraceIds.has(span.spanContext().traceId));

    // Return early if no spans to export
    if (filteredSpans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    void Promise.all(
      this.exporters.map(
        exporter =>
          new Promise<ExportResult>(resolve => {
            if (exporter.export) {
              exporter.export(filteredSpans, resolve);
            } else {
              resolve({ code: ExportResultCode.FAILED });
            }
          }),
      ),
    )
      .then(results => {
        const hasError = results.some(r => r.code === ExportResultCode.FAILED);
        resultCallback({
          code: hasError ? ExportResultCode.FAILED : ExportResultCode.SUCCESS,
        });
      })
      .catch(error => {
        console.error('[CompositeExporter] Export error:', error);
        resultCallback({ code: ExportResultCode.FAILED, error });
      });
  }

  shutdown(): Promise<void> {
    return Promise.all(this.exporters.map(e => e.shutdown?.() ?? Promise.resolve())).then(() => undefined);
  }

  forceFlush(): Promise<void> {
    return Promise.all(this.exporters.map(e => e.forceFlush?.() ?? Promise.resolve())).then(() => undefined);
  }
}

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { DefaultObservabilityInstance } from '../instances/default';
import { SensitiveDataFilter } from '../span_processors/sensitive-data-filter';
import { MastraPlatformExporter } from './mastra-platform';
import { MastraStorageExporter } from './mastra-storage';

function span(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span',
    traceId: 'trace',
    name: 'Preview example',
    type: SpanType.AGENT_RUN,
    startTime: new Date(),
    isEvent: false,
    isRootSpan: true,
    attributes: {},
    ...overrides,
  };
}

const fields = (value: {
  inputPreview?: string | null;
  outputPreview?: string | null;
  errorPreview?: string | null;
}) => ({
  inputPreview: value.inputPreview,
  outputPreview: value.outputPreview,
  errorPreview: value.errorPreview,
});

describe.each(['realtime', 'batch-with-updates', 'insert-only'] as const)(
  'exported preview agreement (%s)',
  strategy => {
    it('persists and publishes the same final previews after formatting, including intentional blanks', async () => {
      const received: Array<Record<string, unknown>> = [];
      const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        const parsed = JSON.parse(body);
        received.push(...(parsed.spans ?? []));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{}');
      });
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const storage = new InMemoryStore();
      const mastra = new Mastra({ storage });
      const format = (exported: AnyExportedSpan) =>
        exported.output?.text === 'private' ? { ...exported, output: { text: '[REDACTED]' } } : exported;
      const platform = new MastraPlatformExporter({
        accessToken: 'test-token',
        endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        maxBatchWaitMs: 60_000,
        customSpanFormatter: format,
      });
      const formattedLocal = new MastraStorageExporter({
        strategy,
        maxBatchWaitMs: 60_000,
        customSpanFormatter: format,
      });
      try {
        await formattedLocal.init({ mastra });
        const initial = span({ input: 'Find order', errorPreview: '' });
        await platform.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: initial });
        await platform.exportTracingEvent({ type: TracingEventType.SPAN_UPDATED, exportedSpan: initial });
        await platform.flush();
        expect(received).toEqual([]);
        await formattedLocal.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: initial });
        await formattedLocal.flush();
        const store = await storage.getStore('observability');
        if (strategy !== 'insert-only') {
          expect((await store!.getSpan({ traceId: 'trace', spanId: 'span' }))?.span.outputPreview).toBe('');
        }
        const ended = {
          ...initial,
          endTime: new Date(),
          output: { text: 'private' },
          errorInfo: { message: 'suppressed' },
        };
        const event = { type: TracingEventType.SPAN_ENDED, exportedSpan: ended };
        await formattedLocal.exportTracingEvent(event);
        await platform.exportTracingEvent(event);
        await formattedLocal.flush();
        await platform.flush();
        const stored = await store!.getSpan({ traceId: 'trace', spanId: 'span' });
        expect(fields(stored!.span)).toEqual({
          inputPreview: 'Find order',
          outputPreview: '[REDACTED]',
          errorPreview: '',
        });
        expect(received).toHaveLength(1);
        expect(fields(received[0]!)).toEqual(fields(stored!.span));
        expect(JSON.stringify(received)).not.toContain('private');

        const tracing = new DefaultObservabilityInstance({
          name: 'previews',
          serviceName: 'previews',
          exporters: [formattedLocal, platform],
          spanOutputProcessors: [new SensitiveDataFilter({ sensitiveFields: ['token', 'message'] })],
        });
        const live = tracing.startSpan({
          type: SpanType.TOOL_CALL,
          name: 'redacted tool',
          input: { token: 'private-token' },
        });
        live.update({ output: { token: 'private-token' } });
        live.error({ error: new Error('private-message'), endSpan: true });
        await tracing.flush();
        const redacted = (await store!.getSpan({ traceId: live.traceId, spanId: live.id }))!.span;
        expect(fields(redacted)).toEqual({
          inputPreview: '{"token":"[REDACTED]"}',
          outputPreview: '{"token":"[REDACTED]"}',
          errorPreview: '[REDACTED]',
        });
        expect(fields(received.at(-1)!)).toEqual(fields(redacted));
        expect(JSON.stringify(received.map(fields))).not.toContain('private-');
        await tracing.shutdown();
      } finally {
        await formattedLocal.shutdown();
        await platform.shutdown();
        await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
      }
    });
  },
);

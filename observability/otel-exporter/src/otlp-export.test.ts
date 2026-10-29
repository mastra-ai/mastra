import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OtelExporter } from './tracing';
import type { OtelExporterConfig } from './types';

// Exercise the real OTLP transports: these regressions otherwise silently drop traces (#28751, #28752).
describe('OTLP exports', () => {
  let server: http.Server;
  let baseUrl: string;
  let requests: { path: string; body: Buffer }[];
  let exporter: OtelExporter | undefined;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        requests.push({ path: req.url!, body: Buffer.concat(chunks) });
        const json = req.headers['content-type'] === 'application/json';
        res.writeHead(200, { 'Content-Type': json ? 'application/json' : 'application/x-protobuf' });
        res.end(json ? '{}' : Buffer.alloc(0));
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    requests = [];
  });
  afterEach(async () => {
    await exporter?.shutdown();
    exporter = undefined;
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    if (server.listening)
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  async function sendSpan(metadata?: Record<string, unknown>, child = false) {
    const now = new Date();
    await exporter!.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: {
        id: child ? 'a1b2c3d4e5f60719' : 'a1b2c3d4e5f60718',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        parentSpanId: child ? 'a1b2c3d4e5f60718' : undefined,
        type: SpanType.AGENT_RUN,
        name: 'agent run',
        startTime: now,
        endTime: now,
        isRootSpan: !child,
        isEvent: false,
        attributes: {},
        metadata,
      } as AnyExportedSpan,
    });
  }

  describe.each(['http/json', 'http/protobuf'] as const)('%s endpoints', protocol => {
    it.each([
      ['', '/v1/traces', '/v1/logs'],
      ['/', '/v1/traces', '/v1/logs'],
      ['/v1/traces', '/v1/traces', '/v1/logs'],
      ['/v1/traces/', '/v1/traces', '/v1/logs'],
      ['/v1/logs', '/v1/traces', '/v1/logs'],
    ])('routes traces and logs for %s', async (path, traces, logs) => {
      exporter = new OtelExporter({ provider: { custom: { endpoint: baseUrl + path, protocol } } });
      await sendSpan();
      await exporter.onLogEvent({ type: 'log', log: { timestamp: new Date(), level: 'info', message: 'hello' } });
      await exporter.flush();
      expect(requests.map(request => request.path).sort()).toEqual([traces, logs].sort());
    });

    it.each([
      ['/api/traces/', '/events/log-ingest?tenant=acme'],
      ['/ingest?signal=traces', '/logs/?signal=logs'],
      ['/', '/'],
    ])('uses explicit trace %s and log %s endpoints unchanged', async (traces, logs) => {
      exporter = new OtelExporter({
        provider: { custom: { protocol, endpoints: { traces: baseUrl + traces, logs: baseUrl + logs } } },
      });
      await sendSpan();
      await exporter.onLogEvent({ type: 'log', log: { timestamp: new Date(), level: 'info', message: 'hello' } });
      await exporter.flush();
      expect(requests.map(request => request.path).sort()).toEqual([traces, logs].sort());
    });

    it.each(['traces', 'logs'] as const)('exports only the explicitly configured %s signal', async signal => {
      exporter = new OtelExporter({
        provider: {
          custom: {
            protocol,
            endpoints: signal === 'traces' ? { traces: baseUrl + '/exact/' } : { logs: baseUrl + '/exact/' },
          },
        },
      });
      await sendSpan();
      await exporter.onLogEvent({ type: 'log', log: { timestamp: new Date(), level: 'info', message: 'hello' } });
      await exporter.flush();
      expect(requests.map(request => request.path)).toEqual(['/exact/']);
    });

    it.each(['traces', 'logs', 'both'] as const)(
      'accepts %s URLs explicitly read from environment variables',
      async signal => {
        vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', signal === 'logs' ? undefined : baseUrl + '/traces/');
        vi.stubEnv('OTEL_EXPORTER_OTLP_LOGS_ENDPOINT', signal === 'traces' ? undefined : baseUrl + '/logs?tenant=acme');
        exporter = new OtelExporter({
          provider: {
            custom: {
              protocol,
              endpoints: {
                traces: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
                logs: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
              },
            },
          },
        });
        await sendSpan();
        await exporter.onLogEvent({ type: 'log', log: { timestamp: new Date(), level: 'info', message: 'hello' } });
        await exporter.flush();
        const expected =
          signal === 'traces'
            ? ['/traces/']
            : signal === 'logs'
              ? ['/logs?tenant=acme']
              : ['/logs?tenant=acme', '/traces/'];
        expect(requests.map(request => request.path).sort()).toEqual(expected);
      },
    );

    it('honors signal toggles with explicit endpoints', async () => {
      exporter = new OtelExporter({
        provider: { custom: { protocol, endpoints: { traces: baseUrl + '/trace', logs: baseUrl + '/log' } } },
        signals: { traces: false, logs: false },
      });
      await sendSpan();
      await exporter.onLogEvent({ type: 'log', log: { timestamp: new Date(), level: 'info', message: 'hello' } });
      await exporter.flush();
      expect(requests).toEqual([]);
    });
  });

  async function attributes(metadata?: Record<string, unknown>, metadataMapping?: Record<string, string>) {
    const config: OtelExporterConfig = {
      provider: { custom: { endpoint: baseUrl, protocol: 'http/json' } },
      signals: { logs: false },
      metadataMapping,
    };
    exporter = new OtelExporter(config);
    await sendSpan(metadata);
    await sendSpan(metadata, true);
    await exporter.flush();
    const spans = requests.flatMap(request => JSON.parse(request.body.toString()).resourceSpans[0].scopeSpans[0].spans);
    expect(spans).toHaveLength(2);
    return spans.map((span: { attributes: { key: string; value: Record<string, unknown> }[] }) =>
      Object.fromEntries(span.attributes.map(({ key, value }) => [key, Object.values(value)[0]])),
    );
  }

  it('keeps metadata namespaced by default', async () => {
    for (const attrs of await attributes({ userId: 'user-123' })) {
      expect(attrs['mastra.metadata.userId']).toBe('user-123');
      expect(attrs['user.id']).toBeUndefined();
    }
  });

  it('copies selected metadata to root and child span attributes without removing the originals', async () => {
    for (const attrs of await attributes(
      {
        userId: 42,
        tenantId: 'acme',
        enabled: false,
        count: 0,
        details: { plan: 'pro' },
        labels: ['a'],
        other: 'private',
      },
      {
        userId: 'user.id',
        tenantId: 'tenant.id',
        enabled: 'enabled',
        count: 'count',
        details: 'details',
        labels: 'labels',
      },
    )) {
      expect(attrs).toMatchObject({
        'user.id': '42',
        'tenant.id': 'acme',
        enabled: 'false',
        count: '0',
        details: '{"plan":"pro"}',
        labels: '["a"]',
        'mastra.metadata.userId': 42,
        'mastra.metadata.other': 'private',
      });
      expect(attrs.other).toBeUndefined();
    }
  });

  it.each([undefined, {}, { userId: null }, { userId: undefined }, { userId: '' }])(
    'omits mapped attributes for absent or empty metadata (%j)',
    async metadata => {
      for (const attrs of await attributes(metadata, { userId: 'user.id' })) {
        expect(attrs['user.id']).toBeUndefined();
      }
    },
  );
});

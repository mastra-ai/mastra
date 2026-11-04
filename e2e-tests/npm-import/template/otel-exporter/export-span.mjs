import { createServer } from 'node:http';
import { OtelExporter } from '@mastra/otel-exporter';
import { SpanType, TracingEventType } from '@mastra/core/observability';

const requests = [];
const server = createServer((req, res) => {
  let bytes = 0;
  req.on('data', chunk => (bytes += chunk.length));
  req.on('end', () => {
    requests.push({ url: req.url, contentType: req.headers['content-type'], bytes });
    res.end('{}');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const exporter = new OtelExporter({
  provider: {
    custom: { endpoint: `http://127.0.0.1:${server.address().port}/v1/traces`, protocol: 'http/protobuf' },
  },
});
const now = new Date();
await exporter.exportTracingEvent({
  type: TracingEventType.SPAN_ENDED,
  exportedSpan: {
    id: '0123456789abcdef',
    traceId: '0123456789abcdef0123456789abcdef',
    type: SpanType.AGENT_RUN,
    name: 'export-span probe',
    isRootSpan: true,
    startTime: now,
    endTime: now,
    attributes: { agentId: 'probe' },
  },
});
await exporter.shutdown();
server.close();
console.log(JSON.stringify(requests));

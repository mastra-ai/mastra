import {Attributes, AttributeValue} from '@opentelemetry/api';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {HostMetrics} from '@opentelemetry/host-metrics';
import FastifyOtelInstrumentation from '@fastify/otel';
import {BatchSpanProcessor, NoopSpanProcessor, SpanProcessor, Span} from '@opentelemetry/sdk-trace-node';

type IgnoreFunction = (request: {url?: string}) => boolean;

/**
 * Hook function for @opentelemetry/instrumentation-http to ignore incoming requests for ping and health endpoints
 * to avoid unnecessary tracing.
 *
 * @param request an incoming request object
 * @returns true if the request is a ping, metrics or health request, false otherwise
 */
export const isIgnorableRequest: IgnoreFunction = request =>
  request.url === '/ping' || request.url === '/health' || request.url === '/metrics' || request.url === '/favicon.ico';

const log = console;

type ShutdownFunction = () => Promise<void>;

// these are the default span processors which are generally provided by the SDK
// but since we are adding our own span processors, we need to do this bootstrapping manually :(
const traceExporter = new OTLPTraceExporter();
const batchSpanProcessor = new BatchSpanProcessor(traceExporter);

const removeDataUrisFromString = (value: string): string => {
  // for now we only really emit this type of data URI so we be quick/dirty here
  if (value.startsWith('data:image/png;base64,')) {
    return '[Data URI]';
  }
  return value.replaceAll(/"data:[^"]+"/g, '"[Data URI]"');
};

const removeDataUrisFromAttributeValue = (value: AttributeValue): AttributeValue => {
  if (typeof value === 'string') {
    return removeDataUrisFromString(value);
  }
  return value;
};

const removeDataUrisFromAttributes = (attributes: Attributes): Attributes =>
  Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, value ? removeDataUrisFromAttributeValue(value) : value]),
  );

class DataUriRemovingProcessor extends NoopSpanProcessor implements SpanProcessor {
  onStart(span: Span) {
    const originalSetAttribute = span.setAttribute;
    const originalSetAttributes = span.setAttributes;

    span.setAttribute = (key, value) => originalSetAttribute.call(span, key, removeDataUrisFromAttributeValue(value));

    span.setAttributes = attributes => originalSetAttributes.call(span, removeDataUrisFromAttributes(attributes));
  }
}

const dataUriRemovingProcessor = new DataUriRemovingProcessor();

export function startTelemetry(): ShutdownFunction {
  const instrumentations = [
    ...getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        headersToSpanAttributes: {
          server: {
            requestHeaders: ['x-request-id', 'x-api-key'],
          },
        },
        ignoreIncomingRequestHook: isIgnorableRequest,
      },
    }),
    new FastifyOtelInstrumentation({registerOnInitialization: true}),
  ];

  const sdk = new NodeSDK({
    instrumentations,
    spanProcessors: [dataUriRemovingProcessor, batchSpanProcessor],
  });

  // initialize the SDK and register with the OpenTelemetry API
  // this enables the API to record telemetry
  sdk.start();

  const hostMetrics = new HostMetrics();
  hostMetrics.start();

  let shutdownCalled = false;

  const shutdown = async () => {
    if (shutdownCalled) {
      return;
    }
    shutdownCalled = true;
    await sdk.shutdown();
  };

  // gracefully shut down the SDK on process exit
  process.on('SIGTERM', () => {
    shutdown()
      .then(() => log.info('OpenTelemetry SDK terminated'))
      .catch(error => log.error(error, 'Error terminating OpenTelemetry SDK'))
      .finally(() => process.exit(0));
  });

  return shutdown;
}

startTelemetry();

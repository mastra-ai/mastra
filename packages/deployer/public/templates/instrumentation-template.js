import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/core/storage/libsql';
import { OTLPStorageExporter } from '@mastra/core/telemetry';
import {
  NodeSDK,
  getNodeAutoInstrumentations,
  ATTR_SERVICE_NAME,
  Resource,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
  OTLPHttpExporter,
  OTLPGrpcExporter,
} from '@mastra/core/telemetry/otel-vendor';
import { telemetry } from './telemetry-config.mjs';

function getSampler(config) {
  if (!config.sampling) {
    return new AlwaysOnSampler();
  }

  if (!config.enabled) {
    return new AlwaysOffSampler();
  }

  switch (config.sampling.type) {
    case 'ratio':
      return new TraceIdRatioBasedSampler(config.sampling.probability);
    case 'always_on':
      return new AlwaysOnSampler();
    case 'always_off':
      return new AlwaysOffSampler();
    case 'parent_based':
      const rootSampler = new TraceIdRatioBasedSampler(config.sampling.root?.probability || 1.0);
      return new ParentBasedSampler({ root: rootSampler });
    default:
      return new AlwaysOnSampler();
  }
}

async function getExporter(config) {
  if (config.export?.type === 'otlp') {
    if(config.export?.protocol === "grpc") {
      return new OTLPGrpcExporter({
        url: config.export.endpoint,
        headers: config.export.headers,
      })
    }
    return new OTLPHttpExporter({
      url: config.export.endpoint,
      headers: config.export.headers,
    });
  } else if (config.export?.type === 'custom') {
    return config.export.exporter;
  } else {
    return new OTLPHttpExporter({
      url: `http://localhost:${process.env.PORT ?? 4111}/api/telemetry`,
    });
  }
}

const sampler = getSampler(telemetry);
const exporter = await getExporter(telemetry);

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: telemetry.serviceName || 'default-service',
  }),
  sampler,
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown().catch(() => {
    // do nothing
  });
});


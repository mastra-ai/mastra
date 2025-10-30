import { MastraCloudExporter } from '@mastra/cloud';
import {
  NodeSDK,
  getNodeAutoInstrumentations,
  ATTR_SERVICE_NAME,
  resourceFromAttributes,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
  OTLPHttpExporter,
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
    return new OTLPHttpExporter({
      url: config.export.endpoint,
      headers: config.export.headers,
    });
  } else if (config.export?.type === 'custom') {
    return config.export.exporter;
  } else {
    console.info('Using default Mastra Cloud Exporter');
    return new MastraCloudExporter({
      endpoint: process.env.BUSINESS_API_TRACE_ENDPOINT,
      accessToken: process.env.BUSINESS_JWT_TOKEN,
    });
  }
}

const sampler = getSampler(telemetry);
const exporter = await getExporter(telemetry);

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: telemetry.serviceName || 'default-service',
  }),
  sampler,
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

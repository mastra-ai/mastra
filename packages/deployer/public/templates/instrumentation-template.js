import {
  NodeSDK, getNodeAutoInstrumentations, ATTR_SERVICE_NAME, Resource,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
} from '@mastra/core/telemetry/otel-vendor';
import { OTLPStorageExporter } from '@mastra/core/telemetry'
import { MastraStorageLibSql } from '@mastra/core/storage'
import { createLogger } from '@mastra/core/logger'
import { telemetry } from './telemetry-config.mjs'


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
    })
  } else if (config.export?.type === 'custom') {
    return config.export.exporter
  } else {
    const storage = new MastraStorageLibSql({
      config: {
        // file lives in ./.mastra/output, and we need to write to ./.mastra/mastra.db
        url: "file:../mastra.db",
      },
    })
    await storage.init()

    return new OTLPStorageExporter({
      logger: createLogger({
        name: 'telemetry',
        level: 'silent',
      }),
      storage,
    })
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
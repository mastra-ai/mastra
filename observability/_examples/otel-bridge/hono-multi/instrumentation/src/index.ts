import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ArizeOpenInferenceOTLPTraceExporter } from './arize-exporter.js';

export const httpInstrumentation = new HttpInstrumentation({});
export const fetchInstrumentation = new UndiciInstrumentation({});

let sdk: NodeSDK | undefined;

const PROJECT_NAME = process.env.ARIZE_PROJECT_NAME || 'tracing-exp';

export const startTelemetry = async (): Promise<NodeSDK> => {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

  const openTelemetrySDK = new NodeSDK({
    resource: defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: PROJECT_NAME,
        [SEMRESATTRS_PROJECT_NAME]: PROJECT_NAME,
      }),
    ),
    spanProcessors: [
      new BatchSpanProcessor(
        new ArizeOpenInferenceOTLPTraceExporter({
          endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:6006/v1/traces',
        }),
      ),
    ],
    instrumentations: [httpInstrumentation, fetchInstrumentation],
    textMapPropagator: new W3CTraceContextPropagator(),
  });
  openTelemetrySDK.start();
  sdk = openTelemetrySDK;

  return Promise.resolve(openTelemetrySDK);
};

export const stopTelemetry = async () => {
  if (!sdk) return;

  await sdk.shutdown();

  sdk = undefined;
};

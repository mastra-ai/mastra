import type { Attributes, Tracer } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import type { CallSettings, TelemetrySettings } from 'ai-v5';
import { noopTracer } from './noop';

export function getTracer({
  isEnabled = false,
  tracer,
}: {
  isEnabled?: boolean;
  tracer?: Tracer;
} = {}): Tracer {
  if (!isEnabled) {
    return noopTracer;
  }

  if (tracer) {
    return tracer;
  }

  return trace.getTracer('mastra');
}

export function assembleOperationName({
  operationId,
  telemetry,
}: {
  operationId: string;
  telemetry?: TelemetrySettings;
}) {
  return {
    'mastra.operationId': operationId,
    'operation.name': `${operationId}${telemetry?.functionId != null ? ` ${telemetry.functionId}` : ''}`,
    ...(telemetry?.functionId ? { 'resource.name': telemetry?.functionId } : {}),
  };
}

export function getTelemetryAttributes({
  model,
  settings,
  telemetry,
  headers,
}: {
  model: { modelId: string; provider: string };
  settings: Omit<CallSettings, 'abortSignal' | 'headers' | 'temperature'>;
  telemetry: TelemetrySettings | undefined;
  headers: Record<string, string | undefined> | undefined;
}): Attributes {
  return {
    'aisdk.model.provider': model.provider,
    'aisdk.model.id': model.modelId,

    // settings:
    ...Object.entries(settings).reduce((attributes, [key, value]) => {
      attributes[`stream.settings.${key}`] = value;
      return attributes;
    }, {} as Attributes),

    // add metadata as attributes:
    ...Object.entries(telemetry?.metadata ?? {}).reduce((attributes, [key, value]) => {
      attributes[`stream.telemetry.metadata.${key}`] = value;
      return attributes;
    }, {} as Attributes),

    // request headers
    ...Object.entries(headers ?? {}).reduce((attributes, [key, value]) => {
      if (value !== undefined) {
        attributes[`stream.request.headers.${key}`] = value;
      }
      return attributes;
    }, {} as Attributes),
  };
}

export function getRootSpan({
  operationId,
  model,
  modelSettings,
  telemetry_settings,
  headers,
}: {
  operationId: string;
  model: { modelId: string; provider: string };
  modelSettings?: CallSettings;
  telemetry_settings?: TelemetrySettings;
  headers?: Record<string, string | undefined> | undefined;
}) {
  const tracer = getTracer({
    isEnabled: telemetry_settings?.isEnabled,
    tracer: telemetry_settings?.tracer,
  });

  const baseTelemetryAttributes = getTelemetryAttributes({
    model: {
      modelId: model.modelId,
      provider: model.provider,
    },
    settings: modelSettings ?? {
      maxRetries: 2,
    },
    telemetry: telemetry_settings,
    headers,
  });

  const rootSpan = tracer.startSpan(operationId).setAttributes({
    ...assembleOperationName({
      operationId,
      telemetry: telemetry_settings,
    }),
    ...baseTelemetryAttributes,
  });

  return {
    rootSpan,
  };
}

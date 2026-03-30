import type { ObservabilityContext } from '@mastra/core/observability';
import { createObservabilityContext, EntityType, getOrCreateSpan, SpanType } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';

import type { ModelByInputTokens } from './model-by-input-tokens';
import type { ResolvedObservationConfig, ResolvedReflectionConfig } from './types';

type OmTracingModel = Exclude<
  ResolvedObservationConfig['model'] | ResolvedReflectionConfig['model'],
  ModelByInputTokens
>;

type OmTracingPhase = 'observer' | 'observer-multi-thread' | 'reflector';

const PHASE_CONFIG: Record<
  OmTracingPhase,
  {
    name: string;
    entityName: string;
  }
> = {
  observer: {
    name: 'om.observer',
    entityName: 'Observer',
  },
  'observer-multi-thread': {
    name: 'om.observer.multi-thread',
    entityName: 'MultiThreadObserver',
  },
  reflector: {
    name: 'om.reflector',
    entityName: 'Reflector',
  },
};

export async function withOmTracingSpan<T>({
  phase,
  model,
  inputTokens,
  requestContext,
  observabilityContext,
  metadata,
  callback,
}: {
  phase: OmTracingPhase;
  model: OmTracingModel;
  inputTokens: number;
  requestContext?: RequestContext;
  observabilityContext?: ObservabilityContext;
  metadata?: Record<string, unknown>;
  callback: (observabilityContext: ObservabilityContext) => Promise<T>;
}): Promise<T> {
  const config = PHASE_CONFIG[phase];
  const span = getOrCreateSpan({
    type: SpanType.GENERIC,
    name: config.name,
    entityType: EntityType.OUTPUT_STEP_PROCESSOR,
    entityName: config.entityName,
    tracingContext: observabilityContext?.tracingContext ?? observabilityContext?.tracing,
    attributes: {
      metadata: {
        omPhase: phase,
        omInputTokens: inputTokens,
        omSelectedModel: typeof model === 'string' ? model : '(dynamic-model)',
        ...metadata,
      },
    },
    requestContext,
  });
  const childObservabilityContext = createObservabilityContext({ currentSpan: span });

  if (!span) {
    return callback(childObservabilityContext);
  }

  return span.executeInContext(() => callback(childObservabilityContext));
}

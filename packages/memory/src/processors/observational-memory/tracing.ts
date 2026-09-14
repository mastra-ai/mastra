import type { MemoryOperationAttributes, ObservabilityContext } from '@mastra/core/observability';
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
    operationType: NonNullable<MemoryOperationAttributes['operationType']>;
    multiThread?: boolean;
  }
> = {
  observer: {
    name: 'memory: observe',
    entityName: 'Observer',
    operationType: 'observe',
  },
  'observer-multi-thread': {
    name: 'memory: observe.multi-thread',
    entityName: 'MultiThreadObserver',
    operationType: 'observe',
    multiThread: true,
  },
  reflector: {
    name: 'memory: reflect',
    entityName: 'Reflector',
    operationType: 'reflect',
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
  // GENERIC is reserved for spans ingested from outside Mastra, where the shape
  // is unknown. These are memory's own model passes, so they carry the memory
  // operation type and its typed attributes rather than an untyped metadata bag.
  //
  // The entity type was previously OUTPUT_STEP_PROCESSOR, which these spans are
  // not: they wrap the observer/reflector model calls made *inside* the
  // observational-memory processor. Anything keying off a processor entity type
  // counted these model-call durations as processor overhead.
  const span = getOrCreateSpan<SpanType.MEMORY_OPERATION>({
    type: SpanType.MEMORY_OPERATION,
    name: config.name,
    entityType: EntityType.MEMORY,
    entityName: config.entityName,
    tracingContext: observabilityContext?.tracingContext ?? observabilityContext?.tracing,
    attributes: {
      operationType: config.operationType,
      inputTokens,
      selectedModel: typeof model === 'string' ? model : '(dynamic-model)',
      ...(config.multiThread ? { multiThread: true } : {}),
    },
    metadata,
    requestContext,
  });
  const childObservabilityContext = createObservabilityContext({ currentSpan: span });

  if (!span) {
    return callback(childObservabilityContext);
  }

  return span.executeInContext(async () => {
    try {
      const result = await callback(childObservabilityContext);
      span.end();
      return result;
    } catch (error) {
      span.error({ error: error as Error, endSpan: true });
      throw error;
    }
  });
}

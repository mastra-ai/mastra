import type { IMastraLogger } from '../logger';
import type {
  ToolPayloadProjection,
  ToolPayloadProjectionContext,
  ToolPayloadProjectionFunction,
  ToolPayloadProjectionPhase,
  ToolPayloadProjectionPolicy,
  ToolPayloadProjectionTarget,
} from './types';

export type ProjectedToolPayloadState = {
  projected?: unknown;
  suppress?: boolean;
  failed?: boolean;
};

export type ToolPayloadProjectionMetadata = Partial<
  Record<ToolPayloadProjectionTarget, Partial<Record<ToolPayloadProjectionPhase, ProjectedToolPayloadState>>>
>;

export type ToolPayloadProjectionSource = {
  policy?: ToolPayloadProjectionPolicy;
  toolProjection?: ToolPayloadProjection;
};

const PHASE_TO_TOOL_PROJECTOR: Record<ToolPayloadProjectionPhase, keyof NonNullable<ToolPayloadProjection['display']>> =
  {
    'input-delta': 'inputDelta',
    'input-available': 'input',
    'output-available': 'output',
    error: 'error',
    approval: 'approval',
    suspend: 'suspend',
    resume: 'resume',
  };

function isProjectionConfigured(source: ToolPayloadProjectionSource | undefined, target: ToolPayloadProjectionTarget) {
  return Boolean(source?.policy?.projectToolPayload || source?.toolProjection?.[target]);
}

function getToolProjector(
  source: ToolPayloadProjectionSource | undefined,
  target: ToolPayloadProjectionTarget,
  phase: ToolPayloadProjectionPhase,
): ToolPayloadProjectionFunction | undefined {
  return source?.toolProjection?.[target]?.[PHASE_TO_TOOL_PROJECTOR[phase]];
}

function safePlaceholder(context: ToolPayloadProjectionContext) {
  return {
    message: `Tool ${context.phase} payload unavailable`,
  };
}

async function projectOneTarget(
  context: ToolPayloadProjectionContext,
  source: ToolPayloadProjectionSource | undefined,
  logger?: IMastraLogger,
): Promise<ProjectedToolPayloadState | undefined> {
  const configured = isProjectionConfigured(source, context.target);
  if (!configured) {
    return undefined;
  }

  const projectors = [
    source?.policy?.projectToolPayload,
    getToolProjector(source, context.target, context.phase),
  ].filter(Boolean) as ToolPayloadProjectionFunction[];

  if (projectors.length === 0) {
    return context.phase === 'input-delta' ? { suppress: true } : { projected: safePlaceholder(context) };
  }

  for (const projector of projectors) {
    try {
      const projected = await projector(context);
      if (projected !== undefined) {
        return { projected };
      }
    } catch (error) {
      logger?.warn?.('Tool payload projection failed', {
        toolName: context.toolName,
        toolCallId: context.toolCallId,
        target: context.target,
        phase: context.phase,
        error,
      });
      return context.phase === 'input-delta'
        ? { suppress: true, failed: true }
        : { projected: safePlaceholder(context), failed: true };
    }
  }

  return context.phase === 'input-delta' ? { suppress: true } : { projected: safePlaceholder(context) };
}

export async function projectToolPayloadForTargets(
  context: Omit<ToolPayloadProjectionContext, 'target'>,
  source: ToolPayloadProjectionSource | undefined,
  logger?: IMastraLogger,
): Promise<ToolPayloadProjectionMetadata | undefined> {
  const display = await projectOneTarget({ ...context, target: 'display' }, source, logger);
  const transcript = await projectOneTarget({ ...context, target: 'transcript' }, source, logger);

  if (!display && !transcript) {
    return undefined;
  }

  return {
    ...(display ? { display: { [context.phase]: display } } : {}),
    ...(transcript ? { transcript: { [context.phase]: transcript } } : {}),
  };
}

export function getProjectedToolPayload(
  metadata: unknown,
  target: ToolPayloadProjectionTarget,
  phase: ToolPayloadProjectionPhase,
): ProjectedToolPayloadState | undefined {
  const projection = (metadata as { mastra?: { toolPayloadProjection?: ToolPayloadProjectionMetadata } } | undefined)
    ?.mastra?.toolPayloadProjection;
  return projection?.[target]?.[phase];
}

function mergeProjectionMetadata(
  existing: ToolPayloadProjectionMetadata | undefined,
  next: ToolPayloadProjectionMetadata | undefined,
): ToolPayloadProjectionMetadata | undefined {
  if (!existing) {
    return next;
  }
  if (!next) {
    return existing;
  }

  return {
    display: {
      ...(existing.display ?? {}),
      ...(next.display ?? {}),
    },
    transcript: {
      ...(existing.transcript ?? {}),
      ...(next.transcript ?? {}),
    },
  };
}

export function withToolPayloadProjectionProviderMetadata<T extends Record<string, any> | undefined>(
  providerMetadata: T,
  projectionMetadata: { mastra?: { toolPayloadProjection?: ToolPayloadProjectionMetadata } } | undefined,
): T | Record<string, any> | undefined {
  const projection = projectionMetadata?.mastra?.toolPayloadProjection;
  if (!projection) {
    return providerMetadata;
  }

  return {
    ...(providerMetadata ?? {}),
    mastra: {
      ...(providerMetadata?.mastra ?? {}),
      toolPayloadProjection: mergeProjectionMetadata(providerMetadata?.mastra?.toolPayloadProjection, projection),
    },
  };
}

export function withToolPayloadProjectionMetadata<T extends { metadata?: Record<string, any> }>(
  chunk: T,
  projection: ToolPayloadProjectionMetadata | undefined,
): T {
  if (!projection) {
    return chunk;
  }

  return {
    ...chunk,
    metadata: {
      ...(chunk.metadata ?? {}),
      mastra: {
        ...(chunk.metadata?.mastra ?? {}),
        toolPayloadProjection: mergeProjectionMetadata(chunk.metadata?.mastra?.toolPayloadProjection, projection),
      },
    },
  };
}

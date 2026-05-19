import type { IMastraLogger } from '../logger';
import type {
  ToolPayloadTransform,
  ToolPayloadTransformContext,
  ToolPayloadTransformFunction,
  ToolPayloadTransformPhase,
  ToolPayloadTransformPolicy,
  ToolPayloadTransformTarget,
} from './types';

export type TransformedToolPayloadState = {
  transformed?: unknown;
  suppress?: boolean;
  failed?: boolean;
};

export type ToolPayloadTransformMetadata = Partial<
  Record<ToolPayloadTransformTarget, Partial<Record<ToolPayloadTransformPhase, TransformedToolPayloadState>>>
>;

export type ToolPayloadTransformSource = {
  policy?: ToolPayloadTransformPolicy;
  toolTransform?: ToolPayloadTransform;
};

type LegacyToolPayloadProjectionPolicy = {
  projectToolPayload?: ToolPayloadTransformFunction;
  targets?: ToolPayloadTransformTarget[];
};

export function normalizeToolPayloadTransformPolicy(
  policy: ToolPayloadTransformPolicy | LegacyToolPayloadProjectionPolicy | undefined,
): ToolPayloadTransformPolicy | undefined {
  if (!policy) {
    return undefined;
  }

  if ('transformToolPayload' in policy) {
    return policy;
  }

  if ('projectToolPayload' in policy && policy.projectToolPayload) {
    return {
      transformToolPayload: policy.projectToolPayload,
      targets: policy.targets,
    };
  }

  return undefined;
}

const PHASE_TO_TOOL_TRANSFORMER: Record<ToolPayloadTransformPhase, keyof NonNullable<ToolPayloadTransform['display']>> =
  {
    'input-delta': 'inputDelta',
    'input-available': 'input',
    'output-available': 'output',
    error: 'error',
    approval: 'approval',
    suspend: 'suspend',
    resume: 'resume',
  };

function isPolicyConfiguredForTarget(
  policy: ToolPayloadTransformPolicy | undefined,
  target: ToolPayloadTransformTarget,
) {
  return Boolean(policy?.transformToolPayload && (!policy.targets || policy.targets.includes(target)));
}

function isTransformConfigured(source: ToolPayloadTransformSource | undefined, target: ToolPayloadTransformTarget) {
  return Boolean(isPolicyConfiguredForTarget(source?.policy, target) || source?.toolTransform?.[target]);
}

function getToolTransformer(
  source: ToolPayloadTransformSource | undefined,
  target: ToolPayloadTransformTarget,
  phase: ToolPayloadTransformPhase,
): ToolPayloadTransformFunction | undefined {
  return source?.toolTransform?.[target]?.[PHASE_TO_TOOL_TRANSFORMER[phase]];
}

function safePlaceholder(context: ToolPayloadTransformContext) {
  return {
    message: `Tool ${context.phase} payload unavailable`,
  };
}

async function transformOneTarget(
  context: ToolPayloadTransformContext,
  source: ToolPayloadTransformSource | undefined,
  logger?: IMastraLogger,
): Promise<TransformedToolPayloadState | undefined> {
  const configured = isTransformConfigured(source, context.target);
  if (!configured) {
    return undefined;
  }

  const transformers = [
    isPolicyConfiguredForTarget(source?.policy, context.target) ? source?.policy?.transformToolPayload : undefined,
    getToolTransformer(source, context.target, context.phase),
  ].filter(Boolean) as ToolPayloadTransformFunction[];

  if (transformers.length === 0) {
    return context.phase === 'input-delta' ? { suppress: true } : { transformed: safePlaceholder(context) };
  }

  for (const transformer of transformers) {
    try {
      const transformed = await transformer(context);
      if (transformed !== undefined) {
        return { transformed };
      }
    } catch (error) {
      logger?.warn?.('Tool payload transform failed', {
        toolName: context.toolName,
        toolCallId: context.toolCallId,
        target: context.target,
        phase: context.phase,
        error,
      });
      return context.phase === 'input-delta'
        ? { suppress: true, failed: true }
        : { transformed: safePlaceholder(context), failed: true };
    }
  }

  return context.phase === 'input-delta' ? { suppress: true } : { transformed: safePlaceholder(context) };
}

export async function transformToolPayloadForTargets(
  context: Omit<ToolPayloadTransformContext, 'target'>,
  source: ToolPayloadTransformSource | undefined,
  logger?: IMastraLogger,
): Promise<ToolPayloadTransformMetadata | undefined> {
  const display = await transformOneTarget({ ...context, target: 'display' }, source, logger);
  const transcript = await transformOneTarget({ ...context, target: 'transcript' }, source, logger);

  if (!display && !transcript) {
    return undefined;
  }

  return {
    ...(display ? { display: { [context.phase]: display } } : {}),
    ...(transcript ? { transcript: { [context.phase]: transcript } } : {}),
  };
}

export function getTransformedToolPayload(
  metadata: unknown,
  target: ToolPayloadTransformTarget,
  phase: ToolPayloadTransformPhase,
): TransformedToolPayloadState | undefined {
  const mastraMetadata = (metadata as { mastra?: Record<string, any> } | undefined)?.mastra;
  const state =
    mastraMetadata?.toolPayloadTransform?.[target]?.[phase] ?? mastraMetadata?.toolPayloadProjection?.[target]?.[phase];

  if (
    state &&
    Object.prototype.hasOwnProperty.call(state, 'projected') &&
    !Object.prototype.hasOwnProperty.call(state, 'transformed')
  ) {
    const { projected, ...rest } = state;
    return { ...rest, transformed: projected };
  }

  return state;
}

export function hasTransformedToolPayload(
  transform: TransformedToolPayloadState | undefined,
): transform is TransformedToolPayloadState & { transformed: unknown } {
  return Boolean(transform && Object.prototype.hasOwnProperty.call(transform, 'transformed'));
}

function mergeTransformMetadata(
  existing: ToolPayloadTransformMetadata | undefined,
  next: ToolPayloadTransformMetadata | undefined,
): ToolPayloadTransformMetadata | undefined {
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

export function withToolPayloadTransformProviderMetadata<T extends Record<string, any> | undefined>(
  providerMetadata: T,
  transformMetadata: { mastra?: { toolPayloadTransform?: ToolPayloadTransformMetadata } } | undefined,
): T | Record<string, any> | undefined {
  const transform = transformMetadata?.mastra?.toolPayloadTransform;
  if (!transform) {
    return providerMetadata;
  }

  return {
    ...(providerMetadata ?? {}),
    mastra: {
      ...(providerMetadata?.mastra ?? {}),
      toolPayloadTransform: mergeTransformMetadata(providerMetadata?.mastra?.toolPayloadTransform, transform),
    },
  };
}

export function withToolPayloadTransformMetadata<T extends { metadata?: Record<string, any> }>(
  chunk: T,
  transform: ToolPayloadTransformMetadata | undefined,
): T {
  if (!transform) {
    return chunk;
  }

  return {
    ...chunk,
    metadata: {
      ...(chunk.metadata ?? {}),
      mastra: {
        ...(chunk.metadata?.mastra ?? {}),
        toolPayloadTransform: mergeTransformMetadata(chunk.metadata?.mastra?.toolPayloadTransform, transform),
      },
    },
  };
}

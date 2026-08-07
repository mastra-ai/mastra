import type { IMastraLogger } from '../../../logger';
import { transformToolPayloadForTargets, withToolPayloadTransformMetadata } from '../../../tools/payload-transform';
import type { CoreTool, ToolPayloadTransformPolicy } from '../../../tools/types';

/**
 * Apply the in-process tool payload transform policy to a chunk before the
 * durable layer publishes it. Mirrors `addToolPayloadTransformToChunk` in the
 * non-durable agentic-execution layer, restricted to the chunk types that the
 * durable loop emits (`tool-call`, `tool-result`, `tool-error`).
 *
 * The transform policy is only available for in-process durable runs (it
 * carries a closure that cannot be serialized into the workflow input). When
 * the policy is missing or the chunk is not tool-shaped, the chunk is
 * returned unchanged.
 */
export async function applyToolPayloadTransformToChunk<TChunk extends { type: string; payload?: any }>(
  chunk: TChunk,
  opts: {
    policy?: ToolPayloadTransformPolicy;
    tools?: Record<string, CoreTool>;
    logger?: IMastraLogger;
  },
): Promise<TChunk> {
  const { policy, tools, logger } = opts;
  if (!policy && !tools) {
    return chunk;
  }

  const payload = chunk.payload;
  if (!payload || typeof payload !== 'object') {
    return chunk;
  }

  const toolName = (payload as { toolName?: unknown }).toolName;
  const toolCallId = (payload as { toolCallId?: unknown }).toolCallId;
  if (typeof toolName !== 'string' || typeof toolCallId !== 'string') {
    return chunk;
  }

  const tool = tools?.[toolName];
  const source = {
    policy,
    toolTransform: (tool as { transform?: unknown } | undefined)?.transform as any,
  };

  let transformedChunk: TChunk = chunk;
  let transform;

  if (chunk.type === 'tool-call') {
    transform = await transformToolPayloadForTargets(
      {
        phase: 'input-available',
        toolName,
        toolCallId,
        input: (payload as { args?: unknown }).args,
        providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
      },
      source,
      logger,
    );
  } else if (chunk.type === 'tool-result') {
    transformedChunk = withToolPayloadTransformMetadata(
      transformedChunk as any,
      await transformToolPayloadForTargets(
        {
          phase: 'input-available',
          toolName,
          toolCallId,
          input: (payload as { args?: unknown }).args,
          providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
        },
        source,
        logger,
      ),
    ) as TChunk;
    transform = await transformToolPayloadForTargets(
      {
        phase: 'output-available',
        toolName,
        toolCallId,
        input: (payload as { args?: unknown }).args,
        output: (payload as { result?: unknown }).result,
        providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
      },
      source,
      logger,
    );
  } else if (chunk.type === 'tool-error') {
    transformedChunk = withToolPayloadTransformMetadata(
      transformedChunk as any,
      await transformToolPayloadForTargets(
        {
          phase: 'input-available',
          toolName,
          toolCallId,
          input: (payload as { args?: unknown }).args,
          providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
        },
        source,
        logger,
      ),
    ) as TChunk;
    transform = await transformToolPayloadForTargets(
      {
        phase: 'error',
        toolName,
        toolCallId,
        input: (payload as { args?: unknown }).args,
        error: (payload as { error?: unknown }).error,
        providerMetadata: (payload as { providerMetadata?: Record<string, unknown> }).providerMetadata,
      },
      source,
      logger,
    );
  } else {
    return chunk;
  }

  return withToolPayloadTransformMetadata(transformedChunk as any, transform) as TChunk;
}

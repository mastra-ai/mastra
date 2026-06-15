import { EntityType, SpanType } from '../observability';
import type { ObservabilityContext } from '../observability';

/**
 * Normalize `type: 'media'` content parts to `type: 'image-data'` or
 * `type: 'file-data'` as AI SDK providers expect. AI SDK does this
 * internally in `mapToolResultOutput`, but Mastra calls toModelOutput
 * directly and stores the result, bypassing that normalization.
 */
export function normalizeModelOutput(output: unknown): unknown {
  if (output == null || typeof output !== 'object') return output;

  const obj = output as Record<string, unknown>;
  if (obj.type !== 'content' || !Array.isArray(obj.value)) return output;

  return {
    ...obj,
    value: (obj.value as unknown[]).map(item => {
      if (item == null || typeof item !== 'object') return item;
      const part = item as Record<string, unknown>;
      if (part.type !== 'media') return part;
      if (typeof part.mediaType === 'string' && part.mediaType.startsWith('image/')) {
        return { type: 'image-data', data: part.data, mediaType: part.mediaType };
      }
      return { type: 'file-data', data: part.data, mediaType: part.mediaType };
    }),
  };
}

/**
 * Compute the model-ready output for a tool call by invoking
 * `tool.toModelOutput(result)` and normalizing the result.
 *
 * Used by both the server tool path (llm-mapping-step) and the client
 * tool continuation path (#applyToModelOutputToMessages in agent.ts)
 * so that both apply the same transform + normalize pipeline.
 *
 * Returns `undefined` when the tool has no `toModelOutput` or the
 * result is null/undefined.
 */
export async function computeToolModelOutput(params: {
  tool?: { toModelOutput?: (output: unknown) => unknown };
  result: unknown;
  toolName: string;
  toolCallId?: string;
  observabilityContext?: ObservabilityContext;
}): Promise<unknown | undefined> {
  const { tool, result, toolName, toolCallId, observabilityContext } = params;

  if (!tool?.toModelOutput || result == null) {
    return undefined;
  }

  const parentSpan = observabilityContext?.tracingContext?.currentSpan;
  const mappingSpan = parentSpan?.createChildSpan({
    type: SpanType.MAPPING,
    name: `tool output mapping: '${toolName}'`,
    entityType: EntityType.TOOL,
    entityId: toolName,
    entityName: toolName,
    input: result,
    attributes: {
      mappingType: 'toModelOutput',
      toolCallId,
    },
  });

  try {
    let modelOutput = await tool.toModelOutput(result);
    modelOutput = normalizeModelOutput(modelOutput);
    mappingSpan?.end({ output: modelOutput });
    return modelOutput;
  } catch (err) {
    mappingSpan?.error({ error: err as Error, endSpan: true });
    throw err;
  }
}

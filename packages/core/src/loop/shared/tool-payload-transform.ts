import type { IMastraLogger } from '../../logger';
import { transformToolPayloadForTargets, withToolPayloadTransformMetadata } from '../../tools/payload-transform';
import { findProviderToolByName } from '../../tools/provider-tool-utils';
import type { ToolPayloadTransformPolicy } from '../../tools/types';

type ToolsRecord = Record<string, unknown>;

/**
 * Chunk-type → transform phase mapping. A chunk type absent from this map is
 * returned unchanged (the transform pipeline only applies to tool-shaped chunks).
 */
const CHUNK_TYPE_PHASE: Record<string, 'input-available' | 'output-available' | 'error' | 'approval' | 'suspend'> = {
  'tool-call': 'input-available',
  'tool-result': 'output-available',
  'tool-error': 'error',
  'tool-output-denied': 'approval',
  'tool-call-approval': 'approval',
  'tool-call-suspended': 'suspend',
};

export interface ApplyToolPayloadTransformOptions {
  /** Run-level transform policy (in-process only — it carries a closure that cannot serialize). */
  policy?: ToolPayloadTransformPolicy;
  /** Pre-resolved tool-level transform. Takes precedence over lookup via `tools`. */
  toolTransform?: unknown;
  /**
   * Tool source(s) searched in order for the tool-level transform. Each source is
   * searched with the full resolution ladder (direct name → provider-tool name →
   * `id` property); the first source that yields the tool ends the search.
   */
  tools?: ToolsRecord | Array<ToolsRecord | undefined>;
  logger?: IMastraLogger;
  /**
   * Overrides for the *transform input* (what the transform function sees),
   * independent of the emitted chunk payload. Key presence wins over the payload
   * value — e.g. llm-mapping merges `mastra.modelOutput` into the emitted
   * payload's providerMetadata but transforms against the original tool-call
   * providerMetadata.
   */
  transformInput?: { args?: unknown; providerMetadata?: Record<string, unknown> };
}

function resolveToolTransform(
  tools: ToolsRecord | Array<ToolsRecord | undefined> | undefined,
  toolName: string,
): unknown {
  const sources = Array.isArray(tools) ? tools : [tools];
  for (const source of sources) {
    if (!source) continue;
    const tool =
      source[toolName] ||
      findProviderToolByName(source as any, toolName) ||
      Object.values(source).find((t: any) => t && typeof t === 'object' && 'id' in t && t.id === toolName);
    if (tool) {
      return (tool as { transform?: unknown }).transform;
    }
  }
  return undefined;
}

/**
 * Apply the tool payload transform policy (run-level and/or tool-level) to a
 * tool-shaped chunk before it is emitted. Shared by the main loop's
 * tool-call/llm-mapping steps and the durable loop's tool-call/llm-execution
 * steps — the phase is derived from the chunk type, and every phase pairs with
 * an `input-available` transform so display targets always see redacted args.
 *
 * When no transform is configured, or the chunk is not tool-shaped, the chunk
 * is returned unchanged.
 */
export async function applyToolPayloadTransformToChunk<
  TChunk extends { type: string; payload?: any; metadata?: Record<string, any> },
>(chunk: TChunk, opts: ApplyToolPayloadTransformOptions): Promise<TChunk> {
  const { policy, logger, transformInput } = opts;

  const phase = CHUNK_TYPE_PHASE[chunk.type];
  if (!phase) {
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

  const toolTransform = opts.toolTransform ?? resolveToolTransform(opts.tools, toolName);
  if (!policy && !toolTransform) {
    return chunk;
  }

  const source = { policy, toolTransform: toolTransform as any };
  const input = transformInput && 'args' in transformInput ? transformInput.args : (payload as any).args;
  const providerMetadata =
    transformInput && 'providerMetadata' in transformInput
      ? transformInput.providerMetadata
      : ((payload as any).providerMetadata as Record<string, unknown> | undefined);

  const inputTransform = await transformToolPayloadForTargets(
    {
      phase: 'input-available',
      toolName,
      toolCallId,
      input,
      providerMetadata,
    },
    source,
    logger,
  );
  const phaseTransform =
    phase === 'input-available'
      ? undefined
      : await transformToolPayloadForTargets(
          {
            phase,
            toolName,
            toolCallId,
            input,
            ...(phase === 'output-available' ? { output: (payload as any).result } : {}),
            ...(phase === 'error' ? { error: (payload as any).error } : {}),
            ...(phase === 'suspend' ? { suspendPayload: (payload as any).suspendPayload } : {}),
            providerMetadata,
          },
          source,
          logger,
        );

  return withToolPayloadTransformMetadata(
    withToolPayloadTransformMetadata(chunk as any, inputTransform),
    phaseTransform,
  ) as TChunk;
}

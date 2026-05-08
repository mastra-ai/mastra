import type { ChunkType } from '@mastra/core/stream';

/**
 * Redacts request data from a v2 format payload.
 * Removes `metadata.request` and `output.steps[].request` from the payload.
 */
function redactV2Payload(payload: Record<string, unknown>): Record<string, unknown> {
  const redactedPayload = { ...payload };

  // Remove metadata.request
  if (redactedPayload.metadata && typeof redactedPayload.metadata === 'object') {
    const { request, ...metadataRest } = redactedPayload.metadata as Record<string, unknown>;
    redactedPayload.metadata = metadataRest;
  }

  // Remove request from output.steps[]
  if (redactedPayload.output && typeof redactedPayload.output === 'object') {
    const output = { ...(redactedPayload.output as Record<string, unknown>) };
    if (Array.isArray(output.steps)) {
      output.steps = output.steps.map((step: Record<string, unknown>) => {
        if (step && typeof step === 'object') {
          const { request, ...stepRest } = step;
          return stepRest;
        }
        return step;
      });
    }
    redactedPayload.output = output;
  }

  return redactedPayload;
}

/**
 * Redacts sensitive data from stream chunks before they are sent to clients.
 *
 * This function strips out request bodies that may contain sensitive information
 * such as system prompts, tool definitions, API keys, and other configuration data.
 *
 * Handles both v1 (legacy) and v2 stream formats:
 *
 * v1 format (fields at root level):
 * - `step-start.request` - Contains the full LLM request body
 * - `step-finish.request` - Contains the request body
 * - `finish.request` - Contains the request body (if present)
 *
 * v2 format (fields nested in payload):
 * - `step-start.payload.request` - Contains the full LLM request body
 * - `step-finish.payload.metadata.request` - Contains the request metadata
 * - `step-finish.payload.output.steps[].request` - Contains request data for each step
 * - `finish.payload.metadata.request` - Contains the request metadata
 * - `finish.payload.output.steps[].request` - Contains request data for each step
 *
 * @param chunk - The stream chunk to redact
 * @returns A new chunk with sensitive data removed, or the original chunk if no redaction needed
 */
export function redactStreamChunk<OUTPUT = undefined>(chunk: ChunkType<OUTPUT>): ChunkType<OUTPUT> {
  if (!chunk || typeof chunk !== 'object') {
    return chunk;
  }

  const typedChunk = chunk as Record<string, unknown>;

  switch (chunk.type) {
    case 'step-start': {
      // Check if this is v2 format (has payload) or v1 format (request at root)
      if ('payload' in typedChunk && typedChunk.payload && typeof typedChunk.payload === 'object') {
        // v2 format: Remove request from payload
        const { payload, ...rest } = typedChunk;
        const { request, ...payloadRest } = payload as Record<string, unknown>;
        return {
          ...rest,
          type: 'step-start',
          payload: {
            ...payloadRest,
            // Keep an empty request object to maintain structure but remove body
            request: {},
          },
        } as ChunkType<OUTPUT>;
      } else if ('request' in typedChunk) {
        // v1 format: Remove request at root level
        const { request, ...rest } = typedChunk;
        return {
          ...rest,
          type: 'step-start',
          // Keep an empty request object to maintain structure
          request: {},
        } as unknown as ChunkType<OUTPUT>;
      }
      return chunk;
    }

    case 'step-finish': {
      // Check if this is v2 format (has payload) or v1 format (request at root)
      if ('payload' in typedChunk && typedChunk.payload && typeof typedChunk.payload === 'object') {
        // v2 format: Remove request from metadata and output.steps[].request
        const { payload, ...rest } = typedChunk;
        return {
          ...rest,
          type: 'step-finish',
          payload: redactV2Payload(payload as Record<string, unknown>),
        } as ChunkType<OUTPUT>;
      } else if ('request' in typedChunk) {
        // v1 format: Remove request at root level
        const { request, ...rest } = typedChunk;
        return {
          ...rest,
          type: 'step-finish',
        } as unknown as ChunkType<OUTPUT>;
      }
      return chunk;
    }

    case 'finish': {
      // Check if this is v2 format (has payload) or v1 format (request at root)
      if ('payload' in typedChunk && typedChunk.payload && typeof typedChunk.payload === 'object') {
        // v2 format: Remove request from metadata and output.steps[].request
        const { payload, ...rest } = typedChunk;
        return {
          ...rest,
          type: 'finish',
          payload: redactV2Payload(payload as Record<string, unknown>),
        } as ChunkType<OUTPUT>;
      } else if ('request' in typedChunk) {
        // v1 format: Remove request at root level
        const { request, ...rest } = typedChunk;
        return {
          ...rest,
          type: 'finish',
        } as unknown as ChunkType<OUTPUT>;
      }
      return chunk;
    }

    default:
      // Other chunk types don't contain sensitive request data
      return chunk;
  }
}

import type { Tool } from '@mastra/core/tools';

/**
 * Normalize modelOutput from toModelOutput() to the AI SDK V2 tool result
 * content shape. Mirrors `normalizeModelOutput` in @mastra/core's
 * llm-mapping-step, which performs the same normalization for server tools.
 */
function normalizeModelOutput(output: unknown): unknown {
  if (output == null || typeof output !== 'object') return output;

  const obj = output as Record<string, unknown>;
  if (obj.type !== 'content' || !Array.isArray(obj.value)) return output;

  return {
    ...obj,
    value: (obj.value as unknown[]).map(item => {
      if (item == null || typeof item !== 'object') return item;
      const part = item as Record<string, unknown>;
      if (part.type === 'image-url' && typeof part.url === 'string') {
        const semicolonIndex = part.url.indexOf(';');
        const commaIndex = part.url.indexOf(',');
        const mediaTypeEnd =
          semicolonIndex === -1
            ? commaIndex
            : commaIndex === -1
              ? semicolonIndex
              : Math.min(semicolonIndex, commaIndex);
        const mediaType =
          typeof part.mediaType === 'string' && part.mediaType
            ? part.mediaType
            : part.url.startsWith('data:')
              ? part.url.slice(5, mediaTypeEnd === -1 ? undefined : mediaTypeEnd) || 'image/jpeg'
              : 'image/jpeg';
        return { type: 'media', data: part.url, mediaType };
      }
      if (part.type === 'image-data' && typeof part.data === 'string') {
        return { type: 'media', data: part.data, mediaType: part.mediaType ?? 'image/jpeg' };
      }
      if (part.type === 'file-data' && typeof part.data === 'string') {
        return { type: 'media', data: part.data, mediaType: part.mediaType ?? 'application/octet-stream' };
      }
      return part;
    }),
  };
}

type ModelFacingValidationError = { error: true; message: string; validationErrors?: unknown };

// Set by @mastra/core's tool validation on the errors it creates; see
// `getModelFacingValidationError` there. Read by symbol so this browser module
// does not import the core tools entry point (tool builder, code mode, stdio
// transports) for one check.
const MODEL_FACING_VALIDATION_ERROR = Symbol.for('mastra.tool.modelFacingValidationError');

/**
 * The model-facing form of a validation error that the tool's own `createTool`
 * validation produced in this process, or `undefined` for any other value,
 * including a result that only has a validation error's fields.
 */
function getModelFacingValidationError(value: unknown): ModelFacingValidationError | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const marked: unknown = Object.getOwnPropertyDescriptor(value, MODEL_FACING_VALIDATION_ERROR)?.value;
  if (
    marked !== null &&
    typeof marked === 'object' &&
    'error' in marked &&
    marked.error === true &&
    'message' in marked &&
    typeof marked.message === 'string'
  ) {
    return { ...marked, error: true, message: marked.message };
  }
  return undefined;
}

/**
 * Apply a client tool's `toModelOutput` mapping to its execution result.
 *
 * Client tools execute locally, so their `toModelOutput` mapping must also run
 * locally — the function cannot be serialized over HTTP. The transformed value
 * is sent back to the server as `providerOptions.mastra.modelOutput` on the
 * tool-result part, which the server already applies when building the next
 * model prompt. The raw result stays in the tool-result `output`/`result`
 * field for storage and application logic, matching server-tool semantics.
 *
 * A validation error the tool's own validation produced (input, request
 * context or output) is not the tool's output, so the mapping is skipped and
 * the error's model-facing form, without the raw values the full error quotes,
 * is returned as an `error-json` output, matching server tools. A result that
 * only has a validation error's fields is mapped like any other result.
 *
 * Returns `undefined` when the tool defines no mapping, the result is null,
 * or the mapping itself returns null/undefined.
 */
export async function getClientToolModelOutput(clientTool: Tool, result: unknown): Promise<unknown> {
  const toModelOutput = (clientTool as { toModelOutput?: (output: unknown) => unknown }).toModelOutput;
  if (typeof toModelOutput !== 'function' || result == null) return undefined;
  const validationError = getModelFacingValidationError(result);
  if (validationError) return { type: 'error-json', value: validationError };

  const modelOutput = await toModelOutput(result);
  return modelOutput == null ? undefined : normalizeModelOutput(modelOutput);
}

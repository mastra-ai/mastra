import { TransformStream } from 'stream/web';
import { asSchema, isDeepEqualData, parsePartialJson } from 'ai-v5';
import type { ObjectOptions } from '../../loop/types';
import { safeValidateTypes } from '../aisdk/v5/compat';
import { getTransformedSchema, getResponseFormat } from './schema';

interface ProcessPartialChunkParams {
  /** Text accumulated from streaming so far */
  accumulatedText: string;
  /** Previously parsed object from last emission */
  previousObject: any;
  /** Previous processing result (handler-specific state) */
  previousResult?: any;
}

interface ProcessPartialChunkResult {
  /** Whether a new value should be emitted */
  shouldEmit: boolean;
  /** The value to emit if shouldEmit is true */
  emitValue?: any;
  /** New previous result state for next iteration */
  newPreviousResult?: any;
}

interface ValidateAndTransformFinalResult {
  /** Whether validation succeeded */
  success: boolean;
  /** The validated and transformed value if successful */
  value?: any;
  /** Error if validation failed */
  error?: Error;
}

/**
 * Strategy interface for handling different output formats during streaming.
 * Each handler implements format-specific logic for processing partial chunks
 * and validating final results.
 */
interface OutputFormatHandler {
  /** The type of output format this handler manages */
  readonly type: 'object' | 'array' | 'enum';

  /**
   * Processes a partial chunk of accumulated text and determines if a new value should be emitted.
   * @param params - Processing parameters
   * @param params.accumulatedText - Text accumulated from streaming so far
   * @param params.previousObject - Previously parsed object from last emission
   * @param params.previousResult - Previous processing result (handler-specific state)
   * @returns Promise resolving to processing result with emission decision
   */
  processPartialChunk(params: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult>;

  /**
   * Validates and transforms the final parsed value when streaming completes.
   * @param finalValue - The final parsed value to validate
   * @returns Promise resolving to validation result
   */
  validateAndTransformFinal(finalValue: any): Promise<ValidateAndTransformFinalResult>;
}

/**
 * Handles object format streaming. Emits parsed objects when they change during streaming.
 * This is the simplest format - objects are parsed and emitted directly without wrapping.
 */
class ObjectFormatHandler implements OutputFormatHandler {
  readonly type = 'object' as const;

  /**
   * Creates an object format handler.
   * @param schema - The original user-provided schema for validation
   */
  constructor(schema?: Parameters<typeof asSchema>[0]) {
    this.schema = schema ? asSchema(schema) : undefined;
  }

  private schema?: ReturnType<typeof asSchema>;

  async processPartialChunk({
    accumulatedText,
    previousObject,
  }: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult> {
    const { value: currentObjectJson } = await parsePartialJson(accumulatedText);

    if (
      currentObjectJson !== undefined &&
      typeof currentObjectJson === 'object' &&
      !isDeepEqualData(previousObject, currentObjectJson)
    ) {
      return {
        shouldEmit: true,
        emitValue: currentObjectJson,
        newPreviousResult: currentObjectJson,
      };
    }

    return { shouldEmit: false };
  }

  async validateAndTransformFinal(finalValue: any): Promise<ValidateAndTransformFinalResult> {
    if (!finalValue) {
      return {
        success: false,
        error: new Error('No object generated: could not parse the response.'),
      };
    }

    if (!this.schema) {
      return {
        success: true,
        value: finalValue,
      };
    }

    try {
      const result = await safeValidateTypes({ value: finalValue, schema: this.schema });

      if (result.success) {
        return {
          success: true,
          value: result.value,
        };
      } else {
        return {
          success: false,
          error: result.error ?? new Error('Validation failed'),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Validation failed'),
      };
    }
  }
}

/**
 * Handles array format streaming. Arrays are wrapped in {elements: [...]} objects by the LLM
 * for better generation reliability. This handler unwraps them and filters incomplete elements.
 * Emits progressive array states as elements are completed.
 */
class ArrayFormatHandler implements OutputFormatHandler {
  readonly type = 'array' as const;
  /** Previously filtered array to track changes */
  private textPreviousFilteredArray: any[] = [];
  /** Whether we've emitted the initial empty array */
  private hasEmittedInitialArray = false;

  /**
   * Creates an array format handler.
   * @param schema - The original user-provided schema for validation
   */
  constructor(schema?: Parameters<typeof asSchema>[0]) {
    this.schema = schema ? asSchema(schema) : undefined;
  }

  private schema?: ReturnType<typeof asSchema>;

  async processPartialChunk({
    accumulatedText,
    previousObject,
  }: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult> {
    const { value: currentObjectJson, state: parseState } = await parsePartialJson(accumulatedText);

    if (currentObjectJson !== undefined && !isDeepEqualData(previousObject, currentObjectJson)) {
      // For arrays, extract and filter elements
      const rawElements = (currentObjectJson as any)?.elements || [];
      const filteredElements: any[] = [];

      // Filter out incomplete elements (like empty objects {})
      for (let i = 0; i < rawElements.length; i++) {
        const element = rawElements[i];

        // Skip the last element if it's incomplete (unless this is the final parse)
        if (i === rawElements.length - 1 && parseState !== 'successful-parse') {
          // Only include the last element if it has meaningful content
          if (element && typeof element === 'object' && Object.keys(element).length > 0) {
            filteredElements.push(element);
          }
        } else {
          // Include all non-last elements that have content
          if (element && typeof element === 'object' && Object.keys(element).length > 0) {
            filteredElements.push(element);
          }
        }
      }

      // Emit initial empty array if this is the first time we see any JSON structure
      if (!this.hasEmittedInitialArray) {
        this.hasEmittedInitialArray = true;
        if (filteredElements.length === 0) {
          this.textPreviousFilteredArray = [];
          return {
            shouldEmit: true,
            emitValue: [],
            newPreviousResult: currentObjectJson,
          };
        }
      }

      // Only emit if the filtered array has actually changed
      if (!isDeepEqualData(this.textPreviousFilteredArray, filteredElements)) {
        this.textPreviousFilteredArray = [...filteredElements];
        return {
          shouldEmit: true,
          emitValue: filteredElements,
          newPreviousResult: currentObjectJson,
        };
      }
    }

    return { shouldEmit: false };
  }

  async validateAndTransformFinal(_finalValue: any): Promise<ValidateAndTransformFinalResult> {
    const resultValue = this.textPreviousFilteredArray;

    if (!resultValue) {
      return {
        success: false,
        error: new Error('No object generated: could not parse the response.'),
      };
    }

    if (!this.schema) {
      return {
        success: true,
        value: resultValue,
      };
    }

    try {
      const result = await safeValidateTypes({ value: resultValue, schema: this.schema });

      if (result.success) {
        return {
          success: true,
          value: result.value,
        };
      } else {
        return {
          success: false,
          error: result.error ?? new Error('Validation failed'),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Validation failed'),
      };
    }
  }
}

/**
 * Handles enum format streaming. Enums are wrapped in {result: "value"} objects by the LLM
 * for better generation reliability. This handler unwraps them and provides partial matching
 * during streaming to emit the best possible enum value as it's being generated.
 */
class EnumFormatHandler implements OutputFormatHandler {
  readonly type = 'enum' as const;
  /** Previously emitted enum result to avoid duplicate emissions */
  private textPreviousEnumResult?: string;

  /**
   * Creates an enum format handler.
   * @param schema - The original schema containing enum values for partial matching
   */
  constructor(schema?: Parameters<typeof asSchema>[0]) {
    this.schema = schema ? asSchema(schema) : undefined;
  }

  private schema?: ReturnType<typeof asSchema>;

  async processPartialChunk({
    accumulatedText,
    previousObject,
  }: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult> {
    const { value: currentObjectJson } = await parsePartialJson(accumulatedText);

    if (
      currentObjectJson !== undefined &&
      currentObjectJson !== null &&
      typeof currentObjectJson === 'object' &&
      !Array.isArray(currentObjectJson) &&
      'result' in currentObjectJson &&
      typeof currentObjectJson.result === 'string' &&
      !isDeepEqualData(previousObject, currentObjectJson)
    ) {
      const partialResult = currentObjectJson.result as string;
      const bestMatch = this.findBestEnumMatch(partialResult);

      // Only emit if we have valid partial matches and the result isn't empty
      if (partialResult.length > 0 && bestMatch && bestMatch !== this.textPreviousEnumResult) {
        this.textPreviousEnumResult = bestMatch;
        return {
          shouldEmit: true,
          emitValue: bestMatch,
          newPreviousResult: currentObjectJson,
        };
      }
    }

    return { shouldEmit: false };
  }

  /**
   * Finds the best matching enum value for a partial result string.
   * If multiple values match, returns the partial string. If only one matches, returns that value.
   * @param partialResult - Partial enum string from streaming
   * @returns Best matching enum value or undefined if no matches
   */
  private findBestEnumMatch(partialResult: string): string | undefined {
    if (!this.schema?.jsonSchema?.enum) {
      return undefined;
    }

    const enumValues = this.schema.jsonSchema.enum;
    const possibleEnumValues = enumValues
      .filter((value: unknown): value is string => typeof value === 'string')
      .filter((enumValue: string) => enumValue.startsWith(partialResult));

    if (possibleEnumValues.length === 0) {
      return undefined;
    }

    // Emit the most specific result - if there's exactly one match, use it; otherwise use partial
    const firstMatch = possibleEnumValues[0];
    return possibleEnumValues.length === 1 && firstMatch !== undefined ? firstMatch : partialResult;
  }

  async validateAndTransformFinal(finalValue: any): Promise<ValidateAndTransformFinalResult> {
    // For enums, check the wrapped format and unwrap
    if (!finalValue || typeof finalValue !== 'object' || typeof finalValue.result !== 'string') {
      return {
        success: false,
        error: new Error('Invalid enum format: expected object with result property'),
      };
    }

    if (!this.schema) {
      return {
        success: true,
        value: finalValue.result,
      };
    }

    try {
      // Validate the unwrapped enum value against original schema
      const result = await safeValidateTypes({ value: finalValue.result, schema: this.schema });

      if (result.success) {
        // Return the unwrapped enum value, not the wrapped object
        return {
          success: true,
          value: result.value,
        };
      } else {
        return {
          success: false,
          error: result.error ?? new Error('Enum validation failed'),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Validation failed'),
      };
    }
  }
}

/**
 * Factory function to create the appropriate output format handler based on schema.
 * Analyzes the transformed schema format and returns the corresponding handler instance.
 * @param schema - Original user-provided schema (e.g., Zod schema from agent.stream({output: z.object({})}))
 * @param transformedSchema - Wrapped/transformed schema used for LLM generation (arrays wrapped in {elements: []}, enums in {result: ""})
 * @returns Handler instance for the detected format type
 */
function createOutputHandler({
  schema,
  transformedSchema,
}: {
  schema?: Parameters<typeof asSchema>[0];
  transformedSchema: ReturnType<typeof getTransformedSchema>;
}): OutputFormatHandler {
  switch (transformedSchema?.outputFormat) {
    case 'array':
      return new ArrayFormatHandler(schema);
    case 'enum':
      return new EnumFormatHandler(schema);
    case 'object':
    default:
      return new ObjectFormatHandler(schema);
  }
}
/**
 * Transforms raw text-delta chunks into structured object chunks for JSON mode streaming.
 *
 * For JSON response formats, this transformer:
 * - Accumulates text deltas and parses them as partial JSON
 * - Emits 'object' chunks when the parsed structure changes
 * - For arrays: filters incomplete elements and unwraps from {elements: [...]} wrapper
 * - For objects: emits the parsed object directly
 * - For enums: unwraps from {result: ""} wrapper and provides partial matching
 * - Always passes through original chunks for downstream processing
 */
export function createObjectStreamTransformer({
  schema,
  onFinish,
}: {
  schema?: Parameters<typeof asSchema>[0];
  /**
   * Callback to be called when the stream finishes.
   * @param data The final parsed object / array
   */
  onFinish: (data: any) => void;
}) {
  const responseFormat = getResponseFormat(schema);
  const transformedSchema = getTransformedSchema(schema);
  const handler = createOutputHandler({ transformedSchema, schema });

  let accumulatedText = '';
  let previousObject: any = undefined;

  return new TransformStream({
    async transform(chunk, controller) {
      if (responseFormat?.type !== 'json') {
        // Not JSON mode - pass through original chunks and exit
        controller.enqueue(chunk);
        return;
      }

      if (chunk.type === 'text-delta' && typeof chunk.payload?.text === 'string') {
        accumulatedText += chunk.payload.text;

        const result = await handler.processPartialChunk({
          accumulatedText,
          previousObject,
        });

        if (result.shouldEmit) {
          previousObject = result.newPreviousResult ?? previousObject;
          controller.enqueue({
            type: 'object',
            object: result.emitValue,
          });
        }
      }

      // Always pass through the original chunk for downstream processing
      controller.enqueue(chunk);
    },

    async flush(controller) {
      if (responseFormat?.type !== 'json') {
        // Not JSON mode, no final validation needed - exit
        return;
      }

      const finalResult = await handler.validateAndTransformFinal(previousObject);

      if (!finalResult.success) {
        controller.enqueue({
          type: 'error',
          payload: { error: finalResult.error ?? new Error('Validation failed') },
        });
        return;
      }

      onFinish(finalResult.value);
    },
  });
}

/**
 * Transforms object chunks into JSON text chunks for streaming.
 *
 * This transformer:
 * - For arrays: emits opening bracket, new elements, and closing bracket
 * - For objects/no-schema: emits the object as JSON
 */
export function createJsonTextStreamTransformer(objectOptions: ObjectOptions) {
  let previousArrayLength = 0;
  let hasStartedArray = false;
  let chunkCount = 0;
  const outputSchema = getTransformedSchema(objectOptions?.schema);

  return new TransformStream<any, string>({
    transform(chunk, controller) {
      if (chunk.type !== 'object') {
        return;
      }

      if (outputSchema?.outputFormat === 'array') {
        chunkCount++;

        // If this is the first chunk, decide between complete vs incremental streaming
        if (chunkCount === 1) {
          // If the first chunk already has multiple elements or is complete,
          // emit as single JSON string
          if (chunk.object.length > 0) {
            controller.enqueue(JSON.stringify(chunk.object));
            previousArrayLength = chunk.object.length;
            hasStartedArray = true;
            return;
          }
        }

        // Incremental streaming mode (multiple chunks)
        if (!hasStartedArray) {
          controller.enqueue('[');
          hasStartedArray = true;
        }

        // Emit new elements that were added
        for (let i = previousArrayLength; i < chunk.object.length; i++) {
          const elementJson = JSON.stringify(chunk.object[i]);
          if (i > 0) {
            controller.enqueue(',' + elementJson);
          } else {
            controller.enqueue(elementJson);
          }
        }
        previousArrayLength = chunk.object.length;
      } else {
        // For non-array objects, just emit as JSON
        controller.enqueue(JSON.stringify(chunk.object));
      }
    },
    flush(controller) {
      // Close the array when the stream ends (only for incremental streaming)
      if (hasStartedArray && outputSchema?.outputFormat === 'array' && chunkCount > 1) {
        controller.enqueue(']');
      }
    },
  });
}

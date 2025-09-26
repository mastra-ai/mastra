import { TransformStream } from 'stream/web';
import { asSchema, isDeepEqualData, jsonSchema, parsePartialJson } from 'ai-v5';
import type { JSONSchema7, Schema } from 'ai-v5';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
import { safeValidateTypes } from '../aisdk/v5/compat';
import { ChunkFrom } from '../types';
import type { ChunkType } from '../types';
import { getTransformedSchema, getResponseFormat } from './schema';
import type { InferSchemaOutput, OutputSchema, PartialSchemaOutput, ZodLikePartialSchema } from './schema';

interface ProcessPartialChunkParams {
  /** Text accumulated from streaming so far */
  accumulatedText: string;
  /** Previously parsed object from last emission */
  previousObject: unknown;
  /** Previous processing result (handler-specific state) */
  previousResult?: unknown;
}

interface ProcessPartialChunkResult {
  /** Whether a new value should be emitted */
  shouldEmit: boolean;
  /** The value to emit if shouldEmit is true */
  emitValue?: unknown;
  /** New previous result state for next iteration */
  newPreviousResult?: unknown;
}

type ValidateAndTransformFinalResult<OUTPUT extends OutputSchema = undefined> =
  | {
      /** Whether validation succeeded */
      success: true;
      /**
       * The validated and transformed value if successful
       */
      value: InferSchemaOutput<OUTPUT>;
    }
  | {
      /** Whether validation succeeded */
      success: false;
      /**
       * Error if validation failed
       */
      error: Error;
    };

/**
 * Base class for all output format handlers.
 * Each handler implements format-specific logic for processing partial chunks
 * and validating final results.
 */
abstract class BaseFormatHandler<OUTPUT extends OutputSchema = undefined> {
  abstract readonly type: 'object' | 'array' | 'enum';
  /**
   * The user-provided schema to validate the final result against.
   */
  readonly schema: Schema<InferSchemaOutput<OUTPUT>> | undefined;

  /**
   * Whether to validate partial chunks. @planned
   */
  readonly validatePartialChunks: boolean = false;
  /**
   * Partial schema for validating partial chunks as they are streamed. @planned
   */
  readonly partialSchema?: ZodLikePartialSchema<InferSchemaOutput<OUTPUT>> | undefined;

  constructor(schema?: OUTPUT, options: { validatePartialChunks?: boolean } = {}) {
    if (!schema) {
      this.schema = undefined;
    } else if (
      schema &&
      typeof schema === 'object' &&
      !(schema as z3.ZodType<any> | z4.ZodType<any, any>).safeParse &&
      !(schema as Schema<any>).jsonSchema
    ) {
      this.schema = jsonSchema(schema as JSONSchema7);
    } else {
      this.schema = asSchema(schema as z3.ZodType<any> | z4.ZodType<any, any> | Schema<any>);
    }
    if (options.validatePartialChunks) {
      if (schema !== undefined && 'partial' in schema && typeof schema.partial === 'function') {
        this.validatePartialChunks = true;
        this.partialSchema = schema.partial() as ZodLikePartialSchema<InferSchemaOutput<OUTPUT>>;
      }
    }
  }

  /**
   * Processes a partial chunk of accumulated text and determines if a new value should be emitted.
   * @param params - Processing parameters
   * @param params.accumulatedText - Text accumulated from streaming so far
   * @param params.previousObject - Previously parsed object from last emission
   * @param params.previousResult - Previous processing result (handler-specific state)
   * @returns Promise resolving to processing result with emission decision
   */
  abstract processPartialChunk(params: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult>;

  /**
   * Validates and transforms the final parsed value when streaming completes.
   * @param finalValue - The final parsed value to validate
   * @returns Promise resolving to validation result
   */
  abstract validateAndTransformFinal(finalValue: string): Promise<ValidateAndTransformFinalResult<OUTPUT>>;

  /**
   * Preprocesses accumulated text to handle LLMs that wrap JSON in code blocks.
   * Extracts content from the first complete valid ```json...``` code block or removes opening ```json prefix if no complete code block is found (streaming chunks).
   * @param accumulatedText - Raw accumulated text from streaming
   * @returns Processed text ready for JSON parsing
   */
  protected preprocessText(accumulatedText: string): string {
    let processedText = accumulatedText;

    // Some LLMs wrap the JSON response in code blocks.
    // In that case, first try to extract content from complete code blocks
    if (processedText.includes('```json')) {
      const match = processedText.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
      if (match && match[1]) {
        // Complete code block found - use content between tags
        processedText = match[1].trim();
      } else {
        // No complete code block - just remove the opening ```json
        processedText = processedText.replace(/^```json\s*\n?/, '');
      }
    }

    return processedText;
  }
}

/**
 * Handles object format streaming. Emits parsed objects when they change during streaming.
 * This is the simplest format - objects are parsed and emitted directly without wrapping.
 */
class ObjectFormatHandler<OUTPUT extends OutputSchema = undefined> extends BaseFormatHandler<OUTPUT> {
  readonly type = 'object' as const;

  async processPartialChunk({
    accumulatedText,
    previousObject,
  }: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult> {
    const processedAccumulatedText = this.preprocessText(accumulatedText);
    const { value: currentObjectJson, state } = await parsePartialJson(processedAccumulatedText);

    // TODO: test partial object chunk validation with schema.partial()
    if (this.validatePartialChunks && this.partialSchema) {
      const result = this.partialSchema?.safeParse(currentObjectJson);
      if (result.success && result.data && result.data !== undefined && !isDeepEqualData(previousObject, result.data)) {
        return {
          shouldEmit: true,
          emitValue: result.data,
          newPreviousResult: result.data,
        };
      }
      /**
       * TODO: emit error chunk if partial validation fails?
       * maybe we need to either not emit the object chunk,
       * emit our error chunk, or wait until final parse to emit the error chunk?
       */
      return { shouldEmit: false };
    }

    if (
      currentObjectJson !== undefined &&
      currentObjectJson !== null &&
      typeof currentObjectJson === 'object' &&
      !isDeepEqualData(previousObject, currentObjectJson) // avoid emitting duplicates
    ) {
      return {
        shouldEmit: ['successful-parse', 'repaired-parse'].includes(state),
        emitValue: currentObjectJson,
        newPreviousResult: currentObjectJson,
      };
    }
    return { shouldEmit: false };
  }

  async validateAndTransformFinal(finalRawValue: string): Promise<ValidateAndTransformFinalResult<OUTPUT>> {
    if (!finalRawValue) {
      return {
        success: false,
        error: new Error('No object generated: could not parse the response.'),
      };
    }
    const rawValue = this.preprocessText(finalRawValue);
    const { value } = await parsePartialJson(rawValue);

    if (!this.schema) {
      return {
        success: true,
        value: value as InferSchemaOutput<OUTPUT>,
      };
    }

    try {
      const result = await safeValidateTypes({ value, schema: this.schema });

      if (result.success) {
        return {
          success: true,
          value: result.value,
        };
      } else {
        return {
          success: false,
          error: result.error ?? new Error('Validation failed', { cause: result.error }),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Validation failed', { cause: error }),
      };
    }
  }
}

/**
 * Handles array format streaming. Arrays are wrapped in {elements: [...]} objects by the LLM
 * for better generation reliability. This handler unwraps them and filters incomplete elements.
 * Emits progressive array states as elements are completed.
 */
class ArrayFormatHandler<OUTPUT extends OutputSchema = undefined> extends BaseFormatHandler<OUTPUT> {
  readonly type = 'array' as const;
  /** Previously filtered array to track changes */
  private textPreviousFilteredArray: any[] = [];
  /** Whether we've emitted the initial empty array */
  private hasEmittedInitialArray = false;

  async processPartialChunk({
    accumulatedText,
    previousObject,
  }: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult> {
    const processedAccumulatedText = this.preprocessText(accumulatedText);
    const { value: currentObjectJson, state: parseState } = await parsePartialJson(processedAccumulatedText);
    // TODO: parse/validate partial array elements, emit error chunk if validation fails
    // using this.partialSchema / this.validatePartialChunks
    if (currentObjectJson !== undefined && !isDeepEqualData(previousObject, currentObjectJson)) {
      // For arrays, extract and filter elements
      const rawElements = (currentObjectJson as any)?.elements || [];
      const filteredElements: Partial<InferSchemaOutput<OUTPUT>>[] = [];

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
            emitValue: [] as unknown as Partial<InferSchemaOutput<OUTPUT>>,
            newPreviousResult: currentObjectJson as Partial<InferSchemaOutput<OUTPUT>>,
          };
        }
      }

      // Only emit if the filtered array has actually changed
      if (!isDeepEqualData(this.textPreviousFilteredArray, filteredElements)) {
        this.textPreviousFilteredArray = [...filteredElements];
        return {
          shouldEmit: true,
          emitValue: filteredElements as unknown as Partial<InferSchemaOutput<OUTPUT>>,
          newPreviousResult: currentObjectJson as Partial<InferSchemaOutput<OUTPUT>>,
        };
      }
    }

    return { shouldEmit: false };
  }

  async validateAndTransformFinal(_finalValue: string): Promise<ValidateAndTransformFinalResult<OUTPUT>> {
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
        value: resultValue as InferSchemaOutput<OUTPUT>,
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
          error: result.error ?? new Error('Validation failed', { cause: result.error }),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Validation failed', { cause: error }),
      };
    }
  }
}

/**
 * Handles enum format streaming. Enums are wrapped in {result: ""} objects by the LLM
 * for better generation reliability. This handler unwraps them and provides partial matching.
 * Emits progressive enum states as they are completed.
 * Validates the final result against the user-provided schema.
 */
class EnumFormatHandler<OUTPUT extends OutputSchema = undefined> extends BaseFormatHandler<OUTPUT> {
  readonly type = 'enum' as const;
  /** Previously emitted enum result to avoid duplicate emissions */
  private textPreviousEnumResult?: string;

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

  async processPartialChunk({
    accumulatedText,
    previousObject,
  }: ProcessPartialChunkParams): Promise<ProcessPartialChunkResult> {
    const processedAccumulatedText = this.preprocessText(accumulatedText);
    const { value: currentObjectJson } = await parsePartialJson(processedAccumulatedText);
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

  async validateAndTransformFinal(rawFinalValue: string): Promise<ValidateAndTransformFinalResult<OUTPUT>> {
    const processedValue = this.preprocessText(rawFinalValue);
    const { value } = await parsePartialJson(processedValue);
    if (!(typeof value === 'object' && value !== null && 'result' in value)) {
      return {
        success: false,
        error: new Error('Invalid enum format: expected object with result property'),
      };
    }
    const finalValue = value as { result: InferSchemaOutput<OUTPUT> };

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
function createOutputHandler<OUTPUT extends OutputSchema = undefined>({
  schema,
  transformedSchema,
}: {
  schema?: OUTPUT;
  transformedSchema: ReturnType<typeof getTransformedSchema<OUTPUT>>;
}) {
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
export function createObjectStreamTransformer<OUTPUT extends OutputSchema = undefined>({
  schema,
  onFinish,
}: {
  schema?: OUTPUT;
  /**
   * Callback to be called when the stream finishes.
   * @param data The final parsed object / array
   */
  onFinish: (data: InferSchemaOutput<OUTPUT>) => void;
}) {
  const responseFormat = getResponseFormat(schema);
  const transformedSchema = getTransformedSchema(schema);
  const handler = createOutputHandler({ transformedSchema, schema });

  let accumulatedText = '';
  let previousObject: any = undefined;
  let finishReason: string | undefined;
  let currentRunId: string | undefined;

  return new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
    async transform(chunk, controller) {
      if (chunk.runId) {
        currentRunId = chunk.runId;
      }

      if (chunk.type === 'finish') {
        finishReason = chunk.payload.stepResult.reason;
        controller.enqueue(chunk);
        return;
      }

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
            from: chunk.from,
            runId: chunk.runId,
            type: 'object',
            object: result.emitValue as PartialSchemaOutput<OUTPUT>, // TODO: handle partial runtime type validation of json chunks
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

      if (['tool-calls'].includes(finishReason ?? '')) {
        onFinish(undefined as InferSchemaOutput<OUTPUT>);
        return;
      }

      const finalResult = await handler.validateAndTransformFinal(accumulatedText);

      if (!finalResult.success) {
        controller.enqueue({
          from: ChunkFrom.AGENT,
          runId: currentRunId ?? '',
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
export function createJsonTextStreamTransformer<OUTPUT extends OutputSchema = undefined>(schema?: OUTPUT) {
  let previousArrayLength = 0;
  let hasStartedArray = false;
  let chunkCount = 0;
  const outputSchema = getTransformedSchema(schema);

  return new TransformStream<ChunkType<OUTPUT>, string>({
    transform(chunk, controller) {
      if (chunk.type !== 'object' || !chunk.object) {
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

import { TransformStream } from 'node:stream/web';
import { isDeepEqualData, parsePartialJson } from '@internal/ai-sdk-v5';
import { isZodType } from '@mastra/schema-compat';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
import type { StructuredOutputOptions } from '../../agent/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { IMastraLogger } from '../../logger';
import type { StandardSchemaWithJSON } from '../../schema';
import { isStandardSchemaWithJSON, toStandardSchema, standardSchemaToJSONSchema } from '../../schema';
import type { ValidationResult } from '../aisdk/v5/compat';
import { ChunkFrom } from '../types';
import type { ChunkType } from '../types';
import { getTransformedSchema } from './schema';
import type { ZodLikePartialSchema } from './schema';

/**
 * Escapes unescaped newlines, carriage returns, and tabs within JSON string values.
 *
 * LLMs often output actual newline characters inside JSON strings instead of properly
 * escaped \n sequences, which breaks JSON parsing. This function fixes that by:
 * 1. Tracking whether we're inside a JSON string (after an unescaped quote)
 * 2. Replacing literal newlines/tabs with their escape sequences only inside strings
 * 3. Preserving already-escaped sequences like \\n
 *
 * @param text - Raw JSON text that may contain unescaped control characters in strings
 * @returns JSON text with control characters properly escaped inside string values
 */
export function escapeUnescapedControlCharsInJsonStrings(text: string): string {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Check for escape sequences
    if (char === '\\' && i + 1 < text.length) {
      // This is an escape sequence - pass through both characters
      result += char + text[i + 1];
      i += 2;
      continue;
    }

    // Track string boundaries (unescaped quotes)
    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    // If inside a string, escape control characters
    if (inString) {
      if (char === '\n') {
        result += '\\n';
        i++;
        continue;
      }
      if (char === '\r') {
        result += '\\r';
        i++;
        continue;
      }
      if (char === '\t') {
        result += '\\t';
        i++;
        continue;
      }
    }

    result += char;
    i++;
  }

  return result;
}

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

type ValidateAndTransformFinalResult<OUTPUT = undefined> =
  | {
      /** Whether validation succeeded */
      success: true;
      /**
       * The validated and transformed value if successful
       */
      value: OUTPUT;
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
abstract class BaseFormatHandler<OUTPUT = undefined> {
  abstract readonly type: 'object' | 'array' | 'enum';
  /**
   * The original user-provided schema (Zod, JSON Schema, or AI SDK Schema).
   */
  readonly schema: StandardSchemaWithJSON<OUTPUT> | undefined;
  /**
   * Validate partial chunks as they are streamed. @planned
   */
  readonly validatePartialChunks: boolean = false;
  readonly partialSchema?: ZodLikePartialSchema<OUTPUT> | undefined;

  constructor(schema?: StandardSchemaWithJSON<OUTPUT>, options: { validatePartialChunks?: boolean } = {}) {
    this.schema = schema;

    if (
      options.validatePartialChunks &&
      this.isZodSchema(schema) &&
      'partial' in schema &&
      typeof schema.partial === 'function'
    ) {
      this.partialSchema = schema.partial() as ZodLikePartialSchema<OUTPUT>;
      this.validatePartialChunks = true;
    }
  }

  /**
   * Checks if the original schema is a Zod schema with safeParse method.
   */
  protected isZodSchema(schema: unknown): schema is z3.ZodType<any, z3.ZodTypeDef, any> | z4.ZodType<any, any> {
    return isZodType(schema);
  }

  /**
   * Validates a value against the schema using StandardSchemaWithJSON's validate method.
   */
  protected async validateValue(value: unknown): Promise<ValidationResult<OUTPUT>> {
    if (!this.schema) {
      return {
        success: true,
        value: value as OUTPUT,
      };
    }

    if (this.isZodSchema(this.schema)) {
      // Use Standard Schema for consistent error message format + safeParse for ZodError cause
      try {
        const ssResult = await this.schema['~standard'].validate(value);

        if (!ssResult.issues) {
          return {
            success: true,
            value: ssResult.value as OUTPUT,
          };
        }

        // Format error message from Standard Schema issues
        const errorMessages = ssResult.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

        // Also use safeParse to get ZodError as cause (for backward compatibility with tests)
        const zodResult = this.schema.safeParse(value);
        const zodError = !zodResult.success ? zodResult.error : undefined;

        return {
          success: false,
          error: new MastraError(
            {
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.SYSTEM,
              id: 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED',
              text: `Structured output validation failed: ${errorMessages}`,
              details: {
                value: typeof value === 'object' ? JSON.stringify(value) : String(value),
              },
            },
            zodError,
          ),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error('Zod validation failed', { cause: error }),
        };
      }
    }

    // For non-Zod StandardSchemaWithJSON schemas (JSON Schema, AI SDK Schema, ArkType, etc.)
    // All schemas are wrapped via toStandardSchema() before reaching here,
    // so we can use ~standard.validate() uniformly.
    try {
      const ssResult = await this.schema['~standard'].validate(value);

      if (!ssResult.issues) {
        return {
          success: true,
          value: ssResult.value as OUTPUT,
        };
      }

      const errorMessages = ssResult.issues.map(e => `- ${e.path?.join('.') || 'root'}: ${e.message}`).join('\n');

      return {
        success: false,
        error: new MastraError({
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          id: 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED',
          text: `Structured output validation failed: ${errorMessages}`,
          details: {
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          },
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Validation failed', { cause: error }),
      };
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
   * Preprocesses accumulated text to handle LLMs that wrap JSON in code blocks
   * and fix common JSON formatting issues like unescaped newlines in strings.
   * Extracts content from the first complete valid ```json...``` code block or removes opening ```json prefix if no complete code block is found (streaming chunks).
   * @param accumulatedText - Raw accumulated text from streaming
   * @returns Processed text ready for JSON parsing
   */
  protected preprocessText(accumulatedText: string): string {
    let processedText = accumulatedText;

    // Some LLMs (e.g., LMStudio with jsonPromptInjection) wrap JSON in special tokens
    // Format: '<|channel|>final <|constrain|>JSON<|message|>{"key":"value"}'
    if (processedText.includes('<|message|>')) {
      const match = processedText.match(/<\|message\|>([\s\S]+)$/);
      if (match && match[1]) {
        processedText = match[1];
      }
    }

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

    // LLMs often output actual newlines/tabs inside JSON strings instead of
    // properly escaped \n sequences. Fix this before parsing.
    processedText = escapeUnescapedControlCharsInJsonStrings(processedText);

    return processedText;
  }
}

/**
 * Handles object format streaming. Emits parsed objects when they change during streaming.
 * This is the simplest format - objects are parsed and emitted directly without wrapping.
 */
class ObjectFormatHandler<OUTPUT = undefined> extends BaseFormatHandler<OUTPUT> {
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

    return this.validateValue(value);
  }
}

/**
 * Handles array format streaming. Arrays are wrapped in {elements: [...]} objects by the LLM
 * for better generation reliability. This handler unwraps them and filters incomplete elements.
 * Emits progressive array states as elements are completed.
 */
class ArrayFormatHandler<OUTPUT = undefined> extends BaseFormatHandler<OUTPUT> {
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
      const filteredElements: Partial<OUTPUT>[] = [];

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
            emitValue: [] as unknown as Partial<OUTPUT>,
            newPreviousResult: currentObjectJson as Partial<OUTPUT>,
          };
        }
      }

      // Only emit if the filtered array has actually changed
      if (!isDeepEqualData(this.textPreviousFilteredArray, filteredElements)) {
        this.textPreviousFilteredArray = [...filteredElements];
        return {
          shouldEmit: true,
          emitValue: filteredElements as unknown as Partial<OUTPUT>,
          newPreviousResult: currentObjectJson as Partial<OUTPUT>,
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

    return this.validateValue(resultValue);
  }
}

/**
 * Handles enum format streaming. Enums are wrapped in {result: ""} objects by the LLM
 * for better generation reliability. This handler unwraps them and provides partial matching.
 * Emits progressive enum states as they are completed.
 * Validates the final result against the user-provided schema.
 */
class EnumFormatHandler<OUTPUT = undefined> extends BaseFormatHandler<OUTPUT> {
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
    if (!this.schema) {
      return undefined;
    }

    // Get enum values from the schema using StandardSchemaWithJSON's jsonSchema conversion
    const outputJsonSchema = standardSchemaToJSONSchema(this.schema);
    const enumValues = outputJsonSchema?.enum;

    if (!enumValues) {
      return undefined;
    }

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
    const finalValue = value as { result: OUTPUT };

    // For enums, check the wrapped format and unwrap
    if (!finalValue || typeof finalValue !== 'object' || typeof finalValue.result !== 'string') {
      return {
        success: false,
        error: new Error('Invalid enum format: expected object with result property'),
      };
    }

    // Validate the unwrapped enum value
    return this.validateValue(finalValue.result);
  }
}

/**
 * Factory function to create the appropriate output format handler based on schema.
 * Analyzes the transformed schema format and returns the corresponding handler instance.
 * @param schema - Original user-provided schema (e.g., Zod schema from agent.stream({output: z.object({})}))
 * @param transformedSchema - Wrapped/transformed schema used for LLM generation (arrays wrapped in {elements: []}, enums in {result: ""})
 * @returns Handler instance for the detected format type
 */
function createOutputHandler<OUTPUT = undefined>({ schema }: { schema?: StandardSchemaWithJSON<OUTPUT> }) {
  // Ensure the schema is a proper StandardSchemaWithJSON.
  // Raw schemas (JSONSchema7, AI SDK Schema) may reach here when the handler is used
  // outside the normal agent pipeline (e.g., direct createObjectStreamTransformer usage).
  const normalizedSchema =
    schema && !isStandardSchemaWithJSON(schema)
      ? (toStandardSchema(schema as any) as StandardSchemaWithJSON<OUTPUT>)
      : schema;

  const transformedSchema = getTransformedSchema(normalizedSchema);
  switch (transformedSchema?.outputFormat) {
    case 'array':
      return new ArrayFormatHandler(normalizedSchema);
    case 'enum':
      return new EnumFormatHandler(normalizedSchema);
    case 'object':
    default:
      return new ObjectFormatHandler(normalizedSchema);
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
export function createObjectStreamTransformer<OUTPUT = undefined>({
  structuredOutput,
  logger,
}: {
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  logger?: IMastraLogger;
}) {
  const handler = createOutputHandler({ schema: structuredOutput?.schema });

  let accumulatedText = '';
  let previousObject: any = undefined;
  let currentRunId: string | undefined;
  let finalResult: ValidateAndTransformFinalResult<OUTPUT> | undefined;

  return new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
    async transform(chunk, controller) {
      if (chunk.runId) {
        // save runId to use in error chunks
        currentRunId = chunk.runId;
      }

      if (chunk.type === 'text-delta' && typeof chunk.payload?.text === 'string') {
        accumulatedText += chunk.payload.text;

        const result = await handler.processPartialChunk({
          accumulatedText,
          previousObject,
        });

        if (result.shouldEmit) {
          previousObject = result.newPreviousResult ?? previousObject;
          const chunkData = {
            from: chunk.from,
            runId: chunk.runId,
            type: 'object',
            object: result.emitValue as Partial<OUTPUT>, // TODO: handle partial runtime type validation of json chunks
          };

          controller.enqueue(chunkData as ChunkType<OUTPUT>);
        }
      }

      // Validate and resolve object when text generation completes
      if (chunk.type === 'text-end') {
        controller.enqueue(chunk);

        if (accumulatedText?.trim() && !finalResult) {
          finalResult = await handler.validateAndTransformFinal(accumulatedText);
          if (finalResult.success) {
            controller.enqueue({
              from: ChunkFrom.AGENT,
              runId: currentRunId ?? '',
              type: 'object-result',
              object: finalResult.value,
            });
          }
        }
        return;
      }

      // Always pass through the original chunk for downstream processing
      controller.enqueue(chunk);
    },

    async flush(controller) {
      if (finalResult && !finalResult.success) {
        handleValidationError(finalResult.error, controller);
      }
      // Safety net: If text-end was never emitted, validate now as fallback
      // This handles edge cases where providers might not emit text-end
      if (accumulatedText?.trim() && !finalResult) {
        finalResult = await handler.validateAndTransformFinal(accumulatedText);
        if (finalResult.success) {
          controller.enqueue({
            from: ChunkFrom.AGENT,
            runId: currentRunId ?? '',
            type: 'object-result',
            object: finalResult.value,
          });
        } else {
          handleValidationError(finalResult.error, controller);
        }
      }
    },
  });

  /**
   * Handle validation errors based on error strategy
   */
  function handleValidationError(error: Error, controller: TransformStreamDefaultController<ChunkType<OUTPUT>>) {
    if (structuredOutput?.errorStrategy === 'warn') {
      logger?.warn(error.message);
    } else if (structuredOutput?.errorStrategy === 'fallback') {
      controller.enqueue({
        from: ChunkFrom.AGENT,
        runId: currentRunId ?? '',
        type: 'object-result',
        object: structuredOutput?.fallbackValue,
      });
    } else {
      controller.enqueue({
        from: ChunkFrom.AGENT,
        runId: currentRunId ?? '',
        type: 'error',
        payload: {
          error,
        },
      });
    }
  }
}

/**
 * Transforms object chunks into JSON text chunks for streaming.
 *
 * This transformer:
 * - For arrays: emits opening bracket, new elements, and closing bracket
 * - For objects/no-schema: emits the object as JSON
 */
export function createJsonTextStreamTransformer<OUTPUT = undefined>(schema?: StandardSchemaWithJSON<OUTPUT>) {
  let previousArrayLength = 0;
  let hasStartedArray = false;
  let chunkCount = 0;
  const outputSchema = getTransformedSchema(schema);

  return new TransformStream<ChunkType<OUTPUT>, string>({
    transform(chunk, controller) {
      if (chunk.type !== 'object' || !chunk.object) {
        return;
      }

      if (outputSchema?.outputFormat === 'array' && Array.isArray(chunk.object)) {
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

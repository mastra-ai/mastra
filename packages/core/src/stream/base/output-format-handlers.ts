import { TransformStream } from 'node:stream/web';
import type { IMastraLogger } from '../../logger';
import type { StandardSchema } from '../../schema/type';
import { ChunkFrom } from '../types';
import type { ChunkType } from '../types';
import { ArrayFormatHandler } from './format-handlers/array-format';
import type { BaseFormatHandler, ValidationResult } from './format-handlers/base-format';
import { EnumFormatHandler } from './format-handlers/enum-format';
import { ObjectFormatHandler } from './format-handlers/object-format';
import { getTransformedSchema, toJSONSchema } from './schema';

export type ErrorStrategy<OUTPUT> =
  | {
      strategy: 'warn';
      fallbackValue?: never;
    }
  | {
      strategy: 'strict';
      fallbackValue?: never;
    }
  | {
      strategy: 'fallback';
      fallbackValue: OUTPUT;
    };

/**
 * Factory function to create the appropriate output format handler based on schema.
 * Analyzes the transformed schema format and returns the corresponding handler instance.
 * @param schema - Original user-provided schema (e.g., Zod schema from agent.stream({output: z.object({})}))
 * @param transformedSchema - Wrapped/transformed schema used for LLM generation (arrays wrapped in {elements: []}, enums in {result: ""})
 * @returns Handler instance for the detected format type
 */
function createOutputHandler<OUTPUT>(schema: StandardSchema<OUTPUT>): BaseFormatHandler<OUTPUT> {
  const transformedSchema = getTransformedSchema(
    schema['~standard'].jsonSchema.input({
      target: 'draft-07',
    }),
  );

  switch (transformedSchema?.outputFormat) {
    case 'array':
      // Cast since we've verified the output format is 'array' and BaseFormatHandler<OUTPUT> is the common interface
      return new ArrayFormatHandler(
        schema as unknown as StandardSchema<unknown[]>,
      ) as unknown as BaseFormatHandler<OUTPUT>;
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
export function createObjectStreamTransformer<OUTPUT>({
  schema,
  errorStrategy,
  logger,
}: {
  schema: StandardSchema<OUTPUT>;
  errorStrategy: ErrorStrategy<OUTPUT>;
  logger?: IMastraLogger;
}) {
  const handler = createOutputHandler(schema);

  let accumulatedText = '';
  let previousObject: any = undefined;
  let currentRunId: string | undefined;
  let finalResult: ValidationResult<OUTPUT> | undefined;

  return new TransformStream<ChunkType, ChunkType<OUTPUT>>({
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
            object: result.emitValue,
          } as const;

          controller.enqueue(chunkData);
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
      controller.enqueue(chunk as ChunkType<OUTPUT>);
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
    if (errorStrategy.strategy === 'warn') {
      logger?.warn(error.message);
    } else if (errorStrategy.strategy === 'fallback') {
      controller.enqueue({
        from: ChunkFrom.AGENT,
        runId: currentRunId ?? '',
        type: 'object-result',
        object: errorStrategy.fallbackValue!,
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
export function createJsonTextStreamTransformer<OUTPUT>(schema: StandardSchema<OUTPUT>) {
  let previousArrayLength = 0;
  let hasStartedArray = false;
  let chunkCount = 0;
  const outputSchema = getTransformedSchema(toJSONSchema(schema));

  return new TransformStream<ChunkType<OUTPUT>, string>({
    transform(chunk, controller) {
      if (chunk.type !== 'object' || !chunk.object) {
        return;
      }

      if (outputSchema?.outputFormat === 'array') {
        chunkCount++;

        const object = chunk.object as OUTPUT extends Array<infer T> ? T : never;

        if (!Array.isArray(object)) {
          throw new Error('Object is not an array');
        }

        // If this is the first chunk, decide between complete vs incremental streaming
        if (chunkCount === 1) {
          // If the first chunk already has multiple elements or is complete,
          // emit as single JSON string
          if (object.length > 0) {
            controller.enqueue(JSON.stringify(object));
            previousArrayLength = object.length;
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
        for (let i = previousArrayLength; i < object.length; i++) {
          const elementJson = JSON.stringify(object[i]);
          if (i > 0) {
            controller.enqueue(',' + elementJson);
          } else {
            controller.enqueue(elementJson);
          }
        }
        previousArrayLength = object.length;
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

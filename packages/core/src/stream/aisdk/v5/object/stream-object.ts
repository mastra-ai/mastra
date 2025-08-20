import { TransformStream } from 'stream/web';
import { asSchema, isDeepEqualData, parsePartialJson } from 'ai-v5';
import type { ObjectOptions } from '../../../../loop/types';
import { safeValidateTypes } from '../compat';
import { getOutputSchema, getResponseFormat } from './schema';

/**
 * Transforms raw text-delta chunks into structured object chunks for JSON mode streaming.
 *
 * For JSON response formats, this transformer:
 * - Accumulates text deltas and parses them as partial JSON
 * - Emits 'object' chunks when the parsed structure changes
 * - For arrays: filters incomplete elements and unwraps from {elements: [...]} wrapper
 * - For objects/no-schema: emits the parsed object directly
 * - Always passes through original chunks for downstream processing
 */
export function createObjectStreamTransformer({
  objectOptions,
  onFinish,
}: {
  objectOptions: ObjectOptions;
  /**
   * Callback to be called when the stream finishes.
   * @param data The final parsed object / array
   */
  onFinish: (data: any) => void;
}) {
  let textAccumulatedText = '';
  let textPreviousObject: any = undefined;
  let textPreviousFilteredArray: any[];
  let textPreviousEnumResult: string | undefined;

  const responseFormat = getResponseFormat(objectOptions);
  const outputSchema = getOutputSchema({ schema: objectOptions?.schema });

  return new TransformStream({
    async transform(chunk, controller) {
      if (responseFormat.type !== 'json') {
        controller.enqueue(chunk);
        return;
      }

      if (chunk.type === 'text-delta' && typeof chunk.payload.text === 'string') {
        if (outputSchema?.outputFormat === 'object') {
          textAccumulatedText += chunk.payload.text;
          const { value: currentObjectJson } = await parsePartialJson(textAccumulatedText);
          // TODO: enqueue error if partial parse state fails
          if (
            currentObjectJson !== undefined &&
            typeof currentObjectJson === 'object' &&
            !isDeepEqualData(textPreviousObject, currentObjectJson)
          ) {
            textPreviousObject = currentObjectJson;
            controller.enqueue({
              type: 'object',
              object: currentObjectJson,
            });
          }
        } else if (outputSchema?.outputFormat === 'array') {
          textAccumulatedText += chunk.payload.text;
          const { value: currentObjectJson, state: parseState } = await parsePartialJson(textAccumulatedText);
          // TODO: enqueue error if partial parse state fails
          if (currentObjectJson !== undefined && !isDeepEqualData(textPreviousObject, currentObjectJson)) {
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

            // Only emit if the filtered array has actually changed
            if (!isDeepEqualData(textPreviousFilteredArray, filteredElements)) {
              textPreviousFilteredArray = [...filteredElements];
              controller.enqueue({
                type: 'object',
                object: filteredElements,
              });
            }

            textPreviousObject = currentObjectJson;
          }
        } else if (outputSchema?.outputFormat === 'enum') {
          textAccumulatedText += chunk.payload.text;
          const { value: currentObjectJson } = await parsePartialJson(textAccumulatedText);
          // TODO: enqueue error if partial parse state fails
          if (
            currentObjectJson !== undefined &&
            currentObjectJson !== null &&
            typeof currentObjectJson === 'object' &&
            !Array.isArray(currentObjectJson) &&
            'result' in currentObjectJson &&
            typeof currentObjectJson.result === 'string' &&
            !isDeepEqualData(textPreviousObject, currentObjectJson)
          ) {
            // Extract enum values from original schema
            const originalSchema = objectOptions?.schema ? asSchema(objectOptions.schema) : null;
            const enumValues = originalSchema?.jsonSchema?.enum || [];
            
            const partialResult = currentObjectJson.result as string;
            const possibleEnumValues = enumValues
              .filter((value: unknown): value is string => typeof value === 'string')
              .filter((enumValue: string) => enumValue.startsWith(partialResult));

            // Only emit if we have valid partial matches and the result isn't empty
            if (partialResult.length > 0 && possibleEnumValues.length > 0) {
              // Emit the most specific result - if there's exactly one match, use it; otherwise use partial
              const firstMatch = possibleEnumValues[0];
              const bestMatch: string = possibleEnumValues.length === 1 && firstMatch !== undefined ? firstMatch : partialResult;
              
              // Only emit if the result has changed from the last emission
              if (bestMatch !== textPreviousEnumResult) {
                textPreviousEnumResult = bestMatch;
                textPreviousObject = currentObjectJson;
                controller.enqueue({
                  type: 'object',
                  object: bestMatch,
                });
              }
            }
          }
        }
      }

      // Always pass through the original chunk for downstream processing
      controller.enqueue(chunk);
    },

    async flush(controller) {
      if (responseFormat.type === 'json') {
        const finalValue = outputSchema?.outputFormat === 'array' ? textPreviousFilteredArray : textPreviousObject;
        // Check if we have a value at all
        if (!finalValue) {
          controller.enqueue({
            type: 'error',
            payload: { error: new Error('No object generated: could not parse the response.') },
          });
          return;
        }

        // Validate the final object against the schema if provided
        if (objectOptions?.schema) {
          try {
            const schema = asSchema(objectOptions.schema);

            // For arrays, validate against the original array schema
            if (outputSchema?.outputFormat === 'array') {
              const result = await safeValidateTypes({ value: finalValue, schema });
              if (!result.success) {
                controller.enqueue({
                  type: 'error',
                  payload: { error: result.error ?? new Error('Validation failed') },
                });
                return;
              }
              onFinish(result.value);
            } else if (outputSchema?.outputFormat === 'enum') {
              // For enums, unwrap from {result: "value"} and validate
              if (
                !finalValue ||
                typeof finalValue !== 'object' ||
                typeof finalValue.result !== 'string'
              ) {
                controller.enqueue({
                  type: 'error',
                  payload: { 
                    error: new Error('Invalid enum format: expected object with result property')
                  },
                });
                return;
              }

              // Validate the unwrapped enum value against original schema
              const result = await safeValidateTypes({ value: finalValue.result, schema });
              if (!result.success) {
                controller.enqueue({
                  type: 'error',
                  payload: { error: result.error ?? new Error('Enum validation failed') },
                });
                return;
              }
              // Return the unwrapped enum value, not the wrapped object
              onFinish(result.value);
            } else {
              // For objects and no-schema, validate the entire object
              const result = await safeValidateTypes({ value: finalValue, schema });
              if (!result.success) {
                controller.enqueue({
                  type: 'error',
                  payload: { error: result.error ?? new Error('Validation failed') },
                });
                return;
              }
              onFinish(result.value);
            }
          } catch (error) {
            controller.enqueue({
              type: 'error',
              payload: { error },
            });
            return;
          }
        } else {
          // No schema provided, just pass through the value
          onFinish(finalValue);
        }
      }
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
  const outputSchema = getOutputSchema({ schema: objectOptions?.schema });

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

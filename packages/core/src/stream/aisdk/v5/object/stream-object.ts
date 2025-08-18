import { TransformStream } from 'stream/web';
import { isDeepEqualData, parsePartialJson } from 'ai-v5';
import type { ObjectOptions } from '../../../../loop/types';
import { getResponseFormat } from './schema';

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
  onError,
}: {
  objectOptions: ObjectOptions;
  /**
   * Callback to be called when the stream finishes.
   * @param data The final parsed object / array
   */
  onFinish: (data: any) => void;
  /**
   * Callback to be called when the stream finishes with an error.
   * @param error The error that occurred (incorrect schema / no object generated etc)
   */
  onError: (error: any) => void;
}) {
  let textAccumulatedText = '';
  let textPreviousObject: any = undefined;
  let textPreviousFilteredArray: any[];

  const responseFormat = getResponseFormat(objectOptions);

  return new TransformStream({
    async transform(chunk, controller) {
      if (!objectOptions) {
        controller.enqueue(chunk);
        return;
      }

      if (responseFormat.type === 'json' && chunk.type === 'text-delta' && typeof chunk.payload.text === 'string') {
        if (objectOptions?.output === 'array') {
          textAccumulatedText += chunk.payload.text;
          const { value: currentObjectJson, state: parseState } = await parsePartialJson(textAccumulatedText);

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
        } else if (objectOptions?.output === 'no-schema' || !objectOptions?.output) {
          textAccumulatedText += chunk.payload.text;
          const { value: currentObjectJson } = await parsePartialJson(textAccumulatedText);

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
        }
      }

      // Always pass through the original chunk for downstream processing
      controller.enqueue(chunk);
    },

    // TODO: validate against the provided schema,
    // TODO: then call onFinish(data) if valid or call onError(err) if invalid
    // TODO: so that the object promise can be resolved/rejected
    flush() {
      if (responseFormat.type === 'json') {
        if (objectOptions?.output === 'array') {
          onFinish(textPreviousFilteredArray);
        } else {
          onFinish(textPreviousObject);
        }

        if (!textPreviousObject && !textPreviousFilteredArray) {
          onError('No object generated: could not parse the response.');
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

  return new TransformStream<any, string>({
    transform(chunk, controller) {
      if (chunk.type !== 'object') {
        return;
      }

      if (objectOptions?.output === 'array') {
        if (!hasStartedArray) {
          // Emit opening bracket if this is the first object in an array
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
      // Close the array when the stream ends
      if (hasStartedArray && objectOptions?.output === 'array') {
        controller.enqueue(']');
      }
    },
  });
}

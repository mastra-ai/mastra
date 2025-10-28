import type { LanguageModelV2Middleware, LanguageModelV2StreamPart } from '@ai-sdk/provider';
import fs from 'node:fs';

/**
 * A middleware that allows to log the raw response from a model.
 * Super helpful to get fixtures for kitchen-sink e2e tests.
 */

let i = 0;
export const logDataMiddleware: LanguageModelV2Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    const result = await doGenerate();

    console.log('doGenerate finished');
    console.log(JSON.stringify(result, null, 2));

    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    const { stream, ...rest } = await doStream();

    const chunks: LanguageModelV2StreamPart[] = [];

    const transformStream = new TransformStream<LanguageModelV2StreamPart, LanguageModelV2StreamPart>({
      transform(chunk, controller) {
        chunks.push(chunk);
        controller.enqueue(chunk);
      },

      flush() {
        i++;

        fs.writeFileSync(`stream-${i}.json`, JSON.stringify(chunks, null, 2));
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};

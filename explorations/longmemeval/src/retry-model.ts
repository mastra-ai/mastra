import { wrapLanguageModel } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';

export function makeRetryModel(model: LanguageModelV2) {
  const state = {
    rateLimitCount: 0,
    pause: null as null | Promise<void>,
    pauseResolve: () => {},
    pauseTime: 0,
  };
  const wrapped = wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        // console.log('params', params);
        if (state.pause) await state.pause;
        const maxRetries = 10;
        let retries = 0;
        while (retries < maxRetries) {
          try {
            const result = await doGenerate();
            return result;
          } catch (error: any) {
            if (error.status === 429 || error.statusCode === 429) {
              retries++;
              state.rateLimitCount++;
              const newPauseTime = 2000 * retries;
              if (state.pause) {
                await state.pause;
              }
              if (retries >= maxRetries) {
                throw error;
              }
              if (newPauseTime <= state.pauseTime) {
                continue;
              }
              if (!state.pause) {
                state.pauseTime = newPauseTime;
                state.pause = new Promise(resolve => {
                  setTimeout(() => {
                    resolve();
                    state.pause = null;
                    state.pauseTime = 0;
                  }, state.pauseTime);
                });
              }
              await state.pause;
            } else {
              throw error;
            }
          }
        }
        throw new Error('unhandled');
      },
    },
  });

  return {
    model: wrapped,
    state,
  };
}

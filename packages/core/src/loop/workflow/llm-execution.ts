import { createStep } from '../../workflows';
import type { OuterLLMRun } from '../types';
import { AgenticRunState } from './run-state';
import { llmIterationOutputSchema } from './schema';

export function createLLMExecutionStep({ model, _internal, messageId }: OuterLLMRun) {
  return createStep({
    id: 'llm-execution',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      const runState = new AgenticRunState({
        _internal: _internal!,
        model,
      });

      console.log(inputData, runState.state);

      // let modelResult;
      // let warnings: any;
      // let request: any;
      // let rawResponse: any;

      switch (model.specificationVersion) {
        case 'v2': {
          console.error('AISDK v2 Language models are not supported. Stay tuned.');
          break;
        }
        default: {
          throw new Error(`Unsupported model version: ${model.specificationVersion}`);
        }
      }

      return {
        messageId,
        stepResult: {},
        metadata: {},
        output: {},
        messages: {
          all: [],
          user: [],
          nonUser: [],
        },
      };
    },
  });
}

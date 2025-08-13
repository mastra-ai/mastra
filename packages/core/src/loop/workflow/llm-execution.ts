import { execute } from '../../stream/aisdk/v5/execute';
import { createStep } from '../../workflows';
import type { OuterLLMRun } from '../types';
import { AgenticRunState } from './run-state';
import { llmIterationOutputSchema } from './schema';

export function createLLMExecutionStep({
  model,
  _internal,
  messageId,
  runId,
  modelStreamSpan,
  telemetry_settings,
  tools,
  toolChoice,
  messageList,
  includeRawChunks,
  modelSettings,
  providerOptions,
  options,
  controller,
}: OuterLLMRun) {
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

      let modelResult;
      let warnings: any;
      let request: any;
      let rawResponse: any;

      switch (model.specificationVersion) {
        case 'v2': {
          modelResult = await execute({
            runId,
            model,
            providerOptions,
            inputMessages: messageList.get.all.prompt() as any,
            tools,
            toolChoice,
            options,
            modelSettings,
            telemetry_settings,
            includeRawChunks,
            onResult: ({
              warnings: warningsFromStream,
              request: requestFromStream,
              rawResponse: rawResponseFromStream,
            }) => {
              warnings = warningsFromStream;
              request = requestFromStream || {};
              rawResponse = rawResponseFromStream;

              controller.enqueue({
                runId,
                from: 'AGENT',
                type: 'step-start',
                payload: {
                  request: request || {},
                  warnings: [],
                  messageId: messageId,
                },
              });
            },
            modelStreamSpan,
          });
          break;
        }
        default: {
          throw new Error(`Unsupported model version: ${model.specificationVersion}`);
        }
      }

      console.log(modelResult);

      return {
        messageId,
        stepResult: {},
        metadata: {
          warnings,
          request,
          rawResponse,
        },
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

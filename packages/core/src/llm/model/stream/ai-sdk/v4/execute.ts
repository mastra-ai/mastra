import type { LanguageModelV1, ToolSet } from 'ai';
import type { ExecutionProps } from '../../types';
import { AISDKV4InputStream } from './input';
import { getModeOption, getOutputSchema, injectJsonInstructions } from './output-schema';
import { prepareToolsAndToolChoice } from './prepare-tools';

export function executeV4({
  runId,
  model,
  headers,
  providerMetadata,
  providerOptions,
  inputMessages,
  tools,
  activeTools,
  toolChoice,
  onResult,
  options,
}: ExecutionProps & {
  model: LanguageModelV1;
  onResult: (result: { warnings: any; request: any; rawResponse: any }) => void;
}) {
  const { mode, output, schema, schemaName, schemaDescription } = options ?? { mode: undefined };

  const v4 = new AISDKV4InputStream({
    component: 'LLM',
    name: model.modelId,
  });

  const preparedTools = prepareToolsAndToolChoice({
    tools: tools as ToolSet,
    toolChoice: toolChoice,
    activeTools: activeTools,
  });

  const outputSchema = getOutputSchema({ schema, output });
  const modeOption = getModeOption({
    mode,
    output,
    outputSchema,
    schemaName,
    schemaDescription,
    tools: preparedTools.tools,
    toolChoice: preparedTools.toolChoice,
  });
  // For models that don't support structured outputs,
  // inject the json schema as the first system message
  if (modeOption.type === 'object-json' && !model.supportsStructuredOutputs) {
    injectJsonInstructions({
      inputMessages,
      outputSchema,
    });
  }

  const providerMetadataOption = providerOptions
    ? { ...(providerMetadata ?? {}), ...providerOptions }
    : providerMetadata;

  const stream = v4.initialize({
    runId,
    onResult,
    createStream: async () => {
      try {
        const stream = await model.doStream({
          inputFormat: 'messages',
          mode: modeOption,
          providerMetadata: providerMetadataOption,
          prompt: inputMessages,
          headers,
        });

        return stream;
      } catch (error) {
        return {
          stream: new ReadableStream({
            start: async controller => {
              controller.enqueue({
                type: 'error',
                error,
              });
              controller.close();
            },
          }),
          warnings: [],
          request: {},
          rawResponse: {},
        };
      }
    },
  });

  return stream;
}

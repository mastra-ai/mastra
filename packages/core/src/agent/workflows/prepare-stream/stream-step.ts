import { z } from 'zod';
import { RuntimeContext } from '../../../runtime-context';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import type { AgentCapabilities } from './types';

interface StreamStepOptions<
  _OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
> {
  capabilities: AgentCapabilities;
  runId: string;
  returnScorerData?: boolean;
  format?: FORMAT;
}

export function createStreamStep<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({ capabilities, runId, returnScorerData, format = 'mastra' as FORMAT }: StreamStepOptions<OUTPUT, FORMAT>) {
  return createStep({
    id: 'stream-text-step',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ inputData, tracingContext }) => {
      capabilities.logger.debug(`Starting agent ${capabilities.agentName} llm stream call`, {
        runId,
      });

      const processors =
        inputData.outputProcessors ||
        (capabilities.outputProcessors
          ? typeof capabilities.outputProcessors === 'function'
            ? await capabilities.outputProcessors({
                runtimeContext: inputData.runtimeContext || new RuntimeContext(),
              })
            : capabilities.outputProcessors
          : []);

      const streamResult = capabilities.llm.stream({
        ...inputData,
        outputProcessors: processors,
        returnScorerData,
        tracingContext,
        _internal: {
          generateId: capabilities.generateMessageId,
        },
      });

      if (format === 'aisdk') {
        return streamResult.aisdk.v5;
      }

      return streamResult;
    },
  });
}

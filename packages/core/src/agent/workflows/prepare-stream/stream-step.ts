import { z } from 'zod';
import type { ModelLoopStreamArgs } from '../../../llm/model/model.loop.types';
import { RuntimeContext } from '../../../runtime-context';
import { AISDKV5OutputStream, MastraModelOutput } from '../../../stream';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import type { AgentCapabilities } from './schema';

interface StreamStepOptions {
  agentId: string;
}

export function createStreamStep<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({ agentId }: StreamStepOptions) {
  return createStep({
    id: 'stream-text-step',
    inputSchema: z.any(), // tried to type this in various ways but it's too complex
    outputSchema: z.union([
      z.instanceof(MastraModelOutput<OUTPUT | undefined>),
      z.instanceof(AISDKV5OutputStream<OUTPUT | undefined>),
    ]),
    execute: async ({ inputData, tracingContext }) => {
      // Instead of validating inputData with zod, we just cast it to the type we know it should be
      const validatedInputData = inputData as ModelLoopStreamArgs<any, OUTPUT> & {
        runId: string;
        returnScorerData?: boolean;
        format?: FORMAT;
        requireToolApproval?: boolean;
        resumeContext?: { resumeData: any; snapshot: any };
        toolCallId?: string;
        capabilities: AgentCapabilities;
      };

      const { capabilities } = validatedInputData;

      const {
        runId,
        returnScorerData,
        format = 'mastra' as FORMAT,
        requireToolApproval,
        resumeContext,
        toolCallId,
      } = validatedInputData;

      capabilities.logger.debug(`Starting agent ${capabilities.agentName} llm stream call`, {
        runId,
      });

      const processors =
        validatedInputData.outputProcessors ||
        (capabilities.outputProcessors
          ? typeof capabilities.outputProcessors === 'function'
            ? await capabilities.outputProcessors({
                runtimeContext: validatedInputData.runtimeContext || new RuntimeContext(),
              })
            : capabilities.outputProcessors
          : []);

      const streamResult = capabilities.llm.stream({
        ...validatedInputData,
        outputProcessors: processors,
        returnScorerData,
        tracingContext,
        requireToolApproval,
        resumeContext,
        _internal: {
          generateId: capabilities.generateMessageId,
        },
        agentId,
        toolCallId,
      });

      if (format === 'aisdk') {
        return streamResult.aisdk.v5;
      }

      return streamResult;
    },
  });
}

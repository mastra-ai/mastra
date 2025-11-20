import { z } from 'zod';
import { getModelMethodFromAgentMethod } from '../../../llm/model/model-method-from-agent';
import type { ModelLoopStreamArgs, ModelMethodType } from '../../../llm/model/model.loop.types';
import { RequestContext } from '../../../request-context';
import { AISDKV5OutputStream, MastraModelOutput } from '../../../stream';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import type { AgentMethodType } from '../../types';
import type { AgentCapabilities } from './schema';

interface StreamStepOptions {
  capabilities: AgentCapabilities;
  runId: string;
  returnScorerData?: boolean;
  requireToolApproval?: boolean;
  resumeContext?: {
    resumeData: any;
    snapshot: any;
  };
  agentId: string;
  toolCallId?: string;
  methodType: AgentMethodType;
}

export function createStreamStep<OUTPUT extends OutputSchema | undefined = undefined>({
  capabilities,
  runId,
  returnScorerData,
  requireToolApproval,
  resumeContext,
  agentId,
  toolCallId,
  methodType,
}: StreamStepOptions) {
  return createStep({
    id: 'stream-text-step',
    inputSchema: z.any(), // tried to type this in various ways but it's too complex
    outputSchema: z.union([
      z.instanceof(MastraModelOutput<OUTPUT | undefined>),
      z.instanceof(AISDKV5OutputStream<OUTPUT | undefined>),
    ]),
    execute: async ({ inputData, tracingContext }) => {
      // Instead of validating inputData with zod, we just cast it to the type we know it should be
      const validatedInputData = inputData as ModelLoopStreamArgs<any, OUTPUT>;

      capabilities.logger.debug(`Starting agent ${capabilities.agentName} llm stream call`, {
        runId,
      });

      const processors =
        validatedInputData.outputProcessors ||
        (capabilities.outputProcessors
          ? typeof capabilities.outputProcessors === 'function'
            ? await capabilities.outputProcessors({
                requestContext: validatedInputData.requestContext || new RequestContext(),
              })
            : capabilities.outputProcessors
          : []);

      const modelMethodType: ModelMethodType = getModelMethodFromAgentMethod(methodType);

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
        methodType: modelMethodType,
      });

      return streamResult;
    },
  });
}

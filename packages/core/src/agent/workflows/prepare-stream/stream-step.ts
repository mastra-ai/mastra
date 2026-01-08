import { z } from 'zod';
import { getModelMethodFromAgentMethod } from '../../../llm/model/model-method-from-agent';
import type { ModelLoopStreamArgs, ModelMethodType } from '../../../llm/model/model.loop.types';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig } from '../../../memory/types';
import { RequestContext } from '../../../request-context';
import { MastraModelOutput } from '../../../stream';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import type { SaveQueueManager } from '../../save-queue';
import type { AgentMethodType } from '../../types';
import type { AgentCapabilities } from './schema';

interface StreamStepOptions {
  capabilities: AgentCapabilities;
  runId: string;
  returnScorerData?: boolean;
  requireToolApproval?: boolean;
  toolCallConcurrency?: number;
  resumeContext?: {
    resumeData: any;
    snapshot: any;
  };
  agentId: string;
  agentName?: string;
  toolCallId?: string;
  methodType: AgentMethodType;
  saveQueueManager?: SaveQueueManager;
  memoryConfig?: MemoryConfig;
  memory?: MastraMemory;
  resourceId?: string;
  autoResumeSuspendedTools?: boolean;
}

export function createStreamStep<OUTPUT = undefined>({
  capabilities,
  runId,
  returnScorerData,
  requireToolApproval,
  toolCallConcurrency,
  resumeContext,
  agentId,
  agentName,
  toolCallId,
  methodType,
  saveQueueManager,
  memoryConfig,
  memory,
  resourceId,
  autoResumeSuspendedTools,
}: StreamStepOptions) {
  return createStep({
    id: 'stream-text-step',
    inputSchema: z.any(), // tried to type this in various ways but it's too complex
    outputSchema: z.instanceof(MastraModelOutput<OUTPUT | undefined>),
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
        toolCallConcurrency,
        resumeContext,
        _internal: {
          generateId: capabilities.generateMessageId,
          saveQueueManager,
          memoryConfig,
          threadId: validatedInputData.threadId,
          resourceId,
          memory,
        },
        agentId,
        agentName,
        toolCallId,
        methodType: modelMethodType,
        autoResumeSuspendedTools,
      });

      return streamResult;
    },
  });
}

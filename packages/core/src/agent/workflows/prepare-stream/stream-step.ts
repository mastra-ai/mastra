import { z } from 'zod/v4';
import type { BackgroundTaskManager } from '../../../background-tasks';
import type { AgentBackgroundConfig } from '../../../background-tasks/types';
import { getModelMethodFromAgentMethod } from '../../../llm/model/model-method-from-agent';
import type { ModelLoopStreamArgs, ModelMethodType } from '../../../llm/model/model.loop.types';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfigInternal } from '../../../memory/types';
import { resolveObservabilityContext } from '../../../observability';
import { RequestContext } from '../../../request-context';
import { MastraModelOutput } from '../../../stream';
import { createStep } from '../../../workflows';
import type { Workspace } from '../../../workspace/workspace';
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
  memoryConfig?: MemoryConfigInternal;
  memory?: MastraMemory;
  resourceId?: string;
  autoResumeSuspendedTools?: boolean;
  workspace?: Workspace;
  backgroundTaskManager?: BackgroundTaskManager;
  agentBackgroundConfig?: AgentBackgroundConfig;
  /**
   * When true, the in-loop `backgroundTaskCheckStep` skips its wait for
   * running tasks. Used when an outer caller (e.g. `agent.streamUntilIdle`)
   * drives continuation from outside the loop.
   */
  skipBgTaskWait?: boolean;
}

export function createStreamStep<OUTPUT = undefined>({
  capabilities,
  runId: _runId,
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
  workspace,
  backgroundTaskManager,
  agentBackgroundConfig,
  skipBgTaskWait,
}: StreamStepOptions) {
  return createStep({
    id: 'stream-text-step',
    inputSchema: z.any(), // tried to type this in various ways but it's too complex
    outputSchema: z.instanceof(MastraModelOutput<OUTPUT>),
    execute: async ({ inputData, ...observabilityContext }) => {
      // Instead of validating inputData with zod, we just cast it to the type we know it should be
      const validatedInputData = inputData as ModelLoopStreamArgs<any, OUTPUT>;

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
        ...resolveObservabilityContext(observabilityContext),
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
          backgroundTaskManager,
          agentBackgroundConfig,
          backgroundTaskManagerConfig: backgroundTaskManager?.config,
          skipBgTaskWait,
        },
        agentId,
        agentName,
        toolCallId,
        methodType: modelMethodType,
        autoResumeSuspendedTools,
        workspace,
      });

      return streamResult as unknown as MastraModelOutput<OUTPUT>;
    },
  });
}

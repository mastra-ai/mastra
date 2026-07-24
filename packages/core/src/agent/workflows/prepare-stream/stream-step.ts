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
import type { RequireToolApproval, ToolPayloadTransformPolicy } from '../../../tools';
import { createStep } from '../../../workflows/workflow';
import type { Workspace } from '../../../workspace/workspace';
import type { SaveQueueManager } from '../../save-queue';
import type { CreatedAgentSignal } from '../../signals';
import type { AgentMethodType } from '../../types';
import type { PrepareStreamRunScope } from './run-scope';
import { LOOP_OPTIONS_KEY } from './run-scope-keys';
import type { AgentCapabilities } from './schema';

interface StreamStepOptions<OUTPUT = undefined> {
  capabilities: AgentCapabilities;
  runId: string;
  returnScorerData?: boolean;
  requireToolApproval?: RequireToolApproval;
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
  toolPayloadTransform?: ToolPayloadTransformPolicy;
  /**
   * When true, the in-loop `backgroundTaskCheckStep` skips its wait for
   * running tasks. Used when an outer caller (e.g. `agent.streamUntilIdle`)
   * drives continuation from outside the loop.
   */
  skipBgTaskWait?: boolean;
  drainPendingSignals?: (runId: string, scope?: 'pending' | 'pre-run') => CreatedAgentSignal[];
  runScope: PrepareStreamRunScope<OUTPUT>;
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
  toolPayloadTransform,
  skipBgTaskWait,
  drainPendingSignals,
  runScope,
}: StreamStepOptions<OUTPUT>) {
  return createStep({
    id: 'stream-text-step',
    inputSchema: z.any(),
    outputSchema: z.instanceof(MastraModelOutput<OUTPUT>),
    execute: async ({ ...observabilityContext }) => {
      // `loopOptions` carries class instances (MessageList, Tools) and closures
      // (onStepFinish, onFinish, ...) — none of which survive the evented engine's
      // JSON round-trip in step inputs. map-results-step parked it on runScope.
      const loopOptions = runScope.getOrThrow(LOOP_OPTIONS_KEY) as ModelLoopStreamArgs<any, OUTPUT> & {
        initialSignalEchoes?: CreatedAgentSignal[];
      };

      const processors =
        loopOptions.outputProcessors ||
        (capabilities.outputProcessors
          ? typeof capabilities.outputProcessors === 'function'
            ? await capabilities.outputProcessors({
                requestContext: loopOptions.requestContext || new RequestContext(),
              })
            : capabilities.outputProcessors
          : []);

      const modelMethodType: ModelMethodType = getModelMethodFromAgentMethod(methodType);

      const streamResult = capabilities.llm.stream({
        ...loopOptions,
        outputProcessors: processors,
        returnScorerData,
        ...resolveObservabilityContext(observabilityContext),
        requireToolApproval,
        toolCallConcurrency,
        resumeContext,
        _internal: {
          agent: capabilities.agent,
          generateId: capabilities.generateMessageId,
          saveQueueManager,
          memoryConfig,
          threadId: loopOptions.threadId,
          resourceId,
          memory,
          backgroundTaskManager,
          agentBackgroundConfig,
          backgroundTaskManagerConfig: backgroundTaskManager?.config,
          toolPayloadTransform,
          skipBgTaskWait,
          drainPendingSignals,
          initialSignalEchoes: loopOptions.initialSignalEchoes,
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

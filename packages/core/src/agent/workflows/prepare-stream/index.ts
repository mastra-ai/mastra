import { z } from 'zod/v4';
import type { BackgroundTaskManager } from '../../../background-tasks';
import type { AgentBackgroundConfig } from '../../../background-tasks/types';
import type { SystemMessage } from '../../../llm';
import { createRunScope } from '../../../mastra/run-scope';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfigInternal, StorageThreadType } from '../../../memory/types';
import type { Span, SpanType } from '../../../observability';
import { InternalSpans } from '../../../observability';
import type { RequestContext } from '../../../request-context';
import { MastraModelOutput } from '../../../stream';
import type { RequireToolApproval, ToolPayloadTransformPolicy } from '../../../tools';
import { createEventedWorkflow, createWorkflow as createDirectWorkflow } from '../../../workflows/create';
import type { Workspace } from '../../../workspace/workspace';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { SaveQueueManager } from '../../save-queue';
import type { CreatedAgentSignal } from '../../signals';
import type { AgentMethodType } from '../../types';
import { createMapResultsStep } from './map-results-step';
import { createPrepareMemoryStep } from './prepare-memory-step';
import { createPrepareToolsStep } from './prepare-tools-step';
import type { AgentCapabilities } from './schema';
import { createStreamStep } from './stream-step';

interface CreatePrepareStreamWorkflowOptions<OUTPUT = undefined> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT>;
  threadFromArgs?: (Partial<StorageThreadType> & { id: string }) | undefined;
  resourceId?: string;
  runId: string;
  requestContext: RequestContext;
  agentSpan?: Span<SpanType.AGENT_RUN>;
  methodType: AgentMethodType;
  instructions: SystemMessage;
  /** MCP server guidance to include as a separate system message. */
  mcpServerGuidance?: string;
  memoryConfig?: MemoryConfigInternal;
  memory?: MastraMemory;
  returnScorerData?: boolean;
  saveQueueManager?: SaveQueueManager;
  requireToolApproval?: RequireToolApproval;
  toolCallConcurrency?: number;
  resumeContext?: {
    resumeData: any;
    snapshot: any;
  };
  agentId: string;
  agentName?: string;
  toolCallId?: string;
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
}

export function createPrepareStreamWorkflow<OUTPUT = undefined>({
  capabilities,
  options,
  threadFromArgs,
  resourceId,
  runId,
  requestContext,
  agentSpan,
  methodType,
  instructions,
  mcpServerGuidance,
  memoryConfig,
  memory,
  returnScorerData,
  saveQueueManager,
  requireToolApproval,
  toolCallConcurrency,
  resumeContext,
  agentId,
  agentName,
  toolCallId,
  workspace,
  backgroundTaskManager,
  agentBackgroundConfig,
  toolPayloadTransform,
  skipBgTaskWait,
  drainPendingSignals,
}: CreatePrepareStreamWorkflowOptions<OUTPUT>) {
  // Per-run scope shared between steps. Class instances (MessageList, Tools),
  // Maps, and closures live here instead of step outputs — see ./run-scope.ts.
  // The agent.ts caller wires the same scope into `Mastra.__createRunScope` for
  // the evented path; the closure reference here keeps the direct path working
  // without touching the registry.
  const runScope = createRunScope();

  const prepareToolsStep = createPrepareToolsStep({
    capabilities,
    options,
    threadFromArgs,
    resourceId,
    runId,
    requestContext,
    agentSpan,
    methodType,
    memory,
    backgroundTaskEnabled: backgroundTaskManager?.config?.enabled,
    runScope,
  });

  const prepareMemoryStep = createPrepareMemoryStep({
    capabilities,
    options,
    threadFromArgs,
    resourceId,
    runId,
    requestContext,
    methodType,
    instructions,
    mcpServerGuidance,
    memoryConfig,
    memory,
    isResume: !!resumeContext,
    runScope,
  });

  const streamStep = createStreamStep({
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
    autoResumeSuspendedTools: options.autoResumeSuspendedTools,
    workspace,
    backgroundTaskManager,
    agentBackgroundConfig,
    toolPayloadTransform,
    skipBgTaskWait,
    drainPendingSignals,
    runScope,
  });

  const mapResultsStep = createMapResultsStep({
    capabilities,
    options,
    resourceId,
    threadId: threadFromArgs?.id,
    runId,
    requestContext,
    memory,
    memoryConfig,
    agentSpan,
    agentId,
    methodType,
    saveQueueManager,
    runScope,
  });

  // Internal toggle: the default is direct (in-process) execution which avoids
  // the requestContext serialisation cycle (toJSON → reconstruct) that drops
  // non-serialisable values (functions, circular-ref objects like the harness
  // context). Set MASTRA_EVENTED_EXECUTION=true to opt in to the evented
  // workflow engine for cross-process coordination via pubsub.
  const useEventedExecution = process.env.MASTRA_EVENTED_EXECUTION === 'true';
  const factory = useEventedExecution ? createEventedWorkflow : createDirectWorkflow;

  return factory({
    id: 'execution-workflow',
    inputSchema: z.object({}),
    outputSchema: z.instanceof(MastraModelOutput<OUTPUT>),
    steps: [prepareToolsStep, prepareMemoryStep, streamStep],
    options: {
      tracingPolicy: {
        internal: InternalSpans.WORKFLOW,
      },
      // This is an internal, non-resumable workflow created per agent generate/stream call.
      // It must never write snapshot rows to the user's storage. Registering Mastra (done by
      // the agent) lets it read storage to suppress noise, while this keeps writes off.
      shouldPersistSnapshot: () => false,
      validateInputs: false,
    },
  })
    .parallel([prepareToolsStep, prepareMemoryStep])
    .map(mapResultsStep)
    .then(streamStep)
    .commit();
}

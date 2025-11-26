import { z } from 'zod';
import type { SystemMessage } from '../../../llm';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../../../memory/types';
import type { Span, SpanType } from '../../../observability';
import { InternalSpans } from '../../../observability';
import type { RequestContext } from '../../../request-context';
import { AISDKV5OutputStream, MastraModelOutput } from '../../../stream';
import type { OutputSchema } from '../../../stream/base/schema';
import type { Constructor } from '../../../types';
import { createWorkflow } from '../../../workflows/workflow';
import type { Agent } from '../../agent';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { SaveQueueManager } from '../../save-queue';
import type { AgentMethodType } from '../../types';
import { createMapResultsStep } from './map-results-step';
import { createPrepareMemoryStep } from './prepare-memory-step';
import { createPrepareToolsStep } from './prepare-tools-step';
import type { AgentCapabilities } from './schema';
import { createStreamStep } from './stream-step';

interface CreatePrepareStreamWorkflowOptions<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT, FORMAT>;
  threadFromArgs?: (Partial<StorageThreadType> & { id: string }) | undefined;
  resourceId?: string;
  runId: string;
  requestContext: RequestContext;
  agentSpan: Span<SpanType.AGENT_RUN>;
  methodType: AgentMethodType;
  instructions: SystemMessage;
  memoryConfig?: MemoryConfig;
  memory?: MastraMemory;
  saveQueueManager: SaveQueueManager;
  returnScorerData?: boolean;
  requireToolApproval?: boolean;
  resumeContext?: {
    resumeData: any;
    snapshot: any;
  };
  agentId: string;
  toolCallId?: string;
  AgentClass: Constructor<Agent>;
}

export function createPrepareStreamWorkflow<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({
  capabilities,
  options,
  threadFromArgs,
  resourceId,
  runId,
  requestContext,
  agentSpan,
  methodType,
  instructions,
  memoryConfig,
  memory,
  saveQueueManager,
  returnScorerData,
  requireToolApproval,
  resumeContext,
  agentId,
  toolCallId,
  AgentClass,
}: CreatePrepareStreamWorkflowOptions<OUTPUT, FORMAT>) {
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
  });

  const prepareMemoryStep = createPrepareMemoryStep({
    capabilities,
    options,
    threadFromArgs,
    resourceId,
    runId,
    requestContext,
    agentSpan,
    methodType,
    instructions,
    memoryConfig,
    memory,
  });

  const streamStep = createStreamStep({
    capabilities,
    runId,
    returnScorerData,
    requireToolApproval,
    resumeContext,
    agentId,
    toolCallId,
    methodType,
  });

  const mapResultsStep = createMapResultsStep({
    capabilities,
    options,
    resourceId,
    runId,
    requestContext,
    memory,
    memoryConfig,
    saveQueueManager,
    agentSpan,
    agentId,
    methodType,
    AgentClass,
  });

  return createWorkflow({
    id: 'execution-workflow',
    inputSchema: z.object({}),
    outputSchema: z.union([
      z.instanceof(MastraModelOutput<OUTPUT | undefined>),
      z.instanceof(AISDKV5OutputStream<OUTPUT | undefined>),
    ]),
    steps: [prepareToolsStep, prepareMemoryStep, streamStep],
    options: {
      tracingPolicy: {
        internal: InternalSpans.WORKFLOW,
      },
      validateInputs: false,
    },
  })
    .parallel([prepareToolsStep, prepareMemoryStep])
    .map(mapResultsStep)
    .then(streamStep)
    .commit();
}

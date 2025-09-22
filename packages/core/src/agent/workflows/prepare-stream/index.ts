import { z } from 'zod';
import { InternalSpans } from '../../../ai-tracing';
import type { AISpan, AISpanType } from '../../../ai-tracing';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../../../memory/types';
import type { RuntimeContext } from '../../../runtime-context';
import { AISDKV5OutputStream, MastraModelOutput } from '../../../stream';
import type { OutputSchema } from '../../../stream/base/schema';
import { createWorkflow } from '../../../workflows';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { SaveQueueManager } from '../../save-queue';
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
  runtimeContext: RuntimeContext;
  agentAISpan: AISpan<AISpanType.AGENT_RUN>;
  methodType: 'generate' | 'stream' | 'generateLegacy' | 'streamLegacy';
  format?: FORMAT;
  instructions: string;
  memoryConfig?: MemoryConfig;
  memory?: MastraMemory;
  saveQueueManager: SaveQueueManager;
  returnScorerData?: boolean;
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
  runtimeContext,
  agentAISpan,
  methodType,
  format,
  instructions,
  memoryConfig,
  memory,
  saveQueueManager,
  returnScorerData,
}: CreatePrepareStreamWorkflowOptions<OUTPUT, FORMAT>) {
  const prepareToolsStep = createPrepareToolsStep({
    capabilities,
    options,
    threadFromArgs,
    resourceId,
    runId,
    runtimeContext,
    agentAISpan,
    methodType,
    format,
    memory,
  });

  const prepareMemoryStep = createPrepareMemoryStep({
    capabilities,
    options,
    threadFromArgs,
    resourceId,
    runId,
    runtimeContext,
    agentAISpan,
    methodType,
    format,
    instructions,
    memoryConfig,
    memory,
  });

  const streamStep = createStreamStep({
    capabilities,
    runId,
    returnScorerData,
    format,
  });

  const mapResultsStep = createMapResultsStep({
    capabilities,
    options,
    resourceId,
    runId,
    runtimeContext,
    memory,
    memoryConfig,
    saveQueueManager,
    agentAISpan,
    instructions,
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
    },
  })
    .parallel([prepareToolsStep, prepareMemoryStep])
    .map(mapResultsStep)
    .then(streamStep)
    .commit();
}

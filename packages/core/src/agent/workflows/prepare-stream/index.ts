import { z } from 'zod';
import { InternalSpans } from '../../../ai-tracing';
import type { AISpan, AISpanType } from '../../../ai-tracing';
import type { SystemMessage } from '../../../llm';
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

export const prepareStreamWorkflowInputSchema = z.object({
  options: z.any(), // TODO
  resourceId: z.string(),
  runId: z.string(),
  threadFromArgs: z.any().optional(), // storage reference
  methodType: z.enum(['generate', 'stream', 'generateLegacy', 'streamLegacy']),
  format: z.enum(['aisdk', 'mastra']).optional(),
  instructions: z.any(), // system message
  memoryConfig: z.any().optional(), // memory config
  memory: z.any().optional(), // memory
  returnScorerData: z.boolean().optional(),
  requireToolApproval: z.boolean().optional(),
  resumeContext: z
    .object({
      resumeData: z.any(),
      snapshot: z.any(),
    })
    .optional(),
  toolCallId: z.string().optional(),
});

interface CreatePrepareStreamWorkflowOptions {
  capabilities: AgentCapabilities;
  saveQueueManager: SaveQueueManager;
  agentId: string;
}

export function createPrepareStreamWorkflow<OUTPUT extends OutputSchema | undefined = undefined>({
  capabilities,
  saveQueueManager,
  agentId,
}: CreatePrepareStreamWorkflowOptions) {
  const prepareToolsStep = createPrepareToolsStep({
    capabilities,
  });

  const prepareMemoryStep = createPrepareMemoryStep({
    capabilities,
  });

  const streamStep = createStreamStep({
    capabilities,
    agentId,
  });

  const mapResultsStep = createMapResultsStep({
    capabilities,
    saveQueueManager,
    agentId,
  });

  return createWorkflow({
    id: 'execution-workflow',
    inputSchema: prepareStreamWorkflowInputSchema,
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
    .map(mapResultsStep as any)
    .then(streamStep)
    .commit();
}

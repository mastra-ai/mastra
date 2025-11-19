import { z } from 'zod';
import type { MastraMemory } from '../../../memory/memory';
import type { StorageThreadType } from '../../../memory/types';
import type { Span, SpanType } from '../../../observability';
import type { RequestContext } from '../../../request-context';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { AgentMethodType } from '../../types';
import type { AgentCapabilities } from './schema';
import { prepareToolsStepOutputSchema } from './schema';

interface PrepareToolsStepOptions<
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
  memory?: MastraMemory;
}

export function createPrepareToolsStep<
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
  memory,
}: PrepareToolsStepOptions<OUTPUT, FORMAT>) {
  return createStep({
    id: 'prepare-tools-step',
    inputSchema: z.object({}),
    outputSchema: prepareToolsStepOutputSchema,
    execute: async () => {
      const toolEnhancements = [
        options?.toolsets && Object.keys(options?.toolsets || {}).length > 0
          ? `toolsets present (${Object.keys(options?.toolsets || {}).length} tools)`
          : undefined,
        memory && resourceId ? 'memory and resourceId available' : undefined,
      ]
        .filter(Boolean)
        .join(', ');

      capabilities.logger.debug(`[Agent:${capabilities.agentName}] - Enhancing tools: ${toolEnhancements}`, {
        runId,
        toolsets: options?.toolsets ? Object.keys(options?.toolsets) : undefined,
        clientTools: options?.clientTools ? Object.keys(options?.clientTools) : undefined,
        hasMemory: !!memory,
        hasResourceId: !!resourceId,
      });

      const threadId = threadFromArgs?.id;

      const convertedTools = await capabilities.convertTools({
        toolsets: options?.toolsets,
        clientTools: options?.clientTools,
        threadId,
        resourceId,
        runId,
        requestContext,
        tracingContext: { currentSpan: agentSpan },
        writableStream: options.writableStream,
        methodType,
      });

      return {
        convertedTools,
      };
    },
  });
}

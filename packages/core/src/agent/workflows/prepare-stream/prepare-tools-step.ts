import { z } from 'zod';
import type { AISpan, AISpanType } from '../../../ai-tracing';
import type { MastraMemory } from '../../../memory/memory';
import type { StorageThreadType } from '../../../memory/types';
import type { RuntimeContext } from '../../../runtime-context';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import type { InnerAgentExecutionOptions } from '../../agent.types';
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
  runtimeContext: RuntimeContext;
  agentAISpan: AISpan<AISpanType.AGENT_RUN>;
  methodType: 'generate' | 'stream' | 'streamVNext' | 'generateVNext';
  format?: FORMAT;
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
  runtimeContext,
  agentAISpan,
  methodType,
  format,
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
        runtimeContext,
        tracingContext: { currentSpan: agentAISpan },
        writableStream: options.writableStream,
        methodType,
        format: format as 'aisdk' | 'mastra' | undefined,
      });

      return {
        convertedTools,
      };
    },
  });
}

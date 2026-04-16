import { z } from 'zod/v4';
import type { MastraMemory } from '../../../memory/memory';
import type { StorageThreadType } from '../../../memory/types';
import type { Span, SpanType } from '../../../observability';
import { createObservabilityContext } from '../../../observability';
import type { RequestContext } from '../../../request-context';
import { createStep } from '../../../workflows';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { AgentMethodType } from '../../types';
import type { AgentCapabilities } from './schema';
import { prepareToolsStepOutputSchema } from './schema';

interface PrepareToolsStepOptions<OUTPUT = undefined> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT>;
  threadFromArgs?: (Partial<StorageThreadType> & { id: string }) | undefined;
  resourceId?: string;
  runId: string;
  requestContext: RequestContext;
  agentSpan?: Span<SpanType.AGENT_RUN>;
  methodType: AgentMethodType;
  memory?: MastraMemory;
  backgroundTaskEnabled?: boolean;
}

export function createPrepareToolsStep<OUTPUT = undefined>({
  capabilities,
  options,
  threadFromArgs,
  resourceId,
  runId,
  requestContext,
  agentSpan,
  methodType,
  memory: _memory,
  backgroundTaskEnabled,
}: PrepareToolsStepOptions<OUTPUT>) {
  return createStep({
    id: 'prepare-tools-step',
    inputSchema: z.object({}),
    outputSchema: prepareToolsStepOutputSchema,
    execute: async () => {
      const threadId = threadFromArgs?.id;

      const convertedTools = await capabilities.convertTools({
        toolsets: options?.toolsets,
        clientTools: options?.clientTools,
        threadId,
        resourceId,
        runId,
        requestContext,
        ...createObservabilityContext({ currentSpan: agentSpan }),
        outputWriter: options.outputWriter,
        methodType,
        memoryConfig: options.memory?.options,
        autoResumeSuspendedTools: options.autoResumeSuspendedTools,
        delegation: options.delegation,
        backgroundTaskEnabled,
      });

      // Update the agent span with available tool names for observability
      const toolNames = Object.keys(convertedTools);
      if (toolNames.length > 0) {
        agentSpan?.update({
          attributes: {
            availableTools: toolNames,
          },
        });
      }

      return {
        convertedTools,
      };
    },
  });
}

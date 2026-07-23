import { z } from 'zod/v4';
import type { MastraMemory } from '../../../memory/memory';
import type { StorageThreadType } from '../../../memory/types';
import type { Span, SpanType } from '../../../observability';
import { createObservabilityContext } from '../../../observability';
import type { RequestContext } from '../../../request-context';
import { createStep } from '../../../workflows/workflow';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { AgentMethodType } from '../../types';
import type { PrepareStreamRunScope } from './run-scope';
import { CONVERTED_TOOLS_KEY } from './run-scope-keys';
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
  runScope: PrepareStreamRunScope<OUTPUT>;
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
  runScope,
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
        backgroundTaskPolicy: options.backgroundTaskPolicy,
        inputProcessors: options.inputProcessors,
        hooks: options.hooks,
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

      // Tool records contain `execute` functions and are not JSON-serializable.
      // Park them on the factory closure's runScope; map-results-step reads them.
      runScope.set(CONVERTED_TOOLS_KEY, convertedTools);
      return {};
    },
  });
}

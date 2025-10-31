import deepEqual from 'fast-deep-equal';
import { z } from 'zod';
import type { AISpan, AISpanType } from '../../../ai-tracing';
import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import type { SystemMessage } from '../../../llm';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../../../memory/types';
import type { RequestContext } from '../../../request-context';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import { MessageList } from '../../message-list';
import type { AgentCapabilities } from './schema';
import { prepareMemoryStepOutputSchema } from './schema';

/**
 * Helper function to add system message(s) to a MessageList
 * Handles string, CoreSystemMessage, SystemModelMessage, and arrays of these message formats
 * Used for both agent instructions and user-provided system messages
 */
function addSystemMessage(messageList: MessageList, content: SystemMessage | undefined, tag?: string): void {
  if (!content) return;

  if (Array.isArray(content)) {
    // Handle array of system messages
    for (const msg of content) {
      messageList.addSystem(msg, tag);
    }
  } else {
    // Handle string, CoreSystemMessage, or SystemModelMessage
    messageList.addSystem(content, tag);
  }
}

interface PrepareMemoryStepOptions<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT, FORMAT>;
  threadFromArgs?: (Partial<StorageThreadType> & { id: string }) | undefined;
  resourceId?: string;
  runId: string;
  requestContext: RequestContext;
  agentAISpan: AISpan<AISpanType.AGENT_RUN>;
  methodType: 'generate' | 'stream' | 'generateLegacy' | 'streamLegacy';
  /**
   * @deprecated When using format: 'aisdk', use the `@mastra/ai-sdk` package instead. See https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk#streaming
   */
  format?: FORMAT;
  instructions: SystemMessage;
  memoryConfig?: MemoryConfig;
  memory?: MastraMemory;
}

export function createPrepareMemoryStep<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({
  capabilities,
  options,
  threadFromArgs,
  resourceId,
  runId,
  requestContext,
  instructions,
  memoryConfig,
  memory,
}: PrepareMemoryStepOptions<OUTPUT, FORMAT>) {
  return createStep({
    id: 'prepare-memory-step',
    inputSchema: z.object({}),
    outputSchema: prepareMemoryStepOutputSchema,
    execute: async ({ tracingContext }) => {
      const thread = threadFromArgs;
      const messageList = new MessageList({
        threadId: thread?.id,
        resourceId,
        generateMessageId: capabilities.generateMessageId,
        // @ts-ignore Flag for agent network messages
        _agentNetworkAppend: capabilities._agentNetworkAppend,
      });

      // Add instructions as system message(s)
      addSystemMessage(messageList, instructions);

      messageList.add(options.context || [], 'context');

      // Add user-provided system message if present
      addSystemMessage(messageList, options.system, 'user-provided');

      if (!memory || (!thread?.id && !resourceId)) {
        messageList.add(options.messages, 'input');
        const { tripwireTriggered, tripwireReason } = await capabilities.runInputProcessors({
          requestContext,
          tracingContext,
          messageList,
          inputProcessorOverrides: options.inputProcessors,
        });
        return {
          threadExists: false,
          thread: undefined,
          messageList,
          ...(tripwireTriggered && {
            tripwire: true,
            tripwireReason,
          }),
        };
      }

      if (!thread?.id || !resourceId) {
        const mastraError = new MastraError({
          id: 'AGENT_MEMORY_MISSING_RESOURCE_ID',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: capabilities.agentName,
            threadId: thread?.id || '',
            resourceId: resourceId || '',
          },
          text: `A resourceId and a threadId must be provided when using Memory. Saw threadId "${thread?.id}" and resourceId "${resourceId}"`,
        });
        capabilities.logger.error(mastraError.toString());
        capabilities.logger.trackException(mastraError);
        throw mastraError;
      }

      const store = memory.constructor.name;
      capabilities.logger.debug(
        `[Agent:${capabilities.agentName}] - Memory persistence enabled: store=${store}, resourceId=${resourceId}`,
        {
          runId,
          resourceId,
          threadId: thread?.id,
          memoryStore: store,
        },
      );

      let threadObject: StorageThreadType | undefined = undefined;
      const existingThread = await memory.getThreadById({ threadId: thread?.id });

      if (existingThread) {
        if (
          (!existingThread.metadata && thread.metadata) ||
          (thread.metadata && !deepEqual(existingThread.metadata, thread.metadata))
        ) {
          threadObject = await memory.saveThread({
            thread: { ...existingThread, metadata: thread.metadata },
            memoryConfig,
          });
        } else {
          threadObject = existingThread;
        }
      } else {
        threadObject = await memory.createThread({
          threadId: thread?.id,
          metadata: thread.metadata,
          title: thread.title,
          memoryConfig,
          resourceId,
          saveThread: false,
        });
      }

      // Set memory context in RequestContext for processors to access
      requestContext.set('MastraMemory', {
        thread: threadObject,
        resourceId,
        memoryConfig,
      });

      // Add user messages - memory processors will handle history/semantic recall/working memory
      messageList.add(options.messages, 'input');

      const { tripwireTriggered, tripwireReason } = await capabilities.runInputProcessors({
        requestContext,
        tracingContext,
        messageList,
        inputProcessorOverrides: options.inputProcessors,
      });

      // Add instructions as system message(s) to the existing messageList
      // which already contains processed historical messages from input processors
      addSystemMessage(messageList, instructions);

      messageList.add(options.context || [], 'context');

      // Add user-provided system message if present
      addSystemMessage(messageList, options.system, 'user-provided');

      return {
        thread: threadObject,
        messageList: messageList,
        ...(tripwireTriggered && {
          tripwire: true,
          tripwireReason,
        }),
        threadExists: !!existingThread,
      };
    },
  });
}

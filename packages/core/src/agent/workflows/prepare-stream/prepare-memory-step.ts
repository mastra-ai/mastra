import deepEqual from 'fast-deep-equal';
import { z } from 'zod';
import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import type { SystemMessage } from '../../../llm';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../../../memory/types';
import { resolveObservabilityContext } from '../../../observability';
import type { ProcessorState } from '../../../processors/runner';
import type { RequestContext } from '../../../request-context';
import { createStep } from '../../../workflows';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import { MessageList } from '../../message-list';
import type { AgentMethodType } from '../../types';
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

interface PrepareMemoryStepOptions<OUTPUT = undefined> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT>;
  threadFromArgs?: (Partial<StorageThreadType> & { id: string }) | undefined;
  resourceId?: string;
  runId: string;
  requestContext: RequestContext;
  methodType: AgentMethodType;
  instructions: SystemMessage;
  memoryConfig?: MemoryConfig;
  memory?: MastraMemory;
}

export function createPrepareMemoryStep<OUTPUT = undefined>({
  capabilities,
  options,
  threadFromArgs,
  resourceId,
  runId,
  requestContext,
  instructions,
  memoryConfig,
  memory,
}: PrepareMemoryStepOptions<OUTPUT>) {
  return createStep({
    id: 'prepare-memory-step',
    inputSchema: z.object({}),
    outputSchema: prepareMemoryStepOutputSchema,
    execute: async ({ ...rest }) => {
      const observabilityContext = resolveObservabilityContext(rest);
      const thread = threadFromArgs;
      const messageList = new MessageList({
        threadId: thread?.id,
        resourceId,
        generateMessageId: capabilities.generateMessageId,
        // @ts-expect-error Flag for agent network messages
        _agentNetworkAppend: capabilities._agentNetworkAppend,
      });

      // Create processorStates map - persists across loop iterations within this agent turn
      // Shared by all processor methods (input and output) for state sharing
      const processorStates = new Map<string, ProcessorState>();

      // Add instructions as system message(s)
      addSystemMessage(messageList, instructions);

      messageList.add(options.context || [], 'context');

      // Add user-provided system message if present
      addSystemMessage(messageList, options.system, 'user-provided');

      if (!memory || (!thread?.id && !resourceId)) {
        messageList.add(options.messages, 'input');
        const { tripwire } = await capabilities.runInputProcessors({
          requestContext,
          ...observabilityContext,
          messageList,
          inputProcessorOverrides: options.inputProcessors,
          processorStates,
        });
        return {
          threadExists: false,
          thread: undefined,
          messageList,
          processorStates,
          tripwire,
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
        // saveThread: true ensures the thread is persisted to the database immediately.
        // This is required because output processors (like MessageHistory) may call
        // saveMessages() before executeOnFinish(), and some storage backends (like PostgresStore)
        // validate that the thread exists before saving messages.
        threadObject = await memory.createThread({
          threadId: thread?.id,
          metadata: thread.metadata,
          title: thread.title,
          memoryConfig,
          resourceId,
          saveThread: true,
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

      const { tripwire } = await capabilities.runInputProcessors({
        requestContext,
        ...observabilityContext,
        messageList,
        inputProcessorOverrides: options.inputProcessors,
        processorStates,
      });

      return {
        thread: threadObject,
        messageList: messageList,
        processorStates,
        tripwire,
        threadExists: !!existingThread,
      };
    },
  });
}

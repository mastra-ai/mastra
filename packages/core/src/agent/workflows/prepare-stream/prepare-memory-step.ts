import deepEqual from 'fast-deep-equal';
import { z } from 'zod';
import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import type { SystemMessage } from '../../../llm';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../../../memory/types';
import type { Span, SpanType } from '../../../observability';
import type { RequestContext } from '../../../request-context';
import type { OutputSchema } from '../../../stream/base/schema';
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
  agentSpan: Span<SpanType.AGENT_RUN>;
  methodType: AgentMethodType;
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
        messageList.add(options.messages, 'user');
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

      const config = memory.getMergedThreadConfig(memoryConfig || {});
      const hasResourceScopeSemanticRecall =
        (typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope !== 'thread') ||
        config?.semanticRecall === true;
      let [memoryResult, memorySystemMessage] = await Promise.all([
        existingThread || hasResourceScopeSemanticRecall
          ? capabilities.getMemoryMessages({
              resourceId,
              threadId: threadObject.id,
              vectorMessageSearch: new MessageList().add(options.messages, `user`).getLatestUserContent() || '',
              memoryConfig,
              requestContext,
            })
          : { messages: [] },
        memory.getSystemMessage({
          threadId: threadObject.id,
          resourceId,
          memoryConfig: capabilities._agentNetworkAppend
            ? { ...memoryConfig, workingMemory: { enabled: false } }
            : memoryConfig,
        }),
      ]);

      const memoryMessages = memoryResult.messages;

      capabilities.logger.debug('Fetched messages from memory', {
        threadId: threadObject.id,
        runId,
        fetchedCount: memoryMessages.length,
      });

      // Handle messages from other threads
      const resultsFromOtherThreads = memoryMessages.filter((m: any) => m.threadId !== threadObject.id);
      if (resultsFromOtherThreads.length && !memorySystemMessage) {
        memorySystemMessage = ``;
      }
      if (resultsFromOtherThreads.length) {
        memorySystemMessage += `\nThe following messages were remembered from a different conversation:\n<remembered_from_other_conversation>\n${(() => {
          let result = ``;

          const messages = new MessageList().add(resultsFromOtherThreads, 'memory').get.all.v1();
          let lastYmd: string | null = null;
          for (const msg of messages) {
            const date = msg.createdAt;
            const year = date.getUTCFullYear();
            const month = date.toLocaleString('default', { month: 'short' });
            const day = date.getUTCDate();
            const ymd = `${year}, ${month}, ${day}`;
            const utcHour = date.getUTCHours();
            const utcMinute = date.getUTCMinutes();
            const hour12 = utcHour % 12 || 12;
            const ampm = utcHour < 12 ? 'AM' : 'PM';
            const timeofday = `${hour12}:${utcMinute < 10 ? '0' : ''}${utcMinute} ${ampm}`;

            if (!lastYmd || lastYmd !== ymd) {
              result += `\nthe following messages are from ${ymd}\n`;
            }
            result += `Message ${msg.threadId && msg.threadId !== threadObject.id ? 'from previous conversation' : ''} at ${timeofday}: ${JSON.stringify(msg)}`;

            lastYmd = ymd;
          }
          return result;
        })()}\n<end_remembered_from_other_conversation>`;
      }

      if (memorySystemMessage) {
        messageList.addSystem(memorySystemMessage, 'memory');
      }

      messageList
        .add(
          memoryMessages.filter((m: any) => m.threadId === threadObject.id),
          'memory',
        )
        .add(options.messages, 'user');

      const { tripwireTriggered, tripwireReason } = await capabilities.runInputProcessors({
        requestContext,
        tracingContext,
        messageList,
        inputProcessorOverrides: options.inputProcessors,
      });

      const systemMessages = messageList.getSystemMessages();

      const systemMessage =
        [...systemMessages, ...messageList.getSystemMessages('memory')]?.map((m: any) => m.content)?.join(`\n`) ??
        undefined;

      const processedMemoryMessages = await memory.processMessages({
        messages: messageList.get.remembered.v1() as any,
        newMessages: messageList.get.input.v1() as any,
        systemMessage,
        memorySystemMessage: memorySystemMessage || undefined,
      });

      const processedList = new MessageList({
        threadId: threadObject.id,
        resourceId,
        generateMessageId: capabilities.generateMessageId,
        // @ts-ignore Flag for agent network messages
        _agentNetworkAppend: capabilities._agentNetworkAppend,
      });

      // Add instructions as system message(s)
      addSystemMessage(processedList, instructions);

      processedList
        .addSystem(memorySystemMessage)
        .addSystem(systemMessages)
        .add(options.context || [], 'context');

      // Add user-provided system message if present
      addSystemMessage(processedList, options.system, 'user-provided');

      processedList.add(processedMemoryMessages, 'memory').add(messageList.get.input.db(), 'user');

      return {
        thread: threadObject,
        messageList: processedList,
        ...(tripwireTriggered && {
          tripwire: true,
          tripwireReason,
        }),
        threadExists: !!existingThread,
      };
    },
  });
}

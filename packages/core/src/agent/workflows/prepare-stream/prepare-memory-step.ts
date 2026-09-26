import deepEqual from 'fast-deep-equal';
import { z } from 'zod/v4';
import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import type { SystemMessage } from '../../../llm';
import type { MastraMemory } from '../../../memory/memory';
import { MemoryRunState } from '../../../memory/run-state';
import type { MemoryConfigInternal, StorageThreadType } from '../../../memory/types';
import { resolveObservabilityContext } from '../../../observability';
import type { ProcessorState } from '../../../processors/runner';
import type { RequestContext } from '../../../request-context';
import { createStep } from '../../../workflows/workflow';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import { assertThreadOwnedByResource } from '../../memory-thread-ownership';
import { MessageList } from '../../message-list';
import { mastraDBMessageToSignal } from '../../signals';
import type { AgentMethodType } from '../../types';
import type { PrepareStreamRunScope } from './run-scope';
import {
  INITIAL_SIGNAL_ECHOES_KEY,
  MEMORY_RUN_STATE_KEY,
  MESSAGE_LIST_KEY,
  PROCESSOR_STATES_KEY,
} from './run-scope-keys';
import type { AgentCapabilities } from './schema';
import { prepareMemoryStepOutputSchema } from './schema';

/**
 * On resume, input processors are not run against the real MessageList. Their
 * processInput system messages would otherwise be lost, changing the system
 * prompt (and busting prompt caches) after e.g. a tool approval. Run them on a
 * throwaway list holding only the current system messages, ignore tripwires and
 * non-system output, and copy over any system messages they added.
 */
async function replayInputProcessorSystemMessages({
  capabilities,
  requestContext,
  observabilityContext,
  messageList,
  inputProcessorOverrides,
}: {
  capabilities: AgentCapabilities;
  requestContext: RequestContext;
  observabilityContext: ReturnType<typeof resolveObservabilityContext>;
  messageList: MessageList;
  inputProcessorOverrides: InnerAgentExecutionOptions['inputProcessors'];
}): Promise<void> {
  const existingTagged = { ...messageList.getPersisted.taggedSystemMessages };
  const replayList = new MessageList();
  replayList.addSystem(messageList.getSystemMessages());
  for (const [tag, messages] of Object.entries(existingTagged)) {
    replayList.addSystem(messages, tag);
  }

  try {
    await capabilities.runInputProcessors({
      requestContext,
      ...observabilityContext,
      messageList: replayList,
      inputProcessorOverrides,
      processorStates: new Map<string, ProcessorState>(),
    });
  } catch (error) {
    capabilities.logger.debug('Failed to replay input processor system messages on resume', { error });
    return;
  }

  // Mirror the replayed buckets so replacements, removals and tags match a fresh run.
  messageList.replaceAllSystemMessages(replayList.getSystemMessages());
  const replayedTagged = replayList.getPersisted.taggedSystemMessages;
  for (const tag of new Set([...Object.keys(existingTagged), ...Object.keys(replayedTagged)])) {
    messageList.clearSystemMessages(tag);
    const messages = replayedTagged[tag];
    if (messages?.length) messageList.addSystem(messages, tag);
  }
}

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

function getInitialSignalEchoes(messageList: MessageList) {
  const inputMessageIds = messageList.makeMessageSourceChecker().input;
  return messageList.get.all
    .db()
    .filter(message => message.role === 'signal' && inputMessageIds.has(message.id))
    .map(mastraDBMessageToSignal);
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
  /** MCP server guidance to include as a separate system message. */
  mcpServerGuidance?: string;
  memoryConfig?: MemoryConfigInternal;
  memory?: MastraMemory;
  isResume?: boolean;
  runScope: PrepareStreamRunScope<OUTPUT>;
}

export function createPrepareMemoryStep<OUTPUT = undefined>({
  capabilities,
  options,
  threadFromArgs,
  resourceId,
  runId: _runId,
  requestContext,
  instructions,
  mcpServerGuidance,
  memoryConfig,
  memory,
  isResume,
  runScope,
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
        logger: capabilities.logger,
        filterIncompleteToolCalls: memoryConfig?.filterIncompleteToolCalls,
        // @ts-expect-error Flag for agent network messages
        _agentNetworkAppend: capabilities._agentNetworkAppend,
      });

      // Create processorStates map - persists across loop iterations within this agent turn
      // Shared by all processor methods (input and output) for state sharing
      const processorStates = new Map<string, ProcessorState>();

      // Add instructions as system message(s)
      addSystemMessage(messageList, instructions);

      // Add MCP server guidance as a separate system message so the base
      // instructions remain a stable prefix for prompt caching.
      addSystemMessage(messageList, mcpServerGuidance, 'mcp-guidance');

      messageList.add(options.context || [], 'context');

      // Add user-provided system message if present
      addSystemMessage(messageList, options.system, 'user-provided');

      if (!memory || (!thread?.id && !resourceId)) {
        messageList.add(options.messages, 'input');
        const initialSignalEchoes = getInitialSignalEchoes(messageList);

        // Don't run input processors on the real messageList during resume — it has no
        // user messages (resumeStream passes messages: []) and the real conversation state
        // lives in the workflow snapshot. Running processors on an empty messageList would
        // cause processors like TokenLimiterProcessor to throw a TripWire. Instead, replay
        // them on a throwaway list so the system messages they add are still sent.
        let tripwire;
        if (!isResume) {
          ({ tripwire } = await capabilities.runInputProcessors({
            requestContext,
            ...observabilityContext,
            messageList,
            inputProcessorOverrides: options.inputProcessors,
            processorStates,
          }));
        } else {
          await replayInputProcessorSystemMessages({
            capabilities,
            requestContext,
            observabilityContext,
            messageList,
            inputProcessorOverrides: options.inputProcessors,
          });
        }

        // Class instances (MessageList) and Maps (processorStates) live on the
        // factory closure's runScope instead of step outputs, because the evented
        // engine serializes step outputs via JSON and would strip them. CreatedAgentSignal
        // carries `toDataPart`/`toLLMMessage`/`toDBMessage` methods that would not survive.
        runScope.set(MESSAGE_LIST_KEY, messageList);
        runScope.set(PROCESSOR_STATES_KEY, processorStates);
        runScope.set(INITIAL_SIGNAL_ECHOES_KEY, initialSignalEchoes);
        return {
          threadExists: false,
          thread: thread as StorageThreadType | undefined,
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
        capabilities.logger.trackException(mastraError);
        throw mastraError;
      }

      let threadObject: StorageThreadType | undefined = undefined;
      const existingThread = await memory.getThreadById({ threadId: thread?.id });

      if (existingThread) {
        assertThreadOwnedByResource({
          thread: existingThread,
          resourceId,
          agentName: capabilities.agentName,
        });

        if (
          (!existingThread.metadata && thread.metadata) ||
          (thread.metadata && !deepEqual(existingThread.metadata, thread.metadata))
        ) {
          threadObject = await memory.saveThread({
            thread: { ...existingThread, metadata: { ...(existingThread.metadata ?? {}), ...thread.metadata } },
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

      const memoryRunState = new MemoryRunState({
        memory,
        threadId: thread.id,
        resourceId,
        thread: threadObject ?? null,
        ownershipValidated: true,
      });
      runScope.set(MEMORY_RUN_STATE_KEY, memoryRunState);

      // Set memory context in RequestContext for processors to access
      requestContext.set('MastraMemory', {
        thread: threadObject,
        resourceId,
        memoryConfig,
        runState: () => runScope.get(MEMORY_RUN_STATE_KEY),
      });

      // Add user messages - memory processors will handle history/semantic recall/working memory
      messageList.add(options.messages, 'input');
      const initialSignalEchoes = getInitialSignalEchoes(messageList);

      // On resume, don't run input processors on the real messageList (see the
      // no-memory branch above); only replay the system messages they add.
      let tripwire;
      if (!isResume) {
        ({ tripwire } = await capabilities.runInputProcessors({
          requestContext,
          ...observabilityContext,
          messageList,
          inputProcessorOverrides: options.inputProcessors,
          processorStates,
        }));
      } else {
        await replayInputProcessorSystemMessages({
          capabilities,
          requestContext,
          observabilityContext,
          messageList,
          inputProcessorOverrides: options.inputProcessors,
        });
      }

      runScope.set(MESSAGE_LIST_KEY, messageList);
      runScope.set(PROCESSOR_STATES_KEY, processorStates);
      runScope.set(INITIAL_SIGNAL_ECHOES_KEY, initialSignalEchoes);
      return {
        thread: threadObject,
        tripwire,
        threadExists: !!existingThread,
      };
    },
  });
}

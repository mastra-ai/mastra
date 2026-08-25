import type { IMastraLogger } from '../../../logger';
import { noopLogger } from '../../../logger/noop-logger';
import type { Mastra } from '../../../mastra';
import type { MastraMemory } from '../../../memory/memory';
import { createObservabilityContext } from '../../../observability';
import type { TracingContext } from '../../../observability';
import type { OutputResult } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import { RequestContext } from '../../../request-context';
import type { Agent } from '../../agent';
import { convertMessages, coreContentToString, MessageList } from '../../message-list';
import type { SerializedMessageListState } from '../../message-list/state';
import { globalRunRegistry } from '../run-registry';
import type { DurableAgenticWorkflowInput, RunRegistryEntry } from '../types';
import { resolveRuntimeDependencies } from '../utils/resolve-runtime';

type GenerateThreadTitleArgs = Parameters<NonNullable<RunRegistryEntry['generateThreadTitle']>>[0];
type AnyAgent = Agent<any, any, any, any>;

export interface DurableFinishSideEffectsOptions {
  runId: string;
  initData: DurableAgenticWorkflowInput;
  messageListState: SerializedMessageListState;
  mastra?: Mastra;
  requestContext?: RequestContext;
  tracingContext?: TracingContext;
  logger?: IMastraLogger;
  outputResult?: OutputResult;
}

export interface DurableFinishSideEffectsResult {
  messageListState: SerializedMessageListState;
  outputText: string;
}

function restoreRequestContext(
  entries: Record<string, unknown> | undefined,
  fallback: RequestContext | undefined,
): RequestContext {
  if (!entries) return fallback ?? new RequestContext();

  const restored = new RequestContext<unknown>(fallback?.entries());
  for (const [key, value] of Object.entries(entries)) restored.set(key, value);
  return restored;
}

function resolveOutputText(messageList: MessageList): string {
  const responseMessages = messageList.get.response.db();
  const hasCompletionCheckMessages = responseMessages.some(message => message.content?.metadata?.completionResult);
  if (hasCompletionCheckMessages) {
    const lastRealMessage = responseMessages.findLast(message => !message.content?.metadata?.completionResult);
    const converted = lastRealMessage ? convertMessages([lastRealMessage]).to('AIV4.Core') : [];
    const lastConverted = converted.at(-1);
    return lastConverted ? coreContentToString(lastConverted.content) : '';
  }

  const converted = messageList.get.response.aiV4.core();
  const lastResponseMessage = converted.at(-1);
  return lastResponseMessage ? coreContentToString(lastResponseMessage.content) : '';
}

/**
 * Run the side effects that happen after the durable agentic loop reaches its
 * terminal state. Every durable engine calls this before emitting its finish
 * event so remote workers provide the same behavior as the built-in engine.
 *
 * The returned state is the SAME MessageList that output processors mutated
 * and memory persistence flushed. Callers must use it in their final output;
 * rebuilding from the pre-processor state would discard redactions and other
 * processOutputResult changes.
 */
export async function runDurableFinishSideEffects({
  runId,
  initData,
  messageListState,
  mastra,
  requestContext,
  tracingContext,
  logger,
  outputResult,
}: DurableFinishSideEffectsOptions): Promise<DurableFinishSideEffectsResult> {
  const effectiveLogger = logger ?? mastra?.getLogger?.() ?? noopLogger;
  const durableState = initData.state;

  // A connect() worker has a separate process-local registry. Rebuild the
  // agent's runtime dependencies when the terminal step cannot see the
  // processor pipeline or the memory save queue prepared by stream().
  let registryEntry = globalRunRegistry.get(runId);
  // resolveRuntimeDependencies only writes its rebuild back into the registry when it
  // rehydrated from Mastra, so an already-hydrated entry that was seeded without a save
  // queue would still be missing one afterwards. Keep what it returns and prefer that.
  let rebuiltSaveQueueManager: RunRegistryEntry['saveQueueManager'] | undefined;
  let rebuiltMemory: MastraMemory | undefined;
  const needsProcessorRebuild = registryEntry?.outputProcessors === undefined;
  const needsMemoryRebuild = !!durableState?.threadId && !registryEntry?.saveQueueManager;
  if ((needsProcessorRebuild || needsMemoryRebuild) && mastra) {
    try {
      const resolved = await resolveRuntimeDependencies({
        mastra,
        runId,
        agentId: initData.agentId,
        input: initData,
        logger: effectiveLogger,
      });
      rebuiltSaveQueueManager = resolved.saveQueueManager;
      rebuiltMemory = resolved.memory;
      registryEntry = globalRunRegistry.get(runId);
    } catch (error) {
      effectiveLogger.error('[DurableAgent] Failed to rebuild finish-time dependencies', {
        agentId: initData.agentId,
        runId,
        error,
      });
    }
  }

  const effectiveRequestContext = restoreRequestContext(initData.requestContextEntries, requestContext);
  // Deserialize into the run's existing MessageList when there is one. MastraModelOutput
  // holds that instance and reads it during final processing, so swapping in a new one
  // would leave the stream reporting pre-processor messages.
  const messageList = (
    registryEntry?.messageList ??
    new MessageList({
      threadId: durableState?.threadId,
      resourceId: durableState?.resourceId,
    })
  ).deserialize(messageListState);
  if (registryEntry) {
    registryEntry.messageList = messageList;
  }

  // Keep this MessageList for every later phase. ProcessorRunner applies
  // returned message arrays back onto it, including removals and replacements.
  if (registryEntry?.outputProcessors?.length) {
    try {
      let agent: AnyAgent | undefined;
      if (mastra) {
        try {
          agent = mastra.getAgentById(initData.agentId);
        } catch {
          agent = undefined;
        }
      }

      const runner = new ProcessorRunner({
        inputProcessors: registryEntry.inputProcessors ?? [],
        outputProcessors: registryEntry.outputProcessors,
        errorProcessors: registryEntry.errorProcessors ?? [],
        logger: effectiveLogger,
        agentName: initData.agentName ?? initData.agentId,
        agent,
        processorStates: registryEntry.processorStates,
      });
      await runner.runOutputProcessors(
        messageList,
        createObservabilityContext(tracingContext),
        effectiveRequestContext,
        0,
        undefined,
        outputResult,
      );
    } catch (error) {
      effectiveLogger.warn('[DurableAgent] Error running output processors', { runId, error });
    }
  }

  // SaveQueueManager may reclassify flushed response messages as persisted
  // memory, so resolve the final response text before persistence runs.
  const outputText = resolveOutputText(messageList);

  const saveQueueManager = registryEntry?.saveQueueManager ?? rebuiltSaveQueueManager;
  const memory = registryEntry?.memory ?? rebuiltMemory;

  if (
    saveQueueManager &&
    memory &&
    durableState?.threadId &&
    durableState?.resourceId &&
    !durableState.observationalMemory &&
    !durableState.memoryConfig?.readOnly
  ) {
    try {
      if (!durableState.threadExists) {
        await memory.createThread?.({
          threadId: durableState.threadId,
          resourceId: durableState.resourceId,
          memoryConfig: durableState.memoryConfig,
        });
      }

      await saveQueueManager.flushMessages(messageList, durableState.threadId, durableState.memoryConfig);
    } catch (error) {
      effectiveLogger.error('[DurableAgent] Error persisting messages', {
        runId,
        threadId: durableState.threadId,
        error,
      });
    }
  }

  // Same exclusions as the persistence block above: an observational-memory run writes no
  // messages here, and titling it would create a thread row holding a title and nothing else.
  if (
    durableState?.threadId &&
    durableState?.resourceId &&
    !durableState.observationalMemory &&
    !durableState.memoryConfig?.readOnly
  ) {
    const titleArgs: GenerateThreadTitleArgs = {
      threadId: durableState.threadId,
      resourceId: durableState.resourceId,
      memoryConfig: durableState.memoryConfig,
      messageListState: messageList.serialize(),
      requestContext: effectiveRequestContext,
      tracingContext,
      logger: effectiveLogger,
    };

    try {
      if (registryEntry?.generateThreadTitle) {
        await registryEntry.generateThreadTitle(titleArgs);
      } else if (mastra) {
        const agent = mastra.getAgentById(initData.agentId);
        const titleMemory = memory ?? (await agent.getMemory({ requestContext: effectiveRequestContext }));
        if (titleMemory) {
          await generateDurableThreadTitle({ agent, memory: titleMemory, ...titleArgs });
        }
      }
    } catch (error) {
      effectiveLogger.warn('[DurableAgent] Error generating thread title', { runId, error });
    }
  }

  return {
    messageListState: messageList.serialize(),
    outputText,
  };
}

/**
 * Generate a durable thread title from messages belonging to that thread.
 * This is standalone so a remote worker can call it with the agent and memory
 * it rebuilt from its own Mastra instance.
 */
export async function generateDurableThreadTitle({
  agent,
  memory,
  threadId,
  resourceId,
  memoryConfig,
  messageListState,
  requestContext,
  tracingContext,
  logger,
}: GenerateThreadTitleArgs & { agent: AnyAgent; memory: MastraMemory }): Promise<void> {
  const thread = await memory.getThreadById({ threadId });
  const mergedConfig = memory.getMergedThreadConfig(memoryConfig);
  const { shouldGenerate, model, instructions, minMessages, emitEvent } = agent.resolveTitleGenerationConfig(
    mergedConfig.generateTitle,
  );
  if (!shouldGenerate || thread?.title) return;

  // Durable finalization has no stream writer, so the `data-thread-title` chunk
  // cannot be emitted here. The title is still generated and persisted.
  if (emitEvent) {
    logger?.warn(
      '[DurableAgent] generateTitle.emitEvent is not supported for durable agents yet; the title is persisted but no data-thread-title chunk is emitted',
      { threadId },
    );
  }

  const titleMessageList = new MessageList().deserialize(messageListState);
  const uiMessages = agent.filterUiMessagesByThread(titleMessageList, threadId, titleMessageList.get.all.ui());
  if (uiMessages.length < (minMessages ?? 1)) return;

  const userMessage = agent.getMostRecentUserMessage(uiMessages);
  if (!userMessage) return;

  const title = await agent.genTitle(
    userMessage,
    requestContext ?? new RequestContext(),
    createObservabilityContext(tracingContext),
    model,
    instructions,
    uiMessages,
  );
  if (!title) return;

  // genTitle is a model round trip, so another writer may have created the thread in the
  // meantime. Re-read before falling back to createThread, which upserts the whole row and
  // would drop metadata that writer stored.
  const currentThread = thread ?? (await memory.getThreadById({ threadId }));

  if (currentThread) {
    await memory.updateThread({
      id: threadId,
      title,
      metadata: currentThread.metadata ?? {},
      memoryConfig,
    });
  } else {
    await memory.createThread({
      threadId,
      resourceId,
      memoryConfig,
      title,
    });
  }
}

import { MastraFGAPermissions } from '../../../auth/ee';
import type { IMastraLogger } from '../../../logger';
import { noopLogger } from '../../../logger/noop-logger';
import type { Mastra } from '../../../mastra';
import type { MastraMemory } from '../../../memory/memory';
import { createObservabilityContext } from '../../../observability';
import type { TracingContext } from '../../../observability';
import type { OutputResult } from '../../../processors';
import { StructuredOutputProcessor } from '../../../processors/processors/structured-output';
import { ProcessorRunner } from '../../../processors/runner';
import { RequestContext } from '../../../request-context';
import { toStandardSchema } from '../../../schema';
import { createOutputHandler } from '../../../stream/base/output-format-handlers';
import type { ChunkType } from '../../../stream/types';
import type { Agent } from '../../agent';
import { convertMessages, coreContentToString, MessageList } from '../../message-list';
import type { SerializedMessageListState } from '../../message-list/state';
import { TripWire } from '../../trip-wire';
import type { StructuredOutputOptions } from '../../types';
import { authorizeDurableMemory, getDurableMemoryAuthorizationChecks } from '../memory-fga';
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
  titleGeneration?: Promise<void>;
  /** Chunks from the `structuredOutput.model` structuring pass, to publish before FINISH. */
  structuredOutputChunks?: ChunkType[];
  /** Set when an output processor aborted in processOutputResult; nothing was persisted. */
  tripwire?: {
    reason: string;
    processorId?: string;
    retry?: boolean;
    metadata?: unknown;
  };
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

  // The caller-side MastraModelOutput only sees the finish event after this step has
  // persisted messages, and remote/recovered runs have no caller at all. Attach the
  // validated object here so the saved assistant message matches plain Agent output.
  // Like Agent, this runs before output processors so processors that persist the turn
  // themselves (observational memory) save the object too.
  // This mirrors createObjectStreamTransformer's finalize: truncated finishes never validate,
  // and failures follow errorStrategy. Prefer the live config (keeps Zod refinements/transforms
  // and non-JSON fallback values). Remote and recovered runs only have the persisted config,
  // which is what cross-process observers use too.
  const structuredOutput = initData.options?.structuredOutput;
  const structuredOutputText = resolveOutputText(messageList);
  const liveStructuredOutput = registryEntry?.structuredOutput;
  const structuredOutputSchema = liveStructuredOutput?.schema ?? structuredOutput?.schema;
  let structuredOutputChunks: ChunkType[] | undefined;
  if (structuredOutputSchema && structuredOutputText.trim()) {
    const finishReason = outputResult?.finishReason;
    const truncated = finishReason === 'length' || finishReason === 'content-filter';
    const errorStrategy = liveStructuredOutput ? liveStructuredOutput.errorStrategy : structuredOutput?.errorStrategy;
    const fallbackValue = liveStructuredOutput ? liveStructuredOutput.fallbackValue : structuredOutput?.fallbackValue;
    let value: unknown;
    if (structuredOutput?.hasStructuringModel) {
      // Like Agent's StructuredOutputProcessor: the main model answered in text, so a
      // separate structuring model turns that answer into the object.
      const structuringModel = liveStructuredOutput?.model ?? structuredOutput.structuringModelConfig?.originalConfig;
      if (structuringModel && !truncated) {
        structuredOutputChunks = await runStructuringPass({
          options: {
            ...(liveStructuredOutput ?? {}),
            schema: liveStructuredOutput?.schema ?? toStandardSchema(structuredOutput.schema!),
            model: structuringModel as any,
            instructions: liveStructuredOutput?.instructions ?? structuredOutput.instructions,
            jsonPromptInjection: liveStructuredOutput?.jsonPromptInjection ?? structuredOutput.jsonPromptInjection,
            errorStrategy,
            fallbackValue,
          } as StructuredOutputOptions<any>,
          mastra,
          agentId: initData.agentId,
          messageList,
          requestContext: effectiveRequestContext,
          logger: effectiveLogger,
        });
        const objectChunk = structuredOutputChunks.findLast(chunk => chunk.type === 'object-result');
        value = objectChunk?.type === 'object-result' ? objectChunk.object : undefined;
      } else if (!structuringModel) {
        effectiveLogger.warn('[DurableAgent] structuredOutput.model is not available on this worker', { runId });
      }
    } else {
      const result = truncated
        ? undefined
        : await createOutputHandler({ schema: structuredOutputSchema }).validateAndTransformFinal(structuredOutputText);
      value = result?.success ? result.value : errorStrategy === 'fallback' ? fallbackValue : undefined;
    }
    const lastAssistantMessage = messageList.get.response
      .db()
      .findLast(message => message.role === 'assistant' && !message.content?.metadata?.completionResult);
    if (value !== undefined && lastAssistantMessage) {
      lastAssistantMessage.content.metadata = {
        ...lastAssistantMessage.content.metadata,
        structuredOutput: value,
      };
    }
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
      if (error instanceof TripWire) {
        // Match Agent: a tripwire rejects the answer, so skip persistence and title generation.
        return {
          messageListState: messageList.serialize(),
          outputText: resolveOutputText(messageList),
          tripwire: {
            reason: error.message,
            processorId: error.processorId,
            retry: error.options?.retry,
            metadata: error.options?.metadata,
          },
        };
      }
      effectiveLogger.warn('[DurableAgent] Error running output processors', { runId, error });
    }
  }

  // SaveQueueManager may reclassify flushed response messages as persisted
  // memory, so resolve the final response text before persistence runs.
  const outputText = resolveOutputText(messageList);

  const saveQueueManager = registryEntry?.saveQueueManager ?? rebuiltSaveQueueManager;
  const memory = registryEntry?.memory ?? rebuiltMemory;
  const authorizeMemory =
    durableState?.threadId && durableState.resourceId
      ? (permission: Parameters<typeof authorizeDurableMemory>[1]['permission']) =>
          authorizeDurableMemory(getDurableMemoryAuthorizationChecks(registryEntry), {
            mastra,
            user: effectiveRequestContext.get('user'),
            threadId: durableState.threadId!,
            resourceId: durableState.resourceId!,
            agentId: initData.agentId,
            requestContext: effectiveRequestContext,
            permission,
            actor: initData.options?.actor,
          })
      : undefined;

  if (
    saveQueueManager &&
    memory &&
    durableState?.threadId &&
    durableState?.resourceId &&
    !durableState.observationalMemory &&
    !durableState.memoryConfig?.readOnly
  ) {
    await authorizeMemory!(MastraFGAPermissions.MEMORY_WRITE);
    if (!durableState.threadExists) await authorizeMemory!(MastraFGAPermissions.MEMORY_READ);
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

  let titleGeneration: Promise<void> | undefined;

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
    };

    const generateThreadTitle = registryEntry?.generateThreadTitle;
    await authorizeMemory!(MastraFGAPermissions.MEMORY_READ);
    await authorizeMemory!(MastraFGAPermissions.MEMORY_WRITE);
    titleGeneration = (async () => {
      if (generateThreadTitle) {
        await generateThreadTitle(titleArgs);
      } else if (mastra) {
        const agent = mastra.getAgentById(initData.agentId);
        const titleMemory = memory ?? (await agent.getMemory({ requestContext: effectiveRequestContext }));
        if (titleMemory) {
          await generateDurableThreadTitle({ agent, memory: titleMemory, ...titleArgs });
        }
      }
    })().catch(error => {
      effectiveLogger.warn('[DurableAgent] Error generating thread title', { runId, error });
    });
  }

  return {
    messageListState: messageList.serialize(),
    outputText,
    titleGeneration,
    structuredOutputChunks,
  };
}

/**
 * Rebuild the chunks the structuring prompt reads (text, tool calls and results) from the
 * run's response messages; the durable finish step has no in-memory chunk history.
 */
function responseStreamParts(messageList: MessageList): ChunkType[] {
  const parts: ChunkType[] = [];
  for (const message of messageList.get.response.db()) {
    if (message.role !== 'assistant' || message.content?.metadata?.completionResult) continue;
    for (const part of message.content?.parts ?? []) {
      if (part.type === 'text') {
        parts.push({ type: 'text-delta', payload: { id: '', text: part.text } } as ChunkType);
      } else if (part.type === 'tool-invocation') {
        const { toolCallId, toolName, args } = part.toolInvocation;
        parts.push({ type: 'tool-call', payload: { toolCallId, toolName, args } } as ChunkType);
        if (part.toolInvocation.state === 'result') {
          parts.push({
            type: 'tool-result',
            payload: { toolCallId, toolName, result: part.toolInvocation.result },
          } as ChunkType);
        }
      }
    }
  }
  return parts;
}

/**
 * Run Agent's StructuredOutputProcessor once against the finished turn and collect the
 * chunks it would have streamed (object deltas and the final `object-result`).
 */
async function runStructuringPass({
  options,
  mastra,
  agentId,
  messageList,
  requestContext,
  logger,
}: {
  options: StructuredOutputOptions<any>;
  mastra?: Mastra;
  agentId: string;
  messageList: MessageList;
  requestContext: RequestContext;
  logger: IMastraLogger;
}): Promise<ChunkType[]> {
  const chunks: ChunkType[] = [];
  try {
    const processor = new StructuredOutputProcessor({ ...options, logger });
    if (mastra) {
      processor.__registerMastra(mastra);
      if (options.useAgent) {
        try {
          processor.setAgent(mastra.getAgentById(agentId) as AnyAgent);
        } catch {
          // Fall back to the processor's internal structuring agent.
        }
      }
    }
    const state: Record<string, unknown> = { controller: { enqueue: (chunk: ChunkType) => chunks.push(chunk) } };
    await processor.processOutputStream({
      part: { type: 'finish' } as ChunkType,
      state,
      streamParts: responseStreamParts(messageList),
      messageList,
      requestContext,
      abort: (() => {
        throw new Error('abort is not supported in the durable structuring pass');
      }) as any,
      retryCount: 0,
    } as any);
  } catch (error) {
    logger.error('[DurableAgent] Structured output structuring pass failed', { error });
  }
  return chunks;
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
}: GenerateThreadTitleArgs & { agent: AnyAgent; memory: MastraMemory }): Promise<void> {
  const thread = await memory.getThreadById({ threadId });
  const mergedConfig = memory.getMergedThreadConfig(memoryConfig);
  const { shouldGenerate, model, instructions, minMessages } = agent.resolveTitleGenerationConfig(
    mergedConfig.generateTitle,
  );
  if (!shouldGenerate || thread?.title) return;

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

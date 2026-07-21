import type { Mastra } from '../../../mastra';
import { createObservabilityContext } from '../../../observability';
import type { ExportedSpan, SpanType, TracingContext } from '../../../observability';
import { RequestContext } from '../../../request-context';
import { MessageList } from '../../message-list';
import { globalRunRegistry } from '../run-registry';
import type { DurableAgenticWorkflowInput } from '../types';

export interface DurableFinishSideEffectsOptions {
  /** Run identifier. */
  runId: string;
  /** The workflow's init data (carries agentId, thread/memory state, serialized options). */
  initData: DurableAgenticWorkflowInput;
  /** FINAL serialized MessageList state (the terminal iteration's, not the initial input's). */
  messageListState: DurableAgenticWorkflowInput['messageListState'];
  /** Mastra instance — required to rebuild runtime dependencies cross-process. */
  mastra?: Mastra;
  /** Request context of the terminal step (best-effort; a fresh one is used when absent). */
  requestContext?: RequestContext;
  /** Tracing context of the terminal step so processor spans parent correctly. */
  tracingContext?: TracingContext;
  /**
   * Exported AGENT_RUN span data for this run. When provided, finish-time spans
   * (processor_run and their memory_operation children) are parented under the
   * REBUILT agent span instead of `tracingContext`. The terminal step's own
   * tracing context is a workflow span that is marked internal (not exported) —
   * and on a remote worker belongs to a tree the driver never sees — so spans
   * parented to it are orphans: their parentSpanId resolves to nothing in
   * storage. Rebuilding from the serialized AGENT_RUN restores the same tree
   * shape as the non-durable agent (processor spans under agent run).
   */
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  logger?: { warn?: (...args: any[]) => void; debug?: (...args: any[]) => void; error?: (...args: any[]) => void };
}

/**
 * Finish-time side effects of a durable agent run — shared by every durable engine's
 * terminal step (core's `createDurableAgenticWorkflow` and `@mastra/inngest`'s
 * `createInngestDurableAgenticWorkflow`):
 *
 *   1. run output processors (processOutputResult),
 *   2. persist the conversation to memory (the `#executeOnFinish` equivalent),
 *   3. generate the thread title.
 *
 * All three read their dependencies from `globalRunRegistry`, which is populated by the
 * process that called `stream()`. With a remote-worker engine (`@mastra/inngest` connect())
 * the terminal step runs in a DIFFERENT process — and may even land on a different worker
 * than the LLM step whose own rebuild would have repopulated the entry. So this first
 * rebuilds the runtime dependencies via `resolveRuntimeDependencies` when the local entry
 * is missing or incomplete; the rebuild writes back into the registry (including the
 * SaveQueueManager), after which the guarded blocks below just work.
 *
 * Every block is individually fail-soft: an error is logged and the remaining blocks still
 * run — matching the non-durable agent, where a failed title generation does not lose the
 * persisted messages.
 */
export async function runDurableFinishSideEffects({
  runId,
  initData,
  messageListState,
  mastra,
  requestContext,
  tracingContext,
  agentSpanData,
  logger,
}: DurableFinishSideEffectsOptions): Promise<void> {
  // Rebuild runtime dependencies when the process-local registry entry is missing or
  // incomplete. Gated on threadId for the memory path but also run when output processors
  // are absent, so processor-only agents (no memory) still get their pipeline cross-process.
  {
    const existingEntry = globalRunRegistry.get(runId);
    const missingProcessors = !existingEntry?.outputProcessors;
    const missingSaveQueue = !!initData.state?.threadId && !existingEntry?.saveQueueManager;
    if ((missingProcessors || missingSaveQueue) && mastra) {
      try {
        const { resolveRuntimeDependencies } = await import('../utils/resolve-runtime');
        await resolveRuntimeDependencies({
          mastra,
          runId,
          agentId: initData.agentId,
          input: initData,
          logger,
        });
      } catch (error) {
        logger?.warn?.(`[DurableAgent] Error rebuilding runtime dependencies at finish: ${error}`);
      }
    }
  }

  const registryEntry = globalRunRegistry.get(runId);

  // Parent finish-time spans under the run's AGENT_RUN span. After a resume the
  // original agent span was ended as `suspended` and a resume span parked on the
  // registry — prefer that override, mirroring the span-ending logic in the
  // terminal steps. Falls back to the step's tracingContext when no span data is
  // available or the rebuild fails.
  let effectiveTracingContext = tracingContext;
  const spanData = (registryEntry as any)?.resumeAgentSpanData ?? agentSpanData;
  if (spanData && mastra) {
    try {
      const observability = (mastra as any).observability?.getSelectedInstance?.({ requestContext });
      const rebuiltAgentSpan = observability?.rebuildSpan?.(spanData);
      if (rebuiltAgentSpan) effectiveTracingContext = { currentSpan: rebuiltAgentSpan };
    } catch {
      /* fall back to the step's tracingContext */
    }
  }

  // Run output processors (processOutputResult) if available
  if (registryEntry?.outputProcessors?.length) {
    try {
      const { ProcessorRunner } = await import('../../../processors/runner');
      const runner = new ProcessorRunner({
        inputProcessors: registryEntry.inputProcessors ?? [],
        outputProcessors: registryEntry.outputProcessors,
        errorProcessors: registryEntry.errorProcessors ?? [],
        logger: logger as any,
        agentName: initData.agentName ?? initData.agentId,
        processorStates: registryEntry.processorStates,
      });
      const outputMessageList = new MessageList();
      outputMessageList.deserialize(messageListState);
      // Parent processor_run spans (and their MEMORY_OPERATION children) to the
      // rebuilt AGENT_RUN span so the tree matches the non-durable agent.
      await runner.runOutputProcessors(
        outputMessageList,
        createObservabilityContext(effectiveTracingContext),
        requestContext ?? new RequestContext(),
        0,
      );
    } catch (error) {
      logger?.warn?.(`[DurableAgent] Error running output processors: ${error}`);
    }
  }

  // Memory persistence (executeOnFinish equivalent)
  const durableState = initData.state;
  if (
    registryEntry?.saveQueueManager &&
    registryEntry.memory &&
    durableState?.threadId &&
    durableState?.resourceId &&
    !durableState.observationalMemory &&
    // Respect readOnly memory config ("read memory but don't save new
    // messages"). Mirrors the non-durable executeOnFinish `!readOnlyMemory`
    // guard and the MessageHistory output processor's readOnly check.
    !durableState.memoryConfig?.readOnly
  ) {
    try {
      const memoryMessageList = new MessageList();
      memoryMessageList.deserialize(messageListState);

      if (!durableState.threadExists) {
        await registryEntry.memory.createThread?.({
          threadId: durableState.threadId,
          resourceId: durableState.resourceId,
          memoryConfig: durableState.memoryConfig,
        });
      }

      await registryEntry.saveQueueManager.flushMessages(
        memoryMessageList,
        durableState.threadId,
        durableState.memoryConfig,
      );
    } catch (error) {
      logger?.warn?.(`[DurableAgent] Error persisting messages: ${error}`);
    }
  }

  // Thread title generation (executeOnFinish equivalent).
  //
  // Kept OUTSIDE the `!observationalMemory` guard above: OM handles its own message
  // persistence, but title generation is orthogonal and should still run when OM is on.
  //
  // Two paths: the in-process registry closure (parked during preparation), or —
  // when the closure is absent because this terminal step runs in a different
  // process (Inngest connect worker) — a direct call with the agent + memory
  // rebuilt from the Mastra instance. Title generation needs nothing else, so
  // the cross-process case no longer silently skips it.
  if (durableState?.threadId && durableState?.resourceId && !durableState.memoryConfig?.readOnly) {
    try {
      const titleArgs = {
        threadId: durableState.threadId,
        resourceId: durableState.resourceId,
        memoryConfig: durableState.memoryConfig,
        messageListState,
        requestContext,
        tracingContext: effectiveTracingContext,
      };
      if (registryEntry?.generateThreadTitle) {
        await registryEntry.generateThreadTitle(titleArgs);
      } else if (mastra) {
        const agent = (mastra as any).getAgentById?.(initData.agentId);
        const memory = registryEntry?.memory ?? (await agent?.getMemory?.({ requestContext }));
        if (agent && memory) {
          await generateDurableThreadTitle({ agent, memory, ...titleArgs });
        }
      }
    } catch (error) {
      logger?.warn?.(`[DurableAgent] Error generating thread title: ${error}`);
    }
  }
}

/**
 * Generate + persist a thread title from the run's first user message — the durable
 * equivalent of the non-durable `#executeOnFinish` title branch. No-op when the merged
 * memory config has no `generateTitle` or the thread already has a title.
 *
 * Standalone (agent + memory passed in, everything else serializable) so it works in
 * BOTH title paths: preparation parks a closure over it on the run registry for the
 * in-process engine, and `runDurableFinishSideEffects` calls it directly with the
 * rebuilt agent/memory on a cross-process worker.
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
}: {
  /** The agent (live instance or rebuilt from Mastra) — supplies the title model + prompts. */
  agent: any;
  /** The agent's resolved memory. */
  memory: any;
  threadId: string;
  resourceId: string;
  memoryConfig?: any;
  messageListState: DurableAgenticWorkflowInput['messageListState'];
  requestContext?: RequestContext;
  tracingContext?: TracingContext;
}): Promise<void> {
  // Re-read the thread so a title written mid-run isn't regenerated, and so we only
  // generate on the first turn (mirrors the non-durable `!thread.title` guard).
  const thread = await memory.getThreadById?.({ threadId });
  const mergedConfig = memory.getMergedThreadConfig?.(memoryConfig);
  const { shouldGenerate, model, instructions, minMessages } = agent.resolveTitleGenerationConfig(
    mergedConfig?.generateTitle,
  );
  if (!shouldGenerate || thread?.title) return;

  const titleMessageList = new MessageList().deserialize(messageListState);
  const uiMessages = titleMessageList.get.all.ui();
  const coreMessages = titleMessageList.get.all.core();
  if (coreMessages.length < (minMessages ?? 1)) return;

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

  // Title-only late write. Prefer updateThread when the thread record already exists
  // so its original createdAt is preserved (createThread rebuilds the record with a
  // fresh createdAt). Fall back to createThread for the first-turn case where the
  // record may not be persisted yet.
  if (thread) {
    await memory.updateThread({
      id: threadId,
      title,
      metadata: thread.metadata ?? {},
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

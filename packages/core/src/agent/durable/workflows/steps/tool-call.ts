import { z } from 'zod';
import { createBackgroundTask } from '../../../../background-tasks/create';
import { resolveBackgroundConfig } from '../../../../background-tasks/resolve-config';
import type { ToolBackgroundConfig } from '../../../../background-tasks/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../../error';
import type { PubSub } from '../../../../events/pubsub';
import { notifyToolDenied } from '../../../../loop/workflows/agentic-execution/tool-permission-notify';
import type { Mastra } from '../../../../mastra';
import type { MastraMemory } from '../../../../memory/memory';
import type { MemoryConfig } from '../../../../memory/types';
import { EntityType, SpanType, createObservabilityContext } from '../../../../observability';
import type { ExportedSpan, ObservabilityContext } from '../../../../observability';
import type { ProcessorState } from '../../../../processors';
import { ProcessorRunner, outputProcessorsSupportStream } from '../../../../processors/runner';
import type { RequestContext } from '../../../../request-context';
import type { ChunkType, ProviderMetadata } from '../../../../stream/types';
import { ChunkFrom } from '../../../../stream/types';
import { findProviderToolByName } from '../../../../tools/provider-tool-utils';
import type { CoreTool } from '../../../../tools/types';
import { ensureSerializable } from '../../../../utils';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { SuspendOptions } from '../../../../workflows/step';
import { createStep } from '../../../../workflows/workflow';
import { stopGoalActivity } from '../../../goal';
import type { MessageList } from '../../../message-list';
import type { SaveQueueManager } from '../../../save-queue';
import { resolveDeclineReason } from '../../../tool-approval';
import {
  createToolCallIdentityDigest,
  parseToolApprovalDecision,
  parseToolApprovalGrant,
} from '../../../tool-call-identity';
import {
  ON_BEFORE_TOOL_EXECUTION_KEY,
  ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY,
  TOOL_PERMISSION_DENIED_ERROR_NAME,
  TOOL_PERMISSION_POLICY_KEY,
  TOOL_PERMISSION_POLICY_REQUIRED_KEY,
} from '../../../tool-permission-prefilter';
import type {
  BeforeToolExecutionHook,
  ToolPermissionDecision,
  ToolPermissionPolicy,
} from '../../../tool-permission-prefilter';
import { createToolSurfaceFence, materializeToolSurfaceFence } from '../../../tool-surface-fence';
import { ensureRemoteAbortListener } from '../../abort-transport';
import { DurableStepIds } from '../../constants';
import { getBoundRunRegistryEntry, globalRunRegistry, markRunActive } from '../../run-registry';
import { emitSuspendedEvent, emitChunkEvent } from '../../stream-adapter';
import type {
  DurableToolCallInput,
  DurableAgenticWorkflowInput,
  SerializableDurableOptions,
  SerializableToolMetadata,
  AgentSuspendedEventData,
  RunRegistryEntry,
} from '../../types';
import { applyToolPayloadTransformToChunk } from '../../utils/apply-tool-payload-transform';
import {
  rebuildRunToolsFromMastra,
  resolveTool,
  restoreRequestContext,
  toolApprovalRequirement,
} from '../../utils/resolve-runtime';
import { serializeError } from '../../utils/serialize-state';
import {
  assertDurableToolHookPolicyAvailable,
  throwDurableToolHookPolicyUnavailable,
} from '../../utils/tool-hook-policy';
import { normalizeModelOutput } from './normalize-model-output';

/**
 * Input schema for the durable tool call step.
 * Each tool call flows through this schema when using .foreach()
 */
const durableToolCallInputSchema = z.object({
  iterationCount: z.number().int().nonnegative().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.any()),
  providerMetadata: z.record(z.string(), z.any()).optional(),
  providerExecuted: z.boolean().optional(),
  output: z.any().optional(),
  activeTools: z.array(z.string()).nullable().optional(),
  // Exported MODEL_STEP span so the TOOL_CALL nests under the LLM call
  stepSpanData: z.any().optional(),
});

/**
 * Output schema for the durable tool call step
 */
const durableToolCallOutputSchema = durableToolCallInputSchema.extend({
  resumeTargetToolCallId: z.string().optional(),
  result: z.any().optional(),
  serverExecuted: z.boolean().optional(),
  modelOutputComputed: z.boolean().optional(),
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  disposition: z.literal('denied').optional(),
  // Approval decision for a `requireApproval` tool. Without this field Zod would strip the
  // approval off the step output, so a declined call would lose its `output-denied` marker.
  approval: z
    .object({
      id: z.string(),
      approved: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
  delegationBailed: z.boolean().optional(),
});

/**
 * Flush messages to memory before suspending.
 * Mirrors the base Agent's flushMessagesBeforeSuspension() to ensure
 * the thread exists and all pending messages are persisted.
 *
 * Skips entirely when memoryConfig.readOnly is set, mirroring the readOnly
 * guard on the durable finish path — a readOnly run shouldn't get a thread
 * created or messages written just because it happened to suspend mid-run.
 */
async function flushMessagesBeforeSuspension({
  saveQueueManager,
  messageList,
  memory,
  threadId,
  resourceId,
  memoryConfig,
  threadExists,
  onThreadCreated,
}: {
  saveQueueManager?: SaveQueueManager;
  messageList?: MessageList;
  memory?: MastraMemory;
  threadId?: string;
  resourceId?: string;
  memoryConfig?: MemoryConfig;
  threadExists?: boolean;
  onThreadCreated?: () => void;
}) {
  if (!saveQueueManager || !messageList || !threadId || memoryConfig?.readOnly) {
    return;
  }

  try {
    // Ensure thread exists before flushing messages
    if (memory && !threadExists && resourceId) {
      const thread = await memory.getThreadById?.({ threadId });
      if (!thread) {
        await memory.createThread?.({
          threadId,
          resourceId,
          memoryConfig,
        });
      }
      onThreadCreated?.();
    }

    // Flush all pending messages immediately
    await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
  } catch {
    // Log but don't throw — suspension should proceed even if flush fails
  }
}

// Concurrent durable tool calls share processor-owned state. Serialize only
// their output-chunk pipeline so each chunk completes one span segment before
// the next starts, while the tool executions themselves remain concurrent.
const outputProcessorQueues = new WeakMap<RunRegistryEntry, Promise<void>>();

/**
 * Run a tool-result or tool-error chunk through the run's output processor pipeline.
 * Returns the processed chunk (possibly modified), or `null` if a processor blocked it
 * (in which case a tripwire chunk is emitted instead).
 *
 * Mirrors the regular agent's `processAndEnqueueChunk` in llm-mapping-step.ts.
 */
async function processChunkThroughOutputProcessors(
  chunk: ChunkType,
  registryEntry: RunRegistryEntry | undefined,
  pubsub: PubSub | undefined,
  runId: string,
  agentName: string,
  logger: any,
  messageList?: MessageList,
  observabilityContext?: ObservabilityContext,
): Promise<ChunkType | null> {
  if (!registryEntry?.processorStates) {
    return chunk;
  }

  const previous = outputProcessorQueues.get(registryEntry) ?? Promise.resolve();
  let releaseQueue!: () => void;
  const queueTail = new Promise<void>(resolve => {
    releaseQueue = resolve;
  });
  outputProcessorQueues.set(registryEntry, queueTail);
  await previous.catch(() => {});

  let runner: ProcessorRunner | null | undefined;
  try {
    if (registryEntry.outputProcessorRunner === undefined) {
      registryEntry.outputProcessorRunner = outputProcessorsSupportStream(registryEntry.outputProcessors)
        ? new ProcessorRunner({
            inputProcessors: [],
            outputProcessors: registryEntry.outputProcessors,
            logger,
            agentName,
            processorStates: registryEntry.processorStates,
          })
        : null;
    }
    runner = registryEntry.outputProcessorRunner;
    if (!runner) return chunk;

    let writer = registryEntry.outputProcessorWriter;
    if (pubsub && (!writer || writer.pubsub !== pubsub || writer.runId !== runId)) {
      writer = {
        pubsub,
        runId,
        writer: {
          async custom(data) {
            await emitChunkEvent(pubsub, runId, data as ChunkType);
          },
        },
      };
      registryEntry.outputProcessorWriter = writer;
    }

    // A durable tool chunk is a separate stream segment from the model
    // chunks surrounding it. Close any still-open model segment before the
    // processor state opens a span owned by this tool chunk.
    runner.endStreamProcessorSpans(registryEntry.processorStates as Map<string, ProcessorState>);

    const {
      part: processed,
      blocked,
      reason,
      tripwireOptions,
      processorId,
    } = await runner.processPart(
      chunk,
      registryEntry.processorStates as Map<string, ProcessorState>,
      observabilityContext,
      registryEntry.requestContext,
      messageList,
      0,
      pubsub ? writer?.writer : undefined,
    );

    if (blocked) {
      // Emit a tripwire chunk so downstream knows about the block
      if (pubsub) {
        await emitChunkEvent(pubsub, runId, {
          type: 'tripwire',
          payload: {
            reason: reason || 'Output processor blocked content',
            retry: tripwireOptions?.retry,
            metadata: tripwireOptions?.metadata,
            processorId,
          },
        } as ChunkType);
      }
      return null;
    }

    return (processed as ChunkType) ?? null;
  } catch (error) {
    logger?.warn?.(`[DurableAgent] Output processor error for tool chunk: ${error}`);
    // Fall through: emit the original chunk if processor fails
    return chunk;
  } finally {
    // The finish chunk that normally ends stream-processor spans never reaches
    // this pipeline, so end the spans opened for this chunk here.
    runner?.endStreamProcessorSpans(registryEntry.processorStates as Map<string, ProcessorState>);
    releaseQueue();
    if (outputProcessorQueues.get(registryEntry) === queueTail) {
      outputProcessorQueues.delete(registryEntry);
    }
  }
}

/**
 * Create a durable tool call step.
 *
 * This step mirrors the base Agent's createToolCallStep pattern:
 * 1. Resolves the tool from the run registry or Mastra
 * 2. Checks if approval is required (global or per-tool)
 * 3. If approval required, emits suspended event, persists messages, and suspends
 * 4. Executes the tool with a suspend callback for in-execution suspension
 * 5. Emits tool-result or tool-error chunks via PubSub
 * 6. Returns the result or error
 *
 * Tool suspension is handled via workflow suspend/resume mechanism:
 * - Tool approval: step suspends with approval payload
 * - In-execution suspension: tool calls suspend() callback, step suspends with suspension payload
 * - Message persistence: messages are flushed before any suspension
 */
export interface DurableToolPermissionResolverInput {
  runId: string;
  agentId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  requestContext: RequestContext | undefined;
  isResume: boolean;
}

export type DurableToolPermissionResolver = (
  input: DurableToolPermissionResolverInput,
) => ToolPermissionDecision | Promise<ToolPermissionDecision>;

export interface CreateDurableToolCallStepOptions {
  /**
   * Trusted worker-local policy resolver for engines that can replay on a
   * different process. The callback is code/configuration, never workflow
   * state. Throwing or returning an invalid decision fails closed as `deny`.
   */
  resolveToolPermission?: DurableToolPermissionResolver;
}

function normalizeToolPermissionDecision(candidate: unknown): ToolPermissionDecision {
  return candidate === 'allow' || candidate === 'ask' || candidate === 'deny' ? candidate : 'deny';
}

function combineToolPermissionDecisions(decisions: ToolPermissionDecision[]): ToolPermissionDecision | undefined {
  if (decisions.includes('deny')) return 'deny';
  if (decisions.includes('ask')) return 'ask';
  if (decisions.includes('allow')) return 'allow';
  return undefined;
}

export function createDurableToolCallStep(options: CreateDurableToolCallStepOptions = {}) {
  const { resolveToolPermission } = options;
  return createStep({
    id: DurableStepIds.TOOL_CALL,
    inputSchema: durableToolCallInputSchema,
    outputSchema: durableToolCallOutputSchema,
    execute: async params => {
      const {
        inputData,
        mastra,
        suspend,
        resumeData: workflowResumeData,
        suspendData,
        requestContext,
        actor,
        getInitData,
      } = params;

      // Access pubsub via symbol
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

      const typedInput = inputData as DurableToolCallInput;
      const {
        iterationCount = 0,
        toolCallId,
        toolName,
        args: rawArgs,
        providerExecuted,
        output,
        activeTools,
      } = typedInput;

      // Extract the model-facing resume controls before validating or executing the tool.
      // A fresh provider call gets a new toolCallId, so the original call and run IDs are
      // required to bind its resumeData to the exact persisted suspension.
      let resumeDataFromArgs: any = undefined;
      let suspendedToolCallId: string | undefined;
      let suppliedSuspendedToolRunId: string | undefined;
      let args: any = rawArgs;
      if (typeof rawArgs === 'object' && rawArgs !== null) {
        const {
          resumeData: resumeDataFromInput,
          suspendedToolCallId: suspendedToolCallIdFromInput,
          suspendedToolRunId: suspendedToolRunIdFromInput,
          ...argsFromInput
        } = rawArgs as Record<string, any>;
        args = argsFromInput;
        resumeDataFromArgs = resumeDataFromInput;
        if (resumeDataFromInput !== undefined && resumeDataFromInput !== null) {
          suspendedToolCallId =
            typeof suspendedToolCallIdFromInput === 'string' && suspendedToolCallIdFromInput.length > 0
              ? suspendedToolCallIdFromInput
              : undefined;
          suppliedSuspendedToolRunId =
            typeof suspendedToolRunIdFromInput === 'string' && suspendedToolRunIdFromInput.length > 0
              ? suspendedToolRunIdFromInput
              : undefined;
        }
      }
      const resumeData = resumeDataFromArgs ?? workflowResumeData;
      const isFreshTurnResume = resumeDataFromArgs !== undefined && resumeDataFromArgs !== null;
      const metadataToolCallId = suspendedToolCallId ?? toolCallId;

      // Get context from init data (the parent workflow input)
      const initData = getInitData<{
        runId: string;
        runtimeBindingId?: string;
        agentId: string;
        runtimeResolution?: 'registry-required';
        options: SerializableDurableOptions;
        toolsMetadata: SerializableToolMetadata[];
        messageListState: DurableAgenticWorkflowInput['messageListState'];
        state: {
          threadId?: string;
          resourceId?: string;
          memoryConfig?: MemoryConfig;
          threadExists?: boolean;
        };
        requestContextEntries?: Record<string, unknown>;
        agentSpanData?: unknown;
        modelSpanData?: unknown;
      }>();

      const { runId, runtimeBindingId, options: agentOptions, state } = initData;
      const logger = (mastra as any)?.getLogger?.();
      let registryEntry = getBoundRunRegistryEntry(runId, runtimeBindingId);
      assertDurableToolHookPolicyAvailable({
        serialized: agentOptions.toolHookPolicy,
        registryEntry,
      });
      if (agentOptions.toolHookPolicy !== undefined && !registryEntry?.tools) {
        throwDurableToolHookPolicyUnavailable();
      }
      const resumeIdentityDigest = createToolCallIdentityDigest({ toolCallId: metadataToolCallId, toolName, args });
      const identityDigest = createToolCallIdentityDigest({ toolCallId, toolName, args });

      // End the open MODEL_STEP + MODEL_GENERATION + AGENT_RUN as `suspended` before
      // pausing — stores persist only span-end events, so an un-ended root is dropped if
      // the run is never resumed. On resume a fresh root is opened (see DurableAgent.resume).
      const endSpansAsSuspended = (info: { toolCallId?: string; toolName?: string; reason?: string }) => {
        try {
          const obs = (mastra as Mastra | undefined)?.observability?.getSelectedInstance({ requestContext });
          if (!obs) return;
          const output = {
            status: 'suspended' as const,
            reason: info.reason,
            toolName: info.toolName,
            toolCallId: info.toolCallId,
          };
          // After a prior resume, end the resume spans (registry override) — they are the
          // active root for this segment. Otherwise end the threaded originals.
          const reg = globalRunRegistry.get(runId);
          const agentSpanData = reg?.resumeAgentSpanData ?? initData.agentSpanData;
          const modelSpanData = reg?.resumeModelSpanData ?? initData.modelSpanData;
          if (typedInput.stepSpanData) {
            obs.rebuildSpan(typedInput.stepSpanData as ExportedSpan<SpanType.MODEL_STEP>)?.end({ output });
          }
          if (modelSpanData) {
            obs.rebuildSpan(modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION>)?.end({ output });
          }
          if (agentSpanData) {
            obs.rebuildSpan(agentSpanData as ExportedSpan<SpanType.AGENT_RUN>)?.end({ output });
          }
        } catch (error) {
          // Span bookkeeping must never break suspension.
          logger?.warn?.(`[DurableAgent] Failed to end spans on suspend: ${error}`);
        }
      };

      // If the tool was already executed by the provider, return the output
      if (providerExecuted && output !== undefined) {
        return {
          ...typedInput,
          result: output,
        };
      }

      // 1. Resolve the tool from the binding-checked registry first. Built-in
      // durable runs fail closed if that exact runtime entry was lost.
      if (
        (!registryEntry || registryEntry.isPlaceholder === true) &&
        initData.runtimeResolution === 'registry-required'
      ) {
        throw new MastraError({
          id: 'DURABLE_AGENT_RUNTIME_REGISTRY_MISSING',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: `DurableAgent runtime dependencies are unavailable for run "${runId}". Resume the run through DurableAgent so recovery checks can restore them.`,
          details: { agentId: initData.agentId, runId },
        });
      }
      // Resolve by provider-tool
      // model-facing name (e.g. `web_search` resolves to `webSearch` when the
      // provider tool advertises the snake-case name), then by id, then fall
      // back to the Mastra-wide tool registry (exact name, provider-tool
      // name, then by id). Mirrors the non-durable tool-call step.
      // Replacement (fenced) runs skip every fallback stage: they dispatch only
      // from the immutable surface captured at preparation.
      if ((!registryEntry || registryEntry.isPlaceholder === true) && agentOptions.toolSurfaceFence !== undefined) {
        throw new Error(
          `[DurableAgent:${initData.agentId}] Cannot reconstruct replacement tool implementations for run ${runId} after the run registry was lost. Refusing to substitute backing-agent tools by name.`,
        );
      }
      if (pubsub) {
        try {
          await ensureRemoteAbortListener(pubsub, runId, runtimeBindingId);
        } catch (error) {
          logger?.warn?.('Failed to subscribe to cross-process abort requests', {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        registryEntry = getBoundRunRegistryEntry(runId, runtimeBindingId);
      }
      const replacementToolNames =
        agentOptions.toolSurfaceFence !== undefined ? new Set(agentOptions.toolSurfaceFence) : undefined;
      // For a replacement run, never dispatch from the mutable registry object.
      // Select from the immutable surface bound to the fenced originals captured at
      // preparation; fall back to re-materializing the fence when that surface is
      // unavailable. Either way an in-place processor mutation of `registryEntry.tools`
      // cannot swap the executable the model was shown a fenced original for.
      let toolSourceMap: Record<string, CoreTool> | undefined = registryEntry?.tools;
      if (registryEntry && replacementToolNames) {
        // Revalidate at the side-effect boundary. A crash/restart can resume
        // directly at this step after the LLM step's earlier validation, and this
        // rebuild also fails closed on a partial registry.
        toolSourceMap =
          registryEntry.replacementToolSurface ??
          (materializeToolSurfaceFence(createToolSurfaceFence(registryEntry.tools, replacementToolNames)) as Record<
            string,
            CoreTool
          >);
      }
      let tool = replacementToolNames?.has(toolName) === false ? undefined : toolSourceMap?.[toolName];
      const observability = (mastra as Mastra | undefined)?.observability?.getSelectedInstance({ requestContext });

      // Parent per-chunk processor spans under the active durable agent segment.
      const processorAgentSpanData = registryEntry?.resumeAgentSpanData ?? initData.agentSpanData;
      const processorAgentSpan =
        registryEntry?.resumeAgentSpan ??
        registryEntry?.agentSpan ??
        (processorAgentSpanData && observability
          ? observability.rebuildSpan(processorAgentSpanData as ExportedSpan<SpanType.AGENT_RUN>)
          : undefined);
      const processorObservabilityContext = processorAgentSpan
        ? createObservabilityContext({ currentSpan: processorAgentSpan })
        : undefined;
      let mastraTools: Record<string, any> | undefined;
      // Tools rebuilt from the Mastra instance when the per-process registry is
      // empty (cross-process worker). Populated lazily below; reused for
      // workspace/memory resolution further down.
      let rebuiltTools: Record<string, any> | undefined;
      let rebuiltWorkspace: any;
      let rebuiltMemory: any;
      let rebuiltSaveQueueManager: any;

      if (!tool && replacementToolNames === undefined) {
        tool = findProviderToolByName(toolSourceMap as any, toolName) as typeof tool;
      }

      if (!tool && replacementToolNames === undefined) {
        tool = Object.values(toolSourceMap ?? {}).find(
          (t: any) => t && typeof t === 'object' && 'id' in t && t.id === toolName,
        ) as typeof tool;
      }

      // Per-execution hooks are burned into the exact tool wrappers captured
      // at preparation. Falling back to a Mastra-wide or freshly rebuilt tool
      // here would execute outside that policy even when its marker matches.
      if (!tool && agentOptions.toolHookPolicy !== undefined) {
        throwDurableToolHookPolicyUnavailable();
      }

      if (!tool && replacementToolNames === undefined && initData.runtimeResolution !== 'registry-required') {
        tool = resolveTool(toolName, mastra as Mastra);
      }

      if (!tool && mastra && replacementToolNames === undefined && initData.runtimeResolution !== 'registry-required') {
        mastraTools = (mastra as Mastra).listTools?.() as Record<string, any> | undefined;
        if (mastraTools) {
          tool = findProviderToolByName(mastraTools as any, toolName) as typeof tool;
          if (!tool) {
            tool = Object.values(mastraTools).find(
              (t: any) => t && typeof t === 'object' && 'id' in t && t.id === toolName,
            ) as typeof tool;
          }
        }
      }

      // Cross-process fallback: workspace/skill tools are per-request closures
      // never registered at the Mastra-instance level, so the lookups above miss
      // them when the durable steps run on a separate process (e.g. the
      // @mastra/inngest connect() worker) whose registry is empty. Rebuild the
      // full toolset from the agent — the same rebuild the LLM step already does
      // via resolveRuntimeDependencies — and retry. This is the root-cause fix
      // for `ToolNotFoundError` on skill/mastra_workspace_* tools cross-process.
      // Replacement (fenced) runs never rebuild: caller-supplied replacement
      // implementations cannot be reconstructed from the backing agent. On a
      // remote worker, rebuilding is also the only way to obtain the save queue
      // needed to persist suspension metadata.
      const needsSaveQueueForFlush = !registryEntry?.saveQueueManager && !!state?.threadId;
      if (
        (!tool || needsSaveQueueForFlush) &&
        mastra &&
        replacementToolNames === undefined &&
        initData.runtimeResolution !== 'registry-required'
      ) {
        const rebuilt = await rebuildRunToolsFromMastra({
          mastra: mastra as Mastra,
          runId,
          agentId: initData.agentId,
          state: state as any,
          options: agentOptions,
          toolsMetadata: initData.toolsMetadata,
          messageListState: initData.messageListState,
          requestContextEntries: initData.requestContextEntries,
          requestContext,
          logger,
        });
        if (rebuilt) {
          rebuiltTools = rebuilt.tools;
          rebuiltWorkspace = rebuilt.workspace;
          rebuiltMemory = rebuilt.memory;
          rebuiltSaveQueueManager = rebuilt.saveQueueManager;
          // Keep an already-resolved tool: we may have rebuilt purely to obtain the
          // SaveQueueManager, and the registry's instance is the live per-request closure.
          if (!tool) {
            tool = rebuiltTools[toolName] as typeof tool;
          }
          if (!tool) {
            tool = findProviderToolByName(rebuiltTools as any, toolName) as typeof tool;
          }
          if (!tool) {
            tool = Object.values(rebuiltTools).find(
              (t: any) => t && typeof t === 'object' && 'id' in t && t.id === toolName,
            ) as typeof tool;
          }
        }
      }

      // Resolve the key the tool is registered under for activeTools filtering.
      // Prefer the per-run tool source key (exact name then identity match),
      // and fall back to the Mastra-wide registry when the tool was resolved
      // there. Without this fallback, a globally-registered tool like
      // `webSearch` invoked by its model-facing name `web_search` would be
      // hidden whenever `activeTools` was set, because the key from
      // the per-run tool source would be `undefined`.
      const toolKey =
        toolSourceMap?.[toolName] || rebuiltTools?.[toolName]
          ? toolName
          : (Object.entries(toolSourceMap ?? {}).find(([, registeredTool]) => registeredTool === tool)?.[0] ??
            Object.entries(rebuiltTools ?? {}).find(([, registeredTool]) => registeredTool === tool)?.[0] ??
            Object.entries(mastraTools ?? {}).find(([, registeredTool]) => registeredTool === tool)?.[0]);
      const effectiveActiveTools = activeTools === null ? undefined : (activeTools ?? agentOptions.activeTools);
      const activeToolKey = toolKey ?? toolName;
      const isHiddenByActiveTools = effectiveActiveTools !== undefined && !effectiveActiveTools.includes(activeToolKey);

      if (!tool || isHiddenByActiveTools) {
        const registeredToolNames = Object.keys(rebuiltTools ?? toolSourceMap ?? {});
        const fenceScopedToolNames =
          replacementToolNames === undefined
            ? registeredToolNames
            : registeredToolNames.filter(name => replacementToolNames.has(name));
        const availableToolNames =
          effectiveActiveTools === undefined
            ? fenceScopedToolNames
            : replacementToolNames === undefined
              ? effectiveActiveTools
              : effectiveActiveTools.filter(name => replacementToolNames.has(name));
        const availableToolsStr =
          availableToolNames.length > 0 ? ` Available tools: ${availableToolNames.join(', ')}` : '';
        const error = {
          name: 'ToolNotFoundError',
          message: `Tool "${toolName}" not found.${availableToolsStr}. Call tools by their exact name only — never add prefixes, namespaces, or colons.`,
        };
        if (pubsub) {
          await emitChunkEvent(pubsub, runId, {
            type: 'tool-error',
            runId,
            from: ChunkFrom.AGENT,
            payload: { toolCallId, toolName, args, error },
          });
        }
        return {
          ...typedInput,
          error,
        };
      }

      // Get memory-related state for message persistence. Fall back to the
      // values rebuilt from Mastra above (cross-process worker), so workspace
      // tools receive their `workspace` and message flushing still works.
      const saveQueueManager = registryEntry?.saveQueueManager ?? rebuiltSaveQueueManager;
      const memory = registryEntry?.memory ?? rebuiltMemory;
      const workspace = registryEntry?.workspace ?? rebuiltWorkspace;
      let threadExists = state?.threadExists ?? false;

      // Reconstruct MessageList from workflow state if available
      // Note: In foreach mode, the message list from the registry may be available
      // but for durability, we access what's available through the registry
      let messageList: MessageList | undefined;
      // For local execution, the bound global entry may be an ExtendedRunRegistry entry
      // that stores the MessageList. Reuse the already binding-checked value.
      const extendedEntry = registryEntry as any;
      if (extendedEntry?.messageList) {
        messageList = extendedEntry.messageList;
      }

      const doFlush = async () => {
        await flushMessagesBeforeSuspension({
          saveQueueManager,
          messageList,
          memory,
          threadId: state?.threadId,
          resourceId: state?.resourceId,
          memoryConfig: state?.memoryConfig,
          threadExists,
          onThreadCreated: () => {
            threadExists = true;
          },
        });
      };

      const workflowSuspendRecord =
        suspendData && typeof suspendData === 'object' && !Array.isArray(suspendData)
          ? (suspendData as Record<string, unknown>)
          : undefined;

      // A model-generated resume happens in a new workflow run, so its workflow
      // suspendData cannot authenticate the earlier call. Read only the exact original
      // call ID from persisted assistant metadata; never fall back by tool name.
      const getStoredSuspendRecord = (originalToolCallId: string): Record<string, unknown> | undefined => {
        if (!messageList) return undefined;
        const assistantMessages = [...messageList.get.all.db()]
          .reverse()
          .filter(message => message.role === 'assistant');
        for (const message of assistantMessages) {
          const metadata =
            typeof message.content.metadata === 'object' && message.content.metadata !== null
              ? (message.content.metadata as Record<string, any>)
              : undefined;
          for (const metadataKey of ['pendingToolApprovals', 'suspendedTools'] as const) {
            const entry = metadata?.[metadataKey]?.[originalToolCallId];
            if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
              return entry as Record<string, unknown>;
            }
          }

          const part = message.content.parts?.find(candidate => {
            if (!('data' in candidate)) return false;
            return (
              (candidate.type === 'data-tool-call-approval' || candidate.type === 'data-tool-call-suspended') &&
              (candidate.data as { toolCallId?: unknown; resumed?: unknown }).toolCallId === originalToolCallId &&
              !(candidate.data as { resumed?: unknown }).resumed
            );
          });
          const partData = part && 'data' in part ? part.data : undefined;
          if (partData && typeof partData === 'object' && !Array.isArray(partData)) {
            return partData as Record<string, unknown>;
          }
        }
        return undefined;
      };

      const storedSuspendRecord =
        isFreshTurnResume && suspendedToolCallId ? getStoredSuspendRecord(suspendedToolCallId) : undefined;
      const suspendRecord = isFreshTurnResume ? storedSuspendRecord : workflowSuspendRecord;
      const suspensionType = suspendRecord?.type;
      const hasKnownSuspendType = suspensionType === 'approval' || suspensionType === 'suspension';
      const hasCommonSuspendIdentity =
        suspendRecord !== undefined &&
        suspendRecord.version === 1 &&
        suspendRecord.stepId === DurableStepIds.TOOL_CALL &&
        suspendRecord.toolCallId === metadataToolCallId &&
        suspendRecord.toolName === toolName;
      const hasMatchingFreshTurnIdentity =
        isFreshTurnResume &&
        suspendedToolCallId !== undefined &&
        suppliedSuspendedToolRunId !== undefined &&
        hasCommonSuspendIdentity &&
        suspendRecord?.originRunId === suppliedSuspendedToolRunId &&
        suspendRecord.runId === suppliedSuspendedToolRunId &&
        typeof suspendRecord.iterationCount === 'number' &&
        Number.isInteger(suspendRecord.iterationCount) &&
        suspendRecord.iterationCount >= 0 &&
        suspendRecord.identityDigest === resumeIdentityDigest;
      const hasMatchingWorkflowIdentity =
        !isFreshTurnResume &&
        hasCommonSuspendIdentity &&
        suspendRecord?.runId === runId &&
        suspendRecord.iterationCount === iterationCount &&
        suspendRecord.identityDigest === identityDigest;
      const hasMatchingSuspendIdentity = hasMatchingFreshTurnIdentity || hasMatchingWorkflowIdentity;
      const hasResumeAttempt =
        isFreshTurnResume || workflowResumeData !== undefined || workflowSuspendRecord !== undefined;
      const hasInvalidSuspendEnvelope = hasResumeAttempt && (!hasKnownSuspendType || !hasMatchingSuspendIdentity);
      const isAuthenticatedResume = hasMatchingSuspendIdentity;
      const isApprovalResume = suspensionType === 'approval' && hasMatchingSuspendIdentity;
      const approvalDecision = parseToolApprovalDecision(resumeData);
      const hasValidApprovalDecision = isApprovalResume && approvalDecision !== undefined;
      const isToolExecutionApprovalResume =
        hasValidApprovalDecision && suspendRecord?.approvalSource === 'tool-execution';
      const persistedApprovalGrant =
        suspensionType === 'suspension' && hasMatchingSuspendIdentity
          ? parseToolApprovalGrant(suspendRecord?.approval, metadataToolCallId)
          : undefined;

      // 2. Approval policy input. Prefer the live policy on the in-process
      //    registry (which preserves the function form with real
      //    toolName/args); fall back to the JSON-safe boolean shadow on the
      //    serialized workflow input for cross-process engines.
      const registryRequireToolApproval = registryEntry?.requireToolApproval;
      const effectiveRequireToolApproval =
        registryRequireToolApproval !== undefined ? registryRequireToolApproval : agentOptions.requireToolApproval;
      // Preserve approval context across cross-process execution and restarts.
      const approvalRequestContext =
        registryEntry?.requestContext ?? restoreRequestContext(initData.requestContextEntries, requestContext);

      // Add suspended-tool / pending-approval metadata to the last assistant
      // message so `extractSuspendedToolsFromMessages` can detect it on the
      // next turn (autoResumeSuspendedTools) or on page-refresh resume.
      // Mirrors the regular agent's `addToolMetadata()`.
      const addToolMetadata = (opts: {
        type: 'approval' | 'suspension';
        approvalSource?: 'tool-gate' | 'tool-execution';
        approval?: { id: string; approved: boolean; reason?: string };
        resumeSchema?: string;
        suspendPayload?: unknown;
        delegatedRunId?: string;
        approvalToolName?: string;
        approvalArgs?: unknown;
      }) => {
        if (!messageList) return;
        const metadataKey = opts.type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';
        const entry = {
          version: 1,
          originRunId: runId,
          stepId: DurableStepIds.TOOL_CALL,
          iterationCount,
          toolCallId,
          toolName: opts.approvalToolName ?? toolName,
          identityDigest,
          args: opts.approvalArgs ?? args,
          ...(opts.approvalToolName ? { parentToolName: toolName, parentArgs: args } : {}),
          type: opts.type,
          // `runId` is the outer resumable durable run. When a delegated
          // sub-agent/workflow suspends, its inner suspended run is preserved
          // separately as `delegatedRunId` so the resume leg can recover it
          // (mirrors the regular engine's tool-call-step metadata shape).
          runId,
          ...(opts.approvalSource ? { approvalSource: opts.approvalSource } : {}),
          ...(opts.approval ? { approval: opts.approval } : {}),
          ...(opts.delegatedRunId && opts.delegatedRunId !== runId ? { delegatedRunId: opts.delegatedRunId } : {}),
          ...(opts.type === 'suspension' ? { suspendPayload: opts.suspendPayload } : {}),
          ...(opts.resumeSchema ? { resumeSchema: opts.resumeSchema } : {}),
        };

        const carriesToolCall = (msg: any) =>
          msg.role === 'assistant' &&
          (msg.content?.parts ?? []).some(
            (part: any) => part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId,
          );

        const responseMessages = messageList.get.response.db();
        const lastAssistantMessage = [...responseMessages].reverse().find(carriesToolCall);
        if (lastAssistantMessage?.content) {
          let metadata: Record<string, any>;
          if (
            typeof lastAssistantMessage.content.metadata === 'object' &&
            lastAssistantMessage.content.metadata !== null
          ) {
            metadata = lastAssistantMessage.content.metadata as Record<string, any>;
          } else {
            metadata = {};
            lastAssistantMessage.content.metadata = metadata;
          }
          metadata[metadataKey] = metadata[metadataKey] || {};
          metadata[metadataKey][toolCallId] = entry;
          return;
        }

        // The response view is empty: a sibling parallel tool call already
        // suspended and its pre-suspension flush drained the unsaved response
        // messages. Without a fallback this sibling's entry is silently lost
        // and only the first suspension survives in persisted metadata. Merge
        // the entry into the assistant message that carries this tool call via
        // updateMessageMetadataByToolCallId, which also re-marks the message
        // unsaved so the following flush persists this write too.
        const allMessages = messageList.get.all.db();
        const target = [...allMessages].reverse().find(carriesToolCall);
        if (!target?.content) {
          logger?.warn?.(
            `[DurableAgent] addToolMetadata could not find an assistant message for tool call ${toolCallId} (${toolName}); ${metadataKey} entry was not persisted.`,
          );
          return;
        }
        const existingMeta =
          typeof target.content.metadata === 'object' && target.content.metadata !== null
            ? (target.content.metadata as Record<string, any>)
            : {};
        const existingEntries = (existingMeta[metadataKey] ?? {}) as Record<string, any>;
        messageList.updateMessageMetadataByToolCallId(toolCallId, {
          [metadataKey]: { ...existingEntries, [toolCallId]: entry },
        });
      };

      // Remove suspended-tool / pending-approval metadata from the last
      // assistant message when a tool is being resumed. This mirrors the
      // regular agent's `removeToolMetadata()`.
      const removeToolMetadata = async (type: 'suspension' | 'approval') => {
        if (!messageList) return;
        const metadataKey = type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';
        const allMessages = messageList.get.all.db();
        const lastAssistantMessage = [...allMessages].reverse().find(msg => {
          const content = msg.content;
          if (!content) return false;
          const meta =
            typeof content.metadata === 'object' && content.metadata !== null
              ? (content.metadata as Record<string, any>)
              : undefined;
          return !!meta?.[metadataKey]?.[metadataToolCallId];
        });
        if (!lastAssistantMessage?.content) return;
        const meta =
          typeof lastAssistantMessage.content.metadata === 'object' && lastAssistantMessage.content.metadata !== null
            ? (lastAssistantMessage.content.metadata as Record<string, any>)
            : undefined;
        if (!meta?.[metadataKey]) return;
        // Resume authentication is call-ID based. Remove only the exact persisted entry.
        const entries = meta[metadataKey] as Record<string, any>;
        const key = entries[metadataToolCallId] ? metadataToolCallId : undefined;
        if (key) {
          delete entries[key];
          if (Object.keys(entries).length === 0) {
            delete meta[metadataKey];
          }
        }
        // Flush to persist the metadata removal
        await doFlush();
      };

      // Authenticate durable resume evidence before reevaluating dynamic policy or dispatching work.
      if (hasInvalidSuspendEnvelope || (isApprovalResume && !hasValidApprovalDecision)) {
        return {
          ...typedInput,
          error: {
            name: 'DurableResumeValidationError',
            message: 'Durable tool resume evidence did not match the suspended tool call',
          },
        };
      }

      if (isApprovalResume && approvalDecision?.editedArgs !== undefined) {
        return {
          ...typedInput,
          error: {
            name: 'DurableResumeValidationError',
            message: 'Edited approval arguments are not supported by durable agents',
          },
        };
      }

      const resumeTarget = metadataToolCallId !== toolCallId ? { resumeTargetToolCallId: metadataToolCallId } : {};

      if (hasValidApprovalDecision && approvalDecision.approved === false) {
        // Remove pending-approval metadata since we're resuming with a decision.
        await removeToolMetadata('approval');
        const approval = {
          id: metadataToolCallId,
          approved: false as const,
          reason: approvalDecision.reason ?? resolveDeclineReason(resumeData),
        };
        if (pubsub) {
          try {
            const deniedChunk = await applyToolPayloadTransformToChunk(
              {
                type: 'tool-output-denied' as const,
                runId,
                from: ChunkFrom.AGENT,
                payload: { toolCallId: metadataToolCallId, toolName, args, approval },
              },
              {
                policy: registryEntry?.toolPayloadTransform,
                tools: registryEntry?.tools,
                logger: logger as any,
              },
            );
            const processed = await processChunkThroughOutputProcessors(
              deniedChunk as ChunkType,
              registryEntry,
              pubsub,
              runId,
              initData.agentId,
              logger,
              messageList,
              processorObservabilityContext,
            );
            if (processed) await emitChunkEvent(pubsub, runId, processed);
          } catch (emitError) {
            logger?.warn?.(`[DurableAgent] Failed to emit tool-output-denied chunk for ${toolName}: ${emitError}`);
          }
        }
        return {
          ...typedInput,
          args,
          ...resumeTarget,
          approval,
        };
      }

      // Re-evaluate the host's per-tool policy at the side-effect boundary on
      // every attempt, including an approved resume. A durable snapshot stores
      // only `permissionPolicyRequired`; it never stores an allow/ask decision.
      // Resume must use the newly supplied RequestContext so a parked `ask` can
      // become `deny`. The original registry context is a valid fallback only
      // for a fresh in-process call, never for a resume where it may be stale.
      const requestPermissionPolicy = requestContext?.get?.(TOOL_PERMISSION_POLICY_KEY);
      const registryPermissionPolicy = !isAuthenticatedResume
        ? registryEntry?.requestContext?.get(TOOL_PERMISSION_POLICY_KEY)
        : undefined;
      const permissionPolicy =
        typeof requestPermissionPolicy === 'function'
          ? (requestPermissionPolicy as ToolPermissionPolicy)
          : typeof registryPermissionPolicy === 'function'
            ? (registryPermissionPolicy as ToolPermissionPolicy)
            : undefined;
      // The revalidation hook resolves through the same request→registry
      // fallback, INDEPENDENTLY of the policy: a hook-only configuration must
      // still find the registry-held closure when a transported context
      // arrives with functions stripped.
      const requestOnBeforeToolExecution = requestContext?.get?.(ON_BEFORE_TOOL_EXECUTION_KEY);
      const registryOnBeforeToolExecution = !isAuthenticatedResume
        ? registryEntry?.requestContext?.get(ON_BEFORE_TOOL_EXECUTION_KEY)
        : undefined;
      const onBeforeToolExecution =
        typeof requestOnBeforeToolExecution === 'function'
          ? (requestOnBeforeToolExecution as BeforeToolExecutionHook)
          : typeof registryOnBeforeToolExecution === 'function'
            ? (registryOnBeforeToolExecution as BeforeToolExecutionHook)
            : undefined;
      const permissionContext =
        typeof requestPermissionPolicy === 'function' || typeof requestOnBeforeToolExecution === 'function'
          ? requestContext
          : typeof registryPermissionPolicy === 'function' || typeof registryOnBeforeToolExecution === 'function'
            ? registryEntry?.requestContext
            : requestContext;
      const toolPermissionDecisions: ToolPermissionDecision[] = [];
      let snapshotPolicyDecision: ToolPermissionDecision | undefined;
      if (permissionPolicy) {
        try {
          snapshotPolicyDecision = normalizeToolPermissionDecision(await permissionPolicy(toolName));
          toolPermissionDecisions.push(snapshotPolicyDecision);
        } catch {
          toolPermissionDecisions.push('deny');
        }
      }
      if (resolveToolPermission) {
        try {
          toolPermissionDecisions.push(
            normalizeToolPermissionDecision(
              await resolveToolPermission({
                runId,
                agentId: initData.agentId,
                toolCallId: metadataToolCallId,
                toolName,
                args,
                requestContext,
                isResume: isAuthenticatedResume,
              }),
            ),
          );
        } catch {
          toolPermissionDecisions.push('deny');
        }
      }
      // §4.2e per-tool revalidation — the harness `sessions.onBeforeToolExecution`
      // hook is threaded on the request context (a session-bound closure, not
      // durable state, so it only survives in-process replay like the policy
      // resolver). Throwing or an unrecognized decision fails closed as `deny`.
      if (typeof onBeforeToolExecution === 'function') {
        try {
          const beforeDecision = await onBeforeToolExecution({
            toolName,
            toolCallId: metadataToolCallId,
            args,
            isResume: isAuthenticatedResume,
            policyDecision: snapshotPolicyDecision,
          });
          if (beforeDecision !== undefined && beforeDecision !== 'allow') {
            toolPermissionDecisions.push('deny');
          }
        } catch {
          toolPermissionDecisions.push('deny');
        }
      } else if (
        agentOptions.onBeforeToolExecutionRequired === true ||
        requestContext?.get?.(ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY) === true ||
        registryEntry?.requestContext?.get?.(ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY) === true
      ) {
        // A hook that was threaded at turn-build cannot be reconstructed on this
        // context (transported or restored request context, cold worker). Like
        // `permissionPolicyRequired` below, that is an authorization failure,
        // not an implicit allow.
        toolPermissionDecisions.push('deny');
      }
      // The awaited hook can span real I/O (e.g. a grant-store read). A run
      // aborted inside that window must not proceed to approval or dispatch —
      // mirror the in-flight abort outcome (an error result; the loop's abort
      // arbitration stops the iteration with finishReason 'abort').
      if (registryEntry?.abortSignal?.aborted) {
        return {
          ...typedInput,
          args,
          ...resumeTarget,
          error: serializeError(
            (registryEntry.abortSignal as AbortSignal & { reason?: unknown }).reason ??
              new DOMException('The operation was aborted.', 'AbortError'),
          ),
        };
      }
      if (
        toolPermissionDecisions.length === 0 &&
        (agentOptions.permissionPolicyRequired === true ||
          requestContext?.get?.(TOOL_PERMISSION_POLICY_REQUIRED_KEY) === true)
      ) {
        // A configured policy that cannot be reconstructed is an authorization
        // failure, not an implicit allow. This is the cold Inngest/restart seam.
        toolPermissionDecisions.push('deny');
      }
      const toolPermissionDecision = combineToolPermissionDecisions(toolPermissionDecisions);

      const yoloAutoApprove = permissionContext?.get?.('__mastra_yoloAutoApprove') === true;
      const unsupportedAskOnSuspensionResume =
        toolPermissionDecision === 'ask' &&
        !yoloAutoApprove &&
        isAuthenticatedResume &&
        !hasValidApprovalDecision &&
        persistedApprovalGrant === undefined;

      if (toolPermissionDecision === 'deny' || unsupportedAskOnSuspensionResume) {
        if (hasValidApprovalDecision) {
          await removeToolMetadata('approval');
        } else if (isAuthenticatedResume && !isApprovalResume) {
          await removeToolMetadata('suspension');
        }
        notifyToolDenied(permissionContext, { toolName, stage: 'action', toolCallId });
        return {
          ...typedInput,
          args,
          ...resumeTarget,
          disposition: 'denied' as const,
          result: unsupportedAskOnSuspensionResume
            ? `Tool "${toolName}" was not resumed because the session permission policy requires a new approval.`
            : `Tool "${toolName}" was denied by the session permission policy.`,
        };
      }

      // 2. Check whether a fresh tool call requires approval. An authenticated
      // resume uses its persisted decision; live permission checks above still apply.
      // Internal transport keys are filtered from the policy's requestContext view.
      const approvalRequirement = !isAuthenticatedResume
        ? await toolApprovalRequirement(tool, effectiveRequireToolApproval, args, {
            requestContext: Object.fromEntries(
              [...approvalRequestContext.entries()].filter(([key]) => key !== '__mastra_requireToolApproval'),
            ),
            // Use the same rebuilt-workspace fallback as execution (above), so
            // workspace-aware approval policies see their workspace cross-process.
            workspace,
            logger,
            toolName,
          })
        : { required: false, reasons: [] };
      const policyAsk = toolPermissionDecision === 'ask' && !yoloAutoApprove;
      const approvalReasons = [...approvalRequirement.reasons];
      if (policyAsk) approvalReasons.push('policy');
      const requiresApproval = approvalRequirement.required || policyAsk;

      // Durable execution owns a distinct approval path from the standard
      // agent loop. Keep both paths on the same invariant: schema-invalid
      // provider input is returned to the model for repair before a human is
      // asked to approve it. execute() still performs authoritative validation
      // immediately before side effects; transformed preflight data is not
      // reused because schema transforms need not be idempotent.
      if (requiresApproval && !isAuthenticatedResume && typeof tool.validateInput === 'function') {
        const preflightValidation = await tool.validateInput(args);
        if (preflightValidation.error !== undefined) {
          return {
            ...typedInput,
            args,
            result:
              preflightValidation.error instanceof Error
                ? serializeError(preflightValidation.error)
                : ensureSerializable(preflightValidation.error),
          };
        }
      }

      if (requiresApproval && !isAuthenticatedResume) {
        const resumeSchema = JSON.stringify({
          type: 'object',
          properties: {
            approved: { type: 'boolean' },
            reason: { type: 'string' },
          },
          required: ['approved'],
        });

        // Persist active goal time before exposing the approval wait.
        await stopGoalActivity({ agentId: initData.agentId, runId });

        // Emit approval chunk via PubSub (mirrors base agent's controller.enqueue)
        if (pubsub) {
          await emitChunkEvent(pubsub, runId, {
            type: 'tool-call-approval',
            runId,
            from: ChunkFrom.AGENT,
            payload: {
              version: 1,
              originRunId: runId,
              stepId: DurableStepIds.TOOL_CALL,
              type: 'approval',
              approvalSource: 'tool-gate',
              identityDigest,
              toolCallId,
              toolName,
              args,
              resumeSchema,
              ...(approvalReasons.length > 0 ? { approvalReasons } : {}),
            },
          });
        }

        // Emit suspended event for the stream adapter
        if (pubsub) {
          await emitSuspendedEvent(pubsub, runId, {
            toolCallId,
            toolName,
            args,
            identityDigest,
            type: 'approval',
            approvalSource: 'tool-gate',
            resumeSchema,
          });
        }

        // Add approval metadata to message before persisting
        addToolMetadata({ type: 'approval', approvalSource: 'tool-gate', resumeSchema });

        // Flush messages before suspension
        await doFlush();

        // End the trace's open spans as suspended before pausing.
        endSpansAsSuspended({ toolCallId, toolName, reason: 'approval' });

        // Suspend and wait for approval
        return suspend(
          {
            version: 1,
            type: 'approval',
            approvalSource: 'tool-gate',
            runId,
            iterationCount,
            stepId: DurableStepIds.TOOL_CALL,
            toolCallId,
            toolName,
            args,
            identityDigest,
            ...(approvalReasons.length > 0 ? { approvalReasons } : {}),
          },
          {
            resumeLabel: toolCallId,
          },
        );
      }

      // Remove pending-approval metadata when resuming with a validated approval
      // decision (the declined path above already removed it before returning).
      if (hasValidApprovalDecision) {
        await removeToolMetadata('approval');
      }

      // Preserve approval provenance even when a dynamic approval predicate changes between
      // suspension and resume, or when the approval was requested from inside tool execution.
      const approvalGrant = hasValidApprovalDecision
        ? ({
            approval: {
              id: metadataToolCallId,
              approved: true as const,
              ...(approvalDecision.reason !== undefined ? { reason: approvalDecision.reason } : {}),
            },
          } as const)
        : persistedApprovalGrant
          ? ({ approval: persistedApprovalGrant } as const)
          : undefined;

      // Suspension provenance comes from the authenticated persisted/workflow
      // envelope, not from payload presence: `resume()` / `resume(undefined)`
      // are valid resumes too. Payload-shaped detection would let an empty
      // resumed terminal-capable tool bypass the terminal-result guard.
      const isResumingFromSuspension = suspensionType === 'suspension' && hasMatchingSuspendIdentity;

      // Remove suspension metadata when resuming from an in-execution (non-approval-decision) suspension.
      // `isResumingFromSuspension` already excludes the approval-decision case above.
      if (isResumingFromSuspension) {
        await removeToolMetadata('suspension');
      }

      // 3. Check for background task execution
      const bgManager = registryEntry?.backgroundTaskManager;
      const bgConfig = registryEntry?.backgroundTasksConfig;
      const toolBgConfig = (tool as any).backgroundConfig as ToolBackgroundConfig | undefined;
      const llmBgOverrides =
        typeof args === 'object' && args !== null && '_background' in args ? (args as any)._background : undefined;

      // Strip _background from args before execution (same as non-durable path)
      const cleanedArgs = { ...args };
      if ('_background' in cleanedArgs) {
        delete (cleanedArgs as any)._background;
      }

      // When resuming a delegated sub-agent/workflow tool, recover the inner
      // suspended run id from this tool call's workflow suspend payload. The
      // payload is partitioned by resumeLabel, so parallel calls to the same
      // delegate cannot select each other's run. Auto-resume calls already pass
      // suspendedToolRunId in their arguments and keep that value unchanged.
      const isResumableTool = toolName?.startsWith('agent-') || toolName?.startsWith('workflow-');
      const suspendedToolRunId = (suspendData as { suspendedToolRunId?: unknown } | undefined)?.suspendedToolRunId;
      // When the delegation tool is itself approval-gated, an `{ approved: true }`
      // resume is ambiguous: it can answer this step's pre-execution gate (execute
      // fresh) or a delegated approval raised mid-execution by the sub-agent. The
      // suspend payload disambiguates — only the delegated approval persists an
      // inner suspended run id, so its decision must resume that inner run.
      const isDelegatedApprovalResume = !!approvalGrant && isResumableTool && typeof suspendedToolRunId === 'string';
      if (
        (isResumingFromSuspension || isDelegatedApprovalResume) &&
        isResumableTool &&
        !cleanedArgs.suspendedToolRunId &&
        typeof suspendedToolRunId === 'string'
      ) {
        cleanedArgs.suspendedToolRunId = suspendedToolRunId;
      }

      // Fire onInputAvailable lifecycle hook before execution (matches non-durable path).
      if (tool && 'onInputAvailable' in tool && typeof (tool as any).onInputAvailable === 'function') {
        try {
          await (tool as any).onInputAvailable({
            toolCallId,
            input: cleanedArgs,
            messages: messageList ? messageList.get.input.aiV5.model() : [],
          });
        } catch (hookError) {
          logger?.error?.('Error calling onInputAvailable', hookError);
        }
      }

      // Execute the tool
      if (!tool.execute) {
        return {
          ...typedInput,
          args,
          ...resumeTarget,
          result: undefined,
          ...(approvalGrant ?? {}),
        };
      }

      // Rebuild the forwarded model_step span and pass it as the tool's tracing context so
      // the TOOL_CALL span nests under the LLM call (matches the non-durable path).
      const stepSpan =
        typedInput.stepSpanData && observability
          ? observability.rebuildSpan(typedInput.stepSpanData as ExportedSpan<SpanType.MODEL_STEP>)
          : undefined;
      const toolTracingContext = stepSpan ? { currentSpan: stepSpan } : undefined;

      // Track whether the tool's suspend callback was invoked so we can skip
      // emitting a spurious tool-result after tool.execute() returns (the
      // workflow engine's suspend() sets an internal flag but does not throw,
      // so execution continues past the suspend call).
      let wasSuspended = false;

      // Forward abort signal from the run registry so tools can observe
      // cancellation (mirrors the non-durable tool-call-step).
      const toolAbortSignal = registryEntry?.abortSignal;

      const toolOptions = {
        toolCallId,
        messages: [],
        workspace,
        requestContext,
        mcp: registryEntry?.mcp,
        tracingContext: toolTracingContext,
        // Use the actor supplied for this workflow segment (so FGA checks inside
        // tool execution see the same actor as the non-durable Agent path). A
        // resumed segment must never recover the initial actor from serialized
        // agent options.
        actor,
        // Delegated approval decisions must also flow to the wrapper tool: it only
        // resumes the inner suspended run when resumeData is present. Likewise a
        // tool-execution approval resume forwards its decision payload to the tool.
        resumeData:
          isResumingFromSuspension || isToolExecutionApprovalResume || isDelegatedApprovalResume
            ? resumeData
            : undefined,
        ...(toolAbortSignal ? { abortSignal: toolAbortSignal } : {}),
        // Provide outputWriter so context.writer.write() / context.writer.custom()
        // emit chunks through pubsub (matching the regular agent's tool streaming).
        outputWriter: pubsub
          ? async (chunk: any) => {
              await emitChunkEvent(pubsub, runId, chunk as ChunkType);
            }
          : undefined,

        // In-execution suspend callback — allows tools to suspend mid-execution
        suspend: async (suspendPayload: any, suspendOptions?: SuspendOptions) => {
          wasSuspended = true;
          // When a delegated sub-agent requests approval, the delegation tool
          // wrapper passes its inner suspended run id via `suspendOptions.runId`
          // (see the agent-tool wrapper's `suspend(..., { runId, isAgentSuspend })`).
          // Persist it with the approval so the resume leg targets that inner
          // run instead of restarting the sub-agent from scratch.
          const delegatedRunId =
            typeof suspendOptions?.runId === 'string' && suspendOptions.runId !== runId
              ? suspendOptions.runId
              : undefined;
          if (suspendOptions?.requireToolApproval) {
            const innerApproval =
              typeof suspendOptions.requireToolApproval === 'object' && suspendOptions.requireToolApproval
                ? suspendOptions.requireToolApproval
                : typeof suspendPayload?.requireToolApproval === 'object' && suspendPayload?.requireToolApproval
                  ? suspendPayload.requireToolApproval
                  : null;

            const approvalToolName = innerApproval?.toolName ?? toolName;
            const approvalArgs = innerApproval?.args !== undefined ? innerApproval.args : args;

            // Tool is requesting approval during execution
            const approvalResumeSchema = JSON.stringify({
              type: 'object',
              properties: {
                approved: { type: 'boolean' },
                reason: { type: 'string' },
              },
              required: ['approved'],
            });

            await stopGoalActivity({ agentId: initData.agentId, runId });

            if (pubsub) {
              await emitChunkEvent(pubsub, runId, {
                type: 'tool-call-approval',
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  version: 1,
                  originRunId: runId,
                  stepId: DurableStepIds.TOOL_CALL,
                  type: 'approval',
                  approvalSource: 'tool-execution',
                  identityDigest,
                  toolCallId,
                  toolName: approvalToolName,
                  args: approvalArgs,
                  parentToolName: toolName,
                  parentArgs: args,
                  resumeSchema: approvalResumeSchema,
                },
              });
            }

            if (pubsub) {
              await emitSuspendedEvent(pubsub, runId, {
                toolCallId,
                toolName: approvalToolName,
                args: approvalArgs,
                identityDigest,
                type: 'approval',
                approvalSource: 'tool-execution',
                resumeSchema: approvalResumeSchema,
              });
            }

            // Add approval metadata to message before persisting
            addToolMetadata({
              type: 'approval',
              approvalSource: 'tool-execution',
              resumeSchema: approvalResumeSchema,
              delegatedRunId,
              approvalToolName,
              approvalArgs,
            });

            await doFlush();

            endSpansAsSuspended({ toolCallId, toolName: approvalToolName, reason: 'approval' });

            return suspend(
              {
                version: 1,
                type: 'approval',
                approvalSource: 'tool-execution',
                runId,
                iterationCount,
                stepId: DurableStepIds.TOOL_CALL,
                toolCallId,
                toolName,
                args,
                identityDigest,
                requireToolApproval: { toolCallId, toolName: approvalToolName, args: approvalArgs },
                // Persist the inner suspended run id in the workflow snapshot,
                // partitioned per tool call (resumeLabel = toolCallId), so the
                // resume leg can recover it even if message metadata is stale.
                ...(delegatedRunId ? { suspendedToolRunId: delegatedRunId } : {}),
              },
              { resumeLabel: toolCallId },
            );
          } else {
            // General tool suspension (e.g., tool calls context.agent.suspend())
            const suspendedEventData: AgentSuspendedEventData = {
              toolCallId,
              toolName,
              args,
              identityDigest,
              ...(approvalGrant ?? {}),
              suspendPayload,
              type: 'suspension',
              resumeSchema: suspendOptions?.resumeSchema,
            };

            if (pubsub) {
              await emitChunkEvent(pubsub, runId, {
                type: 'tool-call-suspended',
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  version: 1,
                  originRunId: runId,
                  stepId: DurableStepIds.TOOL_CALL,
                  type: 'suspension',
                  identityDigest,
                  ...(approvalGrant ?? {}),
                  toolCallId,
                  toolName,
                  suspendPayload,
                  args,
                  resumeSchema: suspendOptions?.resumeSchema,
                },
              });

              await emitSuspendedEvent(pubsub, runId, suspendedEventData);
            }

            // Add suspension metadata to message before persisting
            addToolMetadata({
              type: 'suspension',
              approval: approvalGrant?.approval,
              suspendPayload,
              resumeSchema: suspendOptions?.resumeSchema,
              delegatedRunId,
            });

            await doFlush();

            endSpansAsSuspended({ toolCallId, toolName, reason: 'suspension' });

            return suspend(
              {
                version: 1,
                type: 'suspension',
                runId,
                iterationCount,
                stepId: DurableStepIds.TOOL_CALL,
                toolCallSuspended: suspendPayload,
                toolCallId,
                toolName,
                args,
                identityDigest,
                ...(approvalGrant ?? {}),
                resumeLabel: suspendOptions?.resumeLabel,
                // Persist the inner suspended run id in the workflow snapshot,
                // partitioned per tool call (resumeLabel = toolCallId), so the
                // resume leg continues the delegate's suspended run instead of
                // restarting it (#20496; mirrors the approval branch above).
                ...(delegatedRunId ? { suspendedToolRunId: delegatedRunId } : {}),
              },
              { resumeLabel: toolCallId },
            );
          }
        },
      };

      // Resolve whether to run in background using the shared config resolver
      if (bgManager && !bgConfig?.disabled && typeof cleanedArgs === 'object' && cleanedArgs !== null) {
        const bgResolved = resolveBackgroundConfig({
          llmBgOverrides,
          toolName,
          toolConfig: toolBgConfig,
          agentConfig: bgConfig,
          managerConfig: bgManager.config,
        });

        if (bgResolved.runInBackground) {
          try {
            const bgTask = createBackgroundTask(bgManager, {
              toolName,
              toolCallId,
              args: cleanedArgs,
              agentId: initData.agentId,
              threadId: state?.threadId,
              resourceId: state?.resourceId,
              runId,
              timeoutMs: bgResolved.timeoutMs,
              maxRetries: bgResolved.maxRetries,
              // The hook closure cannot survive cross-process dispatch or cold
              // recovery — persist the requirement so a statically-resolved
              // executor fails closed instead of skipping revalidation.
              requiresToolPermissionHook: typeof onBeforeToolExecution === 'function',
              context: {
                executor: {
                  execute: async (taskArgs: any, taskContext: any) => {
                    // Every attempt is a fresh side-effect boundary: the gate
                    // above ran only before dispatch, so retries must revalidate
                    // or a mid-flight grant revocation never takes effect. A
                    // denial throws TOOL_PERMISSION_DENIED_ERROR_NAME, which the
                    // bg-task workflow classifies as non-retryable.
                    if (typeof onBeforeToolExecution === 'function') {
                      let attemptDecision: 'allow' | 'deny' | void;
                      try {
                        attemptDecision = await onBeforeToolExecution({
                          toolName,
                          toolCallId: metadataToolCallId,
                          args: taskArgs,
                          isResume: taskContext?.resumeData !== undefined || isAuthenticatedResume,
                          policyDecision: snapshotPolicyDecision,
                        });
                      } catch {
                        attemptDecision = 'deny';
                      }
                      if (registryEntry?.abortSignal?.aborted || taskContext?.abortSignal?.aborted) {
                        throw (
                          (
                            (taskContext?.abortSignal ?? registryEntry?.abortSignal) as
                              | (AbortSignal & { reason?: unknown })
                              | undefined
                          )?.reason ?? new DOMException('The operation was aborted.', 'AbortError')
                        );
                      }
                      if (attemptDecision !== undefined && attemptDecision !== 'allow') {
                        notifyToolDenied(permissionContext, {
                          toolName,
                          stage: 'action',
                          toolCallId,
                        });
                        throw Object.assign(
                          new Error(`Tool "${toolName}" was denied by the pre-execution permission hook.`),
                          { name: TOOL_PERMISSION_DENIED_ERROR_NAME },
                        );
                      }
                    }
                    return tool.execute!(taskArgs, {
                      ...toolOptions,
                      ...(taskContext?.resumeData !== undefined ? { resumeData: taskContext.resumeData } : {}),
                      suspend: async (data?: unknown, options?: SuspendOptions) => {
                        await toolOptions.suspend?.(data, options);
                        return taskContext?.suspend?.(data, options);
                      },
                      outputWriter: async (chunk: any) => {
                        await taskContext?.onProgress?.(chunk);
                        return toolOptions.outputWriter?.(chunk);
                      },
                    });
                  },
                },
                onChunk: (chunk: any) => {
                  if (!pubsub) return;
                  try {
                    const bgRunId = chunk.payload.runId;
                    // Emit tool-call chunk so UIs can render the invocation inline
                    if (bgRunId !== runId || (bgRunId === runId && isAuthenticatedResume)) {
                      void emitChunkEvent(pubsub, bgRunId, {
                        type: 'tool-call',
                        runId: bgRunId,
                        from: ChunkFrom.AGENT,
                        payload: {
                          toolCallId: chunk.payload.toolCallId,
                          toolName: chunk.payload.toolName,
                          args: cleanedArgs,
                        },
                      });
                    }

                    if (chunk.type === 'background-task-completed') {
                      void emitChunkEvent(pubsub, bgRunId, {
                        type: 'tool-result',
                        runId: bgRunId,
                        from: ChunkFrom.AGENT,
                        payload: {
                          toolCallId: chunk.payload.toolCallId,
                          toolName: chunk.payload.toolName,
                          args: cleanedArgs,
                          result: chunk.payload.result,
                        },
                      });
                    } else if (chunk.type === 'background-task-failed') {
                      void emitChunkEvent(pubsub, bgRunId, {
                        type: 'tool-error',
                        runId: bgRunId,
                        from: ChunkFrom.AGENT,
                        payload: {
                          toolCallId: chunk.payload.toolCallId,
                          toolName: chunk.payload.toolName,
                          error: chunk.payload.error,
                          args: cleanedArgs,
                        },
                      });
                    }
                  } catch {
                    // PubSub may be closed — ignore
                  }
                },

                onResult: async (params: any) => {
                  if (!messageList) return;

                  const result =
                    params.status === 'failed'
                      ? `Background task failed: ${params.error?.message ?? 'Unknown error'}`
                      : params.result;

                  const updated = messageList.updateToolInvocation(
                    {
                      type: 'tool-invocation',
                      toolInvocation: {
                        // A failed background task is recorded as `output-error` with the
                        // message in `errorText`; a successful one keeps `state: 'result'`.
                        ...(params.status === 'failed'
                          ? { state: 'output-error' as const, errorText: result }
                          : { state: 'result' as const, result }),
                        toolCallId: params.toolCallId,
                        toolName: params.toolName,
                        args: cleanedArgs,
                        // Preserve the approval decision for an approved approval-gated tool that
                        // ran in the background so it round-trips on recall, matching the sync path.
                        ...(approvalGrant ?? {}),
                      },
                    },
                    {
                      mode: 'stream',
                      backgroundTasks: {
                        [params.toolCallId]: {
                          startedAt: params.startedAt,
                          completedAt: params.completedAt,
                          taskId: params.taskId,
                        },
                      },
                    },
                  );

                  if (!updated) {
                    if (params.runId !== runId || (params.runId === runId && isAuthenticatedResume)) {
                      messageList.add(
                        [
                          {
                            role: 'tool' as const,
                            type: 'tool-call',
                            id: crypto.randomUUID(),
                            createdAt: new Date(),
                            content: [
                              {
                                type: 'tool-call' as const,
                                toolCallId: params.toolCallId,
                                toolName: params.toolName,
                                args: cleanedArgs,
                              },
                            ],
                          },
                        ],
                        'response',
                      );
                    }
                    messageList.add(
                      [
                        {
                          role: 'tool' as const,
                          content: [
                            {
                              type: 'tool-result' as const,
                              toolCallId: params.toolCallId,
                              toolName: params.toolName,
                              result,
                              isError: params.status === 'failed',
                            },
                          ],
                        },
                      ],
                      'response',
                    );
                  }

                  if (saveQueueManager && state?.threadId && !state?.memoryConfig?.readOnly) {
                    await saveQueueManager.flushMessages(messageList, state.threadId, state.memoryConfig);
                  }
                },

                onExecution: async (params: any) => {
                  if (!messageList) return;

                  messageList.updateMessageMetadataByToolCallId(params.toolCallId, {
                    mode: 'stream',
                    backgroundTasks: {
                      [params.toolCallId]: {
                        startedAt: params.startedAt,
                        suspendedAt: params.suspendedAt,
                        taskId: params.taskId,
                      },
                    },
                  });

                  // Flush to storage so the metadata update (especially suspendedAt)
                  // is persisted. Unlike the regular agent which has a single long-lived
                  // messageList, the durable agent's workflow state is serialized before
                  // this async callback fires, so we must flush directly.
                  if (saveQueueManager && state?.threadId && !state?.memoryConfig?.readOnly) {
                    await saveQueueManager.flushMessages(messageList, state.threadId, state.memoryConfig);
                  }
                },

                onComplete: toolBgConfig?.onComplete ?? bgConfig?.onTaskComplete,
                onFailed: toolBgConfig?.onFailed ?? bgConfig?.onTaskFailed,
              },
            });

            // If the agent is resuming this tool call and a previously-suspended
            // bg task exists for this toolCallId+runId, resume the bg task with
            // the agent-resume payload instead of dispatching a fresh one.
            const isSuspendedBgResume = isResumingFromSuspension || isToolExecutionApprovalResume;
            if (isSuspendedBgResume) {
              const isSuspended = await bgTask.checkIfSuspended({
                toolCallId,
                runId,
                agentId: initData.agentId,
                threadId: state?.threadId,
                resourceId: state?.resourceId,
                toolName,
              });
              if (isSuspended) {
                const task = await bgTask.resume(resumeData);
                return {
                  ...typedInput,
                  args: cleanedArgs,
                  ...resumeTarget,
                  result: `Background task resumed. Task ID: ${task.id}. The tool "${toolName}" is running in the background. You will be notified when it completes.`,
                  ...(approvalGrant ?? {}),
                };
              }
            }

            const isPreviouslyRunning = await bgTask.checkIfRunning({
              toolCallId,
              runId,
              agentId: initData.agentId,
              threadId: state?.threadId,
              resourceId: state?.resourceId,
              toolName,
            });

            if (isPreviouslyRunning) {
              const task = await bgTask.restart();
              return {
                ...typedInput,
                args: cleanedArgs,
                ...resumeTarget,
                result: `Background task restarted. Task ID: ${task.id}. The tool "${toolName}" is running in the background. You will be notified when it completes.`,
              };
            }

            const { task, fallbackToSync } = await bgTask.dispatch();

            if (!fallbackToSync) {
              // Emit background-task-started chunk via PubSub
              if (pubsub) {
                await emitChunkEvent(pubsub, runId, {
                  type: 'background-task-started' as any,
                  runId,
                  from: ChunkFrom.AGENT,
                  payload: {
                    taskId: task.id,
                    toolName,
                    toolCallId,
                  },
                });
              }

              // Return placeholder result so the LLM can continue
              return {
                ...typedInput,
                args: cleanedArgs,
                ...resumeTarget,
                result: `Background task started. Task ID: ${task.id}. The tool "${toolName}" is running in the background. You will be notified when it completes.`,
                ...(approvalGrant ?? {}),
              };
            }
            // fallbackToSync: concurrency limit hit, fall through to synchronous execution
          } catch (bgError) {
            logger?.debug?.(
              `[DurableAgent] Background task dispatch failed for ${toolName}, falling back to sync: ${bgError}`,
            );
          }
        }
      }

      try {
        const releaseRunActivity = markRunActive(runId);
        let result: unknown;
        try {
          result = await tool.execute(cleanedArgs, toolOptions);
        } finally {
          releaseRunActivity();
        }
        const delegationBailed =
          requestContext?.get('__mastra_delegationBailed') === true ||
          registryEntry?.requestContext?.get('__mastra_delegationBailed') === true;

        // Fire onOutput lifecycle hook after successful execution (matches non-durable path).
        if (tool && 'onOutput' in tool && typeof (tool as any).onOutput === 'function') {
          try {
            await (tool as any).onOutput({
              toolCallId,
              toolName,
              output: result,
            });
          } catch (hookError) {
            logger?.error?.('Error calling onOutput', hookError);
          }
        }

        // Compute model-facing output while invocation-scoped execution metadata is still available.
        // Durable step outputs are serialized before the LLM mapping step, which strips symbols and
        // other non-JSON side channels used by tools such as MCP structured-output tools.
        let providerMetadata = typedInput.providerMetadata as ProviderMetadata | undefined;
        let modelOutputComputed: boolean | undefined;
        const mappingTool = globalRunRegistry.get(runId)?.tools?.[toolName] ?? tool;
        const toModelOutput = mappingTool.toModelOutput;
        if (toModelOutput) {
          modelOutputComputed = true;
          const mappingSpan = stepSpan?.createChildSpan({
            type: SpanType.MAPPING,
            name: `tool output mapping: '${toolName}'`,
            entityType: EntityType.TOOL,
            entityId: toolName,
            entityName: toolName,
            input: result,
            attributes: {
              mappingType: 'toModelOutput',
              toolCallId,
            },
          });
          try {
            const modelOutput = normalizeModelOutput(await toModelOutput(result));
            mappingSpan?.end({ output: modelOutput });

            if (modelOutput != null) {
              const existingMastra = (providerMetadata as any)?.mastra;
              providerMetadata = {
                ...providerMetadata,
                mastra: { ...existingMastra, modelOutput },
              };
            }
          } catch (mappingError) {
            mappingSpan?.error({ error: mappingError as Error, endSpan: true });
            logger?.warn?.(`[DurableAgent] toModelOutput failed for tool "${toolName}": ${mappingError}`);
          }
        }

        // Emit tool-result chunk (non-fatal — result is returned regardless).
        // Skip emission when the tool called suspend() — the workflow engine's
        // suspend() sets a flag but does NOT throw, so execution continues past
        // the suspend call and tool.execute() returns undefined. Emitting a
        // tool-result with undefined would produce a spurious entry that
        // confuses downstream consumers (e.g. MastraModelOutput.toolResults).
        if (pubsub && !wasSuspended) {
          try {
            const rawResultChunk: ChunkType = {
              type: 'tool-result',
              runId,
              from: ChunkFrom.AGENT,
              payload: { toolCallId, toolName, args, result, providerMetadata },
            };
            const resultChunk = await applyToolPayloadTransformToChunk(rawResultChunk, {
              policy: registryEntry?.toolPayloadTransform,
              tools: registryEntry?.tools,
              logger: logger as any,
            });
            // Run through output processors (tripwire/blocking/redaction)
            const processed = await processChunkThroughOutputProcessors(
              resultChunk,
              registryEntry,
              pubsub,
              runId,
              initData.agentId,
              logger,
              messageList,
              processorObservabilityContext,
            );
            if (processed) {
              await emitChunkEvent(pubsub, runId, processed);
            }
          } catch (emitError) {
            logger?.warn?.(`[DurableAgent] Failed to emit tool-result chunk for ${toolName}: ${emitError}`);
          }
        }

        return {
          ...typedInput,
          args,
          ...resumeTarget,
          providerMetadata,
          result,
          ...(!wasSuspended ? { serverExecuted: true } : {}),
          modelOutputComputed,
          ...(delegationBailed ? { delegationBailed: true } : {}),
          ...(isResumingFromSuspension ? { resumedFromSuspension: true as const } : {}),
          ...(approvalGrant ?? {}),
        };
      } catch (error) {
        // Re-throw FGA authorization errors instead of swallowing them —
        // an authorization denial must fail the run, not be serialized as a
        // recoverable tool error for the LLM to retry (mirrors the
        // non-durable tool-call step).
        if (error instanceof Error && error.name === 'FGADeniedError') {
          throw error;
        }
        const toolError = serializeError(error);
        const delegationBailed =
          requestContext?.get('__mastra_delegationBailed') === true ||
          registryEntry?.requestContext?.get('__mastra_delegationBailed') === true;

        // Emit tool-error chunk (non-fatal — error result is returned regardless)
        if (pubsub && !wasSuspended) {
          try {
            const errorChunk = await applyToolPayloadTransformToChunk(
              {
                type: 'tool-error' as const,
                runId,
                from: ChunkFrom.AGENT,
                payload: { toolCallId, toolName, args, error: toolError },
              },
              {
                policy: registryEntry?.toolPayloadTransform,
                tools: registryEntry?.tools,
                logger: logger as any,
              },
            );
            // Run through output processors (tripwire/blocking/redaction)
            const processed = await processChunkThroughOutputProcessors(
              errorChunk,
              registryEntry,
              pubsub,
              runId,
              initData.agentId,
              logger,
              messageList,
              processorObservabilityContext,
            );
            if (processed) {
              await emitChunkEvent(pubsub, runId, processed);
            }
          } catch (emitError) {
            logger?.warn?.(`[DurableAgent] Failed to emit tool-error chunk for ${toolName}: ${emitError}`);
          }
        }

        return {
          ...typedInput,
          args,
          ...resumeTarget,
          error: toolError,
          ...(delegationBailed ? { delegationBailed: true } : {}),
          ...(isResumingFromSuspension ? { resumedFromSuspension: true as const } : {}),
          ...(approvalGrant ?? {}),
        };
      }
    },
  });
}

import { z } from 'zod';
import { createBackgroundTask } from '../../../../background-tasks/create';
import { resolveBackgroundConfig } from '../../../../background-tasks/resolve-config';
import type { ToolBackgroundConfig } from '../../../../background-tasks/types';
import type { PubSub } from '../../../../events/pubsub';
import type { Mastra } from '../../../../mastra';
import type { MastraMemory } from '../../../../memory/memory';
import type { MemoryConfig } from '../../../../memory/types';
import type { ExportedSpan, SpanType } from '../../../../observability';
import type { ProcessorState } from '../../../../processors';
import { ProcessorRunner } from '../../../../processors/runner';
import type { ChunkType } from '../../../../stream/types';
import { ChunkFrom } from '../../../../stream/types';
import { findProviderToolByName } from '../../../../tools/provider-tool-utils';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { SuspendOptions } from '../../../../workflows/step';
import { createStep } from '../../../../workflows/workflow';
import { stopGoalActivity } from '../../../goal';
import type { MessageList } from '../../../message-list';
import type { SaveQueueManager } from '../../../save-queue';
import { DurableStepIds } from '../../constants';
import { globalRunRegistry } from '../../run-registry';
import { emitSuspendedEvent, emitChunkEvent } from '../../stream-adapter';
import type {
  DurableToolCallInput,
  SerializableDurableOptions,
  AgentSuspendedEventData,
  RunRegistryEntry,
} from '../../types';
import { applyToolPayloadTransformToChunk } from '../../utils/apply-tool-payload-transform';
import { rebuildRunToolsFromMastra, resolveTool, toolRequiresApproval } from '../../utils/resolve-runtime';
import { serializeError } from '../../utils/serialize-state';

/**
 * Input schema for the durable tool call step.
 * Each tool call flows through this schema when using .foreach()
 */
const durableToolCallInputSchema = z.object({
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
  result: z.any().optional(),
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  // Approval decision for a `requireApproval` tool. Without this field Zod would strip the
  // approval off the step output, so a declined call would lose its `output-denied` marker.
  approval: z
    .object({
      id: z.string(),
      approved: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
});

/**
 * Flush messages to memory before suspending.
 * Mirrors the base Agent's flushMessagesBeforeSuspension() to ensure
 * the thread exists and all pending messages are persisted.
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
  if (!saveQueueManager || !messageList || !threadId) {
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
): Promise<ChunkType | null> {
  if (!registryEntry?.outputProcessors?.length || !registryEntry.processorStates) {
    return chunk;
  }

  try {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: registryEntry.outputProcessors,
      logger,
      agentName,
      processorStates: registryEntry.processorStates,
    });

    const {
      part: processed,
      blocked,
      reason,
      tripwireOptions,
      processorId,
    } = await runner.processPart(
      chunk,
      registryEntry.processorStates as Map<string, ProcessorState>,
      undefined, // observabilityContext
      registryEntry.requestContext,
      messageList,
      0,
      pubsub
        ? {
            custom: async (data: { type: string }) => {
              await emitChunkEvent(pubsub, runId, data as ChunkType);
            },
          }
        : undefined,
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
export function createDurableToolCallStep() {
  return createStep({
    id: DurableStepIds.TOOL_CALL,
    inputSchema: durableToolCallInputSchema,
    outputSchema: durableToolCallOutputSchema,
    execute: async params => {
      const { inputData, mastra, suspend, resumeData: workflowResumeData, requestContext, actor, getInitData } = params;

      // Access pubsub via symbol
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

      const typedInput = inputData as DurableToolCallInput;
      const { toolCallId, toolName, args: rawArgs, providerExecuted, output, activeTools } = typedInput;

      // Extract resumeData from tool call arguments (autoResumeSuspendedTools path)
      // When the LLM auto-resumes a suspended tool, it injects `resumeData` into the
      // tool call arguments. We extract it here to skip re-suspending for approval.
      // Mirrors the regular agent's tool-call-step.ts logic.
      let resumeDataFromArgs: any = undefined;
      let args: any = rawArgs;
      if (typeof rawArgs === 'object' && rawArgs !== null) {
        const { resumeData: resumeDataFromInput, ...argsFromInput } = rawArgs as Record<string, any>;
        args = argsFromInput;
        resumeDataFromArgs = resumeDataFromInput;
      }
      const resumeData = resumeDataFromArgs ?? workflowResumeData;

      // Get context from init data (the parent workflow input)
      const initData = getInitData<{
        runId: string;
        agentId: string;
        options: SerializableDurableOptions;
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

      const { runId, options: agentOptions, state } = initData;
      const logger = (mastra as any)?.getLogger?.();

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

      // 1. Resolve the tool from global registry first, then by provider-tool
      // model-facing name (e.g. `web_search` resolves to `webSearch` when the
      // provider tool advertises the snake-case name), then by id, then fall
      // back to the Mastra-wide tool registry (exact name, provider-tool
      // name, then by id). Mirrors the non-durable tool-call step.
      const registryEntry = globalRunRegistry.get(runId);
      let tool = registryEntry?.tools?.[toolName];
      let mastraTools: Record<string, any> | undefined;
      // Tools rebuilt from the Mastra instance when the per-process registry is
      // empty (cross-process worker). Populated lazily below; reused for
      // workspace/memory resolution further down.
      let rebuiltTools: Record<string, any> | undefined;
      let rebuiltWorkspace: any;
      let rebuiltMemory: any;
      let rebuiltSaveQueueManager: any;

      if (!tool) {
        tool = findProviderToolByName(registryEntry?.tools as any, toolName) as typeof tool;
      }

      if (!tool) {
        tool = Object.values(registryEntry?.tools ?? {}).find(
          (t: any) => t && typeof t === 'object' && 'id' in t && t.id === toolName,
        ) as typeof tool;
      }

      if (!tool) {
        tool = resolveTool(toolName, mastra as Mastra);
      }

      if (!tool && mastra) {
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
      if (!tool && mastra) {
        const rebuilt = await rebuildRunToolsFromMastra({
          mastra: mastra as Mastra,
          runId,
          agentId: initData.agentId,
          state: state as any,
          options: agentOptions,
          requestContextEntries: initData.requestContextEntries,
          logger,
        });
        if (rebuilt) {
          rebuiltTools = rebuilt.tools;
          rebuiltWorkspace = rebuilt.workspace;
          rebuiltMemory = rebuilt.memory;
          rebuiltSaveQueueManager = rebuilt.saveQueueManager;
          tool = rebuiltTools[toolName] as typeof tool;
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
      // Prefer the per-run registryEntry key (exact name then identity match),
      // and fall back to the Mastra-wide registry when the tool was resolved
      // there. Without this fallback, a globally-registered tool like
      // `webSearch` invoked by its model-facing name `web_search` would be
      // hidden whenever `activeTools` was set, because the key from
      // registryEntry.tools would be `undefined`.
      const toolKey =
        registryEntry?.tools?.[toolName] || rebuiltTools?.[toolName]
          ? toolName
          : (Object.entries(registryEntry?.tools ?? {}).find(([, registeredTool]) => registeredTool === tool)?.[0] ??
            Object.entries(rebuiltTools ?? {}).find(([, registeredTool]) => registeredTool === tool)?.[0] ??
            Object.entries(mastraTools ?? {}).find(([, registeredTool]) => registeredTool === tool)?.[0]);
      const effectiveActiveTools = activeTools === null ? undefined : (activeTools ?? agentOptions.activeTools);
      const activeToolKey = toolKey ?? toolName;
      const isHiddenByActiveTools = effectiveActiveTools !== undefined && !effectiveActiveTools.includes(activeToolKey);

      if (!tool || isHiddenByActiveTools) {
        const availableToolNames = effectiveActiveTools ?? Object.keys(rebuiltTools ?? registryEntry?.tools ?? {});
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
      // For local execution, the globalRunRegistry might have an ExtendedRunRegistry entry
      // that stores the messageList. We cast and check safely.
      const extendedEntry = globalRunRegistry.get(runId) as any;
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

      // 2. Check if tool requires approval. Prefer the live policy on the
      //    in-process registry (which preserves the function form with real
      //    toolName/args); fall back to the JSON-safe boolean shadow on the
      //    serialized workflow input for cross-process engines.
      const registryRequireToolApproval = registryEntry?.requireToolApproval;
      const effectiveRequireToolApproval =
        registryRequireToolApproval !== undefined ? registryRequireToolApproval : agentOptions.requireToolApproval;
      const requiresApproval = await toolRequiresApproval(tool, effectiveRequireToolApproval, args, {
        toolName,
        requestContext: registryEntry?.requestContext
          ? Object.fromEntries(
              [...registryEntry.requestContext.entries()].filter(([key]) => key !== '__mastra_requireToolApproval'),
            )
          : undefined,
        // Use the same rebuilt-workspace fallback as execution (above), so
        // workspace-aware approval policies see their workspace cross-process.
        workspace,
      });

      // Add suspended-tool / pending-approval metadata to the last assistant
      // message so `extractSuspendedToolsFromMessages` can detect it on the
      // next turn (autoResumeSuspendedTools) or on page-refresh resume.
      // Mirrors the regular agent's `addToolMetadata()`.
      const addToolMetadata = (opts: {
        type: 'approval' | 'suspension';
        resumeSchema?: string;
        suspendPayload?: unknown;
      }) => {
        if (!messageList) return;
        const metadataKey = opts.type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';
        const responseMessages = messageList.get.response.db();
        const lastAssistantMessage = [...responseMessages].reverse().find(msg => msg.role === 'assistant');
        if (!lastAssistantMessage?.content) return;

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
        metadata[metadataKey][toolCallId] = {
          toolCallId,
          toolName,
          args,
          type: opts.type,
          runId,
          ...(opts.type === 'suspension' ? { suspendPayload: opts.suspendPayload } : {}),
          ...(opts.resumeSchema ? { resumeSchema: opts.resumeSchema } : {}),
        };
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
          return (
            !!meta?.[metadataKey]?.[toolCallId] ||
            Object.values(meta?.[metadataKey] ?? {}).some(
              (e: any) => e?.toolCallId === toolCallId || e?.toolName === toolName,
            )
          );
        });
        if (!lastAssistantMessage?.content) return;
        const meta =
          typeof lastAssistantMessage.content.metadata === 'object' && lastAssistantMessage.content.metadata !== null
            ? (lastAssistantMessage.content.metadata as Record<string, any>)
            : undefined;
        if (!meta?.[metadataKey]) return;
        // Resolve key: exact toolCallId, then by entry toolCallId, then by toolName
        const entries = meta[metadataKey] as Record<string, any>;
        const key = entries[toolCallId]
          ? toolCallId
          : (Object.keys(entries).find(k => entries[k]?.toolCallId === toolCallId) ??
            Object.keys(entries).find(k => entries[k]?.toolName === toolName) ??
            (entries[toolName] ? toolName : undefined));
        if (key) {
          delete entries[key];
          if (Object.keys(entries).length === 0) {
            delete meta[metadataKey];
          }
        }
        // Flush to persist the metadata removal
        await doFlush();
      };

      if (requiresApproval && !resumeData) {
        const resumeSchema = JSON.stringify({
          type: 'object',
          properties: {
            approved: { type: 'boolean' },
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
            payload: { toolCallId, toolName, args, resumeSchema },
          });
        }

        // Emit suspended event for the stream adapter
        if (pubsub) {
          await emitSuspendedEvent(pubsub, runId, {
            toolCallId,
            toolName,
            args,
            type: 'approval',
            resumeSchema,
          });
        }

        // Add approval metadata to message before persisting
        addToolMetadata({ type: 'approval', resumeSchema });

        // Flush messages before suspension
        await doFlush();

        // End the trace's open spans as suspended before pausing.
        endSpansAsSuspended({ toolCallId, toolName, reason: 'approval' });

        // Suspend and wait for approval
        return suspend(
          {
            type: 'approval',
            toolCallId,
            toolName,
            args,
          },
          {
            resumeLabel: toolCallId,
          },
        );
      }

      // Check if resuming from approval — only when the tool actually requires
      // approval.  Without the `requiresApproval` guard, generic resume data that
      // happens to contain an `approved` field (e.g. from context.agent.suspend())
      // would be misinterpreted as an approval response.
      if (
        requiresApproval &&
        resumeData &&
        typeof resumeData === 'object' &&
        resumeData !== null &&
        'approved' in resumeData
      ) {
        // Remove approval metadata since we're resuming (either approved or declined)
        await removeToolMetadata('approval');

        if (!(resumeData as { approved: boolean }).approved) {
          // Return the approval decision (not a `result` string) so it persists as
          // `state: 'output-denied'` with `approval`. The denial reason carries the
          // existing string so downstream consumers/UI keep the same message.
          return {
            ...typedInput,
            approval: {
              id: toolCallId,
              approved: false,
              reason: 'Tool call was not approved by the user',
            },
          };
        }
      }

      // When an approval-gated tool is approved on resume, tag the resolved output with the
      // approval decision so it round-trips through persistence as `approval: { approved: true }`.
      const approvalGrant =
        requiresApproval &&
        resumeData &&
        typeof resumeData === 'object' &&
        resumeData !== null &&
        (resumeData as { approved?: boolean }).approved === true
          ? ({ approval: { id: toolCallId, approved: true as const } } as const)
          : undefined;

      // Check if resuming from in-execution suspension
      // Pass resumeData through to the tool so it can continue from where it left off.
      // For approval-gated tools, the approval check above already handled the
      // `approved` field, so the tool executes fresh (not as a "from-suspension"
      // resume).  For non-approval tools, ANY resume data is forwarded.
      const isResumingFromSuspension =
        resumeData &&
        typeof resumeData === 'object' &&
        resumeData !== null &&
        (requiresApproval ? !('approved' in resumeData) : true);

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
          result: undefined,
          ...(approvalGrant ?? {}),
        };
      }

      // Rebuild the forwarded model_step span and pass it as the tool's tracing context so
      // the TOOL_CALL span nests under the LLM call (matches the non-durable path).
      const observability = (mastra as Mastra | undefined)?.observability?.getSelectedInstance({ requestContext });
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
        tracingContext: toolTracingContext,
        // Use the actor supplied for this workflow segment. A resumed segment
        // must never recover the initial actor from serialized agent options.
        actor,
        resumeData: isResumingFromSuspension ? resumeData : undefined,
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
          if (suspendOptions?.requireToolApproval) {
            // Tool is requesting approval during execution
            const approvalResumeSchema = JSON.stringify({
              type: 'object',
              properties: {
                approved: { type: 'boolean' },
              },
              required: ['approved'],
            });

            await stopGoalActivity({ agentId: initData.agentId, runId });

            if (pubsub) {
              await emitChunkEvent(pubsub, runId, {
                type: 'tool-call-approval',
                runId,
                from: ChunkFrom.AGENT,
                payload: { toolCallId, toolName, args, resumeSchema: approvalResumeSchema },
              });
            }

            if (pubsub) {
              await emitSuspendedEvent(pubsub, runId, {
                toolCallId,
                toolName,
                args,
                type: 'approval',
                resumeSchema: approvalResumeSchema,
              });
            }

            // Add approval metadata to message before persisting
            addToolMetadata({ type: 'approval', resumeSchema: approvalResumeSchema });

            await doFlush();

            endSpansAsSuspended({ toolCallId, toolName, reason: 'approval' });

            return suspend(
              {
                type: 'approval',
                requireToolApproval: { toolCallId, toolName, args },
              },
              { resumeLabel: toolCallId },
            );
          } else {
            // General tool suspension (e.g., tool calls context.agent.suspend())
            const suspendedEventData: AgentSuspendedEventData = {
              toolCallId,
              toolName,
              args,
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
              suspendPayload,
              resumeSchema: suspendOptions?.resumeSchema,
            });

            await doFlush();

            endSpansAsSuspended({ toolCallId, toolName, reason: 'suspension' });

            return suspend(
              {
                type: 'suspension',
                toolCallSuspended: suspendPayload,
                toolCallId,
                toolName,
                resumeLabel: suspendOptions?.resumeLabel,
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
              context: {
                executor: {
                  execute: async (taskArgs: any, taskContext: any) => {
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
                    if (bgRunId !== runId || (bgRunId === runId && resumeData)) {
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
                        state: 'result',
                        toolCallId: params.toolCallId,
                        toolName: params.toolName,
                        args: cleanedArgs,
                        result,
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
                    if (params.runId !== runId || (params.runId === runId && resumeData)) {
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

                  if (saveQueueManager && state?.threadId) {
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
                  if (saveQueueManager && state?.threadId) {
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
            const isSuspendedBgResume =
              isResumingFromSuspension && resumeData && typeof resumeData === 'object' && resumeData !== null;
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
                  result: `Background task resumed. Task ID: ${task.id}. The tool "${toolName}" is running in the background. You will be notified when it completes.`,
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
        const result = await tool.execute(cleanedArgs, toolOptions);

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

        // Emit tool-result chunk (non-fatal — result is returned regardless).
        // Skip emission when the tool called suspend() — the workflow engine's
        // suspend() sets a flag but does NOT throw, so execution continues past
        // the suspend call and tool.execute() returns undefined. Emitting a
        // tool-result with undefined would produce a spurious entry that
        // confuses downstream consumers (e.g. MastraModelOutput.toolResults).
        if (pubsub && !wasSuspended) {
          try {
            const resultChunk = await applyToolPayloadTransformToChunk(
              {
                type: 'tool-result' as const,
                runId,
                from: ChunkFrom.AGENT,
                payload: { toolCallId, toolName, args, result },
              },
              {
                policy: registryEntry?.toolPayloadTransform,
                tools: registryEntry?.tools,
                logger: logger as any,
              },
            );
            // Run through output processors (tripwire/blocking/redaction)
            const processed = await processChunkThroughOutputProcessors(
              resultChunk,
              registryEntry,
              pubsub,
              runId,
              initData.agentId,
              logger,
              messageList,
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
          result,
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
          error: toolError,
          ...(approvalGrant ?? {}),
        };
      }
    },
  });
}

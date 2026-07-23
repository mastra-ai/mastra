import { randomUUID } from 'node:crypto';
import type { ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod/v4';
import { stopGoalActivity } from '../../../agent/goal';
import { createBackgroundTask } from '../../../background-tasks/create';
import { resolveBackgroundConfig } from '../../../background-tasks/resolve-config';
import type { BackgroundTaskProgressChunk, ToolBackgroundConfig } from '../../../background-tasks/types';
import type { MastraDBMessage } from '../../../memory';
import { toStandardSchema, standardSchemaToJSONSchema } from '../../../schema';
import { safeEnqueue } from '../../../stream/base';
import { ChunkFrom } from '../../../stream/types';
import type { ChunkType, ProviderMetadata } from '../../../stream/types';
import {
  getTransformedToolPayload,
  hasTransformedToolPayload,
  transformToolPayloadForTargets,
  withToolPayloadTransformMetadata,
  withToolPayloadTransformProviderMetadata,
} from '../../../tools/payload-transform';
import { findProviderToolByName } from '../../../tools/provider-tool-utils';
import { getNeedsApprovalFn } from '../../../tools/toolchecks';
import type { MastraToolInvocationOptions, ToolApprovalContext } from '../../../tools/types';
import { noopObserve } from '../../../tools/types';
import { ensureSerializable } from '../../../utils';
import type { SuspendOptions } from '../../../workflows/step';
import { createStep } from '../../../workflows/workflow';
import type { RunScopeContext } from '../../run-scope-access';
import { readScoped, writeScoped } from '../../run-scope-access';
import {
  AGENT_BACKGROUND_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_KEY,
  GENERATE_ID_KEY,
  MEMORY_CONFIG_KEY,
  MEMORY_KEY,
  NOW_KEY,
  RESOURCE_ID_KEY,
  SAVE_QUEUE_MANAGER_KEY,
  STEP_ACTIVE_TOOLS_KEY,
  STEP_TOOLS_KEY,
  STEP_WORKSPACE_KEY,
  THREAD_EXISTS_KEY,
  THREAD_ID_KEY,
  TOOL_PAYLOAD_TRANSFORM_KEY,
} from '../../run-scope-keys';
import type { OuterLLMRun } from '../../types';
import { serializeToolError, ToolNotFoundError } from '../errors';
import { toolCallInputSchema, toolCallOutputSchema } from '../schema';

type AddToolMetadataOptions = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  resumeSchema: string;
  suspendedToolRunId?: string;
  metadata?: Record<string, unknown>;
} & (
  | {
      type: 'approval';
      suspendPayload?: never;
    }
  | {
      type: 'suspension';
      suspendPayload: unknown;
    }
);

export function createToolCallStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  tools,
  messageList,
  options,
  outputWriter,
  controller,
  runId,
  streamState,
  modelSpanTracker,
  _internal,
  logger,
  agentId,
  mastra,
  requireToolApproval: requireToolApprovalFromFactory,
  actor,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'toolCallStep',
    inputSchema: toolCallInputSchema,
    outputSchema: toolCallOutputSchema,
    execute: async ({ inputData, suspend, resumeData: workflowResumeData, suspendData, requestContext }) => {
      // Resolve run-scoped state from either the Mastra-managed RunScope (production
      // path via loop.ts hydration) or the legacy `_internal` bag (tests).
      const scopeCtx: RunScopeContext = { mastra, runId, _internal };
      // Use tools from the scope (set by llmExecutionStep via prepareStep/processInputStep)
      // when available. This avoids serialization — execute functions live off-the-wire.
      // Fall back to the original tools from the closure if not set.
      const stepTools = (readScoped(scopeCtx, STEP_TOOLS_KEY, 'stepTools') as Tools | undefined) || tools;
      const stepActiveTools = readScoped(scopeCtx, STEP_ACTIVE_TOOLS_KEY, 'stepActiveTools');
      const tool =
        stepTools?.[inputData.toolName] ||
        findProviderToolByName(stepTools, inputData.toolName) ||
        Object.values(stepTools || {})?.find((t: any) => `id` in t && t.id === inputData.toolName);
      const transformSource = {
        policy: readScoped(scopeCtx, TOOL_PAYLOAD_TRANSFORM_KEY, 'toolPayloadTransform'),
        toolTransform: (tool as { transform?: unknown } | undefined)?.transform as any,
      };
      const transformChunk = async (
        chunk: ChunkType<OUTPUT>,
        phase: 'input-available' | 'approval' | 'suspend' | 'output-available' | 'error',
        extra?: { output?: unknown; error?: unknown; suspendPayload?: unknown },
      ): Promise<ChunkType<OUTPUT>> => {
        const payload = 'payload' in chunk ? (chunk.payload as Record<string, any>) : {};
        const transformInput = payload.args ?? inputData.args;
        const transformToolName = typeof payload.toolName === 'string' ? payload.toolName : inputData.toolName;
        const transformToolCallId = typeof payload.toolCallId === 'string' ? payload.toolCallId : inputData.toolCallId;
        const transformProviderMetadata =
          (payload.providerMetadata as Record<string, unknown> | undefined) ??
          (inputData.providerMetadata as Record<string, unknown> | undefined);

        const inputTransform = await transformToolPayloadForTargets(
          {
            phase: 'input-available',
            toolName: transformToolName,
            toolCallId: transformToolCallId,
            input: transformInput,
            providerMetadata: transformProviderMetadata,
          },
          transformSource,
          logger,
        );
        const transform =
          phase === 'input-available'
            ? undefined
            : await transformToolPayloadForTargets(
                {
                  phase,
                  toolName: transformToolName,
                  toolCallId: transformToolCallId,
                  input: transformInput,
                  output: extra?.output,
                  error: extra?.error,
                  suspendPayload: extra?.suspendPayload,
                  providerMetadata: transformProviderMetadata,
                },
                transformSource,
                logger,
              );

        return withToolPayloadTransformMetadata(
          withToolPayloadTransformMetadata(chunk, inputTransform),
          transform,
        ) as ChunkType<OUTPUT>;
      };

      const addToolMetadata = ({
        toolCallId,
        toolName,
        args,
        suspendPayload,
        resumeSchema,
        type,
        suspendedToolRunId,
        metadata: toolStateTransformMetadata,
      }: AddToolMetadataOptions) => {
        const metadataKey = type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';
        // Find the last assistant message in the response (which should contain this tool call)
        const responseMessages = messageList.get.response.db();
        const lastAssistantMessage = [...responseMessages].reverse().find(msg => msg.role === 'assistant');

        if (lastAssistantMessage) {
          const content = lastAssistantMessage.content;
          if (!content) return;
          // Add metadata to indicate this tool call is pending approval.
          // Reuse the live metadata object on the message and bind it back immediately. Two
          // parallel suspensions for the same step (e.g. two delegations to one sub-agent) run
          // concurrently; if each seeded a fresh {} and only reassigned at the end, the last
          // writer would clobber the first's entry (lost write). Mutating one shared object in
          // place keeps both entries.
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
          // Key by toolCallId (not toolName) so multiple parallel calls to the SAME tool — e.g.
          // two parallel delegations to one sub-agent — each persist their own suspension entry.
          // Keying by toolName collapsed them in storage, dropping all but the last suspended
          // runId; on resume (including page-refresh, which reconstructs purely from the persisted
          // message) the others could not be recovered (AGENT_RESUME_NO_SNAPSHOT_FOUND). Read and
          // remove paths match by the entry's toolCallId value, with a legacy toolName-key
          // fallback so pre-upgrade persisted metadata still resolves.
          const inputTransform = getTransformedToolPayload(
            toolStateTransformMetadata,
            'transcript',
            'input-available',
          )?.transformed;
          const approvalTransform = getTransformedToolPayload(
            toolStateTransformMetadata,
            'transcript',
            'approval',
          )?.transformed;
          const suspendTransform = getTransformedToolPayload(
            toolStateTransformMetadata,
            'transcript',
            'suspend',
          )?.transformed;
          const transformedArgs =
            type === 'approval'
              ? (approvalTransform ?? inputTransform ?? args)
              : (inputTransform ?? suspendTransform ?? args);
          const transformedSuspendPayload = type === 'suspension' ? (suspendTransform ?? suspendPayload) : undefined;
          metadata[metadataKey][toolCallId] = {
            toolCallId,
            toolName,
            args: transformedArgs,
            type,
            // Store the OUTER (resumable) runId so clients can resume after page refresh or
            // server restart via `resumeStream({ runId, toolCallId })`. For delegated sub-agent /
            // workflow tools the inner suspended run is preserved separately as `delegatedRunId`
            // — it is required to resume the delegate's own suspended stream, but it is not a
            // valid public resume target (resuming with it fails closed). No `parentRunId` is
            // written: readers that resume `parentRunId ?? runId` (channels) get the outer run
            // from `runId` directly; legacy entries with `parentRunId` keep working.
            runId,
            ...(suspendedToolRunId && suspendedToolRunId !== runId ? { delegatedRunId: suspendedToolRunId } : {}),
            ...(type === 'suspension' ? { suspendPayload: transformedSuspendPayload } : {}),
            resumeSchema,
            ...(toolStateTransformMetadata ? { metadata: toolStateTransformMetadata } : {}),
          };
        }
      };

      const removeToolMetadata = async (
        target: { toolCallId: string; toolName: string },
        type: 'suspension' | 'approval',
      ) => {
        const { saveQueueManager, memoryConfig, threadId } = _internal || {};

        if (!saveQueueManager || !threadId) {
          return;
        }

        const { toolCallId, toolName } = target;

        // Maps are keyed by toolCallId. Resolve this call's key in order: exact toolCallId (key,
        // then entry value), then toolName (entry value, then legacy toolName key). The toolName
        // match covers autoResumeSuspendedTools, where resume runs in a fresh turn so the resumed
        // toolCallId differs from the suspended one, plus pre-upgrade metadata keyed by toolName.
        const resolveEntryKey = (entries: Record<string, any> | undefined): string | undefined => {
          if (!entries) return undefined;
          if (entries[toolCallId]) return toolCallId;
          const byCallId = Object.keys(entries).find(key => entries[key]?.toolCallId === toolCallId);
          if (byCallId) return byCallId;
          const byName = Object.keys(entries).find(key => entries[key]?.toolName === toolName);
          if (byName) return byName;
          return entries[toolName] ? toolName : undefined;
        };

        // Match this call's data part. Prefer toolCallId; otherwise fall back to toolName so the
        // autoResume (fresh-turn) and legacy paths still resolve.
        const partMatches = (data: any): boolean => data?.toolCallId === toolCallId || data?.toolName === toolName;

        const getMetadata = (message: MastraDBMessage) => {
          const content = message.content;
          if (!content) return undefined;
          const metadata =
            typeof content.metadata === 'object' && content.metadata !== null
              ? (content.metadata as Record<string, any>)
              : undefined;
          return metadata;
        };

        const metadataKey = type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';

        // Find and update the assistant message to remove approval metadata
        // At this point, messages have been persisted, so we look in all messages
        const allMessages = messageList.get.all.db();
        const lastAssistantMessage = [...allMessages].reverse().find(msg => {
          const metadata = getMetadata(msg);
          const suspendedTools = metadata?.[metadataKey] as Record<string, any> | undefined;
          if (resolveEntryKey(suspendedTools)) {
            return true;
          }
          const dataToolSuspendedParts = msg.content.parts?.filter(
            part => part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval',
          );
          if (dataToolSuspendedParts && dataToolSuspendedParts.length > 0) {
            const foundTool = dataToolSuspendedParts.find((part: any) => partMatches(part.data));
            if (foundTool) {
              return true;
            }
          }
          return false;
        });

        if (lastAssistantMessage) {
          const metadata = getMetadata(lastAssistantMessage);
          let suspendedTools = metadata?.[metadataKey] as Record<string, any> | undefined;
          if (!suspendedTools) {
            suspendedTools = lastAssistantMessage.content.parts
              ?.filter(part => part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval')
              ?.reduce(
                (acc, part) => {
                  if (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') {
                    const data = part.data as any;
                    acc[data.toolCallId ?? data.toolName] = data;
                  }
                  return acc;
                },
                {} as Record<string, any>,
              );
          }

          if (suspendedTools && typeof suspendedTools === 'object') {
            if (metadata) {
              const entryKey = resolveEntryKey(suspendedTools);
              if (entryKey) {
                delete suspendedTools[entryKey];
              }
            } else {
              lastAssistantMessage.content.parts = lastAssistantMessage.content.parts?.map(part => {
                if (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') {
                  if (partMatches(part.data)) {
                    return {
                      ...part,
                      data: {
                        ...(part.data as any),
                        resumed: true,
                      },
                    };
                  }
                }
                return part;
              });
            }

            // If no more pending suspensions, remove the whole object
            if (metadata && Object.keys(suspendedTools).length === 0) {
              delete metadata[metadataKey];
            }

            // Flush to persist the metadata removal
            try {
              await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
            } catch (error) {
              logger?.error('Error removing tool suspension metadata:', error);
            }
          }
        }
      };

      // Helper function to flush messages before suspension
      const flushMessagesBeforeSuspension = async () => {
        const saveQueueManager = readScoped(scopeCtx, SAVE_QUEUE_MANAGER_KEY, 'saveQueueManager');
        const memoryConfig = readScoped(scopeCtx, MEMORY_CONFIG_KEY, 'memoryConfig');
        const threadId = readScoped(scopeCtx, THREAD_ID_KEY, 'threadId');
        const resourceId = readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId');
        const memory = readScoped(scopeCtx, MEMORY_KEY, 'memory');

        if (!saveQueueManager || !threadId) {
          return;
        }

        try {
          // Ensure thread exists before flushing messages
          const threadExists = readScoped(scopeCtx, THREAD_EXISTS_KEY, 'threadExists');
          if (memory && !threadExists && resourceId) {
            const thread = await memory.getThreadById?.({ threadId });
            if (!thread) {
              // Thread doesn't exist yet, create it now
              await memory.createThread?.({
                threadId,
                resourceId,
                memoryConfig,
              });
            }
            writeScoped(scopeCtx, THREAD_EXISTS_KEY, 'threadExists', true);
          }

          // Flush all pending messages immediately
          await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
        } catch (error) {
          logger?.error('Error flushing messages before suspension:', error);
        }
      };

      // Provider-executed tools are handled entirely by the stream path
      // (tool-call and tool-result chunks in llm-execution-step), so skip client execution.
      if (inputData.providerExecuted) {
        return inputData;
      }

      // Resolve the tool key for activeTools enforcement (may differ from toolName when matched by id)
      const toolKey = stepTools?.[inputData.toolName]
        ? inputData.toolName
        : Object.entries(stepTools || {}).find(([_, t]: [string, any]) => t === tool)?.[0];

      // Reject if tool doesn't exist or isn't in the active set for this step
      const isHiddenByActiveTools = stepActiveTools && toolKey && !stepActiveTools.includes(toolKey);
      if (!tool || isHiddenByActiveTools) {
        const availableToolNames = stepActiveTools ?? Object.keys(stepTools || {});
        const availableToolsStr =
          availableToolNames.length > 0 ? ` Available tools: ${availableToolNames.join(', ')}` : '';
        return {
          // The workflow step output crosses the evented engine's pubsub boundary, where
          // `JSON.stringify` reduces Error instances to `{}`. Serialize to a plain object
          // here so `name`/`message`/`stack` survive and the consumer can reify the Error.
          error: serializeToolError(
            new ToolNotFoundError(
              `Tool "${inputData.toolName}" not found.${availableToolsStr}. Call tools by their exact name only — never add prefixes, namespaces, or colons.`,
            ),
          ),
          ...inputData,
        };
      }

      if (tool && 'onInputAvailable' in tool) {
        try {
          await tool?.onInputAvailable?.({
            toolCallId: inputData.toolCallId,
            input: inputData.args,
            messages: messageList.get.input.aiV5.model(),
            abortSignal: options?.abortSignal,
          });
        } catch (error) {
          logger?.error('Error calling onInputAvailable', error);
        }
      }

      if (!tool.execute) {
        return inputData;
      }

      try {
        // The factory closure value is authoritative when set: a function-valued policy
        // doesn't survive `RequestContext.toJSON()` across the evented engine's event bus,
        // so reading only from requestContext would lose it. Fall back to requestContext for
        // direct callers (e.g. legacy tests) that seed the value there.
        const requireToolApproval =
          requireToolApprovalFromFactory ?? requestContext.get('__mastra_requireToolApproval');

        let resumeDataFromArgs: any = undefined;
        let args: any = inputData.args;

        if (typeof inputData.args === 'object' && inputData.args !== null) {
          const { resumeData: resumeDataFromInput, ...argsFromInput } = inputData.args;
          args = argsFromInput;
          resumeDataFromArgs = resumeDataFromInput;
        }

        const resumeData = resumeDataFromArgs ?? workflowResumeData;

        const isResumeToolCall = !!resumeDataFromArgs;

        // Check if approval is required.
        //
        // The global `requireToolApproval` option (boolean, or — new — a function evaluated per
        // call so policies can inspect the tool name and args, e.g. regex allowlists) and the
        // tool's own boolean `requireApproval` flag seed the decision: the call requires approval
        // if either is truthy.
        //
        // A per-tool `needsApprovalFn` (from `createTool({ requireApproval: fn })` or an
        // MCP-derived tool) is authoritative when present and OVERRIDES the seed — it may return
        // `false` to allow a call the global policy/flag would otherwise gate. This preserves the
        // long-standing precedence; the only new behavior is that the global may now be a function.
        // Any policy that throws defaults to requiring approval, to be safe.
        const buildApprovalContext = (): ToolApprovalContext => ({
          toolName: inputData.toolName,
          args,
          // Exclude the internal approval hook so policies only see public request-context entries.
          requestContext: requestContext
            ? Object.fromEntries(
                [...requestContext.entries()].filter(([key]) => key !== '__mastra_requireToolApproval'),
              )
            : {},
          workspace: readScoped(scopeCtx, STEP_WORKSPACE_KEY, 'stepWorkspace'),
        });

        let globalRequiresApproval: boolean;
        if (typeof requireToolApproval === 'function') {
          try {
            globalRequiresApproval = !!(await requireToolApproval(buildApprovalContext()));
          } catch (error) {
            logger?.error(`Error evaluating global requireToolApproval for tool ${inputData.toolName}:`, error);
            // On error, default to requiring approval to be safe.
            globalRequiresApproval = true;
          }
        } else {
          globalRequiresApproval = !!requireToolApproval;
        }

        let toolRequiresApproval: boolean = globalRequiresApproval || !!(tool as any).requireApproval;

        const needsApprovalFn = getNeedsApprovalFn(tool);
        if (needsApprovalFn) {
          // Per-tool needsApprovalFn overrides the seed (matches prior behavior).
          try {
            const { toolName: _toolName, ...needsApprovalCtx } = buildApprovalContext();
            toolRequiresApproval = !!(await needsApprovalFn(args, needsApprovalCtx));
          } catch (error) {
            // Log error to help developers debug faulty needsApprovalFn implementations
            logger?.error(`Error evaluating needsApprovalFn for tool ${inputData.toolName}:`, error);
            // On error, default to requiring approval to be safe
            toolRequiresApproval = true;
          }
        }

        // Schema for tool call approval - used for both streaming and metadata
        const approvalSchema = toStandardSchema(
          z.object({
            approved: z
              .boolean()
              .describe(
                'Controls if the tool call is approved or not, should be true when approved and false when declined',
              ),
          }),
        );

        if (toolRequiresApproval) {
          if (!resumeData) {
            await stopGoalActivity({
              agentId,
              runId,
              now: readScoped(scopeCtx, NOW_KEY, 'now'),
            });
            const approvalChunk = await transformChunk(
              {
                type: 'tool-call-approval',
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  args: inputData.args,
                  resumeSchema: JSON.stringify(standardSchemaToJSONSchema(approvalSchema)),
                },
              },
              'approval',
            );
            if (outputWriter) {
              await outputWriter(approvalChunk);
            } else {
              safeEnqueue(controller, approvalChunk);
            }

            // Add approval metadata to message before persisting
            addToolMetadata({
              toolCallId: inputData.toolCallId,
              toolName: inputData.toolName,
              args: inputData.args,
              type: 'approval',
              resumeSchema: JSON.stringify(standardSchemaToJSONSchema(approvalSchema)),
              metadata: approvalChunk.metadata,
            });

            // Flush messages before suspension to ensure they are persisted
            await flushMessagesBeforeSuspension();

            return suspend(
              {
                requireToolApproval: {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  args: inputData.args,
                },
                __streamState: streamState.serialize(),
                __agentId: agentId,
              },
              {
                resumeLabel: inputData.toolCallId,
              },
            );
          } else {
            // Remove approval metadata since we're resuming (either approved or declined)
            await removeToolMetadata({ toolCallId: inputData.toolCallId, toolName: inputData.toolName }, 'approval');

            if (!resumeData.approved) {
              // Return the approval decision (not a `result` string) so it persists as
              // `state: 'output-denied'` with `approval`. The denial reason carries the
              // existing string so downstream consumers/UI keep the same message.
              return {
                approval: {
                  id: inputData.toolCallId,
                  approved: false,
                  reason: 'Tool call was not approved by the user',
                },
                ...inputData,
              };
            }
          }
        }

        // When an approval-gated tool is approved on resume, tag the resolved output with the
        // approval decision so it round-trips through persistence as `approval: { approved: true }`.
        const approvalGrant =
          toolRequiresApproval && resumeData && (resumeData as { approved?: boolean }).approved === true
            ? ({ approval: { id: inputData.toolCallId, approved: true as const } } as const)
            : undefined;

        //this is to avoid passing resume data to the tool if it's not needed
        // For agent tools, always pass resume data so the agent tool wrapper knows to call
        // resumeStream instead of stream (otherwise the sub-agent restarts from scratch)
        const isAgentTool = inputData.toolName?.startsWith('agent-');
        const isWorkflowTool = inputData.toolName?.startsWith('workflow-');
        const resumeDataToPassToToolOptions =
          !isAgentTool && toolRequiresApproval && Object.keys(resumeData).length === 1 && 'approved' in resumeData
            ? undefined
            : resumeData;

        const toolOptions: MastraToolInvocationOptions = {
          abortSignal: options?.abortSignal,
          toolCallId: inputData.toolCallId,
          // Pass all messages (input + response + memory) so sub-agents (agent-* tools) receive
          // the full conversation context and can make better decisions. Each sub-agent invocation
          // uses a fresh unique thread, so storing this context in that thread is scoped and safe.
          messages: isAgentTool ? messageList.get.all.aiV5.model() : messageList.get.input.aiV5.model(),
          outputWriter,
          observe: noopObserve,
          // Pass current step span as parent for tool call spans
          tracingContext: modelSpanTracker?.getTracingContext(),
          // Pass workspace from the run scope (set by llmExecutionStep via prepareStep/processInputStep)
          workspace: readScoped(scopeCtx, STEP_WORKSPACE_KEY, 'stepWorkspace'),
          // Forward requestContext so tools receive values set by the workflow step
          requestContext,
          actor,
          // Let tools that read thread history mid-stream (e.g. forked subagents
          // cloning the parent thread) drain the save queue so the store reflects
          // the latest user/assistant messages before they read.
          flushMessages: (() => {
            const sqm = readScoped(scopeCtx, SAVE_QUEUE_MANAGER_KEY, 'saveQueueManager');
            const tid = readScoped(scopeCtx, THREAD_ID_KEY, 'threadId');
            const mcfg = readScoped(scopeCtx, MEMORY_CONFIG_KEY, 'memoryConfig');
            return sqm && tid ? () => sqm.flushMessages(messageList, tid, mcfg) : undefined;
          })(),
          suspend: async (suspendPayload: any, options?: SuspendOptions) => {
            if (options?.requireToolApproval) {
              await stopGoalActivity({
                agentId,
                runId,
                now: readScoped(scopeCtx, NOW_KEY, 'now'),
              });
              const approvalChunk = await transformChunk(
                {
                  type: 'tool-call-approval',
                  runId,
                  from: ChunkFrom.AGENT,
                  payload: {
                    toolCallId: inputData.toolCallId,
                    toolName: inputData.toolName,
                    args: inputData.args,
                    resumeSchema: JSON.stringify(
                      standardSchemaToJSONSchema(
                        toStandardSchema(
                          z.object({
                            approved: z
                              .boolean()
                              .describe(
                                'Controls if the tool call is approved or not, should be true when approved and false when declined',
                              ),
                          }),
                        ),
                      ),
                    ),
                  },
                },
                'approval',
              );
              if (outputWriter) {
                await outputWriter(approvalChunk);
              } else {
                safeEnqueue(controller, approvalChunk);
              }

              // Add approval metadata to message before persisting
              addToolMetadata({
                toolCallId: inputData.toolCallId,
                toolName: inputData.toolName,
                args: inputData.args,
                type: 'approval',
                suspendedToolRunId: options.runId,
                resumeSchema: JSON.stringify(
                  standardSchemaToJSONSchema(
                    toStandardSchema(
                      z.object({
                        approved: z
                          .boolean()
                          .describe(
                            'Controls if the tool call is approved or not, should be true when approved and false when declined',
                          ),
                      }),
                    ),
                  ),
                ),
                metadata: approvalChunk.metadata,
              });

              // Flush messages before suspension to ensure they are persisted
              await flushMessagesBeforeSuspension();

              return suspend(
                {
                  requireToolApproval: {
                    toolCallId: inputData.toolCallId,
                    toolName: inputData.toolName,
                    args: inputData.args,
                  },
                  __streamState: streamState.serialize(),
                  __agentId: agentId,
                  // Persist the inner suspended run id in the workflow snapshot, partitioned
                  // per tool call (resumeLabel = toolCallId). The shared per-message
                  // pendingToolApprovals metadata is keyed by toolName and flushed/rehydrated
                  // concurrently across parallel branches of the same assistant step, so for two
                  // delegations to the same sub-agent the second branch's entry is overwritten,
                  // leaving its run id unrecoverable on resume (AGENT_RESUME_NO_SNAPSHOT_FOUND).
                  // The foreach snapshot is collision-free, so it is the reliable source here.
                  suspendedToolRunId: options.runId,
                },
                {
                  resumeLabel: inputData.toolCallId,
                },
              );
            } else {
              const suspensionChunk = await transformChunk(
                {
                  type: 'tool-call-suspended',
                  runId,
                  from: ChunkFrom.AGENT,
                  payload: {
                    toolCallId: inputData.toolCallId,
                    toolName: inputData.toolName,
                    suspendPayload,
                    args: inputData.args,
                    resumeSchema: options?.resumeSchema,
                  },
                },
                'suspend',
                { suspendPayload },
              );
              safeEnqueue(controller, suspensionChunk);

              // Add suspension metadata to message before persisting
              addToolMetadata({
                toolCallId: inputData.toolCallId,
                toolName: inputData.toolName,
                args,
                suspendPayload,
                suspendedToolRunId: options?.runId,
                type: 'suspension',
                resumeSchema: options?.resumeSchema,
                metadata: suspensionChunk.metadata,
              });

              // Flush messages before suspension to ensure they are persisted
              await flushMessagesBeforeSuspension();

              return await suspend(
                {
                  toolCallSuspended: suspendPayload,
                  __streamState: streamState.serialize(),
                  __agentId: agentId,
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  resumeLabel: options?.resumeLabel,
                },
                {
                  resumeLabel: inputData.toolCallId,
                },
              );
            }
          },
          resumeData: resumeDataToPassToToolOptions,
        };

        //if resuming a subAgent or workflow tool, we want to find the runId from when it got suspended.
        // Also look up the runId when the LLM provided resumeData in args (isResumeToolCall)
        // but omitted suspendedToolRunId — without it, workflow tools start a fresh run and re-suspend.
        const needsRunIdLookup = resumeDataToPassToToolOptions && (isAgentTool || isWorkflowTool);
        if (needsRunIdLookup) {
          // Primary source: the per-iteration workflow suspend payload, which carries the
          // suspended run id partitioned per tool call (resumeLabel = toolCallId). This is
          // collision-free for parallel delegations to the same sub-agent, where the shared,
          // toolName-keyed per-message pendingToolApprovals metadata is overwritten by a sibling
          // branch — so the message lookup below would return the wrong (surviving) run id and
          // resume the wrong call (or fail with AGENT_RESUME_NO_SNAPSHOT_FOUND). The message
          // metadata / data parts remain as a fallback for page-refresh resumes where the
          // workflow snapshot is unavailable.
          let suspendedToolRunId = (suspendData as any)?.suspendedToolRunId || '';
          const shouldUsePartsFallback = !isResumeToolCall || !args.suspendedToolRunId;
          const messages = messageList.get.all.db();
          const assistantMessages = [...messages].reverse().filter(message => message.role === 'assistant');
          for (const message of assistantMessages) {
            if (suspendedToolRunId) break;
            const pendingOrSuspendedTools = (message.content.metadata?.suspendedTools ||
              message.content.metadata?.pendingToolApprovals) as Record<string, any>;
            if (pendingOrSuspendedTools) {
              // Entries are now keyed by toolCallId so parallel calls to the SAME tool each keep
              // their own suspension. Resolution order:
              //   1. Exact toolCallId match (key, then entry value) — used by approveToolCall-style
              //      resume where the resumed call id equals the suspended one.
              //   2. toolName match — used by autoResumeSuspendedTools, where resume happens via a
              //      fresh stream() turn so inputData.toolCallId differs from the suspended call.
              //      Also covers legacy metadata that was keyed by toolName.
              const entry =
                pendingOrSuspendedTools[inputData.toolCallId] ??
                Object.values(pendingOrSuspendedTools).find((e: any) => e?.toolCallId === inputData.toolCallId) ??
                pendingOrSuspendedTools[inputData.toolName] ??
                Object.values(pendingOrSuspendedTools).find((e: any) => e?.toolName === inputData.toolName);
              if (entry) {
                // Prefer the inner delegated run id — that's the run the sub-agent/workflow tool
                // must resume. `entry.runId` is the outer resumable run; older persisted entries
                // stored the inner run there, so it remains the fallback.
                suspendedToolRunId = entry.delegatedRunId ?? entry.runId;
                break;
              }
            }

            if (shouldUsePartsFallback) {
              const dataToolSuspendedParts = message.content.parts?.filter(
                part =>
                  (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
                  !(part.data as any).resumed,
              );
              if (dataToolSuspendedParts && dataToolSuspendedParts.length > 0) {
                // Prefer the part for this exact tool call; fall back to toolName for older parts
                // that may not carry a toolCallId.
                const foundTool =
                  dataToolSuspendedParts.find((part: any) => part.data.toolCallId === inputData.toolCallId) ??
                  dataToolSuspendedParts.find((part: any) => part.data.toolName === inputData.toolName);
                if (foundTool) {
                  suspendedToolRunId = (foundTool as any).data.delegatedRunId ?? (foundTool as any).data.runId;
                  break;
                }
              }
            }
          }

          if (suspendedToolRunId) {
            args.suspendedToolRunId = suspendedToolRunId;
          }
        }

        if (!toolRequiresApproval && isResumeToolCall) {
          await removeToolMetadata({ toolCallId: inputData.toolCallId, toolName: inputData.toolName }, 'suspension');
        }

        if (args === null || args === undefined) {
          return {
            error: serializeToolError(
              new Error(
                `Tool "${inputData.toolName}" received invalid arguments — the provided JSON could not be parsed. Please provide valid JSON arguments.`,
              ),
            ),
            ...inputData,
          };
        }

        if (isAgentTool) {
          if (typeof args === 'object' && args !== null && 'prompt' in args) {
            args.threadId = readScoped(scopeCtx, THREAD_ID_KEY, 'threadId');
            args.resourceId = readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId');
          }
        }

        // Tool-level FGA (TOOLS_EXECUTE) is enforced inside the tool wrapper
        // (`createExecute` in tools/tool-builder/builder.ts), which runs on every
        // execution path — inline, background dispatch, and durable steps — using
        // the canonical resource id (`<agentId>:<toolName>`, the MCP id, or the
        // standalone name). Checking here as well would authorize a bare,
        // non-canonical id that the durable path never checks, so it is not
        // duplicated (keeps regular and durable authorization identical).

        const llmBgOverrides =
          typeof args === 'object' && args !== null && '_background' in args ? args._background : undefined;

        if (llmBgOverrides) {
          delete args._background;
        }

        // --- Background task dispatch ---
        const backgroundTaskManager = readScoped(scopeCtx, BACKGROUND_TASK_MANAGER_KEY, 'backgroundTaskManager');
        const agentBgConfigCheck = readScoped(scopeCtx, AGENT_BACKGROUND_CONFIG_KEY, 'agentBackgroundConfig');
        // Skip background dispatch entirely when disabled (e.g., for sub-agents whose
        // entire invocation is itself dispatched as a background task by the parent)
        if (backgroundTaskManager && !agentBgConfigCheck?.disabled && typeof args === 'object' && args !== null) {
          const toolBgConfig = (tool as any).backgroundConfig as ToolBackgroundConfig | undefined;
          const agentBgConfig = agentBgConfigCheck;
          const managerConfig = readScoped(scopeCtx, BACKGROUND_TASK_MANAGER_CONFIG_KEY, 'backgroundTaskManagerConfig');

          const bgResolved = resolveBackgroundConfig({
            llmBgOverrides,
            toolName: inputData.toolName,
            toolConfig: toolBgConfig,
            agentConfig: agentBgConfig,
            managerConfig,
          });

          if (bgResolved.runInBackground) {
            // Resolve the tool executor from the current closure
            const stepTools = (readScoped(scopeCtx, STEP_TOOLS_KEY, 'stepTools') as Tools | undefined) || tools;
            const resolvedTool =
              stepTools?.[inputData.toolName] ||
              Object.values(stepTools || {})?.find((t: any) => 'id' in t && t.id === inputData.toolName);
            if (!resolvedTool?.execute) {
              throw new ToolNotFoundError(inputData.toolName);
            }
            let backgroundChunkTransformQueue: Promise<void> = Promise.resolve();
            const emittedReplayedToolCalls = new Set<string>();

            // Create a self-contained background task with per-stream hooks
            const bgTask = createBackgroundTask(backgroundTaskManager, {
              toolName: inputData.toolName,
              toolCallId: inputData.toolCallId,
              args: args as Record<string, unknown>,
              agentId,
              threadId: readScoped(scopeCtx, THREAD_ID_KEY, 'threadId'),
              resourceId: readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId'),
              timeoutMs: bgResolved.timeoutMs,
              maxRetries: bgResolved.maxRetries,
              runId,
              context: {
                // Executor — uses the tool from the current closure
                executor: {
                  execute: (
                    bgArgs: Record<string, unknown>,
                    opts?: {
                      abortSignal?: AbortSignal;
                      onProgress?: (chunk: BackgroundTaskProgressChunk) => Promise<void>;
                      suspend?: (data?: unknown, options?: SuspendOptions) => Promise<void>;
                      resumeData?: unknown;
                    },
                  ) => {
                    // Override the agent loop's `suspend`/`resumeData` (which
                    // would suspend the AGENT run via tool-call-approval) with
                    // the bg-task workflow's, so calling `suspend()` from the
                    // tool pauses the bg-task run instead.
                    return resolvedTool.execute!(bgArgs, {
                      ...toolOptions,
                      ...(opts?.resumeData !== undefined ? { resumeData: opts.resumeData } : {}),
                      suspend: async (data?: unknown, options?: SuspendOptions) => {
                        await toolOptions.suspend?.(data, options);
                        return opts?.suspend?.(data, options);
                      },
                      outputWriter: async (chunk: any) => {
                        await opts?.onProgress?.(chunk);
                        return toolOptions.outputWriter?.(chunk);
                      },
                      abortSignal: opts?.abortSignal,
                    } as any);
                  },
                },

                // Synthetic tool-call/tool-result emitter. Bg-task lifecycle
                // chunks (running/output/completed/failed/cancelled) are NOT
                // re-emitted here — `bgManager.stream(...)` is the single
                // source of truth for those. We only emit the synthetic
                // tool-call (at dispatch time) and tool-result / tool-error
                // chunks so UIs rendering this stream can show the tool's
                // outcome inline with the conversation.
                onChunk: chunk => {
                  backgroundChunkTransformQueue = backgroundChunkTransformQueue
                    .then(async () => {
                      const bgRunId = chunk.payload.runId;
                      const replayKey = `${bgRunId}:${chunk.payload.toolCallId}`;
                      if (
                        (bgRunId !== runId || (bgRunId === runId && workflowResumeData)) &&
                        !emittedReplayedToolCalls.has(replayKey)
                      ) {
                        safeEnqueue(
                          controller,
                          await transformChunk(
                            {
                              type: 'tool-call',
                              runId: bgRunId,
                              from: ChunkFrom.AGENT,
                              payload: {
                                toolCallId: chunk.payload.toolCallId,
                                toolName: chunk.payload.toolName,
                                args: inputData.args,
                                providerMetadata: inputData.providerMetadata as ProviderMetadata | undefined,
                                providerExecuted: inputData.providerExecuted,
                              },
                            },
                            'input-available',
                          ),
                        );
                        emittedReplayedToolCalls.add(replayKey);
                      }

                      if (chunk.type === 'background-task-completed') {
                        safeEnqueue(
                          controller,
                          await transformChunk(
                            {
                              type: 'tool-result',
                              runId: bgRunId,
                              from: ChunkFrom.AGENT,
                              payload: {
                                toolCallId: chunk.payload.toolCallId,
                                toolName: chunk.payload.toolName,
                                args: inputData.args,
                                result: chunk.payload.result,
                                providerMetadata: inputData.providerMetadata as ProviderMetadata | undefined,
                                providerExecuted: inputData.providerExecuted,
                              },
                            },
                            'output-available',
                            { output: chunk.payload.result },
                          ),
                        );
                      } else if (chunk.type === 'background-task-failed') {
                        safeEnqueue(
                          controller,
                          await transformChunk(
                            {
                              type: 'tool-error',
                              runId: bgRunId,
                              from: ChunkFrom.AGENT,
                              payload: {
                                toolCallId: chunk.payload.toolCallId,
                                toolName: chunk.payload.toolName,
                                error: chunk.payload.error,
                                args: inputData.args,
                                providerMetadata: inputData.providerMetadata as ProviderMetadata | undefined,
                                providerExecuted: inputData.providerExecuted,
                              },
                            },
                            'error',
                            { error: chunk.payload.error },
                          ),
                        );
                      }
                    })
                    .catch(error => {
                      logger?.warn?.('Error transforming background task stream chunk', {
                        toolCallId: chunk.payload.toolCallId,
                        toolName: chunk.payload.toolName,
                        runId: chunk.payload.runId,
                        error,
                        errorMessage: error instanceof Error ? error.message : undefined,
                        errorStack: error instanceof Error ? error.stack : undefined,
                      });
                    });
                },

                // Result injector — updates the existing tool-invocation in the
                // message list (keyed by toolCallId) with the real result, then
                // flushes to memory. This matters because the initial turn
                // persisted a placeholder ("Background task started...") as the
                // tool-result for the same toolCallId; appending a second
                // tool-result would leave two conflicting entries in memory and
                // the LLM on the next turn would re-dispatch the tool thinking
                // the research was still running.
                onResult: async params => {
                  const result =
                    params.status === 'failed'
                      ? `Background task failed: ${params.error?.message ?? 'Unknown error'}`
                      : params.result;
                  let transformCarrier = withToolPayloadTransformMetadata(
                    { metadata: {} as Record<string, any> },
                    await transformToolPayloadForTargets(
                      {
                        phase: 'input-available',
                        toolName: params.toolName,
                        toolCallId: params.toolCallId,
                        input: args,
                        providerMetadata: inputData.providerMetadata as Record<string, unknown> | undefined,
                      },
                      transformSource,
                      logger,
                    ),
                  );
                  transformCarrier = withToolPayloadTransformMetadata(
                    transformCarrier,
                    await transformToolPayloadForTargets(
                      {
                        phase: params.status === 'failed' ? 'error' : 'output-available',
                        toolName: params.toolName,
                        toolCallId: params.toolCallId,
                        input: args,
                        output: params.status === 'failed' ? undefined : params.result,
                        error: params.status === 'failed' ? params.error : undefined,
                        providerMetadata: inputData.providerMetadata as Record<string, unknown> | undefined,
                      },
                      transformSource,
                      logger,
                    ),
                  );
                  const transcriptArgsTransform = getTransformedToolPayload(
                    transformCarrier.metadata,
                    'transcript',
                    'input-available',
                  );
                  const transcriptResultTransform = getTransformedToolPayload(
                    transformCarrier.metadata,
                    'transcript',
                    params.status === 'failed' ? 'error' : 'output-available',
                  );
                  const transcriptArgs = hasTransformedToolPayload(transcriptArgsTransform)
                    ? transcriptArgsTransform.transformed
                    : args;
                  const transcriptResult = hasTransformedToolPayload(transcriptResultTransform)
                    ? transcriptResultTransform.transformed
                    : result;
                  const providerMetadata = withToolPayloadTransformProviderMetadata(
                    inputData.providerMetadata as ProviderMetadata | undefined,
                    transformCarrier.metadata,
                  ) as ProviderMetadata | undefined;

                  const updated = messageList.updateToolInvocation(
                    {
                      type: 'tool-invocation',
                      toolInvocation: {
                        state: 'result',
                        toolCallId: params.toolCallId,
                        toolName: params.toolName,
                        args,
                        result,
                        // Preserve the approval decision for an approved approval-gated tool that
                        // ran in the background so it round-trips on recall, matching the sync path
                        // and the "started" placeholder above.
                        ...(approvalGrant ?? {}),
                      },
                      ...(providerMetadata ? { providerMetadata } : {}),
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

                  // Fallback: no matching tool-invocation was found in the
                  // current message list (can happen if the initial run's
                  // message list was cleared, e.g. because the task completed
                  // after the process restarted and hooks were reattached
                  // without the original call). Append a standalone tool
                  // message so memory still records the result, even if it
                  // means a duplicate entry for that toolCallId.
                  if (!updated) {
                    if (params.runId !== runId || (params.runId === runId && workflowResumeData)) {
                      messageList.add(
                        [
                          {
                            role: 'tool' as const,
                            type: 'tool-call',
                            id: readScoped(scopeCtx, GENERATE_ID_KEY, 'generateId')?.() ?? randomUUID(),
                            createdAt: new Date(),
                            content: [
                              {
                                type: 'tool-call' as const,
                                toolCallId: params.toolCallId,
                                toolName: params.toolName,
                                args: transcriptArgs,
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
                              result: transcriptResult,
                              isError: params.status === 'failed',
                            },
                          ],
                        },
                      ],
                      'response',
                    );
                  }

                  // Flush to memory if available
                  {
                    const sqm = readScoped(scopeCtx, SAVE_QUEUE_MANAGER_KEY, 'saveQueueManager');
                    const tid = readScoped(scopeCtx, THREAD_ID_KEY, 'threadId');
                    if (sqm && tid) {
                      await sqm.flushMessages(
                        messageList,
                        tid,
                        readScoped(scopeCtx, MEMORY_CONFIG_KEY, 'memoryConfig'),
                      );
                    }
                  }
                },
                // Execution injector — records background task lifecycle metadata on the
                // assistant message without changing the model-visible tool result.
                onExecution: async params => {
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
                },

                // Per-task callbacks
                onComplete: toolBgConfig?.onComplete ?? agentBgConfig?.onTaskComplete,
                onFailed: toolBgConfig?.onFailed ?? agentBgConfig?.onTaskFailed,
              },
            });

            const isSuspended = await bgTask.checkIfSuspended({
              toolCallId: inputData.toolCallId,
              runId,
              agentId,
              threadId: readScoped(scopeCtx, THREAD_ID_KEY, 'threadId'),
              resourceId: readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId'),
              toolName: inputData.toolName,
            });
            if (isSuspended && resumeDataToPassToToolOptions) {
              const task = await bgTask.resume(resumeDataToPassToToolOptions);

              return {
                result: `Background task resumed. Task ID: ${task.id}. The tool "${inputData.toolName}" is running in the background. You will be notified when it completes.`,
                ...inputData,
              };
            }

            const { task, fallbackToSync } = await bgTask.dispatch();

            if (!fallbackToSync) {
              // Emit background-task-started chunk. Use safeEnqueue: the
              // agent stream may have closed by the time this fires (e.g.
              // when the controller closes mid-dispatch in a long-lived
              // streamUntilIdle wrapper) — without the guard, the throw
              // bubbles up through the AI-SDK-v5 tool builder and gets
              // wrapped as `TOOL_EXECUTION_FAILED: Invalid state:
              // Controller is already closed`.
              const backgroundTaskStartedChunk = {
                type: 'background-task-started' as const,
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  taskId: task.id,
                  toolName: inputData.toolName,
                  toolCallId: inputData.toolCallId,
                },
              };
              safeEnqueue(controller, backgroundTaskStartedChunk);
              try {
                await options?.onChunk?.(backgroundTaskStartedChunk);
              } catch (error) {
                logger?.warn?.('Error invoking onChunk for background-task-started', {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  error,
                  errorMessage: error instanceof Error ? error.message : undefined,
                  errorStack: error instanceof Error ? error.stack : undefined,
                });
              }

              // Return placeholder result so the LLM can continue
              return {
                result: `Background task started. Task ID: ${task.id}. The tool "${inputData.toolName}" is running in the background. You will be notified when it completes.`,
                ...inputData,
                ...(approvalGrant ?? {}),
              };
            }
            // fallbackToSync: concurrency limit hit, fall through to synchronous execution
          }
        }

        const rawResult = await tool.execute(args, toolOptions);
        const result = ensureSerializable(rawResult);

        // Call onOutput hook after successful execution
        if (tool && 'onOutput' in tool && typeof (tool as any).onOutput === 'function') {
          try {
            await (tool as any).onOutput({
              toolCallId: inputData.toolCallId,
              toolName: inputData.toolName,
              output: result,
              abortSignal: options?.abortSignal,
            });
          } catch (error) {
            logger?.error('Error calling onOutput', error);
          }
        }

        return { result, ...inputData, ...(approvalGrant ?? {}) };
      } catch (error) {
        // Re-throw FGA authorization errors instead of swallowing them
        if (error instanceof Error && error.name === 'FGADeniedError') {
          throw error;
        }
        return {
          error: serializeToolError(error),
          ...inputData,
        };
      }
    },
  });
}

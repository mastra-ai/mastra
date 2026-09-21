import { randomUUID } from 'node:crypto';
import type { ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod/v4';
import { normalizeModelOutput } from '../../../agent/durable/workflows/steps/normalize-model-output';
import { stopGoalActivity } from '../../../agent/goal';
import { resolveDeclineReason } from '../../../agent/tool-approval';
import {
  createToolCallIdentityDigest,
  parseToolApprovalDecision,
  parseToolApprovalGrant,
  toolApprovalEditedArgsSchema,
} from '../../../agent/tool-call-identity';
import type { ToolApprovalGrant } from '../../../agent/tool-call-identity';
import {
  ON_BEFORE_TOOL_EXECUTION_KEY,
  ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY,
  TOOL_PERMISSION_DENIED_ERROR_NAME,
  TOOL_PERMISSION_POLICY_KEY,
  type BeforeToolExecutionHook,
  type ToolPermissionPolicy,
} from '../../../agent/tool-permission-prefilter';
import { MastraFGAPermissions } from '../../../auth/ee';
import { createBackgroundTask } from '../../../background-tasks/create';
import { resolveBackgroundConfig } from '../../../background-tasks/resolve-config';
import type { BackgroundTaskProgressChunk, ToolBackgroundConfig } from '../../../background-tasks/types';
import type { MastraDBMessage } from '../../../memory';
import { BACKGROUND_WORK_CONTEXT, notifyBackgroundWorkTerminal } from '../../../processors/background-work-signals';
import { RequestContext } from '../../../request-context';
import { toStandardSchema, standardSchemaToJSONSchema } from '../../../schema';
import { safeEnqueue } from '../../../stream/base';
import { ChunkFrom } from '../../../stream/types';
import type { ChunkType, ProviderMetadata } from '../../../stream/types';
import { resolveToolApprovalRequirement } from '../../../tools/approval';
import {
  getTransformedToolPayload,
  hasTransformedToolPayload,
  transformToolPayloadForTargets,
  withToolPayloadTransformMetadata,
  withToolPayloadTransformProviderMetadata,
} from '../../../tools/payload-transform';
import { findProviderToolByName } from '../../../tools/provider-tool-utils';
import type { MastraToolInvocationOptions, RequireToolApproval } from '../../../tools/types';
import { ensureSerializable } from '../../../utils';
import type { InnerOutput, SuspendOptions } from '../../../workflows/step';
import { createStep } from '../../../workflows/workflow';
import type { RunScopeContext } from '../../run-scope-access';
import { readScoped, writeScoped } from '../../run-scope-access';
import {
  AGENT_BACKGROUND_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_KEY,
  EDITED_APPROVAL_RESUME_LOADER_KEY,
  GENERATE_ID_KEY,
  MEMORY_CONFIG_KEY,
  MEMORY_KEY,
  NOW_KEY,
  RESOURCE_ID_KEY,
  SAVE_QUEUE_MANAGER_KEY,
  STEP_ACTIVE_TOOLS_KEY,
  STEP_MODEL_MESSAGES_KEY,
  STEP_TOOLS_KEY,
  STEP_WORKSPACE_KEY,
  THREAD_EXISTS_KEY,
  THREAD_ID_KEY,
  TOOL_PAYLOAD_TRANSFORM_KEY,
} from '../../run-scope-keys';
import { raceAgainstAbort } from '../../timeout';
import type { OuterLLMRun } from '../../types';
import { serializeToolError, ToolNotFoundError } from '../errors';
import { toolCallInputSchema, toolCallOutputSchema } from '../schema';
import { notifyToolDenied, TOOL_DENIED_CALLBACK_KEY, type ToolDeniedCallback } from './tool-permission-notify';

type AddToolMetadataOptions = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  parentToolName?: string;
  parentArgs?: unknown;
  resumeSchema: string;
  suspendedToolRunId?: string;
  approval?: ToolApprovalGrant;
  approvalSource?: 'tool-gate' | 'tool-execution';
  approvalInputIdentityDigest?: string;
  approvedArgs?: Record<string, unknown>;
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

type HarnessToolContextSlot = {
  registerQuestion?: (params: Record<string, unknown>) => Promise<void>;
  registerPlanApproval?: (params: Record<string, unknown>) => Promise<void>;
};

function buildToolRequestContext(
  requestContext: RequestContext,
  opts: { runId: string; toolCallId: string },
): RequestContext {
  const harness = requestContext.get('harness') as HarnessToolContextSlot | undefined;
  if (!harness?.registerQuestion && !harness?.registerPlanApproval) return requestContext;

  const overlay = new RequestContext<unknown>(
    Array.from(requestContext.entries() as IterableIterator<[string, unknown]>),
  );
  overlay.set('harness', {
    ...harness,
    ...(harness.registerQuestion
      ? {
          registerQuestion: async (params: Record<string, unknown>) =>
            harness.registerQuestion!({
              ...params,
              runId: typeof params.runId === 'string' ? params.runId : opts.runId,
              toolCallId: typeof params.toolCallId === 'string' ? params.toolCallId : opts.toolCallId,
            }),
        }
      : {}),
    ...(harness.registerPlanApproval
      ? {
          registerPlanApproval: async (params: Record<string, unknown>) =>
            harness.registerPlanApproval!({
              ...params,
              runId: typeof params.runId === 'string' ? params.runId : opts.runId,
              toolCallId: typeof params.toolCallId === 'string' ? params.toolCallId : opts.toolCallId,
            }),
        }
      : {}),
  });
  return overlay;
}

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
  agentVersionId,
  mastra,
  requireToolApproval: requireToolApprovalFromFactory,
  requestContext: factoryRequestContext,
  actor,
  mcp,
}: OuterLLMRun<Tools, OUTPUT>) {
  // Function-valued requestContext entries do not survive `RequestContext.toJSON()`
  // across the evented engine's event bus. The factory closure captured the live
  // turn context, so these reads are authoritative — same pattern as
  // `requireToolApproval` above. The execute-time requestContext remains the
  // fallback for direct callers that seed the entries there.
  const toolPermissionPolicyFromFactory = factoryRequestContext?.get(TOOL_PERMISSION_POLICY_KEY) as
    | ToolPermissionPolicy
    | undefined;
  const onBeforeToolExecutionFromFactory = factoryRequestContext?.get(ON_BEFORE_TOOL_EXECUTION_KEY) as
    | BeforeToolExecutionHook
    | undefined;
  const onToolDeniedFromFactory = factoryRequestContext?.get(TOOL_DENIED_CALLBACK_KEY) as
    | ToolDeniedCallback
    | undefined;
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

        const transformedChunk = withToolPayloadTransformMetadata(
          withToolPayloadTransformMetadata(chunk, inputTransform),
          transform,
        ) as ChunkType<OUTPUT>;
        if (transformedChunk.type !== 'tool-call-approval' && transformedChunk.type !== 'tool-call-suspended') {
          return transformedChunk;
        }

        const displayInputTransform = getTransformedToolPayload(
          transformedChunk.metadata,
          'display',
          'input-available',
        );
        const displayPhaseTransform = getTransformedToolPayload(transformedChunk.metadata, 'display', phase);
        const resumeArgs =
          phase === 'approval'
            ? hasTransformedToolPayload(displayPhaseTransform)
              ? displayPhaseTransform.transformed
              : transformInput
            : hasTransformedToolPayload(displayInputTransform)
              ? displayInputTransform.transformed
              : transformInput;

        return {
          ...transformedChunk,
          payload: {
            ...transformedChunk.payload,
            resumeIdentityDigest: createToolCallIdentityDigest({
              toolCallId: transformToolCallId,
              toolName: transformToolName,
              args: resumeArgs,
            }),
          },
        } as ChunkType<OUTPUT>;
      };

      const addToolMetadata = ({
        toolCallId,
        toolName,
        args,
        parentToolName,
        parentArgs,
        suspendPayload,
        resumeSchema,
        type,
        suspendedToolRunId,
        approval,
        approvalSource,
        approvalInputIdentityDigest,
        approvedArgs,
        metadata: toolStateTransformMetadata,
      }: AddToolMetadataOptions) => {
        const metadataKey = type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';
        const inputTransform = getTransformedToolPayload(toolStateTransformMetadata, 'transcript', 'input-available');
        const approvalTransform = getTransformedToolPayload(toolStateTransformMetadata, 'transcript', 'approval');
        const suspendTransform = getTransformedToolPayload(toolStateTransformMetadata, 'transcript', 'suspend');
        const transformedArgs =
          type === 'approval'
            ? hasTransformedToolPayload(approvalTransform)
              ? approvalTransform.transformed
              : hasTransformedToolPayload(inputTransform)
                ? inputTransform.transformed
                : args
            : hasTransformedToolPayload(inputTransform)
              ? inputTransform.transformed
              : args;
        const transformedSuspendPayload =
          type === 'suspension'
            ? hasTransformedToolPayload(suspendTransform)
              ? suspendTransform.transformed
              : suspendPayload
            : undefined;
        const entry = {
          version: 1,
          originRunId: runId,
          stepId: 'toolCallStep',
          toolCallId,
          toolName,
          identityDigest: createToolCallIdentityDigest({ toolCallId, toolName, args }),
          resumeIdentityDigest: createToolCallIdentityDigest({ toolCallId, toolName, args: transformedArgs }),
          args: transformedArgs,
          ...(parentToolName ? { parentToolName, parentArgs } : {}),
          type,
          runId,
          ...(suspendedToolRunId && suspendedToolRunId !== runId ? { delegatedRunId: suspendedToolRunId } : {}),
          ...(approval ? { approval } : {}),
          ...(approvalSource ? { approvalSource } : {}),
          ...(approvalInputIdentityDigest ? { approvalInputIdentityDigest } : {}),
          ...(approvedArgs ? { approvedArgs } : {}),
          ...(type === 'suspension' ? { suspendPayload: transformedSuspendPayload } : {}),
          resumeSchema,
          ...(toolStateTransformMetadata ? { metadata: toolStateTransformMetadata } : {}),
        };
        const carriesToolCall = (message: MastraDBMessage) =>
          message.role === 'assistant' &&
          (message.content?.parts ?? []).some(
            part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId,
          );

        const responseMessages = messageList.get.response.db();
        const responseMessage = [...responseMessages].reverse().find(carriesToolCall);
        if (responseMessage?.content) {
          const metadata =
            typeof responseMessage.content.metadata === 'object' && responseMessage.content.metadata !== null
              ? (responseMessage.content.metadata as Record<string, any>)
              : {};
          responseMessage.content.metadata = metadata;
          metadata[metadataKey] = metadata[metadataKey] || {};
          metadata[metadataKey][toolCallId] = entry;
          return;
        }

        const target = [...messageList.get.all.db()].reverse().find(carriesToolCall);
        if (!target?.content) {
          logger?.warn?.(
            `addToolMetadata could not find an assistant message for tool call ${toolCallId} (${toolName}); ${metadataKey} entry was not persisted.`,
          );
          return;
        }
        const existingMetadata =
          typeof target.content.metadata === 'object' && target.content.metadata !== null
            ? (target.content.metadata as Record<string, any>)
            : {};
        const existingEntries = (existingMetadata[metadataKey] ?? {}) as Record<string, any>;
        const updated = messageList.updateMessageMetadataByToolCallId(toolCallId, {
          [metadataKey]: { ...existingEntries, [toolCallId]: entry },
        });
        if (!updated) {
          logger?.debug?.(
            `addToolMetadata could not update the assistant message for tool call ${toolCallId} (${toolName}); ${metadataKey} entry was not persisted.`,
          );
        }
      };

      const removeToolMetadata = async (toolCallId: string, toolName: string, type: 'suspension' | 'approval') => {
        const { saveQueueManager, memoryConfig, threadId } = _internal || {};

        if (!saveQueueManager || !threadId) {
          return;
        }

        // Resume authentication and metadata deletion are call-ID based. Parallel
        // calls may share a tool name, so a name fallback could delete a sibling.
        const resolveEntryKey = (entries: Record<string, any> | undefined): string | undefined => {
          if (!entries) return undefined;
          if (entries[toolCallId]) return toolCallId;
          return Object.keys(entries).find(key => entries[key]?.toolCallId === toolCallId);
        };

        const partMatches = (data: any): boolean => data?.toolCallId === toolCallId;

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
                Object.create(null) as Record<string, any>,
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
            if (saveQueueManager && threadId) {
              try {
                await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
              } catch (error) {
                logger?.error('Error removing tool suspension metadata:', error);
              }
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

        if (!saveQueueManager || !threadId || memoryConfig?.readOnly) {
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

      let approvalGrant: { approval: ToolApprovalGrant } | undefined;
      let verifiedApprovedArgs: Record<string, unknown> | undefined;
      let resumeTargetToolCallId: string | undefined;
      let resumedFromSuspension = false;

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

        let resumeData = resumeDataFromArgs !== undefined ? resumeDataFromArgs : workflowResumeData;
        // An APPROVAL decision may only arrive through the workflow resume boundary
        // (`agent.resumeStream` / the durable resume envelope). `resumeData` the model wrote
        // into its own tool arguments is untrusted: the pending approval's coordinates —
        // toolCallId, args, even `identityDigest` — are persisted on the
        // `data-tool-call-approval` part the model can read back, so identity alone does not
        // establish human consent. Suspension-typed args-borne resume (autoResumeSuspendedTools)
        // is unaffected; only consent is boundary-only.
        let isModelAuthoredResumeData = resumeDataFromArgs !== undefined;

        let isResumeToolCall = resumeDataFromArgs !== undefined;
        const isAgentTool = inputData.toolName?.startsWith('agent-');
        const isWorkflowTool = inputData.toolName?.startsWith('workflow-');
        const suspendedToolCallId =
          isResumeToolCall && typeof args?.suspendedToolCallId === 'string' && args.suspendedToolCallId.length > 0
            ? args.suspendedToolCallId
            : undefined;
        if (args && typeof args === 'object' && Object.hasOwn(args, 'suspendedToolCallId')) {
          const { suspendedToolCallId: _suspendedToolCallId, ...argsWithoutCallId } = args;
          args = argsWithoutCallId;
        }
        const suppliedSuspendedToolRunId =
          isResumeToolCall && typeof args?.suspendedToolRunId === 'string' && args.suspendedToolRunId.length > 0
            ? args.suspendedToolRunId
            : undefined;
        if (args && typeof args === 'object' && Object.hasOwn(args, 'suspendedToolRunId')) {
          const { suspendedToolRunId: _suspendedToolRunId, ...argsWithoutRunId } = args;
          args = argsWithoutRunId;
        }
        const metadataToolCallId = suspendedToolCallId ?? inputData.toolCallId;
        let identityArgs = args;
        let expectedIdentityDigest = createToolCallIdentityDigest({
          toolCallId: metadataToolCallId,
          toolName: inputData.toolName,
          args: identityArgs,
        });
        // Keep the digest for the arguments supplied to this workflow execution separate
        // from the canonical approved arguments restored below. A new suspension created
        // by an auto-resume must bind to those supplied arguments; an authoritative snapshot
        // replay keeps the digest carried by that snapshot.
        const workflowInputIdentityDigest = expectedIdentityDigest;
        let expectedResumeIdentity = {
          version: 1,
          originRunId: runId,
          stepId: 'toolCallStep',
          toolCallId: metadataToolCallId,
          toolName: inputData.toolName,
          identityDigest: expectedIdentityDigest,
        } as const;
        let approvedArgsResume:
          | {
              approvalInputIdentityDigest: string;
              approvedArgs: Record<string, unknown>;
            }
          | undefined;
        const matchesExpectedResumeIdentity = (value: unknown) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
          const record = value as Record<string, unknown>;
          return Object.entries(expectedResumeIdentity).every(
            ([key, expected]) => Object.hasOwn(record, key) && record[key] === expected,
          );
        };
        const getStoredResumeIdentityMatch = (value: unknown, expectedType: 'approval' | 'suspension') => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
          const record = value as Record<string, unknown>;
          const hasValidIdentityEnvelope =
            Object.hasOwn(record, 'version') &&
            record.version === 1 &&
            Object.hasOwn(record, 'originRunId') &&
            typeof record.originRunId === 'string' &&
            record.originRunId.length > 0 &&
            Object.hasOwn(record, 'runId') &&
            typeof record.runId === 'string' &&
            record.runId.length > 0 &&
            Object.hasOwn(record, 'type') &&
            record.type === expectedType &&
            Object.hasOwn(record, 'stepId') &&
            record.stepId === 'toolCallStep' &&
            Object.hasOwn(record, 'toolCallId') &&
            record.toolCallId === metadataToolCallId &&
            Object.hasOwn(record, 'toolName') &&
            record.toolName === inputData.toolName &&
            Object.hasOwn(record, 'identityDigest');
          if (!hasValidIdentityEnvelope) return undefined;
          if (record.identityDigest === expectedIdentityDigest) return 'canonical' as const;
          if (record.resumeIdentityDigest === expectedIdentityDigest) return 'resume' as const;
          return undefined;
        };
        const getStoredCanonicalArgs = (message: MastraDBMessage, record: Record<string, unknown>) => {
          if (typeof record.identityDigest !== 'string') return undefined;
          const structuredPart = message.content.parts?.find(
            part => part.type === 'tool-invocation' && part.toolInvocation?.toolCallId === metadataToolCallId,
          );
          const structuredArgs =
            structuredPart?.type === 'tool-invocation' ? structuredPart.toolInvocation?.args : undefined;
          const legacyArgs = message.content.toolInvocations?.find(
            invocation => invocation.toolCallId === metadataToolCallId,
          )?.args;
          const candidates = [
            structuredArgs,
            legacyArgs,
            Object.hasOwn(record, 'args') ? record.args : undefined,
            // Edited approvals retain their canonical arguments separately when
            // transcript transforms redact the visible invocation and metadata
            // `args`. The identity digest authenticates this candidate exactly as
            // it does the ordinary structured/legacy candidates above.
            Object.hasOwn(record, 'approvedArgs') ? record.approvedArgs : undefined,
          ].filter(candidate => candidate !== undefined);
          return candidates.find(
            candidate =>
              createToolCallIdentityDigest({
                toolCallId: metadataToolCallId,
                toolName: inputData.toolName,
                args: candidate,
              }) === record.identityDigest,
          );
        };
        const readStoredResumeMetadata = (
          stored: unknown,
          type: 'approval' | 'suspension',
          message: MastraDBMessage,
        ) => {
          const storedRecord =
            stored && typeof stored === 'object' && !Array.isArray(stored)
              ? (stored as Record<string, unknown>)
              : undefined;
          const identityMatch = getStoredResumeIdentityMatch(stored, type);
          return {
            type,
            // Delegated entries persist the OUTER resumable run under `runId` and
            // the delegate's inner suspended run under `delegatedRunId`. Resume
            // validation and the wrapper handoff both need the inner run, so
            // surface it here (mirrors auto-resume-system-message).
            runId:
              typeof storedRecord?.delegatedRunId === 'string'
                ? storedRecord.delegatedRunId
                : typeof storedRecord?.runId === 'string'
                  ? storedRecord.runId
                  : undefined,
            originRunId: typeof storedRecord?.originRunId === 'string' ? storedRecord.originRunId : undefined,
            identityDigest: typeof storedRecord?.identityDigest === 'string' ? storedRecord.identityDigest : undefined,
            identityMatches: identityMatch !== undefined,
            identityMatch,
            canonicalArgs: storedRecord ? getStoredCanonicalArgs(message, storedRecord) : undefined,
            approval: parseToolApprovalGrant(storedRecord?.approval, metadataToolCallId),
            approvalSource:
              storedRecord?.approvalSource === 'tool-gate' || storedRecord?.approvalSource === 'tool-execution'
                ? storedRecord.approvalSource
                : undefined,
            approvalInputIdentityDigest:
              typeof storedRecord?.approvalInputIdentityDigest === 'string'
                ? storedRecord.approvalInputIdentityDigest
                : undefined,
            approvedArgs: storedRecord?.approvedArgs,
          };
        };
        const getStoredResumeMetadata = (toolCallId: string) => {
          const messages = [...messageList.get.all.db()].reverse().filter(message => message.role === 'assistant');
          for (const message of messages) {
            const metadata =
              typeof message.content.metadata === 'object' && message.content.metadata !== null
                ? (message.content.metadata as Record<string, any>)
                : undefined;
            if (metadata?.pendingToolApprovals && Object.hasOwn(metadata.pendingToolApprovals, toolCallId)) {
              const stored = metadata.pendingToolApprovals[toolCallId];
              return readStoredResumeMetadata(stored, 'approval', message);
            }
            if (metadata?.suspendedTools && Object.hasOwn(metadata.suspendedTools, toolCallId)) {
              const stored = metadata.suspendedTools[toolCallId];
              return readStoredResumeMetadata(stored, 'suspension', message);
            }

            const foundPart = message.content.parts?.find(
              part =>
                (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
                (part.data as any).toolCallId === toolCallId &&
                !(part.data as any).resumed,
            );
            if (foundPart?.type === 'data-tool-call-approval') {
              return readStoredResumeMetadata(foundPart.data, 'approval', message);
            }
            if (foundPart?.type === 'data-tool-call-suspended') {
              return readStoredResumeMetadata(foundPart.data, 'suspension', message);
            }
          }
          return undefined;
        };
        let storedResumeMetadata = resumeData !== undefined ? getStoredResumeMetadata(metadataToolCallId) : undefined;
        let hasSuspendedToolRunIdMismatch =
          suppliedSuspendedToolRunId !== undefined &&
          storedResumeMetadata?.runId !== undefined &&
          suppliedSuspendedToolRunId !== storedResumeMetadata.runId;
        const hasStoredOriginRunMismatch =
          storedResumeMetadata?.originRunId !== undefined && storedResumeMetadata.originRunId !== runId;
        const authoritativeResumeEnvelope =
          suspendData && typeof suspendData === 'object' && !Array.isArray(suspendData)
            ? (suspendData as Record<string, unknown>).toolCallResume
            : undefined;
        const hasAuthoritativeResumeEnvelope = authoritativeResumeEnvelope !== undefined;
        const editedApprovalResumeLoader = readScoped(
          scopeCtx,
          EDITED_APPROVAL_RESUME_LOADER_KEY,
          'editedApprovalResumeLoader',
        );
        const hasEditedApprovalMarker =
          storedResumeMetadata?.approval !== undefined || storedResumeMetadata?.approvalSource === 'tool-gate';
        const needsEditedApprovalResumeRecovery =
          !hasAuthoritativeResumeEnvelope &&
          !isAgentTool &&
          !isWorkflowTool &&
          resumeData !== undefined &&
          storedResumeMetadata?.type === 'suspension' &&
          storedResumeMetadata.identityMatches === true &&
          storedResumeMetadata.identityMatch === 'resume' &&
          hasEditedApprovalMarker &&
          storedResumeMetadata.canonicalArgs === undefined &&
          storedResumeMetadata.approvedArgs === undefined &&
          typeof storedResumeMetadata.runId === 'string' &&
          typeof storedResumeMetadata.originRunId === 'string' &&
          typeof storedResumeMetadata.identityDigest === 'string';
        if (
          needsEditedApprovalResumeRecovery &&
          editedApprovalResumeLoader &&
          storedResumeMetadata &&
          typeof storedResumeMetadata.runId === 'string' &&
          typeof storedResumeMetadata.originRunId === 'string' &&
          typeof storedResumeMetadata.identityDigest === 'string'
        ) {
          const recovered = await editedApprovalResumeLoader({
            runId: storedResumeMetadata.runId,
            originRunId: storedResumeMetadata.originRunId,
            toolCallId: metadataToolCallId,
            toolName: inputData.toolName,
            identityDigest: storedResumeMetadata.identityDigest,
            requestContext,
            threadId: readScoped(scopeCtx, THREAD_ID_KEY, 'threadId'),
            resourceId: readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId'),
            actor,
          });
          if (recovered) {
            // Keep the secret snapshot data local to this execution. Recalled
            // transcript metadata is intentionally redacted and must not be
            // repopulated with private approval arguments.
            storedResumeMetadata = {
              ...storedResumeMetadata,
              canonicalArgs: recovered.approvedArgs,
              approvedArgs: recovered.approvedArgs,
              approvalInputIdentityDigest: recovered.approvalInputIdentityDigest,
            };
          }
        }
        // A tool that suspends after an edited approval retains both the original
        // workflow-input identity and the approved arguments. Authenticate the
        // original input before restoring those arguments from the snapshot.
        const approvedArgsEnvelope = authoritativeResumeEnvelope as
          | {
              approvalInputIdentityDigest?: unknown;
              approvedArgs?: unknown;
              identityDigest?: unknown;
            }
          | undefined;
        const hasApprovedArgsEnvelope =
          approvedArgsEnvelope?.approvedArgs !== undefined &&
          typeof approvedArgsEnvelope.approvalInputIdentityDigest === 'string' &&
          toolApprovalEditedArgsSchema.safeParse(approvedArgsEnvelope.approvedArgs).success &&
          createToolCallIdentityDigest({
            toolCallId: metadataToolCallId,
            toolName: inputData.toolName,
            args: approvedArgsEnvelope.approvedArgs,
          }) === approvedArgsEnvelope.identityDigest;
        const hasStoredApprovedArgsFields =
          storedResumeMetadata?.approvedArgs !== undefined ||
          storedResumeMetadata?.approvalInputIdentityDigest !== undefined;
        const hasStoredApprovedArgs =
          !hasAuthoritativeResumeEnvelope &&
          storedResumeMetadata?.type === 'suspension' &&
          storedResumeMetadata.approvedArgs !== undefined &&
          typeof storedResumeMetadata.approvalInputIdentityDigest === 'string' &&
          toolApprovalEditedArgsSchema.safeParse(storedResumeMetadata.approvedArgs).success &&
          createToolCallIdentityDigest({
            toolCallId: metadataToolCallId,
            toolName: inputData.toolName,
            args: storedResumeMetadata.approvedArgs,
          }) === storedResumeMetadata.identityDigest;
        const authoritativeIdentityMatches =
          hasAuthoritativeResumeEnvelope &&
          (matchesExpectedResumeIdentity(authoritativeResumeEnvelope) ||
            (hasApprovedArgsEnvelope &&
              matchesExpectedResumeIdentity({
                ...(authoritativeResumeEnvelope as object),
                identityDigest: approvedArgsEnvelope.approvalInputIdentityDigest,
              })));
        // Some providers materialize optional workflow/agent-tool control fields
        // as null on a fresh call. When the workflow engine is explicitly resuming
        // that call, its resume data must win over the provider placeholder. This
        // only applies when the provider supplied no non-empty resume coordinate;
        // model-driven resumes keep their identity evidence and remain fail-closed
        // in the checks below. The authoritative envelope is still validated before
        // the workflow resume data can be consumed.
        const isIdentityFreeProviderNullResume =
          isResumeToolCall &&
          resumeDataFromArgs === null &&
          suspendedToolCallId === undefined &&
          suppliedSuspendedToolRunId === undefined;
        if (isIdentityFreeProviderNullResume && workflowResumeData !== undefined) {
          resumeData = workflowResumeData;
          isResumeToolCall = false;
          // The effective payload now comes from the workflow boundary, not the provider
          // placeholder, so it is no longer model-authored.
          isModelAuthoredResumeData = false;
        }

        // Null is also a valid resumed tool payload, so a fresh provider null is
        // normalized to undefined only when no workflow, durable, or caller-supplied
        // resume evidence exists.
        const isEvidenceFreeNullResumePlaceholder =
          isIdentityFreeProviderNullResume &&
          workflowResumeData === undefined &&
          !hasAuthoritativeResumeEnvelope &&
          storedResumeMetadata === undefined;
        if (isEvidenceFreeNullResumePlaceholder) {
          resumeData = undefined;
          isResumeToolCall = false;
        }
        const authoritativeResumeType = authoritativeIdentityMatches
          ? (authoritativeResumeEnvelope as { type?: unknown }).type
          : undefined;
        const authoritativeApprovalSource = authoritativeIdentityMatches
          ? (authoritativeResumeEnvelope as { approvalSource?: unknown }).approvalSource
          : undefined;
        const hasKnownAuthoritativeResumeType =
          authoritativeResumeType === 'approval' || authoritativeResumeType === 'suspension';
        const hasAuthoritativeWorkflowResumeData =
          workflowResumeData !== undefined &&
          authoritativeIdentityMatches &&
          hasKnownAuthoritativeResumeType &&
          !(resumeDataFromArgs === null && suppliedSuspendedToolRunId !== undefined);
        if (hasAuthoritativeWorkflowResumeData) {
          // A validated workflow snapshot is the resume boundary. Provider-replayed args can
          // retain an older resume payload and suspended-run coordinate; preserve the mapped
          // tool call identity, but let the boundary payload win and clear that stale mismatch.
          resumeData = workflowResumeData;
          isModelAuthoredResumeData = false;
          hasSuspendedToolRunIdMismatch = false;
        }
        const effectiveResumeType = hasAuthoritativeResumeEnvelope
          ? hasKnownAuthoritativeResumeType
            ? authoritativeResumeType
            : undefined
          : storedResumeMetadata?.type;
        const effectiveApprovalSource =
          authoritativeApprovalSource === 'tool-gate' || authoritativeApprovalSource === 'tool-execution'
            ? authoritativeApprovalSource
            : storedResumeMetadata?.approvalSource;
        const approvalDecision = parseToolApprovalDecision(resumeData);
        const hasApprovalResumeShape = approvalDecision !== undefined;
        const approvalDeclineReason = resolveDeclineReason(resumeData);
        const authoritativeDelegatedRunId =
          suspendData &&
          typeof suspendData === 'object' &&
          !Array.isArray(suspendData) &&
          typeof (suspendData as { suspendedToolRunId?: unknown }).suspendedToolRunId === 'string' &&
          (suspendData as { suspendedToolRunId: string }).suspendedToolRunId.length > 0
            ? (suspendData as { suspendedToolRunId: string }).suspendedToolRunId
            : undefined;
        const isDelegatedApprovalResume =
          hasApprovalResumeShape &&
          effectiveResumeType === 'approval' &&
          !hasSuspendedToolRunIdMismatch &&
          ((authoritativeIdentityMatches && authoritativeDelegatedRunId !== undefined) ||
            ((isAgentTool || isWorkflowTool) &&
              storedResumeMetadata?.identityMatches === true &&
              storedResumeMetadata.runId &&
              storedResumeMetadata.originRunId &&
              storedResumeMetadata.runId !== storedResumeMetadata.originRunId));
        const hasResumeIdentityMismatch =
          ((approvedArgsEnvelope?.approvedArgs !== undefined ||
            approvedArgsEnvelope?.approvalInputIdentityDigest !== undefined) &&
            !hasApprovedArgsEnvelope) ||
          (!hasAuthoritativeResumeEnvelope && hasStoredApprovedArgsFields && !hasStoredApprovedArgs) ||
          (hasAuthoritativeResumeEnvelope && (!authoritativeIdentityMatches || !hasKnownAuthoritativeResumeType)) ||
          (!hasAuthoritativeResumeEnvelope && storedResumeMetadata?.identityMatches === false);
        const isKnownApprovalResume =
          effectiveResumeType === 'approval' &&
          (authoritativeResumeType === 'approval' || storedResumeMetadata?.identityMatches === true) &&
          !isDelegatedApprovalResume;
        const isKnownSuspensionResume =
          effectiveResumeType === 'suspension' &&
          (authoritativeResumeType === 'suspension' || storedResumeMetadata?.identityMatches === true);
        resumedFromSuspension = isKnownSuspensionResume;
        const isApprovalResumeData = hasApprovalResumeShape && isKnownApprovalResume && !isModelAuthoredResumeData;
        const isAnyResume = Boolean(isApprovalResumeData || isKnownSuspensionResume || isDelegatedApprovalResume);
        const isToolExecutionApprovalResume = isApprovalResumeData && effectiveApprovalSource === 'tool-execution';
        const persistedApprovalGrant =
          effectiveResumeType === 'suspension'
            ? hasAuthoritativeResumeEnvelope && authoritativeIdentityMatches
              ? parseToolApprovalGrant(
                  (authoritativeResumeEnvelope as Record<string, unknown>).approval,
                  metadataToolCallId,
                )
              : storedResumeMetadata?.identityMatches === true
                ? storedResumeMetadata.approval
                : undefined
            : undefined;
        const needsCanonicalArgsRestore =
          storedResumeMetadata?.identityMatch === 'resume' &&
          !(authoritativeIdentityMatches && hasApprovedArgsEnvelope);
        const isCanonicalArgsUnavailable =
          needsCanonicalArgsRestore && storedResumeMetadata?.canonicalArgs === undefined;
        const hasInvalidResumeData =
          resumeData !== undefined &&
          (hasResumeIdentityMismatch ||
            hasSuspendedToolRunIdMismatch ||
            isCanonicalArgsUnavailable ||
            (hasStoredOriginRunMismatch && !isResumeToolCall) ||
            (!isDelegatedApprovalResume &&
              ((effectiveResumeType === 'approval' && !isApprovalResumeData) ||
                (effectiveResumeType !== 'approval' && effectiveResumeType !== 'suspension'))));

        if (hasInvalidResumeData) {
          return {
            ...inputData,
            error: new Error('Tool resume evidence did not match the suspended tool call'),
          };
        }

        if (needsCanonicalArgsRestore) {
          args = structuredClone(storedResumeMetadata!.canonicalArgs);
          expectedIdentityDigest = createToolCallIdentityDigest({
            toolCallId: metadataToolCallId,
            toolName: inputData.toolName,
            args,
          });
          expectedResumeIdentity = {
            ...expectedResumeIdentity,
            identityDigest: expectedIdentityDigest,
          };
        }
        if (authoritativeIdentityMatches && hasApprovedArgsEnvelope) {
          args = structuredClone(approvedArgsEnvelope.approvedArgs);
          identityArgs = structuredClone(args);
          verifiedApprovedArgs = structuredClone(args);
          approvedArgsResume = {
            approvalInputIdentityDigest: approvedArgsEnvelope.approvalInputIdentityDigest as string,
            approvedArgs: structuredClone(args),
          };
          expectedIdentityDigest = approvedArgsEnvelope.identityDigest as string;
          expectedResumeIdentity = { ...expectedResumeIdentity, identityDigest: expectedIdentityDigest };
          inputData = { ...inputData, args: structuredClone(args) };
        } else if (hasStoredApprovedArgs) {
          args = structuredClone(storedResumeMetadata!.approvedArgs);
          identityArgs = structuredClone(args);
          verifiedApprovedArgs = structuredClone(args);
          approvedArgsResume = {
            // This branch is a new suspension after an auto-resume. Bind its next resume
            // envelope to the input that initiated this execution, which may be transcript-redacted.
            approvalInputIdentityDigest: workflowInputIdentityDigest,
            approvedArgs: structuredClone(args),
          };
          expectedIdentityDigest = createToolCallIdentityDigest({
            toolCallId: metadataToolCallId,
            toolName: inputData.toolName,
            args,
          });
          expectedResumeIdentity = { ...expectedResumeIdentity, identityDigest: expectedIdentityDigest };
          inputData = { ...inputData, args: structuredClone(args) };
        }
        if (
          verifiedApprovedArgs === undefined &&
          !isAgentTool &&
          !isWorkflowTool &&
          isKnownSuspensionResume &&
          persistedApprovalGrant !== undefined &&
          storedResumeMetadata?.identityMatch === 'canonical' &&
          args !== null &&
          typeof args === 'object' &&
          !Array.isArray(args)
        ) {
          // Canonical args are already authenticated by the suspension identity and persisted
          // approval grant. Keep a detached copy only for result/persistence consumers; do not
          // turn this provenance marker into resume authorization or a new approval envelope.
          verifiedApprovedArgs = structuredClone(args);
        }
        const resumeTarget =
          metadataToolCallId !== inputData.toolCallId ? { resumeTargetToolCallId: metadataToolCallId } : {};
        resumeTargetToolCallId = resumeTarget.resumeTargetToolCallId;

        // Check if approval is required
        // requireApproval can be:
        // - boolean (from Mastra createTool or mapped from AI SDK needsApproval: true)
        // - undefined (no approval needed)
        // If needsApprovalFn exists, evaluate it with the tool args and context
        if (isApprovalResumeData && approvalDecision.approved === false) {
          await removeToolMetadata(metadataToolCallId, inputData.toolName, 'approval');

          return {
            ...inputData,
            args: identityArgs,
            // Keep the provider's current call ID so its invocation receives a result, and carry
            // the original pending call separately so persistence can mark that approval denied.
            ...resumeTarget,
            ...(verifiedApprovedArgs ? { approvedArgs: structuredClone(verifiedApprovedArgs) } : {}),
            approval: {
              id: metadataToolCallId,
              approved: false,
              reason: approvalDeclineReason,
            },
          };
        }

        const validateInput = (
          tool as {
            validateInput?: (
              params: unknown,
            ) => { data?: unknown; error?: unknown } | Promise<{ data?: unknown; error?: unknown }>;
          }
        ).validateInput;
        const supportsEditedApprovalArgs =
          !isAgentTool &&
          !isWorkflowTool &&
          (tool as { approvalInputEditing?: unknown }).approvalInputEditing === 'object' &&
          typeof validateInput === 'function';
        if (effectiveResumeType === 'approval' && approvalDecision?.editedArgs !== undefined) {
          if (effectiveApprovalSource !== 'tool-gate' || isDelegatedApprovalResume || isAgentTool || isWorkflowTool) {
            return { ...inputData, error: new Error('Edited approval arguments require a regular tool-gate approval') };
          }
          if (!supportsEditedApprovalArgs) {
            return { ...inputData, error: new Error('Edited approval arguments require a tool input validator') };
          }
          const baseArgs = args == null ? {} : args;
          if (typeof baseArgs !== 'object' || Array.isArray(baseArgs)) {
            return { ...inputData, error: new Error('Edited approval arguments require object tool input') };
          }
          const editedArgs = { ...baseArgs, ...approvalDecision.editedArgs };
          let validation;
          try {
            validation = await validateInput(editedArgs);
          } finally {
            await removeToolMetadata(metadataToolCallId, inputData.toolName, 'approval');
          }
          if (validation.error !== undefined) {
            return {
              ...inputData,
              ...resumeTarget,
              result:
                validation.error instanceof Error
                  ? serializeToolError(validation.error)
                  : ensureSerializable(validation.error),
            };
          }
          // Validation may transform input. Execution owns those transforms, so
          // retain the untransformed approved input in identity and snapshots.
          const originalIdentityDigest = expectedIdentityDigest;
          args = editedArgs;
          identityArgs = structuredClone(args);
          expectedIdentityDigest = createToolCallIdentityDigest({
            toolCallId: metadataToolCallId,
            toolName: inputData.toolName,
            args,
          });
          expectedResumeIdentity = { ...expectedResumeIdentity, identityDigest: expectedIdentityDigest };
          approvedArgsResume = {
            approvalInputIdentityDigest: approvedArgsResume?.approvalInputIdentityDigest ?? originalIdentityDigest,
            approvedArgs: structuredClone(args),
          };
          verifiedApprovedArgs = structuredClone(args);
          inputData = { ...inputData, args: structuredClone(args) };
        }

        if (isApprovalResumeData) {
          await removeToolMetadata(metadataToolCallId, inputData.toolName, 'approval');
        } else if (isKnownSuspensionResume) {
          await removeToolMetadata(metadataToolCallId, inputData.toolName, 'suspension');
        }

        const validatedSuspendedToolRunId = suppliedSuspendedToolRunId ?? storedResumeMetadata?.runId;
        if ((isAgentTool || isWorkflowTool) && validatedSuspendedToolRunId !== undefined) {
          args.suspendedToolRunId = validatedSuspendedToolRunId;
        }

        // Per-tool permission policy gate (§4.2e). A caller (e.g. the harness)
        // may thread a resolver on the request context that returns
        // 'allow' | 'ask' | 'deny' for a tool name. `deny` blocks the call with a
        // non-aborting result the model can react to; `ask` forces approval (it is
        // OR'd with tool-owned/global approval, never suppressing them); `allow`
        // defers entirely to the tool's own approval config. The factory-captured
        // value is authoritative because the function does not survive the
        // evented engine's requestContext transport.
        const toolPermissionPolicyResolver =
          toolPermissionPolicyFromFactory ??
          (requestContext.get(TOOL_PERMISSION_POLICY_KEY) as ToolPermissionPolicy | undefined);
        const toolPermissionPolicy = toolPermissionPolicyResolver?.(inputData.toolName);
        // §O4 deny observability reads the callback off the request context;
        // prefer the factory-captured one so the event survives evented
        // transport too.
        const deniedNotifyContext =
          onToolDeniedFromFactory === undefined
            ? requestContext
            : {
                get: (key: string) =>
                  key === TOOL_DENIED_CALLBACK_KEY ? onToolDeniedFromFactory : requestContext.get(key),
              };
        if (toolPermissionPolicy === 'deny') {
          // §O4 — surface WHY a tool was blocked (action-time deny is otherwise
          // opaque: only a generic result reaches the model). Optional, sync,
          // fire-and-forget, isolated; a non-harness caller threads no callback.
          notifyToolDenied(deniedNotifyContext, {
            toolName: inputData.toolName,
            stage: 'action',
            toolCallId: inputData.toolCallId,
          });
          return {
            ...inputData,
            ...resumeTarget,
            disposition: 'denied' as const,
            result: `Tool "${inputData.toolName}" was denied by the session permission policy.`,
          };
        }

        // §4.2e per-tool revalidation — an awaited hook the caller (the harness)
        // may thread on the request context so authorization can be re-checked
        // against durable state captured after this turn's snapshot (e.g. a
        // grant revoked or expired mid-turn). Runs after the policy deny
        // short-circuit and before approval resolution/`execute()`. Throwing
        // or returning an unrecognized decision fails closed as deny. When the
        // REQUIRED marker is present without the function (transported or
        // restored context), the call is denied rather than silently
        // unrevalidated.
        const onBeforeToolExecution =
          onBeforeToolExecutionFromFactory ??
          (requestContext.get(ON_BEFORE_TOOL_EXECUTION_KEY) as BeforeToolExecutionHook | undefined);
        if (typeof onBeforeToolExecution === 'function') {
          let beforeDecision: 'allow' | 'deny' | void;
          try {
            beforeDecision = await onBeforeToolExecution({
              toolName: inputData.toolName,
              toolCallId: inputData.toolCallId,
              args,
              isResume: isAnyResume,
              policyDecision: toolPermissionPolicy,
            });
          } catch {
            beforeDecision = 'deny';
          }
          if (beforeDecision !== undefined && beforeDecision !== 'allow') {
            notifyToolDenied(deniedNotifyContext, {
              toolName: inputData.toolName,
              stage: 'action',
              toolCallId: inputData.toolCallId,
            });
            return {
              ...inputData,
              ...resumeTarget,
              disposition: 'denied' as const,
              result: `Tool "${inputData.toolName}" was denied by the pre-execution permission hook.`,
            };
          }
          // The awaited hook can span real I/O (e.g. a grant-store read). A
          // request aborted inside that window must not proceed to approval or
          // dispatch — the hook's verdict is moot once the turn is cancelled.
          if (options?.abortSignal?.aborted) {
            return {
              aborted: true,
              abortError: serializeToolError(
                (options.abortSignal as AbortSignal & { reason?: unknown }).reason ??
                  new DOMException('The operation was aborted.', 'AbortError'),
              ),
              ...inputData,
            };
          }
        } else if (
          requestContext.get(ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY) === true ||
          factoryRequestContext?.get(ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY) === true
        ) {
          notifyToolDenied(deniedNotifyContext, {
            toolName: inputData.toolName,
            stage: 'action',
            toolCallId: inputData.toolCallId,
          });
          return {
            ...inputData,
            ...resumeTarget,
            disposition: 'denied' as const,
            result: `Tool "${inputData.toolName}" was denied by the pre-execution permission hook.`,
          };
        }

        // §4.2e per-turn `yolo`: a caller (the harness queued-turn drain) may thread
        // `__mastra_yoloAutoApprove` to clear the POLICY-level approval reason — i.e.
        // an effective `ask` from the permission gate. Per spec it suppresses ONLY the
        // `policy` reason; it NEVER suppresses a tool-owned reason (a tool's static
        // `requireApproval` / its `needsApprovalFn` callback), and (since `deny`
        // already returned above) it can never run a denied tool. Mirrors how a grant
        // clears the policy ask at the resolver — yolo does it per-run here.
        const yoloAutoApprove = requestContext.get('__mastra_yoloAutoApprove') === true;

        const approvalRequirement = await resolveToolApprovalRequirement({
          tool,
          args,
          // #17337 — pass through unboxed: the global may be a per-call FUNCTION
          // policy; resolveToolApprovalRequirement evaluates it (fail-safe true).
          requireToolApproval: requireToolApproval as RequireToolApproval | undefined,
          requestContext,
          workspace: _internal?.stepWorkspace,
          logger,
          toolName: inputData.toolName,
        });
        // §4.2e additive reasons: tool-owned reasons (tool-config / tool-fn) from
        // the requirement, plus a `policy` reason when the session permission gate
        // forces `ask` AND per-run `yolo` did not clear it. Surfaced on the approval
        // chunk + suspend payload so the pending approval can show WHY (matches the
        // durable agent path). Tool-owned reasons survive yolo.
        const policyAsk = toolPermissionPolicy === 'ask' && !yoloAutoApprove;
        const approvalReasons: string[] = [...approvalRequirement.reasons];
        if (policyAsk) approvalReasons.push('policy');
        const toolRequiresApproval = approvalRequirement.required || policyAsk;

        // execute() is intentionally deferred until after approval, but its
        // schema validation must not be deferred with it. Otherwise an invalid
        // provider call can be presented to a user, accepted, and only then
        // collapse into a validation result on the resumed leg. Return that
        // same result to the model now so it can repair the call before anyone
        // is asked to approve it. Keep execute() validation as the final
        // authority and do not reuse transformed data here: transforms are not
        // guaranteed to be idempotent.
        if (toolRequiresApproval && resumeData === undefined && typeof validateInput === 'function') {
          const preflightValidation = await validateInput(args);
          if (preflightValidation.error !== undefined) {
            return {
              result:
                preflightValidation.error instanceof Error
                  ? serializeToolError(preflightValidation.error)
                  : ensureSerializable(preflightValidation.error),
              ...inputData,
            };
          }
        }

        // On resume, the live `requireToolApproval` policy may be gone: function-form
        // policies do not survive RequestContext serialization, and decline/approve
        // helpers typically only pass `{ runId, toolCallId }` — not the original option.
        // The suspend payload still records that this step waited for approval, so treat
        // that as authoritative for the resume decision (especially declines).
        //
        // Nested sub-agent/workflow approvals also write `requireToolApproval` on the
        // outer suspend payload, but they additionally set `suspendedToolRunId`. Those
        // must resume into the nested tool path — not the outer approval short-circuit —
        // even when a live outer `requireToolApproval` policy is still present.
        const isDelegatedApproval = authoritativeDelegatedRunId !== undefined;
        const suspendedForApproval = Boolean(
          suspendData &&
          typeof suspendData === 'object' &&
          (suspendData as { requireToolApproval?: unknown }).requireToolApproval &&
          !isDelegatedApproval,
        );
        // `approvalDecision` / `hasApprovalResumeShape` are resolved above from the
        // identity-verified resume envelope (authoritative `toolCallResume` or the
        // persisted approval metadata), which is this fork's trust boundary for a
        // resume decision: an approval-typed resume whose identity does not match is
        // rejected as invalid resume evidence before reaching this gate.
        const isApprovalResume =
          resumeData != null && typeof resumeData === 'object' && 'approved' in (resumeData as Record<string, unknown>);
        // Gate the resume branch on either a live policy or a prior outer approval suspend.
        // Without this, `declineToolCall` falls through to `execute` when the policy was
        // lost (#20470). Do not key only on `approved` in resumeData — generic tool
        // resumes can carry that field for unrelated reasons (same guard as durable).
        const approvalGated =
          !isDelegatedApproval && (toolRequiresApproval || (suspendedForApproval && isApprovalResume));

        // Schema for tool call approval - used for both streaming and metadata
        const approvalInputSchema = z.object({
          approved: z
            .boolean()
            .describe(
              'Controls if the tool call is approved or not, should be true when approved and false when declined',
            ),
          reason: z
            .string()
            .optional()
            .describe('Optional explanation for the decision, surfaced to the model when the tool call is declined'),
        });
        const approvalSchema = toStandardSchema(approvalInputSchema);
        const toolGateApprovalSchema = toStandardSchema(
          supportsEditedApprovalArgs
            ? approvalInputSchema.extend({
                editedArgs: toolApprovalEditedArgsSchema.optional().describe('Shallow JSON input patch'),
              })
            : approvalInputSchema,
        );

        if (approvalGated) {
          if (resumeData === undefined) {
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
                  ...expectedResumeIdentity,
                  type: 'approval',
                  approvalSource: 'tool-gate',
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  args: inputData.args,
                  resumeSchema: JSON.stringify(standardSchemaToJSONSchema(toolGateApprovalSchema)),
                  ...(approvalReasons.length > 0 ? { approvalReasons } : {}),
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
              approvalSource: 'tool-gate',
              resumeSchema: JSON.stringify(standardSchemaToJSONSchema(toolGateApprovalSchema)),
              metadata: approvalChunk.metadata,
            });

            // Flush messages before suspension to ensure they are persisted
            await flushMessagesBeforeSuspension();

            return suspend(
              {
                toolCallResume: {
                  ...expectedResumeIdentity,
                  ...(approvedArgsResume ?? {}),
                  type: 'approval',
                  approvalSource: 'tool-gate',
                },
                requireToolApproval: {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  args: inputData.args,
                  ...(approvalReasons.length > 0 ? { approvalReasons } : {}),
                },
                __streamState: streamState.serialize(),
                __agentId: agentId,
                ...(agentVersionId ? { __agentVersionId: agentVersionId } : {}),
              },
              {
                resumeLabel: inputData.toolCallId,
              },
            );
          } else if (!isAnyResume) {
            await removeToolMetadata(metadataToolCallId, inputData.toolName, 'approval');

            // Return the approval decision (not a `result` string) so it persists as
            // `state: 'output-denied'` with `approval`. The denial reason carries the
            // caller-supplied reason when one was provided, otherwise the default string
            // so downstream consumers/UI keep the same message.
            if (!hasApprovalResumeShape || approvalDecision.approved === false) {
              return {
                ...inputData,
                args: identityArgs,
                ...(metadataToolCallId !== inputData.toolCallId ? { resumeTargetToolCallId: metadataToolCallId } : {}),
                approval: {
                  id: metadataToolCallId,
                  approved: false,
                  reason: approvalDeclineReason,
                },
              };
            }
          }
        }

        // Avoid passing approval sentinels to tools. Delegated agent/workflow
        // resumes still receive their resume data so wrappers call resumeStream
        // instead of starting the sub-run from scratch.
        const shouldTreatResumeDataAsApproval =
          hasApprovalResumeShape && !isKnownSuspensionResume && !isDelegatedApprovalResume;
        // Preserve the approval decision on resolved output so persistence can
        // distinguish an approved gated call from an ordinary tool result.
        // `isKnownApprovalResume` (not only the live policy) keeps
        // approve-after-policy-loss tagging intact.
        approvalGrant =
          (toolRequiresApproval || isKnownApprovalResume) &&
          shouldTreatResumeDataAsApproval &&
          approvalDecision?.approved === true
            ? {
                approval: {
                  id: metadataToolCallId,
                  approved: true,
                  ...(approvalDecision.reason !== undefined ? { reason: approvalDecision.reason } : {}),
                },
              }
            : persistedApprovalGrant
              ? { approval: persistedApprovalGrant }
              : undefined;
        const shouldStripApprovalResumeData =
          (toolRequiresApproval || isKnownApprovalResume) &&
          shouldTreatResumeDataAsApproval &&
          !isToolExecutionApprovalResume;
        const resumeDataToPassToToolOptions = shouldStripApprovalResumeData ? undefined : resumeData;
        const toolRequestContext = buildToolRequestContext(requestContext, {
          runId,
          toolCallId: inputData.toolCallId,
        });

        const toolOptions: MastraToolInvocationOptions = {
          abortSignal: options?.abortSignal,
          runId,
          toolCallId: inputData.toolCallId,
          // Agent tools receive the exact processor-adjusted prompt visible to the parent model.
          // Regular tools retain the input-only context expected by the AI SDK tool contract.
          messages: isAgentTool
            ? (readScoped(scopeCtx, STEP_MODEL_MESSAGES_KEY, 'stepModelMessages') ?? messageList.get.all.aiV5.model())
            : messageList.get.input.aiV5.model(),
          outputWriter,
          // Pass current step span as parent for tool call spans
          tracingContext: modelSpanTracker?.getTracingContext(),
          // Pass workspace from the run scope (set by llmExecutionStep via prepareStep/processInputStep)
          workspace: readScoped(scopeCtx, STEP_WORKSPACE_KEY, 'stepWorkspace'),
          // Forward requestContext so tools receive values set by the workflow step
          requestContext: toolRequestContext,
          actor,
          mcp,
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
            const delegatedSuspendedToolCallId =
              isAgentTool && typeof options?.suspendedToolCallId === 'string' && options.suspendedToolCallId.length > 0
                ? options.suspendedToolCallId
                : undefined;
            if (options?.requireToolApproval) {
              const innerApproval =
                typeof options.requireToolApproval === 'object' && options.requireToolApproval
                  ? options.requireToolApproval
                  : typeof suspendPayload?.requireToolApproval === 'object' && suspendPayload?.requireToolApproval
                    ? suspendPayload.requireToolApproval
                    : null;

              const approvalToolName = innerApproval?.toolName ?? inputData.toolName;
              const approvalArgs = innerApproval?.args !== undefined ? innerApproval.args : inputData.args;

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
                    ...expectedResumeIdentity,
                    type: 'approval',
                    approvalSource: 'tool-execution',
                    toolCallId: metadataToolCallId,
                    toolName: approvalToolName,
                    args: approvalArgs,
                    parentToolName: inputData.toolName,
                    parentArgs: inputData.args,
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
                toolCallId: metadataToolCallId,
                toolName: approvalToolName,
                args: approvalArgs,
                ...(approvalToolName !== inputData.toolName || approvalArgs !== inputData.args
                  ? { parentToolName: inputData.toolName, parentArgs: inputData.args }
                  : {}),
                type: 'approval',
                approvalSource: 'tool-execution',
                suspendedToolRunId: options.runId,
                resumeSchema: JSON.stringify(standardSchemaToJSONSchema(approvalSchema)),
                metadata: approvalChunk.metadata,
              });

              // Flush messages before suspension to ensure they are persisted
              await flushMessagesBeforeSuspension();

              return suspend(
                {
                  toolCallResume: {
                    ...expectedResumeIdentity,
                    ...(approvedArgsResume ?? {}),
                    type: 'approval',
                    approvalSource: 'tool-execution',
                  },
                  requireToolApproval: {
                    toolCallId: metadataToolCallId,
                    toolName: approvalToolName,
                    args: approvalArgs,
                  },
                  __streamState: streamState.serialize(),
                  __agentId: agentId,
                  ...(agentVersionId ? { __agentVersionId: agentVersionId } : {}),
                  // Persist the inner suspended run id in the workflow snapshot, partitioned per
                  // tool call (resumeLabel = toolCallId). Persisted message metadata exposes the
                  // same id as delegatedRunId for cold reloads, while the snapshot remains the
                  // runtime source for routing this targeted resume.
                  suspendedToolRunId: options.runId,
                  ...(delegatedSuspendedToolCallId ? { suspendedToolCallId: delegatedSuspendedToolCallId } : {}),
                },
                {
                  resumeLabel: metadataToolCallId,
                },
              );
            } else {
              const suspensionChunk = await transformChunk(
                {
                  type: 'tool-call-suspended',
                  runId,
                  from: ChunkFrom.AGENT,
                  payload: {
                    ...expectedResumeIdentity,
                    type: 'suspension',
                    ...(approvalGrant ?? {}),
                    toolCallId: metadataToolCallId,
                    toolName: inputData.toolName,
                    suspendPayload,
                    args,
                    resumeSchema: options?.resumeSchema,
                  },
                },
                'suspend',
                { suspendPayload },
              );
              safeEnqueue(controller, suspensionChunk);

              // Add suspension metadata to message before persisting
              addToolMetadata({
                toolCallId: metadataToolCallId,
                toolName: inputData.toolName,
                args: approvedArgsResume?.approvedArgs ?? args,
                suspendPayload,
                suspendedToolRunId: options?.runId,
                type: 'suspension',
                approval: approvalGrant?.approval,
                ...(approvedArgsResume ?? {}),
                resumeSchema: options?.resumeSchema,
                metadata: suspensionChunk.metadata,
              });

              // Flush messages before suspension to ensure they are persisted
              await flushMessagesBeforeSuspension();

              return await suspend(
                {
                  toolCallResume: {
                    ...expectedResumeIdentity,
                    ...(approvedArgsResume ?? {}),
                    type: 'suspension',
                    ...(approvalGrant ?? {}),
                  },
                  toolCallSuspended: suspendPayload,
                  __streamState: streamState.serialize(),
                  __agentId: agentId,
                  ...(agentVersionId ? { __agentVersionId: agentVersionId } : {}),
                  toolCallId: metadataToolCallId,
                  toolName: inputData.toolName,
                  resumeLabel: options?.resumeLabel,
                  ...(delegatedSuspendedToolCallId ? { suspendedToolCallId: delegatedSuspendedToolCallId } : {}),
                },
                {
                  resumeLabel: metadataToolCallId,
                },
              );
            }
          },
          resumeData: resumeDataToPassToToolOptions,
        };

        let parentStepSuspended = false;
        const requestParentSuspension = async (
          suspendPayload: unknown,
          suspendOptions?: SuspendOptions,
        ): Promise<InnerOutput> => {
          if (parentStepSuspended) return undefined as unknown as InnerOutput;
          await toolOptions.suspend?.(suspendPayload, suspendOptions);
          parentStepSuspended = true;
          // `toolOptions.suspend` has already registered the parent step's
          // suspension. Return the branded workflow sentinel so this path
          // cannot be interpreted as a successful tool result.
          return undefined as unknown as InnerOutput;
        };

        //if resuming a subAgent or workflow tool, we want to find the runId from when it got suspended.
        // Also look up the runId when the LLM provided resumeData in args (isResumeToolCall)
        // but omitted suspendedToolRunId — without it, workflow tools start a fresh run and re-suspend.
        // Defined, not truthy: a delegated tool can be resumed with `false` / `0` / `''` / `null`
        // (a provider-materialized null resume is normalized above), and skipping the lookup for
        // those would start a fresh sub-run instead of resuming the suspended one.
        const needsRunIdLookup = resumeDataToPassToToolOptions !== undefined && (isAgentTool || isWorkflowTool);
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
            const suspendedTools = message.content.metadata?.suspendedTools as Record<string, any> | undefined;
            const pendingToolApprovals = message.content.metadata?.pendingToolApprovals as
              | Record<string, any>
              | undefined;
            const pendingOrSuspendedTools =
              suspendedTools || pendingToolApprovals
                ? { ...(pendingToolApprovals ?? {}), ...(suspendedTools ?? {}) }
                : undefined;
            if (pendingOrSuspendedTools) {
              // Entries are keyed by toolCallId so parallel calls to the SAME tool each keep
              // their own suspension. Resolution order:
              //   1. Exact resolved toolCallId match (key, then entry value) — used by
              //      approveToolCall-style resumes and model resumes that supplied
              //      suspendedToolCallId (metadataToolCallId is the original pending call).
              //   2. toolName match — used by autoResumeSuspendedTools, where resume happens via a
              //      fresh stream() turn so inputData.toolCallId differs from the suspended call.
              //      Also covers legacy metadata that was keyed by toolName.
              const entry =
                pendingOrSuspendedTools[metadataToolCallId] ??
                Object.values(pendingOrSuspendedTools).find((e: any) => e?.toolCallId === metadataToolCallId) ??
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
                // Prefer the part for this exact (resolved) tool call; fall back to toolName for
                // fresh-turn autoResume and older parts that may not carry a toolCallId.
                const foundTool =
                  dataToolSuspendedParts.find((part: any) => part.data.toolCallId === metadataToolCallId) ??
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

          // Agent delegation resumes need both coordinates of the child
          // suspension. The run id selects the child agentic-loop snapshot;
          // this label selects the exact tool call inside that snapshot. It is
          // durable per foreach iteration, unlike shared message metadata.
          const childToolCallId =
            (suspendData as any)?.suspendedToolCallId ?? (suspendData as any)?.toolCallSuspended?.toolCallId;
          if (isAgentTool && typeof childToolCallId === 'string' && childToolCallId.length > 0) {
            args.suspendedToolCallId = childToolCallId;
          }
        }

        // Clear both entries for BOTH resume conventions: `resumeData` embedded in the LLM's
        // re-emitted args (autoResumeSuspendedTools) and the workflow-level resumeData that
        // `agent.resumeStream(resumeData, { runId, toolCallId })` delivers. Keyed on the
        // identity-mapped `metadataToolCallId` so a concurrently suspended sibling that shares
        // this tool name keeps its own pending entry.
        if (resumeData !== undefined && (isResumeToolCall || isAgentTool || isWorkflowTool)) {
          await removeToolMetadata(metadataToolCallId, inputData.toolName, 'approval');
          await removeToolMetadata(metadataToolCallId, inputData.toolName, 'suspension');
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

        // FGA authorization check before tool execution
        const toolFgaProvider = mastra?.getServer?.()?.fga;
        if (toolFgaProvider) {
          const fgaUser = requestContext?.get('user');
          const { builtToolEnforcesFGAProvider, checkFGA, getBuiltToolFGAResourceId, getStandaloneToolFGAResourceId } =
            await import('../../../auth/ee/fga-check');
          const builtResourceId = getBuiltToolFGAResourceId(tool);
          // CoreToolBuilder owns the check only when it will use this exact
          // provider. Converted tools without a builder provider (for example,
          // browser tools) retain their canonical identity but are authorized
          // here; raw tools fail closed to the standalone identity.
          if (!builtToolEnforcesFGAProvider(tool, toolFgaProvider)) {
            await checkFGA({
              fgaProvider: toolFgaProvider,
              user: fgaUser,
              resource: {
                type: 'tool',
                id: builtResourceId ?? getStandaloneToolFGAResourceId(inputData.toolName),
              },
              permission: MastraFGAPermissions.TOOLS_EXECUTE,
              actor,
              requestContext: toolRequestContext,
            });
          }
        }

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
            let resolveReconciliation!: (outcome: { error?: unknown }) => void;
            const reconciliationComplete = new Promise<{ error?: unknown }>(resolve => {
              resolveReconciliation = resolve;
            });

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
              // The hook closure cannot survive cross-process dispatch or cold
              // recovery — persist the requirement so a statically-resolved
              // executor fails closed instead of skipping revalidation.
              requiresToolPermissionHook: typeof onBeforeToolExecution === 'function',
              context: {
                awaited: bgResolved.disposition === 'awaited',
                // Executor — uses the tool from the current closure
                executor: {
                  execute: async (
                    bgArgs: Record<string, unknown>,
                    opts?: {
                      abortSignal?: AbortSignal;
                      onProgress?: (chunk: BackgroundTaskProgressChunk) => Promise<void>;
                      suspend?: (data?: unknown, options?: SuspendOptions) => Promise<void>;
                      resumeData?: unknown;
                    },
                  ) => {
                    // Every attempt is a fresh side-effect boundary: the gate
                    // above ran only before dispatch, so retries must revalidate
                    // or a mid-flight grant revocation never takes effect. A
                    // denial throws TOOL_PERMISSION_DENIED_ERROR_NAME, which the
                    // bg-task workflow classifies as non-retryable.
                    if (typeof onBeforeToolExecution === 'function') {
                      let attemptDecision: 'allow' | 'deny' | void;
                      try {
                        attemptDecision = await onBeforeToolExecution({
                          toolName: inputData.toolName,
                          toolCallId: inputData.toolCallId,
                          args: bgArgs,
                          // The step-level resume (approval/suspension) counts
                          // even when this attempt itself carries no resumeData —
                          // e.g. an approved call dispatched into background
                          // execution for the first time.
                          isResume: isAnyResume || opts?.resumeData !== undefined,
                          policyDecision: toolPermissionPolicy,
                        });
                      } catch {
                        attemptDecision = 'deny';
                      }
                      if (opts?.abortSignal?.aborted || options?.abortSignal?.aborted) {
                        throw (
                          (
                            (opts?.abortSignal ?? options?.abortSignal) as
                              | (AbortSignal & { reason?: unknown })
                              | undefined
                          )?.reason ?? new DOMException('The operation was aborted.', 'AbortError')
                        );
                      }
                      if (attemptDecision !== undefined && attemptDecision !== 'allow') {
                        notifyToolDenied(deniedNotifyContext, {
                          toolName: inputData.toolName,
                          stage: 'action',
                          toolCallId: inputData.toolCallId,
                        });
                        throw Object.assign(
                          new Error(`Tool "${inputData.toolName}" was denied by the pre-execution permission hook.`),
                          { name: TOOL_PERMISSION_DENIED_ERROR_NAME },
                        );
                      }
                    }
                    // Override the agent loop's `suspend`/`resumeData` (which
                    // would suspend the AGENT run via tool-call-approval) with
                    // the bg-task workflow's, so calling `suspend()` from the
                    // tool pauses the bg-task run instead.
                    const rawResult = await resolvedTool.execute!(bgArgs, {
                      ...toolOptions,
                      isBackgroundTask: true,
                      [BACKGROUND_WORK_CONTEXT]: {
                        originRunId: runId,
                        originToolCallId: inputData.toolCallId,
                        taskId: bgTask.task.id,
                        invocationKind: isAgentTool ? 'agent' : 'tool',
                        disposition: bgResolved.disposition === 'awaited' ? 'awaited' : 'deferred',
                      },
                      ...(opts?.resumeData !== undefined ? { resumeData: opts.resumeData } : {}),
                      suspend: async (data?: unknown, options?: SuspendOptions) => {
                        await toolOptions.suspend?.(data, options);
                        parentStepSuspended = true;
                        return opts?.suspend?.(data, options);
                      },
                      outputWriter: async (chunk: any) => {
                        await opts?.onProgress?.(chunk);
                        return toolOptions.outputWriter?.(chunk);
                      },
                      abortSignal: opts?.abortSignal,
                    } as any);
                    const result = ensureSerializable(rawResult);

                    if ('onOutput' in resolvedTool && typeof (resolvedTool as any).onOutput === 'function') {
                      try {
                        await (resolvedTool as any).onOutput({
                          toolCallId: inputData.toolCallId,
                          toolName: inputData.toolName,
                          output: result,
                          abortSignal: opts?.abortSignal,
                        });
                      } catch (error) {
                        logger?.error('Error calling onOutput', error);
                      }
                    }

                    return result;
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
                        (bgRunId !== runId || (bgRunId === runId && workflowResumeData != null)) &&
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
                  try {
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
                    let providerMetadata = withToolPayloadTransformProviderMetadata(
                      inputData.providerMetadata as ProviderMetadata | undefined,
                      transformCarrier.metadata,
                    ) as ProviderMetadata | undefined;

                    // Recompute the model-facing output from the *real* result.
                    //
                    // The dispatch turn stored `mastra.modelOutput` derived from the
                    // "Background task started..." placeholder, and `llmPrompt()`
                    // prefers that field over `toolInvocation.result` when building
                    // the tool message. Carrying the dispatch metadata through
                    // unchanged would leave the model reading the placeholder
                    // forever, so it re-dispatches the tool or answers from nothing.
                    // Mirrors the synchronous path in llm-mapping-step.
                    // Every path below overwrites the dispatch's `mastra.modelOutput`, including
                    // the ones that produce nothing: a tool with no `toModelOutput`, a mapping
                    // that returns nullish, and a mapping that throws. Leaving the key untouched
                    // in those cases would preserve the placeholder — the exact bug this fixes.
                    // A null `modelOutput` is the established "no mapping, use the raw result"
                    // signal that `MessageList` keys off by value.
                    const toModelOutput = (resolvedTool as { toModelOutput?: (output: unknown) => unknown } | undefined)
                      ?.toModelOutput;
                    let modelOutput: unknown = null;
                    if (params.status !== 'failed' && toModelOutput && result != null) {
                      try {
                        modelOutput = normalizeModelOutput(await toModelOutput(result)) ?? null;
                      } catch (mappingError) {
                        // Non-fatal: the real result is still written to `toolInvocation.result`
                        // below and the model reads that instead. Surface it loudly because the
                        // tool asked for a mapping and did not get one.
                        logger?.warn?.(
                          `toModelOutput failed for background tool "${params.toolName}" — falling back to the raw result`,
                          { toolCallId: params.toolCallId, error: mappingError },
                        );
                        modelOutput = null;
                      }
                    }
                    providerMetadata = {
                      ...providerMetadata,
                      mastra: { ...(providerMetadata as any)?.mastra, modelOutput },
                    } as ProviderMetadata;

                    const updated = messageList.updateToolInvocation(
                      {
                        type: 'tool-invocation',
                        toolInvocation: {
                          // A failed background task is recorded as `output-error` with the
                          // message in `errorText`; a successful one keeps `state: 'result'`.
                          ...(params.status === 'failed'
                            ? { state: 'output-error' as const, errorText: result as string }
                            : { state: 'result' as const, result }),
                          toolCallId: params.toolCallId,
                          toolName: params.toolName,
                          args: verifiedApprovedArgs ?? args,
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
                      verifiedApprovedArgs ? { replaceArgs: true } : undefined,
                    );

                    // Fallback: no matching tool-invocation was found in the
                    // current message list (can happen if the initial run's
                    // message list was cleared, e.g. because the task completed
                    // after the process restarted and hooks were reattached
                    // without the original call). Append a standalone tool
                    // message so memory still records the result, even if it
                    // means a duplicate entry for that toolCallId.
                    if (!updated) {
                      if (params.runId !== runId || (params.runId === runId && workflowResumeData != null)) {
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

                    resolveReconciliation({});
                    void notifyBackgroundWorkTerminal(mastra, {
                      originRunId: runId,
                      originToolCallId: params.toolCallId,
                      ...(params.runId !== runId ? { executorRunId: params.runId } : {}),
                      taskId: params.taskId,
                      invocationKind: isAgentTool ? 'agent' : 'tool',
                      disposition: bgResolved.disposition === 'awaited' ? 'awaited' : 'deferred',
                      status: params.status === 'failed' ? 'failed' : 'completed',
                    });
                  } catch (error) {
                    resolveReconciliation({ error });
                    throw error;
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

            const awaitAuthoritativeBackgroundResult = async () => {
              const completedTask = await bgTask.waitForCompletion({
                abortSignal: options?.abortSignal,
                includeSuspended: true,
              });
              if (completedTask.status === 'suspended') {
                // The task's executor normally requests this parent
                // suspension before the background workflow records its own
                // suspended state. The guard also covers a resumed caller
                // that observes an already-suspended task before execution.
                return {
                  kind: 'suspended' as const,
                  suspension: await requestParentSuspension(completedTask.suspendPayload),
                };
              }
              if (completedTask.status !== 'completed') {
                throw new Error(
                  completedTask.error?.message ??
                    `Background task ${completedTask.status.replace('_', ' ')}: ${completedTask.id}`,
                );
              }

              const reconciliationTimeoutMs = Number.isFinite(completedTask.timeoutMs)
                ? completedTask.timeoutMs
                : bgResolved.timeoutMs;
              let reconciliationTimer: ReturnType<typeof setTimeout> | undefined;
              const reconciliationTimeout = new Promise<never>((_, reject) => {
                reconciliationTimer = setTimeout(
                  () => {
                    reject(
                      new Error(
                        `Background task "${completedTask.id}" result reconciliation timed out after ${reconciliationTimeoutMs}ms`,
                      ),
                    );
                  },
                  Math.max(0, reconciliationTimeoutMs),
                );
              });
              try {
                const reconciliation = await raceAgainstAbort(
                  Promise.race([reconciliationComplete, reconciliationTimeout]),
                  options?.abortSignal,
                );
                if (reconciliation.error) {
                  throw reconciliation.error;
                }
              } finally {
                if (reconciliationTimer !== undefined) clearTimeout(reconciliationTimer);
              }

              return { kind: 'completed' as const, result: ensureSerializable(completedTask.result) };
            };

            const isSuspended = await bgTask.checkIfSuspended({
              toolCallId: inputData.toolCallId,
              runId,
              agentId,
              threadId: readScoped(scopeCtx, THREAD_ID_KEY, 'threadId'),
              resourceId: readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId'),
              toolName: inputData.toolName,
            });
            // Treat only `undefined` as absent: primitive resume schemas may
            // legitimately resolve to false, 0, an empty string, or null.
            if (isSuspended && resumeDataToPassToToolOptions !== undefined) {
              const task =
                bgResolved.disposition === 'awaited'
                  ? await bgTask.resume(resumeDataToPassToToolOptions, {
                      waitForAdmission: true,
                      abortSignal: options?.abortSignal,
                    })
                  : await bgTask.resume(resumeDataToPassToToolOptions);

              if (bgResolved.disposition === 'awaited') {
                const awaitedResult = await awaitAuthoritativeBackgroundResult();
                if (awaitedResult.kind === 'suspended') return awaitedResult.suspension;
                return {
                  result: awaitedResult.result,
                  ...inputData,
                  ...resumeTarget,
                  ...(approvalGrant ?? {}),
                  ...(verifiedApprovedArgs ? { approvedArgs: verifiedApprovedArgs } : {}),
                };
              }

              return {
                result: `Background task resumed. Task ID: ${task.id}. The tool "${inputData.toolName}" is running in the background. You will be notified when it completes.`,
                ...inputData,
                ...resumeTarget,
                ...(approvalGrant ?? {}),
                ...(verifiedApprovedArgs ? { approvedArgs: verifiedApprovedArgs } : {}),
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

              if (bgResolved.disposition === 'awaited') {
                const awaitedResult = await awaitAuthoritativeBackgroundResult();
                if (awaitedResult.kind === 'suspended') return awaitedResult.suspension;
                return {
                  result: awaitedResult.result,
                  ...inputData,
                  ...resumeTarget,
                  ...(approvalGrant ?? {}),
                  ...(verifiedApprovedArgs ? { approvedArgs: verifiedApprovedArgs } : {}),
                };
              }

              // Return placeholder result so the LLM can continue
              return {
                result: `Background task started. Task ID: ${task.id}. The tool "${inputData.toolName}" is running in the background. You will be notified when it completes.`,
                ...inputData,
                ...resumeTarget,
                ...(approvalGrant ?? {}),
                ...(verifiedApprovedArgs ? { approvedArgs: verifiedApprovedArgs } : {}),
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

        return {
          result,
          ...inputData,
          ...resumeTarget,
          ...(resumedFromSuspension ? { resumedFromSuspension: true as const } : {}),
          ...(approvalGrant ?? {}),
          ...(verifiedApprovedArgs ? { approvedArgs: verifiedApprovedArgs } : {}),
        };
      } catch (error) {
        // Re-throw FGA authorization errors instead of swallowing them
        if (error instanceof Error && error.name === 'FGADeniedError') {
          throw error;
        }
        // A throw while the request is aborted is a mid-flight cancellation, not a genuine
        // model-visible failure. Recording it as a normal error result would complete the
        // invocation in history and let the model continue after cancellation. Preserve a
        // serialized terminal-only error so stream consumers can still render the tool's
        // authoritative cancellation payload, while the mapping step leaves the persisted
        // call incomplete and bails. Key off the abort signal, not the error type:
        // CoreToolBuilder wraps the AbortError in a TOOL_EXECUTION_FAILED MastraError.
        if (options?.abortSignal?.aborted) {
          logger?.debug?.('Tool execution interrupted by request abort; leaving the tool call incomplete', {
            toolName: inputData.toolName,
            toolCallId: inputData.toolCallId,
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            aborted: true,
            abortError: serializeToolError(error),
            ...inputData,
          };
        }
        return {
          error: serializeToolError(error),
          ...inputData,
          ...(resumeTargetToolCallId ? { resumeTargetToolCallId } : {}),
          ...(resumedFromSuspension ? { resumedFromSuspension: true as const } : {}),
          ...(approvalGrant ?? {}),
          ...(verifiedApprovedArgs ? { approvedArgs: verifiedApprovedArgs } : {}),
        };
      }
    },
  });
}

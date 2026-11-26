import type { UIMessage } from '@internal/ai-sdk-v4';
import type { ModelMessage } from '@internal/ai-sdk-v5';
import { wrapSchemaWithNullTransform } from '@mastra/schema-compat';
import type { StandardSchemaWithJSON } from '@mastra/schema-compat/schema';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod/v4';
import type { MastraPrimitives, MastraUnion } from '../action';
import type { ActorSignal } from '../auth/ee';
import { MastraFGAPermissions } from '../auth/ee';
import type { AgentBackgroundConfig, ToolBackgroundConfig } from '../background-tasks';
import { MastraBase } from '../base';
import type { MastraBrowser } from '../browser/browser';
import type { BrowserContext } from '../browser/processor';
import { AgentChannels } from '../channels/agent-channels';
import type { ChannelConfig } from '../channels/types';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type {
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
  MastraScorers,
  MastraScorer,
  ScoringSamplingConfig,
} from '../evals';
import { runScorer } from '../evals/hooks';
import type { ScoringFilter } from '../evals/predicate';
import { validateScoringPredicate } from '../evals/predicate';
import { withAck } from '../events/acking-callback';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import { reachesOtherProcesses } from '../events/reach';
import type { Knowledge } from '../knowledge';
import { KNOWLEDGE_INSTRUCTIONS_PROCESSOR_ID, KnowledgeInstructionsProcessor } from '../knowledge/instructions';
import { PINNED_KNOWLEDGE_STATE_ID } from '../knowledge/pinned';
import { PinnedStateProcessor } from '../knowledge/pinned-state-processor';
import type { CoreMessage } from '../llm';
import { resolveModelConfig } from '../llm';
import { MastraLLMV1 } from '../llm/model';
import type {
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
} from '../llm/model/base.types';
import { validateModelTimeoutSettings } from '../llm/model/model-settings';
import { MastraLLMVNext } from '../llm/model/model.loop';
import type { ProviderOptions } from '../llm/model/provider-options';
import { mergeProviderOptions } from '../llm/model/provider-options';
import { ModelRouterLanguageModel } from '../llm/model/router';
import type {
  MastraLanguageModel,
  MastraLegacyLanguageModel,
  MastraModelConfig,
  WidenedMastraModelConfig,
} from '../llm/model/shared.types';
import { RegisteredLogger } from '../logger';
import { AGENTIC_EXECUTION_WORKFLOW_ID, AGENTIC_LOOP_WORKFLOW_ID } from '../loop/loop-builder';
import { networkLoop } from '../loop/network';
import { LOCAL_MODEL_REQUEST_KEY } from '../loop/run-scope-keys';
import { recordDelegationFailure } from '../loop/shared/delegation-outcome';
import { executionFailureTermination } from '../loop/shared/execution-outcome';
import {
  getRunStreamSlot,
  getScopeStreamSlot,
  untilIdleHandlesBackgroundTask,
} from '../loop/shared/stream-until-idle-helpers';
import { TOOL_ABORT_GRACE_MS, TOOL_SETTLE_MARGIN_MS } from '../loop/shared/tool-abort-grace';
import {
  DEADLINE_SAVE_CLAIM_HOLD_MS,
  DEADLINE_SAVE_WAIT_MS,
  createTimeoutAbortSignal,
  isMastraTimeoutError,
  settledOrElapsed,
} from '../loop/timeout';
import type { AgentLoopResumeClaim } from '../loop/types';
import { withDefaultToolCallConcurrencyLimit } from '../loop/workflows/agentic-execution/tool-call-concurrency';
import type { Mastra } from '../mastra';
import { mastraCtorHolder } from '../mastra/mastra-ctor-holder';
import { createRunScope } from '../mastra/run-scope';
import { DEFAULT_RESTART_CONCURRENCY, runWithConcurrency } from '../mastra/run-with-concurrency';
import type { VersionOverrides } from '../mastra/types';
import type { MastraMemory } from '../memory/memory';
import { normalizeMessageHistoryConfig } from '../memory/message-history-config';
import { getMemoryRunState } from '../memory/run-state';
import { checkThreadFGA } from '../memory/thread-fga';
import type { MemoryConfig, MemoryConfigInternal } from '../memory/types';
import type { NotificationDeliveryPolicyInput } from '../notifications/delivery-policy';
import { resolveDeliveryFailureUpdate, resolveNotificationDeliveryDecision } from '../notifications/delivery-policy';
import { applyNotificationRoutingRequirement } from '../notifications/routing';
import {
  createNotificationSignal,
  createNotificationSummarySignal,
  summarizeNotifications,
} from '../notifications/signals';
import type {
  NotificationDeliveryDecision,
  NotificationRecord,
  SendNotificationSignalInput,
} from '../notifications/types';
import type {
  DefinitionSource,
  TracingProperties,
  ObservabilityContext,
  ResumeTracingContext,
  TracingContext,
  TracingPolicy,
  AIModelGenerationSpan,
  ExportedSpan,
  Span,
} from '../observability';
import {
  EntityType,
  InternalSpans,
  SpanType,
  executeWithContext,
  getOrCreateSpan,
  createObservabilityContext,
  resolveCurrentSpan,
  resolveObservabilityContext,
  getResumeTracingContext,
  getWorkflowResumeTracingContext,
} from '../observability';
import type {
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  LLMRequestProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ProcessorWorkflow,
  Processor,
} from '../processors/index';
import { ProcessorStepSchema, isProcessorWorkflow } from '../processors/index';
import { SkillsProcessor } from '../processors/processors/skills';
import { WorkspaceInstructionsProcessor } from '../processors/processors/workspace-instructions';
import type { ProcessorState } from '../processors/runner';
import { ProcessorRunner } from '../processors/runner';
import { defaultStabilityErrorProcessors, STABILITY_ERROR_PROCESSOR_IDS } from '../processors/stability-defaults';
import type { ProcessorStepOutput } from '../processors/step-schema';
import { REPROCESS_PART_KEY, takeHeldParts } from '../processors/stream-reprocess';
import {
  RequestContext,
  withoutLiveRequestKeys,
  MASTRA_INHERITED_MEMORY_KEY,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_SCOPES_KEY,
  MASTRA_THREAD_ID_KEY,
  MASTRA_VERSIONS_KEY,
} from '../request-context';
import { getRequestContextInputSource, getRequestContextInputValues } from '../request-context/input-source';
import type { DeclaredAgentSchedule } from '../schedules/define';
import type { InferStandardSchemaOutput } from '../schema';
import { toStandardSchema, standardSchemaToJSONSchema } from '../schema';
import type { SignalProvider } from '../signals/signal-provider';
import { resolveAgentSkills, mergeWorkspaceSkills } from '../skills/agent-skills-resolver';
import type { AgentSkillsInput, AgentSkillsResolver, SkillInput } from '../skills/types';
import type { MemoryStorage, WorkflowsStorage } from '../storage';
import { getSnapshotMemoryInfo, InMemoryStore } from '../storage';
import type { GoalObjectiveRecord } from '../storage/domains/thread-state/base';
import type { RunFence } from '../storage/run-fencing';
import { matchesRunFence, runOutsideRunFenceScope } from '../storage/run-fencing';
import type { ChunkType, MastraAgentNetworkStream, MastraOnFinishCallback } from '../stream';
import { ChunkFrom } from '../stream';
import { usesOpenAIStrictJsonSchema } from '../stream/aisdk/v5/execute';
import type { FullOutput, MastraModelOutput } from '../stream/base/output';
import type { ToolCallChunk, DelegatedPauseIdentity, MastraStreamTransformOptions } from '../stream/types';
import { createTool } from '../tools';
import { createWebSearchProviderTool, isWebSearchTool, normalizeWebSearchProvider } from '../tools/builtin/web-search';
import { normalizeToolPayloadTransformPolicy } from '../tools/payload-transform';
import type { ToolToConvert } from '../tools/tool-builder/builder';
import {
  isMastraTool,
  isProviderTool,
  isApprovalExempt,
  markAgentWorkflowTool,
  markApprovalExempt,
} from '../tools/toolchecks';
import type {
  CoreTool,
  MastraToolInvocationOptions,
  McpMetadata,
  ToolHooks,
  ToolPayloadTransformPolicy,
} from '../tools/types';
import { validateToolInput } from '../tools/validation';
import type { DynamicArgument } from '../types';
import type { ToolOptions } from '../utils';
import { makeCoreTool, createMastraProxy, ensureToolProperties, deepMerge, rebindProcessorTools } from '../utils';
import { resolveDynamicArgument } from '../utils/dynamic-argument';
import { slugify } from '../utils/slugify';
import type { IMastraVoice } from '../voice';
import { DefaultVoice } from '../voice';
import { createWorkflow } from '../workflows/create';
import { loadStepResults, residentStepResults } from '../workflows/run-journal';
import type { Step } from '../workflows/step';
import type { OutputWriter, WorkflowResult, WorkflowRunState, WorkflowRunStatus } from '../workflows/types';
import {
  waitForSuspendedSnapshot,
  RESUME_SNAPSHOT_POLL_INTERVAL_MS,
  RESUME_SNAPSHOT_WAIT_STATUSES,
} from '../workflows/utils';
import type { AnyWorkflow } from '../workflows/workflow';
import { createStepFromProcessor, isProcessor } from '../workflows/workflow';
import type { AnyWorkspace } from '../workspace';
import { createWorkspaceTools } from '../workspace';
import { ThreadStateFileReadTracker } from '../workspace/filesystem/thread-state-read-tracker';
import type { SkillFormat } from '../workspace/skills';
import { createSkillTools } from '../workspace/skills';
import type { Skill, SkillMetadata, WorkspaceSkills } from '../workspace/skills/types';
import { AgentLegacyHandler } from './agent-legacy';
import type {
  AgentExecutionOptions,
  AgentExecutionOptionsBase,
  AgentStreamOutput,
  PublicAgentExecutionOptions,
  InnerAgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
  NetworkOptions,
  DelegationConfig,
  DelegationStartContext,
  DelegationStartResult,
  DelegationCompleteContext,
  DelegationHookError,
} from './agent.types';
import type { DelegationRefInput, DelegationRefRegistry } from './delegation-refs';
import { createDelegationRefRegistry, resolveDelegationRefs } from './delegation-refs';
import { releaseRemoteAbortListener } from './durable/abort-transport';
import {
  AgentStreamEventTypes,
  DurableStepIds,
  RECOVER_SHUTDOWN_ERROR_ID,
  RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID,
  RECOVER_CHECKPOINT_NOT_AVAILABLE_ERROR_ID,
  RECOVER_RUN_SUSPENDED_ERROR_ID,
  shouldRejectStream,
} from './durable/constants';
import type { DurableAgent } from './durable/durable-agent';
import { runDurableStreamUntilIdle, runResumeDurableStreamUntilIdle } from './durable/durable-stream-until-idle';
import { DefaultAgentExecutionEngine, EventedAgentExecutionEngine } from './durable/execution-engine';
import type { ExecutionFence, UntrackedRunLiveness } from './durable/execution-fence';
import {
  assertExecutionOwned,
  EXECUTION_ABANDONED_ERROR_ID,
  DurableExecutionFenceError,
  EXECUTION_UNVERIFIED_ERROR_ID,
  fencePubSub,
  setExecutionClaim,
  executionLeaseKey,
  readRunGeneration,
  resolveLeaseProvider,
  supportsRunFencing,
} from './durable/execution-fence';
import { getExecutionStreamOwner } from './durable/execution-stream-publisher';
import { detachFullStreamOnEnd } from './durable/observe-full-stream';
import { persistDurableRunInput } from './durable/persist-run-input';
import type { PreparationOptions, PreparationResult } from './durable/preparation';
import { prepareForDurableExecution, SCOPES_ALREADY_APPLIED, RESUMED_SPAN_DATA } from './durable/preparation';
import { createRunAbortController } from './durable/run-abort';
import { createRunCleanup } from './durable/run-cleanup';
import { recordRunSavedMessages } from './durable/run-message-refs';
import {
  getRunRegistryEntry,
  ExtendedRunRegistry,
  endRunSpansWithError,
  globalRunRegistry,
  markResumeInFlight,
  deleteRunRegistryEntry,
} from './durable/run-registry';
import { carrySegmentSpans, openedSegment } from './durable/segment-spans';
import type { SegmentSpanData } from './durable/segment-spans';
import type { DurableStreamAdapterResult, DurableStreamAdapterOptions } from './durable/stream-adapter';
import {
  createDurableAgentStream,
  createRunGenerationFilter,
  emitChunkEvent,
  emitAbortEvent,
  emitErrorEvent,
  emitFinishEvent,
  emitOwnershipClaimedEvent,
  newestLogIndex,
} from './durable/stream-adapter';
import { toLiveStructuredOutputSchema } from './durable/structured-output-null-transform';
import type {
  DurableAgentRecoveredRun,
  DurableAgentListActiveRunsOptions,
  DurableAgentListActiveRunsResult,
  DurableAgentRecoverActiveRunsOptions,
  DurableAgentRecoverActiveRunsResult,
  DurableAgentRecoverOptions,
  DurableAgentStreamOptions,
  DurableAgentStreamResult,
  AgentSuspendedEventData,
  AgentAbortEventData,
  AgentChunkEventData,
  AgentStreamEvent,
  DurableAgentStepFinishResult,
  DurableAgenticWorkflowInput,
  RegistryModelListEntry,
  RunRegistryEntry,
  SerializableModelListEntry,
} from './durable/types';
import { DurableProcessorRebuildError } from './durable/utils/resolve-runtime';
import { restoreCompletionPolicy } from './durable/utils/restore-completion';
import { normalizeResumeGenerateArgs } from './durable/utils/resume-generate-args';
import { deadlineMessageListState, runDurableDeadlineOutputPass } from './durable/workflows/finalize-run';
import {
  hydrateMessageListState,
  loadMessageListStateForResume,
  latestMessageListState,
} from './durable/workflows/shared/message-list-state';
import {
  beginGoalActivity,
  stopGoalActivity,
  GoalSignalProvider,
  resolveGoalStore,
  readObjective,
  writeObjective,
  clearObjective,
} from './goal';
import {
  convertInstructionsToString,
  resolveRunId,
  resolveVersionContext,
  recoverySkip,
  TRANSIENT_RECOVERY_RETRY_DELAY_MS,
  applyReservedMemoryContextKeys,
} from './helpers';
import { buildMcpServerGuidance } from './mcp-guidance';
import type { MessageInput, MessageListInput, UIMessageWithMetadata, MastraDBMessage } from './message-list';
import { MessageList } from './message-list';
import { createStoredMessageLoader } from './message-list/memory-message-refs';
import { modelSpanAttributes } from './model-span-attributes';
import { throwAgentRequestContextValidationError } from './request-context-validation';
import { buildResumeSpanInput } from './resume-span-input';
import { whenRunStepsSettle } from './run-lease-fence';
import { AGENT_LEASE_RENEW_INTERVAL_MS, AGENT_LEASE_TTL_MS } from './run-ownership';
import { SaveQueueManager } from './save-queue';
import type { AgentScopesConfig, AgentScopesSnapshot, ResolvedAgentScopes } from './scopes';
import {
  applyAgentScopesConfig,
  applyResolvedAgentScopes,
  incomingAgentScopes,
  parseAgentScope,
  resolveAgentScopes,
  setRunAgentScopes,
  withoutIdentityAgentScopes,
  restoreRunAgentScopes,
} from './scopes';
import type { PendingSignalListener, AgentSignalInput, CreatedAgentSignal } from './signals';
import { signalSpanAttributes } from './signals';
import { runStreamUntilIdle, runResumeStreamUntilIdle } from './stream-until-idle';
import { publishAbortRequest, requestAcknowledgedAbort } from './streams/abort-transport';
import { AgentStreamBus } from './streams/bus';
import { agentStreamsConfig, areAgentStreamsEnabled } from './streams/config';
import { AGENT_STREAM_TOPIC } from './streams/constants';
import { ExecutionEnginePolicy } from './streams/execution-policy';
import type { ExecutionEngineDefaults } from './streams/execution-policy';
import type { AgentStreamPublisher } from './streams/publisher';
import { createAgentStreamPublisher } from './streams/publisher';
import type { ResponseMessagesReplay } from './streams/response-messages';
import { replayResponseMessages, withRebuiltResponseMessages } from './streams/response-messages';
import type { AgentRunRecord } from './streams/run-records';
import { durableReplayOwnerKey, readAgentRunRecord, readDurableReplayOwner } from './streams/run-records';
import type { AgentStreamStepFinishPayload } from './streams/wire';
import type { SubAgent, SubAgentToolCall, SubAgentToolResult } from './subagent';
import type { ActiveThreadRun, AgentThreadRunRegistration } from './thread-stream-runtime';
import { agentThreadStreamRuntime, AgentThreadLeaseConflictError } from './thread-stream-runtime';
import { TripWire } from './trip-wire';
import { isDurableAgentLike } from './types';
import type {
  AgentClaimThreadPeerOptions,
  AgentAbortThreadOptions,
  AgentConfig,
  AgentUpdateThreadPeerOptions,
  AgentDurableOption,
  AgentGenerateOptions,
  AgentNotificationConfig,
  GoalConfig,
  AgentStreamOptions,
  ToolsetsInput,
  ToolsInput,
  AgentModelManagerConfig,
  AgentCreateOptions,
  AgentExecuteOnFinishOptions,
  AgentEditorConfig,
  AgentInstructions,
  AgentMemoryOption,
  AgentMessageInput,
  AgentMethodType,
  AgentSignal,
  AgentStateSignalInput,
  AgentSubscribeToThreadOptions,
  AgentThreadIdentityOptions,
  AgentThreadPeerAdvertisement,
  AgentThreadSubscription,
  DiscoverAgentThreadPeersOptions,
  CancelQueuedAgentMessagesOptions,
  CancelQueuedAgentMessagesResult,
  DurableAgentLike,
  AgentThreadEventListener,
  SubscribeAgentThreadEventsOptions,
  PublicStructuredOutputOptions,
  QueueAgentMessageOptions,
  QueueAgentMessageResult,
  QueueAgentSignalOptions,
  QueueAgentSignalResult,
  SendAgentMessageOptions,
  SendAgentMessageResult,
  SendAgentNotificationSignalOptions,
  SendAgentNotificationSignalResult,
  SendAgentSignalAccepted,
  SendAgentSignalOptions,
  SendAgentSignalResult,
  SendAgentStateSignalOptions,
  SendAgentStateSignalResult,
  SendAgentStreamResumeOptions,
  SendAgentStreamResumeResult,
  StructuredOutputOptions,
  ModelFallbackSettings,
  ModelWithRetries,
  ZodSchema,
} from './types';
import { isSupportedLanguageModel, resolveThreadIdFromArgs, supportedLanguageModelSpecifications } from './utils';
import { createPrepareStreamWorkflow } from './workflows/prepare-stream';
import type { AgentCapabilities } from './workflows/prepare-stream/schema';
/** Whether a failed owned recovery should terminate observers of the run. */
interface RehydratedRecoveryState {
  requestContext: RequestContext;
  threadId?: string;
  resourceId?: string;
  messageList: MessageList;
  recoverAgentSpan?: Span<SpanType.AGENT_RUN>;
  recoverModelSpan?: AIModelGenerationSpan;
  registryEntry: any;
}

/**
 * Bind live fallback model instances to the persisted ids that llm-execution
 * looks them up by (#22594).
 *
 * Identity first: explicit ids are stable across resolutions, so an exact-id
 * match is definitive regardless of resolver ordering. Position is only
 * trusted among the leftover entries on both sides — regenerated-uuid ids,
 * which can never match a persisted id — and only when those residues line up
 * 1:1. Anything still unbound degrades to config-based resolution in the
 * llm-execution step. (A renamed explicit id is indistinguishable from a
 * fresh uuid and lands in the positional residue — an inherent limit of the
 * persisted contract.)
 */
interface RebindModelListResult {
  modelList: RegistryModelListEntry[] | undefined;
  boundById: number;
  boundByPosition: number;
  unbound: number;
}

function rebindRecoveredModelList(
  persisted: SerializableModelListEntry[],
  enabledLive: AgentModelManagerConfig[],
): RebindModelListResult {
  // Phase 1: bind by identity. Explicit ids are stable across resolutions, so
  // an exact match is definitive regardless of resolver order. Each live entry
  // binds at most once (first unused occurrence wins for duplicate ids).
  const pool = [...enabledLive];
  const bound = persisted.map(entry => {
    const i = pool.findIndex(live => live.id === entry.id);
    return i === -1 ? undefined : pool.splice(i, 1)[0];
  });
  const boundById = bound.filter(Boolean).length;

  // Phase 2: the leftovers on both sides carry regenerated uuids that can
  // never match, so position is the only signal left. Zip them — but only
  // when they pair 1:1; anything else risks mis-binding and stays unbound.
  if (persisted.length - boundById === pool.length) {
    for (let i = 0; i < bound.length; i++) {
      bound[i] ??= pool.shift();
    }
  }

  // Emit in persisted order: the persisted id wins (llm-execution looks live
  // models up by it), everything else comes from the bound live entry — same
  // field mapping as preparation.ts.
  const modelList: RegistryModelListEntry[] = [];
  persisted.forEach((entry, i) => {
    const live = bound[i];
    if (live) {
      modelList.push({
        id: entry.id,
        model: live.model,
        maxRetries: live.maxRetries ?? 0,
        enabled: true,
        headers: live.headers,
      });
    }
  });

  return {
    modelList: modelList.length ? modelList : undefined,
    boundById,
    boundByPosition: modelList.length - boundById,
    unbound: persisted.length - modelList.length,
  };
}

// `Mastra` is imported type-only here: a runtime import would create an ESM
// init cycle (agent → mastra → agent/durable → agent) that breaks
// `class DurableAgent extends Agent` with a TDZ error. The constructor is read
// from `mastraCtorHolder` (populated by `mastra/index.ts` at load), with an
// `await import('../mastra')` fallback for the standalone-agent case where the
// Mastra module was never loaded. See `#getOrCreateEphemeralMastra`.

// Value import of durable constants is safe: constants.ts is a leaf module
// with no imports, so it cannot create the runtime cycle `agent →
// agent/durable → agent`.

// Type-only imports from the durable module: erased at build time so they
// don't create the runtime cycle `agent → agent/durable → agent`.

const RESOLVED_EXECUTION_OPTIONS = Symbol('mastra.durable.resolvedExecutionOptions');
const RESOLVED_DEFAULT_OPTIONS = Symbol('mastra.durable.resolvedDefaultOptions');
function createLocalRequestReader(runId: string, entry: RunRegistryEntry, mastra: Mastra | undefined) {
  const scope = (entry.runScope ??= createRunScope());
  scope.delete(LOCAL_MODEL_REQUEST_KEY);
  const fence = entry.executionFence;
  return () => {
    const current = getRunRegistryEntry(runId, mastra);
    if (current?.runScope !== scope || current.executionFence !== fence || fence?.isLost()) return undefined;
    return scope.get(LOCAL_MODEL_REQUEST_KEY);
  };
}

type DurableAgentResumeOptions<OUTPUT = undefined> = DurableAgentStreamOptions<OUTPUT> & {
  toolCallId?: string;
};

export type MastraLLM = MastraLLMV1 | MastraLLMVNext;

/**
 * Safety ceiling for {@link Agent.#validateSuspendedToolCallTarget} when waiting for
 * a suspend write to become durable on the parent `agentic-loop` row. The normal
 * exit is "parent now carries the target suspension" (reached as soon as the row is
 * durable); this bound only guards against a write that never completes so
 * `approveToolCall()` cannot hang forever.
 */
const RESUME_SUSPEND_DURABILITY_TIMEOUT_MS = 30_000;
/** Upper bound for the exponential poll backoff inside that wait. */
const RESUME_SUSPEND_DURABILITY_MAX_POLL_INTERVAL_MS = 500;

/**
 * Agentic-loop runs currently being resumed in this process, for stores that
 * cannot claim a run atomically. Keyed by runId.
 */
const inFlightUnclaimedResumes = new Set<string>();

/**
 * How long a resume claim may go without a sign of life before a later resume treats it as
 * abandoned by a process that died, and takes the suspension over: a `pending` claim (claimed but
 * not started) since it was claimed, a `running` claim (on stores with run fencing) since its
 * lease was last renewed.
 */
export const AGENT_RESUME_CLAIM_STALE_MS = 60_000;

/** How often a running resume renews its claim lease. Several renewals fit in one stale window. */
const AGENT_RESUME_CLAIM_RENEW_MS = AGENT_RESUME_CLAIM_STALE_MS / 4;

const createSubAgentInputSchema = ({ withResultRefs = false }: { withResultRefs?: boolean } = {}) =>
  z.object({
    prompt: z.string().describe('The prompt to send to the agent'),
    ...(withResultRefs
      ? {
          contextFromRefs: z
            .array(
              z.union([
                z.string().min(1),
                z.object({
                  ref: z.string().min(1).describe('Reference ID from a [ref: ...] line'),
                  as: z.string().min(1).nullish().describe('Optional label for this result in the prompt'),
                  note: z.string().nullish().describe('Optional note about why this result is relevant'),
                }),
              ]),
            )
            .nullish()
            .describe(
              'Reference IDs from the [ref: ...] lines of earlier agent results in this task. The full text of each referenced result is inserted before your prompt exactly as it was produced, so you do not need to restate it.',
            ),
        }
      : {}),
    // Using .nullish() instead of .optional() because OpenAI sends null for unfilled optional fields
    threadId: z.string().nullish().describe('Thread ID for conversation continuity for memory messages'),
    resourceId: z.string().nullish().describe('Resource/user identifier for memory messages'),
    instructions: z
      .string()
      .nullish()
      .describe(
        'Additional instructions to append to the agent instructions. Only provide if you have specific guidance beyond what the agent already knows. Leave empty in most cases.',
      ),
    maxSteps: z
      .number()
      .or(z.string().transform(Number))
      .pipe(z.number().int().min(3))
      .nullish()
      .describe('Maximum number of execution steps for the sub-agent (integer, minimum 3)'),
    // using minimum of 3 to ensure if the agent has a tool call, the llm gets executed again after the tool call step, using the tool call result
    // to return a proper llm response
  });

const createSubAgentOutputSchema = () =>
  z.object({
    text: z.string().describe('The response from the agent'),
    subAgentThreadId: z.string().describe('The thread ID of the agent').optional(),
    subAgentResourceId: z.string().describe('The resource ID of the agent').optional(),
    subAgentToolResults: z
      .array(
        z.object({
          toolName: z.string().describe('The name of the tool'),
          toolCallId: z.string().describe('The ID of the tool call'),
          result: z.unknown().describe('The result of the tool call'),
          args: z.unknown().describe('The arguments of the tool call').optional(),
          isError: z.boolean().describe('Whether the tool call resulted in an error').optional(),
        }),
      )
      .describe("The results from the agent's tool calls")
      .optional(),
    subAgentPendingToolCalls: z
      .array(
        z.object({
          toolName: z.string().describe('The name of the tool'),
          toolCallId: z.string().describe('The ID of the tool call'),
          args: z.unknown().describe('The arguments of the tool call').optional(),
        }),
      )
      .describe(
        'Tool calls the agent made that were never resolved because the tool has no server-side execute (client tools)',
      )
      .optional(),
    ref: z.string().describe('Reference ID for this result when delegation.enableResultReferences is on').optional(),
  });

type SubAgentToolSchemas = {
  inputSchema: StandardSchemaWithJSON<SubAgentToolInput>;
  outputSchema: StandardSchemaWithJSON<SubAgentToolOutput>;
};

type SubAgentToolSchemaVariant = 'default' | 'withResultRefs';

type SubAgentToolInput = Omit<z.infer<ReturnType<typeof createSubAgentInputSchema>>, 'maxSteps'> & {
  maxSteps?: number | null;
  contextFromRefs?: DelegationRefInput[] | null;
};
type SubAgentToolOutput = z.infer<ReturnType<typeof createSubAgentOutputSchema>>;

type SubAgentPendingToolCall = NonNullable<SubAgentToolOutput['subAgentPendingToolCalls']>[number];

/** A run-log entry that ends the run. An error *chunk* can precede the finish, so it does not count. */
const isRunTerminalEvent = (event: any): boolean => {
  if (event?.type === 'error') return true;
  const type = event?.type === 'chunk' ? event.data?.type : event?.type;
  return type === 'finish' || type === 'abort';
};

const RESOLVED_TOOL_INVOCATION_STATES = new Set<string>(['result', 'output-error', 'output-denied']);

/**
 * Tool calls a sub-agent made that never got a result. A tool without a server-side
 * `execute` (a client tool) ends the sub-agent's run at the tool-calls step, and
 * nothing in a delegation can run it, so the call stays unresolved.
 *
 * Calls that failed or were declined also have no tool-result, but the loop records
 * them in the response messages (`output-error` / `output-denied`), so those count as
 * resolved too.
 */
function getPendingSubAgentToolCalls(
  toolCalls: SubAgentToolCall[] | undefined,
  toolResults: SubAgentToolResult[] | undefined,
  responseMessages: MastraDBMessage[],
): SubAgentPendingToolCall[] {
  const resolvedIds = new Set((toolResults ?? []).map(toolResult => toolResult.payload.toolCallId));
  for (const message of responseMessages) {
    for (const part of message.content.parts ?? []) {
      if (part.type === 'tool-invocation' && RESOLVED_TOOL_INVOCATION_STATES.has(part.toolInvocation.state)) {
        resolvedIds.add(part.toolInvocation.toolCallId);
      }
    }
  }
  return (toolCalls ?? [])
    .filter(toolCall => !toolCall.payload.providerExecuted && !resolvedIds.has(toolCall.payload.toolCallId))
    .map(toolCall => ({
      toolName: toolCall.payload.toolName,
      toolCallId: toolCall.payload.toolCallId,
      args: toolCall.payload.args,
    }));
}

/**
 * Note for the supervisor model when the sub-agent stopped on unresolved client tool
 * calls, so an empty sub-agent reply is not read as a finished task.
 */
function formatPendingSubAgentToolCalls(pendingToolCalls: SubAgentPendingToolCall[] | undefined): string {
  if (!pendingToolCalls?.length) return '';
  const calls = pendingToolCalls.map(toolCall => `${toolCall.toolName}(${JSON.stringify(toolCall.args ?? {})})`);
  return `\n\n[The sub-agent stopped before finishing: it called tools that have no server-side execute and were never run: ${calls.join(', ')}.]`;
}

/**
 * The sub-agent's own tool call that paused, read from its `tool-call-suspended` /
 * `tool-call-approval` payload. When that sub-agent is itself re-raising a deeper
 * delegate's pause, the deeper call already rides on `delegatedToolCallId`, so the
 * call that actually paused wins over the intermediate delegation call.
 */
function getDelegatedPauseIdentity(payload: unknown): DelegatedPauseIdentity {
  if (!payload || typeof payload !== 'object') return {};
  const { toolCallId, toolName, delegatedToolCallId, delegatedToolName } = payload as Record<string, unknown>;
  const callId = delegatedToolCallId ?? toolCallId;
  const name = delegatedToolName ?? toolName;
  return {
    ...(typeof callId === 'string' ? { delegatedToolCallId: callId } : {}),
    ...(typeof name === 'string' ? { delegatedToolName: name } : {}),
  };
}

function logPendingSubAgentToolCalls(
  logger: { warn: (message: string, ...args: any[]) => void },
  agentName: string,
  pendingToolCalls: SubAgentPendingToolCall[],
) {
  logger.warn(
    `Sub-agent "${agentName}" stopped on tool calls that have no server-side execute (client tools), which sub-agents cannot resolve. Let the supervisor own client tools, or use suspend() in the sub-agent's tool.`,
    { tools: pendingToolCalls.map(toolCall => toolCall.toolName) },
  );
}

type ModelFallbacks = {
  id: string;
  model: DynamicArgument<WidenedMastraModelConfig>;
  maxRetries: number;
  maxRetriesConfigured: boolean;
  enabled: boolean;
  modelSettings?: DynamicArgument<ModelFallbackSettings>;
  providerOptions?: DynamicArgument<ProviderOptions>;
  headers?: DynamicArgument<Record<string, string>>;
}[];

type ResolvedModelSelection = WidenedMastraModelConfig | ModelFallbacks;

type ProcessorLoadedToolsProvider = {
  getLoadedToolsForRequestContext?: (args: {
    requestContext: RequestContext;
    tools?: Record<string, unknown>;
    getMessages?: () => Promise<MastraDBMessage[]>;
    runMessages?: MastraDBMessage[];
  }) => Record<string, ToolToConvert> | Promise<Record<string, ToolToConvert>>;
};

type AgentSnapshotMemoryInfo = {
  threadId?: string;
  resourceId?: string;
};

/**
 * A suspended tool call inside a suspended agent run — either waiting on a
 * tool-call approval (`requireApproval` / `requireToolApproval`) or on resume
 * data for a tool that called `suspend()`.
 */
export interface AgentRunToolCall {
  toolCallId?: string;
  toolName?: string;
  /** Arguments the model supplied for the tool call (approval suspensions only). */
  args?: unknown;
  /** True when the run is waiting on a tool-call approval. */
  requiresApproval: boolean;
  /** The tool-defined suspend payload when the tool itself called `suspend()`. */
  suspendPayload?: unknown;
}

/**
 * Statuses of agent runs discoverable via {@link Agent.listSuspendedRuns}.
 *
 * Agent run snapshots are only persisted while a run is waiting on input and
 * are deleted when the run reaches a terminal state, so `'suspended'` is the
 * only status discoverable from storage today.
 */
export type AgentRunStatus = Extract<WorkflowRunStatus, 'suspended'>;

/**
 * Filters for {@link Agent.listSuspendedRuns}. Mirrors the `listWorkflowRuns`
 * filter contract, plus the agent-level `threadId` filter.
 */
export interface AgentListSuspendedRunsOptions {
  /** Only return runs that belong to this memory thread. */
  threadId?: string;
  /** Only return runs that belong to this memory resource. */
  resourceId?: string;
  /** Only return runs created at or after this date. */
  fromDate?: Date;
  /** Only return runs created at or before this date. */
  toDate?: Date;
  /**
   * Number of items per page. Pagination is applied when both `perPage` and
   * `page` are provided; otherwise all matching runs are returned.
   */
  perPage?: number;
  /** Zero-indexed page number. */
  page?: number;
}

/**
 * An agent run discovered from workflow snapshot storage.
 */
export interface AgentRun {
  /** Run ID accepted by `resumeStream()`, `approveToolCall()`, and `declineToolCall()`. */
  runId: string;
  status: AgentRunStatus;
  threadId?: string;
  resourceId?: string;
  /** When the run's snapshot was last persisted (i.e. when it suspended). */
  suspendedAt: Date;
  /** Suspended tool calls awaiting approval or resume data. */
  toolCalls: AgentRunToolCall[];
}

export interface AgentListSuspendedRunsResult {
  runs: AgentRun[];
  /** Total number of matching runs, before pagination. */
  total: number;
}

function getInvocationActor(context: unknown): ActorSignal | undefined {
  return (context as { actor?: ActorSignal } | undefined)?.actor;
}

/**
 * Whether any step in the workflow (including nested workflows) can suspend.
 * Mirrors the `canSuspend` rule used when serializing step graphs. Every
 * builder method (then/parallel/branch/loops/foreach) registers its inner
 * steps in `workflow.steps`, so no step-graph walk is needed.
 */
function workflowCanSuspend(workflow: unknown, seen = new Set<unknown>()): boolean {
  if (!workflow || seen.has(workflow)) return false;
  seen.add(workflow);
  const steps = (workflow as { steps?: Record<string, unknown> }).steps;
  return Object.values(steps ?? {}).some(step => {
    const s = step as { suspendSchema?: unknown; resumeSchema?: unknown; component?: string } | undefined;
    if (!s) return false;
    if (s.suspendSchema || s.resumeSchema) return true;
    return s.component === 'WORKFLOW' && workflowCanSuspend(s, seen);
  });
}

type ProcessorWorkflowChildrenContainer = {
  steps?: Record<string, unknown> | unknown[];
  children?: Record<string, unknown> | unknown[];
  stepGraph?: Array<{
    step?: unknown;
    steps?: Array<{ step?: unknown } | unknown>;
  }>;
};

function resolveMaybePromise<T, R = void>(value: T | Promise<T> | PromiseLike<T>, cb: (value: T) => R): R | Promise<R> {
  if (value instanceof Promise || (value != null && typeof (value as PromiseLike<T>).then === 'function')) {
    return Promise.resolve(value).then(cb);
  }

  return cb(value as T);
}

/**
 * Registers the Mastra instance on processors a signal provider contributed.
 *
 * The provider's own `__registerMastra` only reaches the provider. Its
 * processors need the instance too — they resolve storage through it (e.g. the
 * goal and task state processors read the thread-scoped state domain). The
 * array branch in `Agent.__registerMastra` covers processors configured as a
 * plain `inputProcessors` array, but a provider-contributed processor leaves
 * that walk as soon as `inputProcessors` is configured as a function: the Agent
 * folds the two into one resolved function, so `Array.isArray` is false and no
 * processor in it is registered. Without this, such a processor never resolves
 * a store and silently degrades (the goal processor projects `status: none`,
 * i.e. "the goal was cancelled").
 *
 * Callers pass the instances the agent actually wired into its chain, so a
 * provider that returns fresh processors per call still gets the instance on
 * the ones that run.
 *
 * `mastra.addProcessor` is deliberately not used here because these processors belong
 * to the agent's resolved chain and shouldn't be added to Mastra's processor registry.
 */
function registerProviderProcessors(
  processors: Array<InputProcessorOrWorkflow | OutputProcessorOrWorkflow>,
  mastra: Mastra,
) {
  for (const processor of processors) {
    if (typeof (processor as { __registerMastra?: unknown }).__registerMastra === 'function') {
      (processor as { __registerMastra: (m: Mastra) => void }).__registerMastra(mastra);
    }
  }
}

function listProcessorWorkflowChildren(workflow: ProcessorWorkflow): unknown[] {
  const workflowChildren = workflow as ProcessorWorkflowChildrenContainer;
  const children: unknown[] = [];
  const seen = new Set<unknown>();

  const addChild = (child: unknown) => {
    if (!child || seen.has(child)) {
      return;
    }
    seen.add(child);
    children.push(child);
  };

  const addChildren = (value: ProcessorWorkflowChildrenContainer['steps']) => {
    if (Array.isArray(value)) {
      value.forEach(addChild);
      return;
    }
    Object.values(value ?? {}).forEach(addChild);
  };

  addChildren(workflowChildren.steps);
  addChildren(workflowChildren.children);

  for (const entry of workflowChildren.stepGraph ?? []) {
    addChild(entry.step);
    for (const stepEntry of entry.steps ?? []) {
      addChild(
        stepEntry && typeof stepEntry === 'object' && 'step' in stepEntry
          ? (stepEntry as { step?: unknown }).step
          : stepEntry,
      );
    }
  }

  return children;
}

function hasConfiguredProcessor(
  processors: InputProcessorOrWorkflow[],
  predicate: (processor: Processor) => boolean,
): boolean {
  return processors.some(processor => {
    const maybeWorkflow = processor as {
      steps?: Record<string, unknown>;
      stepGraph?: Array<{ type: string; step?: unknown; steps?: Array<{ step?: unknown }> }>;
    };
    const isWorkflowLike = isProcessorWorkflow(processor);

    const workflowSteps = [
      ...Object.values(maybeWorkflow.steps ?? {}),
      ...(maybeWorkflow.stepGraph ?? []).flatMap(entry => {
        if (entry.type === 'step') {
          return entry.step ? [entry.step] : [];
        }
        return entry.steps?.map(stepEntry => stepEntry.step).filter(Boolean) ?? [];
      }),
    ];

    if (!isWorkflowLike || workflowSteps.length === 0) {
      const processorId =
        typeof (processor as Processor).id === 'string' && (processor as Processor).id.startsWith('processor:')
          ? (processor as Processor).id.slice('processor:'.length)
          : (processor as Processor).id;
      return predicate({
        ...(processor as Processor),
        id: processorId,
        providesSkillDiscovery: (processor as Processor).providesSkillDiscovery,
      } as Processor);
    }

    return workflowSteps.some(step => {
      if (isProcessorWorkflow(step)) {
        return hasConfiguredProcessor([step], predicate);
      }

      const stepId = typeof (step as { id?: unknown }).id === 'string' ? (step as { id: string }).id : undefined;
      if (!stepId?.startsWith('processor:')) {
        return false;
      }

      const processorId = stepId.slice('processor:'.length);
      const workflowStep = step as { providesSkillDiscovery?: Processor['providesSkillDiscovery'] };
      return predicate({
        id: processorId,
        providesSkillDiscovery: workflowStep.providesSkillDiscovery,
      } as Processor);
    });
  });
}

function hasEagerSkillsProcessor(processors: InputProcessorOrWorkflow[]): boolean {
  return hasConfiguredProcessor(processors, processor => processor.id === 'skills-processor');
}

function hasOnDemandSkillDiscoveryProcessor(processors: InputProcessorOrWorkflow[]): boolean {
  return hasConfiguredProcessor(processors, processor => processor.providesSkillDiscovery === 'on-demand');
}

function runIdAlreadyClaimedError({ agentName, runId }: { agentName: string; runId: string }): MastraError {
  return new MastraError({
    id: 'AGENT_RUN_ID_ALREADY_CLAIMED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${agentName}" cannot start a run with id "${runId}" because another run already owns it.`,
    details: { agentName, runId },
  });
}

function alreadyClaimedResumeError({
  agentName,
  method,
  runId,
  toolCallId,
}: {
  agentName: string;
  method: string;
  runId: string;
  toolCallId?: string;
}): MastraError {
  return new MastraError({
    id: 'AGENT_RESUME_ALREADY_CLAIMED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${agentName}" ${method}() cannot resume run "${runId}" because another resume of it already claimed it.`,
    details: { agentName, method, runId, ...(toolCallId !== undefined ? { toolCallId } : {}) },
  });
}

/**
 * Run-level tool hooks with every non-function entry dropped. A request body can
 * carry `hooks: { beforeToolCall: null }`; that must not unset configured hooks.
 */
function definedToolHooks(hooks: ToolHooks | null | undefined): ToolHooks | undefined {
  if (!hooks || typeof hooks !== 'object') return undefined;
  const entries = Object.entries(hooks).filter(([, hook]) => typeof hook === 'function');
  return entries.length > 0 ? (Object.fromEntries(entries) as ToolHooks) : undefined;
}

/** Call options whose `hooks` hold only functions, ready to merge over defaults. */
function withDefinedToolHooks<T extends { hooks?: ToolHooks | null }>(options: T | undefined): T | undefined {
  if (options?.hooks === undefined) return options;
  return { ...options, hooks: definedToolHooks(options.hooks) };
}

/** Tool sources slower than this are named on the `agent:prepare-tools` span. */
const SLOW_TOOL_SOURCE_MS = 100;

/**
 * Assistant messages in a delegating agent's context that keep content once tool calls
 * and tool results are removed. Reasoning still counts, so this matches the iteration
 * delegation hooks saw before `stripParentToolParts` also dropped reasoning (#29276).
 */
function countParentAssistantSteps(messages: ModelMessage[]): number {
  return messages.filter(
    message =>
      (message as { id?: string }).id !== 'om-continuation' &&
      message.role === 'assistant' &&
      (!Array.isArray(message.content) ||
        message.content.some(part => part.type !== 'tool-call' && part.type !== 'tool-result')),
  ).length;
}

/**
 * Creates an AI agent that generates and streams responses, with optional tools,
 * memory, and voice capabilities.
 *
 * Configure resumable streams with `durable`. For checkpoint-backed durable
 * execution, explicitly wrap the agent with `createDurableAgent`.
 *
 * @example
 * `yourModel` is your configured model.
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 *
 * const agent = new Agent({
 *   id: 'assistant',
 *   name: 'Assistant',
 *   instructions: 'You are a helpful assistant.',
 *   model: yourModel,
 * });
 * ```
 *
 * @see For documentation bundled with your installed package, locate
 * `@mastra/core/package.json` with your project's resolver or package-manager
 * tooling, then read `dist/docs/SKILL.md` from that package root and follow its
 * reference links. Use package-manager tools for virtual or archived packages.
 *
 * @see [Agent documentation](https://mastra.ai/docs/agents/overview)
 * if packaged docs are unavailable.
 */
export class Agent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
  /**
   * Defaults to `any` (not `unknown`) so agents that declare a `requestContextSchema`
   * remain assignable to the bare `Agent` type. `TRequestContext` is invariant on
   * `Agent` (it appears in both parameter and return positions via `DynamicArgument`
   * / private fields), so a schema-narrowed agent is not assignable to
   * `Agent<..., unknown>` — which broke generic helpers typed as `(agent: Agent) => ...`.
   *
   * Construction without a schema still infers a concrete context from
   * `requestContextSchema` when present; the `any` default only affects the
   * unparameterized `Agent` alias used for "any agent" acceptors.
   */
  TRequestContext extends Record<string, any> | unknown = any,
  TEditor extends AgentEditorConfig | undefined = AgentEditorConfig | undefined,
>
  extends MastraBase
  implements SubAgent<TAgentId, TRequestContext>
{
  public id: TAgentId;
  public name: string;
  public source?: DefinitionSource;
  #instructions: DynamicArgument<AgentInstructions, TRequestContext>;
  /**
   * Schedules declared by a file-based agent's `schedules/` directory, attached
   * by `assembleAgentFromFsEntry`. Mastra reads these at boot and syncs them
   * into schedule storage. Empty for code-defined agents, which register
   * schedules through `mastra.schedules.create(...)` instead.
   */
  #declaredSchedules: DeclaredAgentSchedule[] = [];
  readonly #description?: string;
  readonly #metadata?: DynamicArgument<Record<string, unknown>, TRequestContext>;
  model: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
  #originalModel: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
  maxRetries?: number;
  readonly #maxRetriesConfigured: boolean;
  #mastra?: Mastra;
  /**
   * Lazily-built in-memory Mastra used when the agent isn't wired into one.
   * Provides a workflow storage backend for internal snapshot lookups
   * (loadAgenticLoopSnapshotOrThrow, assertToolCallSuspended,
   * listSuspendedRuns) so `new Agent(...)` works standalone. Cleared when
   * `__registerMastra` attaches a real Mastra later.
   */
  #ephemeralMastra?: Mastra;

  /**
   * True when this instance is a fork produced by resolving a stored agent
   * version (see Mastra#resolveVersionedAgent). Prevents #prepareAndStartPlainWorkflow from
   * re-resolving the version and recursing.
   * @internal
   */
  #storedVersionApplied = false;
  #pubsub?: PubSub;
  #inheritedPubSub?: PubSub;
  /**
   * The agent the shared `AgentThreadStreamRuntime` addresses for this agent's
   * signal, message, and subscription APIs. Defaults to `this`. See
   * {@link Agent.__setThreadRuntimeAgent}.
   */
  #threadRuntimeAgent?: Agent<any, any, any, any>;
  #memory?: DynamicArgument<MastraMemory, TRequestContext>;
  #skills?: AgentSkillsInput<TRequestContext>;
  #skillsFormat?: SkillFormat;
  // Per-request memoization so one resolver call serves both context injection and tool creation.
  #resolvedSkillsByRequest = new WeakMap<RequestContext<TRequestContext>, Promise<SkillInput[]>>();
  #workflows?: DynamicArgument<Record<string, AnyWorkflow>, TRequestContext>;
  #defaultGenerateOptionsLegacy: DynamicArgument<AgentGenerateOptions, TRequestContext>;
  #defaultStreamOptionsLegacy: DynamicArgument<AgentStreamOptions, TRequestContext>;
  #defaultOptions: DynamicArgument<PublicAgentExecutionOptions<TOutput>, TRequestContext>;
  #defaultNetworkOptions: DynamicArgument<NetworkOptions, TRequestContext>;
  #tools: DynamicArgument<TTools, TRequestContext>;
  #hooks?: ToolHooks;
  #scorers: DynamicArgument<MastraScorers, TRequestContext>;
  #scopes?: AgentScopesConfig<TRequestContext>;
  #agents: DynamicArgument<Record<string, SubAgent<string, TRequestContext>>, TRequestContext>;
  #voice: DynamicArgument<IMastraVoice, TRequestContext>;
  #agentChannels: AgentChannels | null = null;
  #workspace?: DynamicArgument<AnyWorkspace | undefined, TRequestContext>;
  #knowledge?: Knowledge | string;
  #inputProcessors?: DynamicArgument<InputProcessorOrWorkflow[], TRequestContext>;
  #outputProcessors?: DynamicArgument<OutputProcessorOrWorkflow[], TRequestContext>;
  #maxProcessorRetries?: number;
  #errorProcessors?: DynamicArgument<ErrorProcessorOrWorkflow[], TRequestContext>;
  #errorProcessorDefaults?: boolean;
  #browser?: MastraBrowser;
  #hasExplicitBrowser = false;
  #requestContextSchema?: StandardSchemaWithJSON<TRequestContext>;
  #backgroundTasks?: AgentBackgroundConfig;
  #notifications?: AgentNotificationConfig;
  #signals?: SignalProvider[];
  /**
   * The exact processor instances signal providers contributed and the agent
   * wired into its chain. Kept so Mastra can be registered on those instances
   * without calling the provider getters again — a provider is free to return
   * fresh processors per call, and registering on those would leave the wired
   * ones without an instance.
   */
  #signalProviderProcessors: Array<InputProcessorOrWorkflow | OutputProcessorOrWorkflow> = [];
  #goal?: GoalConfig;
  #toolPayloadTransform?: ToolPayloadTransformPolicy;
  #editorConfig?: AgentEditorConfig;
  /**
   * Tracks the active `streamUntilIdle` wrapper per `(threadId|resourceId)`
   * scope on this Agent instance. A new call for the same scope aborts the
   * prior one before subscribing so bg-task pubsub events aren't fanned into
   * two concurrent wrappers (which would forward duplicate events and
   * trigger duplicate continuation turns).
   *
   * Value is the prior wrapper's `forceClose`. Entries remove themselves on
   * close if they're still the active one.
   */
  protected activeStreamUntilIdle = new Map<string, () => void>();
  /** The stream segment that currently owns each run's shared state. */
  readonly #segmentOwner = new Map<string, symbol>();
  /**
   * Per-call output processors of suspended runs, by runId. They are functions, so the
   * suspend snapshot cannot hold them; a resume in this process that passes none reuses them,
   * as the durable agent does through its run registry.
   */
  #suspendedRunOutputProcessors = new Map<string, OutputProcessorOrWorkflow[]>();
  readonly #options?: AgentCreateOptions;
  #executionEnginePolicy: ExecutionEnginePolicy;
  readonly #executionPolicyWarnings = new Set<string>();
  readonly #recoveryAttempts = new Map<string, Promise<unknown>>();

  #hasRecoveryAttempt(runId: string): boolean {
    return this.#recoveryAttempts.has(runId);
  }

  #startRecoveryAttempt<T>(runId: string, recover: () => Promise<T>): Promise<T> {
    // Defer execution until the map is populated, including synchronous re-entrant callers.
    const attempt = Promise.resolve().then(recover);
    this.#recoveryAttempts.set(runId, attempt);
    const removeAttempt = () => {
      if (this.#recoveryAttempts.get(runId) === attempt) this.#recoveryAttempts.delete(runId);
    };
    void attempt.then(removeAttempt, removeAttempt);
    return attempt;
  }

  /**
   * Logger for the persistence-policy guardrail warnings. The durable
   * registration path rewires the *underlying* agent's logger but not the
   * wrapper's, so prefer the Mastra-configured logger (which also respects
   * `logger: false`) and fall back to the base logger for unregistered
   * agents.
   *
   * @internal
   */
  protected get guardrailLogger() {
    return this.#mastra?.getLogger() ?? this.logger;
  }

  #executionEngine?: DefaultAgentExecutionEngine;

  /** @internal One execution owner per Agent, initialized without starting a workflow. */
  protected get executionEngine(): DefaultAgentExecutionEngine {
    return this.#resolveExecutionEngine() ?? this.#requireDurableExecution('execution');
  }

  /**
   * The engine the policy selects, built on first use. Building freezes the policy, so
   * registration defaults can no longer pick a different engine. Undefined when no
   * engine is selected.
   */
  #resolveExecutionEngine(): DefaultAgentExecutionEngine | undefined {
    if (this.#executionEngine) return this.#executionEngine;
    const engine = this.#executionEnginePolicy.engine;
    if (!engine) return undefined;
    this.#beginExecutionPolicy();
    return (this.#executionEngine =
      engine === 'evented'
        ? new EventedAgentExecutionEngine(this.id, this.#mastra)
        : new DefaultAgentExecutionEngine(this.id, this.#mastra));
  }

  /** @internal Register native durable workflows before execution workers subscribe. */
  __initializeDurableExecution(): void {
    if (this.#resolveExecutionEngine()) this.getWorkflow();
  }

  /** @internal Legacy wrappers expose the low-level durable stream result. */
  protected get returnsDurableStreamResult(): boolean {
    return false;
  }

  /** @internal Inspect engine selection without allocating a backend or freezing policy. */
  __hasDurableExecution(): boolean {
    return this.#executionEnginePolicy.engine !== false;
  }

  /** Resumable stream layer, built on first use once streams are enabled. */
  #streamBus?: AgentStreamBus;
  /** Forks share the fallback transport without making it override Mastra registration. */
  #defaultStreamPubsub?: PubSub;
  /** Published runs executing in this process, with the owner the abort route checks. */
  #publishedRuns = new Map<string, { publisher: AgentStreamPublisher; resourceId?: string; threadId?: string }>();
  #legacyHandler?: AgentLegacyHandler;
  #config: AgentConfig<TAgentId, TTools, TOutput, TRequestContext, TEditor>;
  #subAgentToolSchemas: Partial<Record<SubAgentToolSchemaVariant, SubAgentToolSchemas>> = {};

  // This flag is for agent network messages. We should change the agent network formatting and remove this flag after.
  private _agentNetworkAppend = false;

  /**
   * Creates a new Agent instance with the specified configuration.
   *
   * @example
   * ```typescript
   * import { Agent } from '@mastra/core/agent';
   * import { Memory } from '@mastra/memory';
   *
   * const agent = new Agent({
   *   id: 'weatherAgent',
   *   name: 'Weather Agent',
   *   instructions: 'You help users with weather information',
   *   model: 'openai/gpt-5',
   *   tools: { getWeather },
   *   memory: new Memory(),
   *   maxRetries: 2,
   * });
   * ```
   */
  constructor(config: AgentConfig<TAgentId, TTools, TOutput, TRequestContext, TEditor>) {
    super({ component: RegisteredLogger.AGENT, rawConfig: config.rawConfig });

    this.#config = config;

    this.name = config.name;
    this.id = config.id ?? config.name;
    this.source = 'code';

    this.#editorConfig = config.editor;
    this.#instructions = config.instructions ?? '';
    this.#description = config.description;
    this.#metadata = config.metadata;
    this.#options = config.options;
    this.#executionEnginePolicy = new ExecutionEnginePolicy(config.durable);

    if (!config.model) {
      const mastraError = new MastraError({
        id: 'AGENT_CONSTRUCTOR_MODEL_REQUIRED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: config.name,
        },
        text: `LanguageModel is required to create an Agent. Please provide the 'model'.`,
      });
      this.logger.trackException(mastraError);
      throw mastraError;
    }

    this.#maxRetriesConfigured = config.maxRetries !== undefined;

    if (Array.isArray(config.model)) {
      if (config.model.length === 0) {
        const mastraError = new MastraError({
          id: 'AGENT_CONSTRUCTOR_MODEL_ARRAY_EMPTY',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: config.name,
          },
          text: `Model array is empty. Please provide at least one model.`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }
      if (config.editor !== false && config.editor?.model === true && config.model.some(model => !model.id)) {
        const mastraError = new MastraError({
          id: 'AGENT_CONSTRUCTOR_EDITOR_MODEL_ID_REQUIRED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: config.name,
          },
          text: `Every model entry must have an explicit id when Editor owns the model list.`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }
      this.model = config.model.map(mdl =>
        Agent.toFallbackEntry(mdl, config.maxRetries ?? 0, this.#maxRetriesConfigured),
      ) as ModelFallbacks;
      this.#originalModel = [...this.model];
    } else {
      this.model = config.model;
      this.#originalModel = config.model;
    }

    this.maxRetries = config.maxRetries ?? 0;

    if (config.workflows) {
      this.#workflows = config.workflows;
    }

    this.#defaultGenerateOptionsLegacy = config.defaultGenerateOptionsLegacy || {};
    this.#defaultStreamOptionsLegacy = config.defaultStreamOptionsLegacy || {};
    this.#defaultOptions = config.defaultOptions || ({} as PublicAgentExecutionOptions<TOutput>);
    this.#defaultNetworkOptions = config.defaultNetworkOptions || {};
    this.#toolPayloadTransform = normalizeToolPayloadTransformPolicy(
      config.transform ?? (config as any).toolPayloadProjection,
    );

    this.#tools = config.tools || ({} as TTools);
    this.#hooks = config.hooks;
    this.#pubsub = config.pubsub;

    if (config.mastra) {
      this.__registerMastra(config.mastra);
      this.__registerPrimitives({
        logger: config.mastra.getLogger(),
      });
    }

    const durable = config.durable;
    if (durable && typeof durable === 'object') {
      const legacyKeys = ['id', 'name'].filter(key => Object.hasOwn(durable, key));
      if (legacyKeys.length) {
        this.logger.warn(
          `Agent "${this.id}" ignores durable execution options: ${legacyKeys.join(', ')}. ` +
            'Use createDurableAgent({ agent, ...executionOptions }) to configure wrapper-specific options. ' +
            'On native Agent, durable configures resumable streams and the execution engine.',
        );
      }
    }

    this.#scopes = config.scopes;
    this.#scorers = config.scorers || ({} as MastraScorers);

    // Validate statically-configured scoring filters at definition time so a
    // typo'd root fails loud at construction instead of silently skipping all
    // scoring at runtime. Function-based scorers are validated when resolved.
    if (typeof this.#scorers !== 'function') {
      for (const entry of Object.values(this.#scorers)) {
        if (entry?.filter) validateScoringPredicate(entry.filter);
      }
    }

    this.#agents = config.agents || ({} as Record<string, SubAgent<string, TRequestContext>>);

    if (config.memory) {
      this.#memory = config.memory;
    }

    if (config.skills) {
      this.#skills = config.skills;
    }

    if (config.skillsFormat) {
      this.#skillsFormat = config.skillsFormat;
    }

    if (config.voice) {
      this.#voice = config.voice;
      // Only seed a static voice instance. A resolver is invoked per request in getVoice(),
      // where its session-owned instance is configured, so we must not touch it here.
      if (typeof this.#voice !== 'function') {
        if (typeof config.tools !== 'function') {
          this.#voice.addTools(this.#tools as TTools);
        }
        if (typeof config.instructions === 'string') {
          this.#voice.addInstructions(config.instructions);
        }
      }
    } else {
      this.#voice = new DefaultVoice();
    }

    if (config.channels) {
      if (config.channels instanceof AgentChannels) {
        this.#agentChannels = config.channels;
        this.#agentChannels.__setAgent(this);
      } else if (
        'adapters' in config.channels &&
        config.channels.adapters &&
        Object.keys(config.channels.adapters).length > 0
      ) {
        // ChannelConfig with adapters — direct adapter configuration
        const channelConfig = config.channels as ChannelConfig;
        this.#agentChannels = new AgentChannels({
          ...channelConfig,
          userName: channelConfig.userName ?? config.name,
        });
        this.#agentChannels.__setAgent(this);
      }
    }

    if (config.browser) {
      // Runtime check: Agent requires SDK providers (AgentBrowser, StagehandBrowser)
      // CLI providers (BrowserViewer) should be used with Workspace instead
      if (config.browser.providerType !== 'sdk') {
        const mastraError = new MastraError({
          id: 'AGENT_INVALID_BROWSER_PROVIDER',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: config.name,
            providerType: config.browser.providerType,
          },
          text: `Agent.browser requires an SDK provider (providerType: 'sdk'), but received '${config.browser.providerType}'. Use @mastra/agent-browser or @mastra/stagehand for Agent.browser. For CLI providers like @mastra/browser-viewer, use Workspace.browser instead.`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }
      this.#browser = config.browser;
      this.#hasExplicitBrowser = true;
    }

    this.#knowledge = config.knowledge;
    if (config.workspace) {
      this.#workspace = config.workspace;
    }

    if (config.inputProcessors) {
      this.#inputProcessors = config.inputProcessors;
    }

    if (config.outputProcessors) {
      this.#outputProcessors = config.outputProcessors;
    }

    // Deliberately no default for `#maxProcessorRetries`. The retry gate is
    // `canRetry = maxProcessorRetries !== undefined && currentProcessorRetryCount < maxProcessorRetries`
    // (llm-execution-step.ts), which covers input/output processor retries too. Defaulting it would
    // silently convert `abort({ retry: true })` from abort into retry for every existing agent — the
    // behavior asserted by `packages/core/src/agent/__tests__/structured-output.test.ts`. The default
    // error processors bound themselves via their own retry budgets instead.
    if (config.maxProcessorRetries !== undefined) {
      this.#maxProcessorRetries = config.maxProcessorRetries;
    }

    if (config.errorProcessors) {
      this.#errorProcessors = config.errorProcessors;
    }
    if (config.errorProcessorDefaults !== undefined) {
      this.#errorProcessorDefaults = config.errorProcessorDefaults;
    }

    if (config.requestContextSchema) {
      this.#requestContextSchema = toStandardSchema(config.requestContextSchema);
    }

    if (config.backgroundTasks) {
      this.#backgroundTasks = config.backgroundTasks;
    }

    if (config.notifications) {
      this.#notifications = config.notifications;
    }

    if (config.goal) {
      this.#goal = config.goal;
    }

    // Auto-wire the goal state-signal projection when a goal is configured but no
    // goal provider was supplied, so configuring `goal` alone keeps the model
    // aware of its current objective (mirrors the task-signal-provider footgun
    // note). Callers who activate goals purely through the persisted objective
    // APIs (`setObjective`/`updateObjectiveOptions`) without static `goal` config
    // should register `GoalSignalProvider` explicitly — we can't auto-wire on
    // `memory` alone because the goal state processor requires an active
    // memory-backed thread and would throw for memory agents that never use
    // goals.
    const configuredSignals = config.signals ?? [];
    const hasGoalProvider = configuredSignals.some(p => p.id === 'goal-signals');
    const effectiveSignals: SignalProvider[] =
      config.goal && !hasGoalProvider ? [...configuredSignals, new GoalSignalProvider()] : configuredSignals;

    if (effectiveSignals.length > 0) {
      this.#signals = effectiveSignals;

      // Collect processors and tools from signal providers that opt in
      const signalInputProcessors: InputProcessorOrWorkflow[] = [];
      const signalOutputProcessors: OutputProcessorOrWorkflow[] = [];
      let signalTools: Record<string, unknown> = {};

      for (const provider of effectiveSignals) {
        // Propagate Mastra instance before lifecycle so providers have storage access
        if (this.#mastra) {
          provider.__registerMastra(this.#mastra);
        }

        // Skip re-wiring providers that are already connected (e.g. via __fork())
        if (!provider.isConnected) {
          provider.connect(this as Agent<any, any, any, any>);
          provider.startPolling();
          void provider.start?.();
        }

        // Resolve the contributed processors once, after connect(), and keep
        // these exact instances: they are what gets wired into the chain, so
        // Mastra has to land on them rather than on whatever the getters return
        // the next time they are called.
        const providerInputProcessors = provider.getInputProcessors?.() ?? [];
        const providerOutputProcessors = provider.getOutputProcessors?.() ?? [];
        this.#signalProviderProcessors.push(...providerInputProcessors, ...providerOutputProcessors);

        if (this.#mastra) {
          registerProviderProcessors(providerInputProcessors, this.#mastra);
          registerProviderProcessors(providerOutputProcessors, this.#mastra);
        }

        signalInputProcessors.push(...providerInputProcessors);
        signalOutputProcessors.push(...providerOutputProcessors);

        if (provider.getTools) {
          signalTools = { ...signalTools, ...provider.getTools() };
        }
      }

      // Merge signal provider tools into the agent's tool set
      if (Object.keys(signalTools).length > 0) {
        if (typeof this.#tools === 'function') {
          const existingToolsFn = this.#tools;
          this.#tools = ((ctx: any) => {
            const result = existingToolsFn(ctx);
            return resolveMaybePromise(result, (tools: any) => ({ ...signalTools, ...tools }));
          }) as any;
        } else {
          this.#tools = { ...signalTools, ...this.#tools } as TTools;
        }
      }

      // Register collected input processors
      if (signalInputProcessors.length > 0) {
        const existingInput = this.#inputProcessors;
        this.#inputProcessors = existingInput
          ? typeof existingInput === 'function'
            ? async (ctx: { requestContext: RequestContext<TRequestContext> }) => {
                const resolved = await existingInput(ctx);
                return [...signalInputProcessors, ...resolved];
              }
            : [...signalInputProcessors, ...existingInput]
          : signalInputProcessors;
      }

      // Register collected output processors
      if (signalOutputProcessors.length > 0) {
        const existingOutput = this.#outputProcessors;
        this.#outputProcessors = existingOutput
          ? typeof existingOutput === 'function'
            ? async (ctx: { requestContext: RequestContext<TRequestContext> }) => {
                const resolved = await existingOutput(ctx);
                return [...resolved, ...signalOutputProcessors];
              }
            : [...existingOutput, ...signalOutputProcessors]
          : signalOutputProcessors;
      }
    }

    // @ts-expect-error Flag for agent network messages
    this._agentNetworkAppend = config._agentNetworkAppend || false;
  }

  getMastraInstance() {
    return this.#mastra;
  }

  /** @internal */
  __inheritMastraForFork(mastra: Mastra) {
    this.#mastra = mastra;
  }

  /** @internal */
  __getNotificationConfig() {
    return this.#notifications;
  }

  getPubSub() {
    return this.#pubsub ?? this.#inheritedPubSub ?? this.#mastra?.pubsub;
  }

  hasOwnPubSub(): boolean {
    return Boolean(this.#pubsub);
  }

  /**
   * Returns the background tasks configuration for this agent.
   */
  getBackgroundTasksConfig(): AgentBackgroundConfig | undefined {
    return this.#backgroundTasks;
  }

  /**
   * Returns the agent-level tool payload transform policy, if any.
   * Used by durable execution to mirror the non-durable layer's
   * per-call → agent → mastra merge order.
   */
  getToolPayloadTransform(): ToolPayloadTransformPolicy | undefined {
    return this.#toolPayloadTransform;
  }

  /**
   * Returns the agent's native goal configuration, if any. Read by the loop's
   * goal step to resolve effective settings (judge model, max runs, prompt).
   * @internal
   */
  __getGoalConfig(): GoalConfig | undefined {
    return this.#goal;
  }

  /**
   * Whether `maxRetries` was explicitly configured on this agent. Durable
   * preparation serializes this alongside `maxRetries` so the llm-execution
   * step's retry ladder can apply the same precedence as the in-process loop:
   * an explicitly configured agent value (including 0) beats call-time
   * `modelSettings.maxRetries`; otherwise the call-time value wins.
   * @internal
   */
  __getMaxRetriesConfigured(): boolean {
    return this.#maxRetriesConfigured;
  }

  /**
   * The agent-level `maxProcessorRetries`. Durable preparation uses it as the
   * default when the call doesn't pass one, matching the in-process loop.
   * @internal
   */
  __getMaxProcessorRetries(): number | undefined {
    return this.#maxProcessorRetries;
  }

  /**
   * Returns a closure that drains pending signals for a given run from the
   * shared `AgentThreadStreamRuntime`. Used by `prepareForDurableExecution` to
   * store the drain function on the in-process `RunRegistryEntry`.
   * @internal
   */
  __getDrainPendingSignals(): (runId: string, scope?: 'pending' | 'pre-run') => CreatedAgentSignal[] {
    const pubsub = this.getPubSub();
    return (runId, scope) => agentThreadStreamRuntime.drainPendingSignals(runId, pubsub, scope);
  }

  /**
   * Returns a closure that queues a signal on a durable run through
   * `sendSignal`, so the run's drain delivers it to the next model request.
   * @internal
   */
  __getEnqueuePendingSignal(): (
    target: { runId: string; resourceId?: string; threadId?: string },
    signalInput: AgentSignalInput,
  ) => Promise<CreatedAgentSignal> {
    return async (target, signalInput) => {
      // A held processor callback belongs to its original run. Never wake a
      // new run or follow a newer owner of the same thread after it finishes.
      if (!agentThreadStreamRuntime.listActiveThreadRuns(this.getPubSub()).some(run => run.runId === target.runId)) {
        throw new Error(`Cannot send processor signal: run ${target.runId} is no longer active`);
      }
      const result = this.sendSignal(signalInput, { runId: target.runId });
      const accepted = await result.accepted;
      if (accepted.action !== 'deliver' || accepted.runId !== target.runId) {
        throw new Error(`Processor signal was not delivered to run ${target.runId}`);
      }
      return result.signal;
    };
  }

  /** @internal */
  __getSubscribePendingSignals(): (runId: string, listener: PendingSignalListener) => () => void {
    const pubsub = this.getPubSub();
    return (runId, listener) => agentThreadStreamRuntime.subscribePendingSignals(runId, listener, pubsub);
  }

  /** @internal Read one JSON-safe request-context value captured in a suspended run snapshot. */
  async __getSuspendedRunRequestContextValue({ runId, key }: { runId: string; key: string }): Promise<unknown> {
    const executionEngine = this.#resolveExecutionEngine();
    if (executionEngine) {
      if (!this.#mastra) {
        throw new MastraError({
          id: 'DURABLE_AGENT_RECOVER_NO_MASTRA',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" __getSuspendedRunRequestContextValue() requires the agent to be registered on a Mastra instance.`,
          details: { agentName: this.name, runId },
        });
      }

      const workflowsStore = await this.#mastra.getStorage()?.getStore('workflows');
      if (!workflowsStore) {
        throw new MastraError({
          id: 'DURABLE_AGENT_RECOVER_NO_STORAGE',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" __getSuspendedRunRequestContextValue() requires persistent storage to load the run snapshot.`,
          details: { agentName: this.name, runId },
        });
      }

      return executionEngine.loadSuspendedRequestContextValue(workflowsStore, runId, this, key);
    }

    try {
      const snapshot = await this.#loadAgenticLoopSnapshotOrThrow({
        runId,
        method: '__getSuspendedRunRequestContextValue',
      });
      return snapshot.requestContext?.[key];
    } catch (error) {
      if (error instanceof MastraError && error.id === 'AGENT_RESUME_NO_SNAPSHOT_FOUND') return undefined;
      throw error;
    }
  }

  /**
   * Registers the agent the shared `AgentThreadStreamRuntime` calls back into
   * for this agent's signal, message, and subscription APIs. The runtime starts
   * idle threads with `agent.stream()`, so the agent it addresses decides the
   * execution path. `DurableAgent` subclasses `Agent`, so `this` is already the
   * durable entry point. The Inngest wrapper is a Proxy over a plain object that
   * forwards these methods to the wrapped agent; without this hook a signal that
   * wakes an idle thread would run through the wrapped agent's in-process
   * `stream()` instead of the durable one.
   * @internal
   */
  __setThreadRuntimeAgent(agent: Agent<any, any, any, any>) {
    this.#threadRuntimeAgent = agent;
  }

  #getThreadRuntimeAgent(): Agent<any, any, any, any> {
    return this.#threadRuntimeAgent ?? (this as Agent<any, any, any, any>);
  }

  /**
   * Returns the uncombined processors suitable for `processLLMRequest`: the input processors plus the
   * resolved error-phase processors, so an error-lane `ProviderHistoryCompat` also gets its prompt rules.
   * Combined (workflow-wrapped) processors skip `processLLMRequest`; this
   * method returns them individually so the `ProcessorRunner` can invoke
   * each processor's `processLLMRequest` method.
   * @internal — used by `DurableAgent` preparation to populate the registry.
   */
  async __listLLMRequestProcessors(
    requestContext?: RequestContext,
    errorProcessorOverrides?: ErrorProcessorOrWorkflow[],
  ): Promise<LLMRequestProcessorOrWorkflow[]> {
    return this.listResolvedLLMRequestProcessors(requestContext, undefined, errorProcessorOverrides);
  }

  /**
   * Set the durable objective for a thread. The objective is judged in the
   * execution loop until complete or the run budget is exhausted. Requires a
   * memory-backed thread and a Mastra storage instance; no-ops otherwise.
   *
   * Only the optional fields explicitly provided are persisted into the
   * objective record; unset fields fall back to the agent's `goal` config at
   * evaluation time. A judge model (here or in `goal.judge`) is required for the
   * goal to do anything.
   */
  async setObjective(
    objective: string,
    options: {
      threadId: string;
      resourceId?: string;
      judgeModelId?: string;
      maxRuns?: number;
      prompt?: string;
      id?: string;
      activeDurationMs?: number;
    },
  ): Promise<GoalObjectiveRecord | undefined> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    if (!store || !options.threadId) return undefined;

    const now = Date.now();
    const suppliedActiveDurationMs = options.activeDurationMs;
    const activeDurationMs =
      suppliedActiveDurationMs !== undefined &&
      Number.isFinite(suppliedActiveDurationMs) &&
      suppliedActiveDurationMs >= 0
        ? suppliedActiveDurationMs
        : 0;
    const record: GoalObjectiveRecord = {
      id: options.id ?? globalThis.crypto.randomUUID(),
      objective,
      status: 'active',
      runsUsed: 0,
      activeDurationMs,
      startedAt: now,
      updatedAt: now,
      ...(options.maxRuns !== undefined && options.maxRuns > 0 ? { maxRuns: options.maxRuns } : {}),
      ...(options.judgeModelId !== undefined ? { judgeModelId: options.judgeModelId } : {}),
      ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
    };
    await writeObjective(store, options.threadId, record);
    return record;
  }

  /**
   * Read the current objective record for a thread, or `undefined` when none is
   * set (or the agent has no storage).
   */
  async getObjective(options: { threadId: string }): Promise<GoalObjectiveRecord | undefined> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    return readObjective(store, options.threadId);
  }

  /**
   * Drop the objective for a thread.
   */
  async clearObjective(options: { threadId: string }): Promise<void> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    await clearObjective(store, options.threadId);
  }

  /**
   * Partially update the options of the active objective. Only provided fields
   * are persisted into the record (so the precedence over agent config is
   * remembered in thread state). No-ops when no objective is set.
   *
   * `pausedReason` lasts for one pause: it's cleared when the goal leaves
   * paused, or when a goal moves into paused from another status without a new
   * reason. A supplied reason replaces the stored one.
   */
  async updateObjectiveOptions(options: {
    threadId: string;
    judgeModelId?: string;
    maxRuns?: number;
    prompt?: string;
    status?: GoalObjectiveRecord['status'];
    pausedReason?: string;
  }): Promise<GoalObjectiveRecord | undefined> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    const existing = await readObjective(store, options.threadId);
    if (!store || !existing) return undefined;

    const updated: GoalObjectiveRecord = {
      ...existing,
      updatedAt: Date.now(),
      ...(options.judgeModelId !== undefined ? { judgeModelId: options.judgeModelId } : {}),
      ...(options.maxRuns !== undefined && options.maxRuns > 0 ? { maxRuns: options.maxRuns } : {}),
      ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      ...(options.pausedReason !== undefined ? { pausedReason: options.pausedReason } : {}),
    };
    // A pause cause lasts for one pause. Leaving paused clears it, and entering
    // paused without a new reason drops any stale one from a non-paused record.
    if (updated.status !== 'paused' || (existing.status !== 'paused' && options.pausedReason === undefined)) {
      delete updated.pausedReason;
    }
    await writeObjective(store, options.threadId, updated);
    return updated;
  }

  /**
   * Returns the statically-configured sub-agents without executing dynamic
   * resolvers. Used by Mastra at registration time to detect whether background
   * tasks should be auto-enabled. Returns undefined when sub-agents are
   * configured via a function (those get resolved per-request).
   * @internal
   */
  __getStaticAgents(): Record<string, SubAgent> | undefined {
    if (typeof this.#agents === 'function') return undefined;
    return this.#agents as Record<string, SubAgent> | undefined;
  }

  /**
   * True when this agent has any sub-agent registry configured — either a
   * static record with entries OR a dynamic (function-based) resolver.
   * Used by Mastra at registration time to decide whether to auto-enable
   * background tasks; we can't know what a function resolver will return
   * at request time, so we enable defensively.
   * @internal
   */
  __hasSubAgentsConfigured(): boolean {
    if (typeof this.#agents === 'function') return true;
    const record = this.#agents as Record<string, SubAgent> | undefined;
    return !!record && Object.keys(record).length > 0;
  }

  /**
   * Disables background task dispatch for this agent. Every tool call will run
   * synchronously in the agentic loop, regardless of the agent's or tools'
   * background configuration.
   *
   * Useful when this agent is invoked as a sub-agent and the parent has wrapped
   * the entire sub-agent invocation as a background task — you don't want the
   * sub-agent's own tools to also dispatch separate background tasks inside it.
   */
  disableBackgroundTasks(): void {
    this.#backgroundTasks = { ...(this.#backgroundTasks ?? {}), disabled: true };
  }

  /**
   * Re-enables background task dispatch after it has been disabled.
   */
  enableBackgroundTasks(): void {
    if (this.#backgroundTasks) {
      this.#backgroundTasks = { ...this.#backgroundTasks, disabled: false };
    }
  }

  /**
   * Inspects a sub-agent (a child agent invoked as a tool) and derives a
   * ToolBackgroundConfig if any of its tools are background-eligible OR if the
   * sub-agent itself has a background tasks config that enables tools.
   *
   * Returns undefined when no background dispatch is warranted, so the parent
   * runs the sub-agent synchronously.
   *
   * @internal
   */
  private async deriveSubAgentBackgroundConfig(
    subAgent: SubAgent<string, TRequestContext>,
    requestContext: RequestContext,
  ): Promise<ToolBackgroundConfig | undefined> {
    try {
      const subAgentBgConfig = subAgent.getBackgroundTasksConfig?.();

      // 1. Sub-agent has its own backgroundTasks config that enables tools
      if (subAgentBgConfig?.disabled !== true && subAgentBgConfig?.tools) {
        if (subAgentBgConfig.tools === 'all') {
          return { enabled: true, waitTimeoutMs: subAgentBgConfig.waitTimeoutMs };
        }
        const hasEnabledTool = Object.values(subAgentBgConfig.tools).some(t => {
          if (typeof t === 'boolean') return t;
          return t?.enabled === true;
        });
        if (hasEnabledTool) {
          return { enabled: true, waitTimeoutMs: subAgentBgConfig.waitTimeoutMs };
        }
      }

      // 2. Any of a full Agent sub-agent's tools has backgroundConfig.enabled === true
      if (subAgent instanceof Agent) {
        const subAgentTools = await subAgent.getToolsForExecution({
          requestContext,
          backgroundTaskEnabled: true,
        });
        if (subAgentTools && typeof subAgentTools === 'object') {
          for (const tool of Object.values(subAgentTools)) {
            const bg = (tool as any)?.backgroundConfig as ToolBackgroundConfig | undefined;
            if (bg?.enabled === true) {
              return { enabled: true, waitTimeoutMs: subAgentBgConfig?.waitTimeoutMs };
            }
          }
        }
      }
    } catch {
      // If anything fails (e.g., dynamic tools throw), skip background derivation
    }
    return undefined;
  }

  /**
   * Returns the AgentChannels instance that manages all channel adapters.
   * Returns null if no channels are configured.
   */
  getChannels(): AgentChannels | null {
    return this.#agentChannels;
  }

  /**
   * Returns the signal providers connected to this agent.
   */
  listSignalProviders(): SignalProvider[] {
    return this.#signals ?? [];
  }

  /**
   * Sets the AgentChannels instance for this agent.
   * Used by ChannelProvider implementations to inject the channels they create.
   * @internal
   */
  setChannels(agentChannels: AgentChannels): void {
    if (this.#agentChannels && this.#agentChannels !== agentChannels) {
      this.logger?.debug(`Replacing existing AgentChannels on agent "${this.name}"`);
    }
    this.#agentChannels = agentChannels;
    agentChannels.__setAgent(this);
    const logger = this.#mastra?.getLogger() ?? this.logger;
    if (logger) {
      agentChannels.__setLogger(logger);
    }
  }

  /**
   * Returns the browser instance for this agent, if configured.
   * Browser tools are automatically added at execution time via `convertTools()`.
   * This getter is primarily used by server-side code to access browser features
   * like screencast streaming and input injection.
   */
  get browser(): MastraBrowser | undefined {
    return this.#browser;
  }

  /**
   * Effective resumable-stream configuration and execution-engine selection.
   *
   * See {@link AgentDurableOption}.
   */
  get durable(): AgentDurableOption | undefined {
    return this.#executionEnginePolicy.durable;
  }

  /** @internal Configured policy, not a claim of active durable execution. */
  __getExecutionEnginePolicy() {
    return this.#executionEnginePolicy.engine;
  }

  /** @internal Only Mastra's stored native-agent registration applies defaults. */
  __registerExecutionEnginePolicy(defaults?: ExecutionEngineDefaults): void {
    const previous = this.#executionEnginePolicy.durable;
    const diagnostic = this.#executionEnginePolicy.register(defaults);
    if (this.#streamBus) {
      const previousConfig = agentStreamsConfig(previous);
      const config = agentStreamsConfig(this.#executionEnginePolicy.durable);
      if (
        previousConfig.cleanupTimeoutMs !== config.cleanupTimeoutMs ||
        previousConfig.shouldCache !== config.shouldCache
      ) {
        this.#streamBus = this.#streamBus.withConfig(config);
      }
    }
    if (diagnostic) {
      this.#warnExecutionPolicy(
        diagnostic,
        'Execution engine policy is fixed for this Agent instance; conflicting registration defaults were ignored.',
      );
    }
    if (typeof this.#defaultOptions !== 'function') this.#warnInheritedExecutionOptions(this.#defaultOptions);
  }

  #warnExecutionPolicy(kind: string, message: string): void {
    if (this.#executionPolicyWarnings.has(kind)) return;
    this.#executionPolicyWarnings.add(kind);
    this.logger.warn(`Agent "${this.id}": ${message}`);
  }

  #warnInheritedExecutionOptions(options: { eagerToolExecution?: boolean; stopWhen?: unknown }): void {
    if (!this.#executionEnginePolicy.inherited) return;
    if (options.eagerToolExecution === true) {
      this.#warnExecutionPolicy(
        'eager',
        'Mastra-inherited execution engine policy does not support eagerToolExecution.',
      );
    }
    if (this.#executionEnginePolicy.engine === 'evented' && options.stopWhen !== undefined) {
      this.#warnExecutionPolicy(
        'stopWhen',
        'Mastra-inherited evented execution does not carry stopWhen to another process. Set maxSteps to bound the run across processes.',
      );
    }
  }

  #beginExecutionPolicy(): void {
    this.#executionEnginePolicy.freeze();
  }

  /**
   * The resumable stream layer runs of this agent publish on, or `undefined`
   * when streams are off. See {@link AgentConfig.durable}.
   *
   * @internal
   */
  __getStreamBus(force = false): AgentStreamBus | undefined {
    if (!force && !areAgentStreamsEnabled(this.#executionEnginePolicy.durable, !!this.#mastra)) return undefined;
    if (!this.#streamBus) {
      const config = agentStreamsConfig(this.#executionEnginePolicy.durable);
      this.#streamBus = new AgentStreamBus(
        { ...config, pubsub: config.pubsub ?? this.#pubsub },
        {
          getMastra: () => this.#mastra,
          usesSharedRunLog: () => this.__usesSharedRunLog(),
          warn: message => this.logger.warn(`[Agent:${this.id}] ${message}`),
        },
        (this.#defaultStreamPubsub ??= new EventEmitterPubSub()),
      );
      if (this.#mastra) this.#streamBus.registerMastra(this.#mastra.pubsub);
    }
    return this.#streamBus;
  }

  /** Whether run frames are published by workers on Mastra's shared log. @internal */
  __usesSharedRunLog(): boolean {
    return (
      !!this.#mastra &&
      this.__hasDurableExecution() &&
      this.executionEngine.resolveWorkflowEngine(this.workflowEngine, this.logger) === 'evented'
    );
  }

  /** Whether this class executes through the plain Agent publisher. @internal */
  protected __ownsPlainStreamPublisher(): boolean {
    return !this.__hasDurableExecution();
  }

  // Sharing transport does not opt durable execution into plain run records or abort checks.
  #ownStreamBus(): AgentStreamBus | undefined {
    if (
      !this.__ownsPlainStreamPublisher() ||
      !areAgentStreamsEnabled(this.#executionEnginePolicy.durable, !!this.#mastra)
    )
      return undefined;
    return this.__getStreamBus();
  }

  /**
   * Whether runs of this agent can be followed from another reader with
   * `observe()` (or the server's observe route): true when its runs publish
   * on a stream topic, which is the case for durable agents and for agents
   * with streams on. See {@link AgentConfig.durable}.
   */
  hasResumableStreams(): boolean {
    return !!this.#executionEnginePolicy.durable || !!this.__getStreamBus();
  }

  /**
   * A published run's id identifies exactly one run: its stream topic and its
   * ownership record are both keyed by it. A caller-supplied `runId` is only a
   * claim, so this refuses one that another run already holds — otherwise a
   * second caller would take over that run's topic and record, and be treated
   * as its owner by `observe()` and the server's run routes.
   *
   * A `running` record means another process is executing that run and listening
   * for its abort requests, so it is refused even to the same owner: two
   * publishers on one topic would cross their chunks and abort requests. A
   * `suspended` or `finished` record keeps the id until it expires, so the same
   * owner can still reuse it (a resume, or a retry after the run finished).
   * Runs without a resourceId own nothing to protect.
   *
   * A resume is the one caller that may continue a `running` record, because it
   * already validated and claimed the suspended run (`resumeContext.claim`).
   * The record can still say `running` there: the suspension is written to the
   * record after the snapshot, so a slow snapshot write leaves the previous
   * `running` record in place for the whole resume handoff.
   *
   * Reading the record and writing our own is not atomic, so two processes
   * starting the same id within one cache round-trip of each other can still
   * overlap. The cache has no compare-and-set to close that.
   *
   * Returns the record it accepted, so the caller can tell a fresh id from a
   * reused one.
   */
  async #assertRunIdAvailable(
    runId: string,
    resourceId: string | undefined,
    { resuming }: { resuming: boolean },
  ): Promise<AgentRunRecord | undefined> {
    if (!areAgentStreamsEnabled(this.#executionEnginePolicy.durable, !!this.#mastra)) return undefined;
    const bus = this.__getStreamBus();
    if (!bus) return undefined;

    // A resume may still find its own finishing publisher here: the suspension is
    // persisted before the publisher ends, so the entry outlives the handoff.
    if (!resuming && this.#publishedRuns.has(runId)) {
      throw runIdAlreadyClaimedError({ agentName: this.name, runId });
    }

    const record = await readAgentRunRecord(bus.runRecordCache, this.id, runId);
    if (!record) return undefined;
    if (record.resourceId && record.resourceId !== resourceId) {
      throw runIdAlreadyClaimedError({ agentName: this.name, runId });
    }
    if (record.status === 'running' && !resuming) {
      throw runIdAlreadyClaimedError({ agentName: this.name, runId });
    }
    return record;
  }

  #createStreamPublisher(
    runId: string,
    owner: { resourceId?: string; threadId?: string; abortSignal?: AbortSignal },
  ): AgentStreamPublisher | undefined {
    if (!areAgentStreamsEnabled(this.#executionEnginePolicy.durable, !!this.#mastra)) return undefined;
    const bus = this.__getStreamBus();
    if (!bus) return undefined;
    const publisher = createAgentStreamPublisher({
      pubsub: bus.pubsub,
      runId,
      cleanupTimeoutMs: bus.cleanupTimeoutMs,
      logger: this.logger,
      abortSignal: owner.abortSignal,
      onEnd: () => {
        if (this.#publishedRuns.get(runId)?.publisher === publisher) this.#publishedRuns.delete(runId);
      },
      record: { cache: bus.runRecordCache, agentId: this.id, resourceId: owner.resourceId, threadId: owner.threadId },
    });
    this.#publishedRuns.set(runId, { publisher, resourceId: owner.resourceId, threadId: owner.threadId });
    return publisher;
  }

  /**
   * Owner of a run this process tracks, or undefined. Native engine runs are tracked by
   * the run registry until auto-cleanup clears their replay history.
   * @internal
   */
  __getRunOwner(runId: string): { resourceId?: string; threadId?: string } | undefined {
    if (!this.__hasDurableExecution()) return this.__getPublishedRunOwner(runId);
    if (!this.executionRunRegistry.has(runId)) return undefined;
    return { ...this.executionRunRegistry.getMemoryInfo(runId) };
  }

  /**
   * Owner of an engine run whose replay history is still retained: the local owner,
   * else the shared record, including legacy records without stream status.
   * Undefined once the run's topic is cleared or when no engine is selected. Only used
   * for replay access. Rejects when the shared cache cannot be read.
   * @internal
   */
  async __getReplayOwner(runId: string): Promise<{ resourceId?: string; threadId?: string } | undefined> {
    if (!this.__hasDurableExecution()) return undefined;
    const local = this.__getRunOwner(runId);
    if (local) return local;
    const shared = await readDurableReplayOwner(
      this.__getStreamBus(true)!.getRunRecordCache(this.__usesSharedRunLog()),
      this.id,
      runId,
    );
    if (!shared) return undefined;
    return { resourceId: shared.resourceId, threadId: shared.threadId };
  }

  /**
   * The shared ownership record of a published run (see
   * `streams/run-records.ts`), from any process sharing this agent's record
   * cache: running, suspended, or finished and still replayable. Undefined when
   * the run is unknown, expired, or streams are off. Rejects when the record
   * cache cannot be read, so the server refuses instead of guessing.
   * @internal Used by the server's observe and run abort routes.
   */
  async __getRunRecord(runId: string): Promise<AgentRunRecord | undefined> {
    if (this.__hasDurableExecution()) {
      return readAgentRunRecord(
        this.__getStreamBus(true)!.getRunRecordCache(this.__usesSharedRunLog()),
        this.id,
        runId,
        durableReplayOwnerKey(this.id, runId),
      );
    }
    const local = this.#publishedRuns.get(runId);
    if (local) {
      const { resourceId, threadId } = local;
      return { agentId: this.id, runId, resourceId, threadId, status: 'running', updatedAt: Date.now() };
    }
    const bus = this.__getStreamBus();
    if (!bus) return undefined;
    return readAgentRunRecord(bus.runRecordCache, this.id, runId);
  }

  /**
   * Owner of a published run executing in this process, or undefined when the
   * run is not running here. Lets the server authorize run-scoped aborts for
   * agents without durable run storage.
   * @internal
   */
  __getPublishedRunOwner(runId: string): { resourceId?: string; threadId?: string } | undefined {
    const run = this.#publishedRuns.get(runId);
    return run ? { resourceId: run.resourceId, threadId: run.threadId } : undefined;
  }

  /**
   * Ask whichever process runs `runId` to abort it, over the run's control
   * topic. Best-effort: a failed publish is logged, and a request nobody hears
   * is a no-op, like aborting a finished run.
   */
  protected async requestRemoteAbort(runId: string, bus = this.__getStreamBus()): Promise<void> {
    if (!bus) return;
    try {
      this.#resolveExecutionEngine();
      await publishAbortRequest(bus.forRun(this.__usesSharedRunLog()).pubsub, runId);
    } catch (error) {
      this.logger.warn(`[Agent:${this.id}] failed to publish abort request`, { runId, error });
    }
  }

  /**
   * Sets or updates the browser instance for this agent.
   * This allows hot-swapping browser configuration without recreating the agent.
   * Browser tools will be automatically updated on the next execution.
   *
   * @param browser - The new browser instance, or undefined to disable browser tools
   */
  setBrowser(browser: MastraBrowser | undefined): void {
    this.#browser = browser;
    // Mark as explicit so workspace browser doesn't overwrite
    // Setting to undefined is also explicit (disabling browser tools)
    this.#hasExplicitBrowser = true;
  }

  /**
   * Returns true if this agent was configured with its own browser instance.
   * Used by AgentController to avoid overwriting agent-level browser configuration.
   */
  hasOwnBrowser(): boolean {
    return this.#hasExplicitBrowser;
  }

  /**
   * Resolves the combined WorkspaceSkills from agent-level skills and/or workspace skills.
   * Agent-level skills win on name conflicts when both are present.
   * @internal
   */
  private async resolveSkills(
    requestContext?: RequestContext,
    workspaceOverride?: AnyWorkspace,
    tracingContext?: TracingContext,
  ): Promise<WorkspaceSkills | undefined> {
    const rc = requestContext || new RequestContext();

    // Resolve agent-level skills (if configured)
    let agentSkills: WorkspaceSkills | undefined;
    if (this.#skills) {
      let resolvedInputs: SkillInput[];
      if (typeof this.#skills === 'function') {
        resolvedInputs = await this.#resolveDynamicSkills(
          this.#skills,
          rc as RequestContext<TRequestContext>,
          tracingContext,
        );
      } else {
        resolvedInputs = this.#skills;
      }
      if (resolvedInputs.length > 0) {
        agentSkills = resolveAgentSkills(resolvedInputs);
      }
    }

    // Resolve workspace-level skills (if configured)
    const workspace = workspaceOverride ?? (await this.getWorkspace({ requestContext: rc }));
    const configuredWorkspaceSkills = workspace?.skills;
    const workspaceSkills = configuredWorkspaceSkills?.getScoped
      ? await configuredWorkspaceSkills.getScoped({ requestContext: rc })
      : configuredWorkspaceSkills;

    // Merge if both exist (agent skills win on name conflicts)
    if (agentSkills && workspaceSkills) {
      const { merged } = await mergeWorkspaceSkills(agentSkills, workspaceSkills);
      return merged;
    }

    return agentSkills || workspaceSkills;
  }

  /**
   * Runs a dynamic skills resolver once per request, sharing the result with the
   * other resolution sites. Rejections aren't cached so a later site can retry.
   * @internal
   */
  #resolveDynamicSkills(
    resolver: AgentSkillsResolver<TRequestContext>,
    requestContext: RequestContext<TRequestContext>,
    tracingContext?: TracingContext,
  ): Promise<SkillInput[]> {
    const pending = this.#resolvedSkillsByRequest.get(requestContext);
    if (pending) return pending;

    const parentSpan = tracingContext?.currentSpan ?? resolveCurrentSpan();
    const skillsSpan = parentSpan?.createChildSpan({
      type: SpanType.SKILL_ACTION,
      name: 'skill:resolve',
      attributes: { operation: 'resolve' as const, agentId: this.id },
    });

    const resolution = executeWithContext({
      span: skillsSpan,
      fn: async () => resolver({ requestContext, tracingContext: { currentSpan: skillsSpan } }),
    })
      .then(skills => {
        skillsSpan?.end({ attributes: { skillCount: skills.length } });
        return skills;
      })
      .catch(error => {
        skillsSpan?.error({ error: error instanceof Error ? error : new Error(String(error)), endSpan: true });
        this.#resolvedSkillsByRequest.delete(requestContext);
        throw error;
      });

    this.#resolvedSkillsByRequest.set(requestContext, resolution);
    return resolution;
  }

  /**
   * Gets the skills processors to add to input processors when skills are configured.
   * Supports both agent-level skills and workspace skills.
   * @internal
   */
  private async getSkillsProcessors(
    configuredProcessors: InputProcessorOrWorkflow[],
    requestContext?: RequestContext,
  ): Promise<InputProcessorOrWorkflow[]> {
    // Check for existing SkillsProcessor in configured processors to avoid duplicates
    const hasSkillsProcessor = hasEagerSkillsProcessor(configuredProcessors);
    const hasOnDemandProcessor = hasOnDemandSkillDiscoveryProcessor(configuredProcessors);
    if (hasSkillsProcessor || hasOnDemandProcessor) {
      return [];
    }

    const rc = requestContext || new RequestContext();
    const workspace = await this.getWorkspace({ requestContext: rc });

    // Resolve combined skills from agent-level and/or workspace
    const skills = await this.resolveSkills(rc, workspace ?? undefined);
    if (!skills) {
      return [];
    }

    return [new SkillsProcessor({ skills, format: this.#skillsFormat })];
  }

  /**
   * Gets the workspace-instructions processors to add when the workspace has a
   * filesystem or sandbox (i.e. something to describe).
   * @internal
   */
  private async getWorkspaceInstructionsProcessors(
    configuredProcessors: InputProcessorOrWorkflow[],
    requestContext?: RequestContext,
  ): Promise<InputProcessorOrWorkflow[]> {
    const workspace = await this.getWorkspace({ requestContext: requestContext || new RequestContext() });
    if (!workspace) return [];

    // Skip if workspace has no filesystem or sandbox (nothing to describe)
    const hasFilesystemConfig =
      typeof workspace.hasFilesystemConfig === 'function' ? workspace.hasFilesystemConfig() : !!workspace.filesystem;
    const hasSandboxConfig =
      typeof workspace.hasSandboxConfig === 'function' ? workspace.hasSandboxConfig() : !!workspace.sandbox;
    if (!hasFilesystemConfig && !hasSandboxConfig) return [];

    // Check for existing processor to avoid duplicates
    const hasProcessor = configuredProcessors.some(
      p => !isProcessorWorkflow(p) && 'id' in p && p.id === 'workspace-instructions-processor',
    );
    if (hasProcessor) return [];

    return [new WorkspaceInstructionsProcessor({ workspace })];
  }

  #warnedPinsWithoutMemory = false;

  #getKnowledgeProcessors(
    configuredProcessors: InputProcessorOrWorkflow[],
    hasMemory: boolean,
  ): InputProcessorOrWorkflow[] {
    const knowledge = this.getKnowledge();
    if (!knowledge) return [];
    const configuredIds = new Set(
      configuredProcessors.flatMap(p => (!isProcessorWorkflow(p) && 'id' in p ? [p.id] : [])),
    );
    const processors: InputProcessorOrWorkflow[] = [];
    const instructions = knowledge.getInstructions();
    if (instructions && !configuredIds.has(KNOWLEDGE_INSTRUCTIONS_PROCESSOR_ID)) {
      processors.push(new KnowledgeInstructionsProcessor(instructions));
    }
    if (knowledge.pinnedContextEnabled && !configuredIds.has(PINNED_KNOWLEDGE_STATE_ID)) {
      // Pins ride a Memory state signal; without Memory there is no thread to carry them.
      if (!hasMemory) {
        if (!this.#warnedPinsWithoutMemory) {
          this.#warnedPinsWithoutMemory = true;
          this.logger.warn(
            `Agent "${this.name}": Knowledge pinnedContext needs Memory on the agent; pinned pages are not delivered without it.`,
          );
        }
        return processors;
      }
      processors.push(
        new PinnedStateProcessor({
          principalsKey: context => knowledge.__principalsKey(context),
          readPins: context => knowledge.__deliveredPins(context),
          ...knowledge.__toolGroups,
        }),
      );
    }
    return processors;
  }

  /**
   * Extract and forward client observability data from incoming messages.
   *
   * ## How client-side tool observability flows through the system
   *
   * Client-side tools (defined via `@mastra/client-js`'s `clientTools`)
   * execute in the browser, not on the server. The observability data
   * they produce follows a two-request round trip:
   *
   * **Request 1 (server → client):**
   * The agent loop emits a tool-call chunk for a client tool. If
   * `@mastra/observability` is configured, a CLIENT_TOOL_CALL
   * span is created and a W3C trace context carrier is injected into
   * the chunk's `observability` field. This happens in
   * `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`
   * while processing streamed or final tool-call chunks in
   * `processOutputStream`.
   *
   * **Client execution:**
   * The `@mastra/client-js` SDK sees the carrier on the tool-call
   * chunk, creates an `ObservabilityCollector` that buffers child
   * spans and logs, wraps the user's `execute` function (providing
   * the `observe` helper on the context), and after execution flushes
   * the collector to an OTLP/JSON payload.
   *
   * **Request 2 (client → server):**
   * The client SDK re-invokes `agent.stream()` / `agent.generate()`
   * with the tool result appended as a tool-role message. The OTLP
   * payload and the original W3C carrier are attached to the
   * tool-result content block as `__mastraObservability`:
   *
   * ```
   * { type: 'tool-result', toolCallId, toolName, result,
   *   __mastraObservability: { parentContext, payload } }
   * ```
   *
   * This method scans the incoming messages for those metadata blocks,
   * extracts them, forwards the payload through
   * `ClientObservabilityProxy.receive()` on the observability bus,
   * and strips the metadata so the model never sees it. It is called
   * at the top of `stream()` and `generate()` before messages reach
   * the loop.
   */
  #extractClientObservability(messages: MessageListInput): void {
    if (!Array.isArray(messages)) return;

    const proxy = this.#mastra?.observability?.getClientObservabilityProxy?.();

    const handleObservabilityBlock = (block: Record<string, unknown>) => {
      const obs = block.__mastraObservability as
        | {
            parentContext?: { traceparent: string; tracestate?: string; baggage?: string };
            payload?: { spans?: unknown; logs?: unknown; executionDurationMs?: number; toolName?: string };
          }
        | undefined;

      if (proxy && obs?.payload && obs.parentContext) {
        try {
          proxy.receive(
            obs.payload as Parameters<typeof proxy.receive>[0],
            obs.parentContext as Parameters<typeof proxy.receive>[1],
          );
        } catch (err) {
          // Tracing must never break the agent run.
          this.logger?.warn?.('[ClientObservabilityProxy] failed to receive client observability payload', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Strip the metadata so the model doesn't see it
      delete block.__mastraObservability;
    };

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || !('role' in msg)) continue;
      const parts = (msg as { parts?: unknown }).parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (!part || typeof part !== 'object') continue;
          const block = part as Record<string, unknown>;
          if (block.type === 'tool-invocation') {
            const toolInvocation = block.toolInvocation;
            if (!toolInvocation || typeof toolInvocation !== 'object') continue;
            handleObservabilityBlock(toolInvocation as Record<string, unknown>);
            continue;
          }

          // AI SDK v6 UIMessage tool parts carry arbitrary `toolMetadata` that survives the
          // full useChat round-trip. We use it as the transport for the W3C carrier and
          // buffered OTLP payload emitted during client-side tool execution.
          const toolMetadata = block.toolMetadata;
          if (!toolMetadata || typeof toolMetadata !== 'object') continue;
          handleObservabilityBlock(toolMetadata as Record<string, unknown>);
        }
      }

      if ((msg as { role: string }).role !== 'tool') continue;
      const content = (msg as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;

      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const block = part as Record<string, unknown>;
        if (block.type !== 'tool-result') continue;
        handleObservabilityBlock(block);
      }
    }
  }

  /**
   * Returns the agents configured for this agent, resolving function-based agents if necessary.
   * Used in multi-agent collaboration scenarios where this agent can delegate to other agents.
   *
   * @example
   * ```typescript
   * const agents = await agent.listAgents();
   * console.log(Object.keys(agents)); // ['agent1', 'agent2']
   * ```
   */
  public listAgents({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | Record<string, SubAgent<string, TRequestContext>>
    | Promise<Record<string, SubAgent<string, TRequestContext>>> {
    const agentsToUse = this.#agents ? resolveDynamicArgument(this.#agents, { requestContext }) : {};

    return resolveMaybePromise(agentsToUse, agents => {
      if (!agents) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_AGENTS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based agents returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      const pubsub = this.getPubSub();
      Object.entries(agents || {}).forEach(([_agentName, agent]) => {
        if (this.#mastra) {
          agent.__registerMastra?.(this.#mastra);
        }
        if (pubsub && agent instanceof Agent && !agent.hasOwnPubSub()) {
          agent.__setPubSub(pubsub);
        }
      });

      return agents;
    });
  }

  /**
   * Resolves the error processors for a generation.
   *
   * The caller's list is the base and keeps its order. Each shared stability default is added only
   * when no configured processor already carries its id, and is inserted at the position its id
   * gives it among the defaults, so naming a subset of them still yields the correct relative order
   * — supplying only `stream-error-retry-processor`, for instance, still puts `provider-history-compat`
   * ahead of it. Configured processors are never reordered. An empty list is merged like any other,
   * so it resolves to the defaults; `errorProcessorDefaults: false` is the only opt-out.
   *
   * Pass `includeDefaults: false` to resolve only what the caller configured. `getConfiguredProcessorIds`
   * uses that mode because its contract is the raw configured list — the editor clones it to storage, so
   * framework defaults must not appear there.
   */
  async #resolveErrorProcessors({
    requestContext,
    overrides,
    includeDefaults = true,
  }: {
    requestContext: RequestContext;
    overrides?: ErrorProcessorOrWorkflow[];
    includeDefaults?: boolean;
  }): Promise<ErrorProcessorOrWorkflow[]> {
    if (overrides) return this.#withMemoryErrorProcessors(overrides, requestContext);

    const configured = await this.#resolveConfiguredErrorProcessors(requestContext);
    if (!includeDefaults) return configured ?? [];
    return this.#withMemoryErrorProcessors(this.#withErrorProcessorDefaults(configured), requestContext);
  }

  /**
   * Appends the memory's error processors, like memory input and output processors are added
   * ahead of configured ones. They go last so configured and default error processors get the
   * first chance to handle an error, and they are kept when a call overrides `errorProcessors`.
   */
  async #withMemoryErrorProcessors(
    resolved: ErrorProcessorOrWorkflow[],
    requestContext: RequestContext,
  ): Promise<ErrorProcessorOrWorkflow[]> {
    const memory = await this.getMemory({ requestContext });
    if (!memory) return resolved;

    const resolvedIds = new Set(resolved.map(processor => processor.id));
    // Optional so memory objects that predate this hook (or don't extend MastraMemory) still work.
    const memoryProcessors = ((await memory.getErrorProcessors?.(resolved, requestContext)) ?? []).filter(
      processor =>
        !resolvedIds.has(processor.id) &&
        !(this.#inheritedMemory(requestContext) && processor.id === 'observational-memory'),
    );
    return memoryProcessors.length > 0 ? [...resolved, ...memoryProcessors] : resolved;
  }

  async #resolveConfiguredErrorProcessors(
    requestContext: RequestContext,
  ): Promise<ErrorProcessorOrWorkflow[] | undefined> {
    if (!this.#errorProcessors) return undefined;
    return resolveDynamicArgument(this.#errorProcessors, { requestContext });
  }

  #withErrorProcessorDefaults(configured: ErrorProcessorOrWorkflow[] | undefined): ErrorProcessorOrWorkflow[] {
    if (this.#errorProcessorDefaults === false) return configured ?? [];
    if (!configured) return defaultStabilityErrorProcessors();

    const configuredIds = new Set(configured.map(processor => processor.id));
    const missingDefaults = defaultStabilityErrorProcessors().filter(processor => !configuredIds.has(processor.id));
    if (missingDefaults.length === 0) return configured;

    // Insert each missing default before the first configured processor that follows it in the
    // canonical order, so a caller naming a later default does not invert the pair. Configured
    // processors keep their positions; defaults with no successor are appended in canonical order.
    const canonicalIndex = new Map<string, number>(STABILITY_ERROR_PROCESSOR_IDS.map((id, index) => [id, index]));
    const resolved = [...configured];

    for (const defaultProcessor of missingDefaults) {
      const index = canonicalIndex.get(defaultProcessor.id);
      if (index === undefined) {
        resolved.push(defaultProcessor);
        continue;
      }

      const insertAt = resolved.findIndex(processor => {
        const processorIndex = canonicalIndex.get(processor.id);
        return processorIndex !== undefined && processorIndex > index;
      });

      if (insertAt === -1) resolved.push(defaultProcessor);
      else resolved.splice(insertAt, 0, defaultProcessor);
    }

    return resolved;
  }

  /**
   * Resolves a run's error processors once: the list the error lane runs (call-time `overrides`,
   * otherwise the configured list merged with the defaults, plus the memory's error processors
   * either way) and whether the caller
   * configured any themselves. A dynamic `errorProcessors` function is invoked at most once, so
   * the request lane, the error lane and the retry-cap warning all see the same instances.
   * @internal
   */
  async __resolveRunErrorProcessors(
    requestContext: RequestContext,
    overrides?: ErrorProcessorOrWorkflow[],
  ): Promise<{ errorProcessors: ErrorProcessorOrWorkflow[]; hasConfiguredErrorProcessors: boolean }> {
    if (overrides) {
      return {
        errorProcessors: await this.#withMemoryErrorProcessors(overrides, requestContext),
        hasConfiguredErrorProcessors: overrides.length > 0,
      };
    }

    const configured = await this.#resolveConfiguredErrorProcessors(requestContext);
    return {
      errorProcessors: await this.#withMemoryErrorProcessors(
        this.#withErrorProcessorDefaults(configured),
        requestContext,
      ),
      hasConfiguredErrorProcessors: Boolean(configured?.some(processor => processor.id)),
    };
  }

  /**
   * Creates and returns a ProcessorRunner with resolved input/output processors.
   * @internal
   */
  private async getProcessorRunner({
    requestContext,
    inputProcessorOverrides,
    outputProcessorOverrides,
    errorProcessorOverrides,
    processorStates,
  }: {
    requestContext: RequestContext;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
    errorProcessorOverrides?: ErrorProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
  }): Promise<ProcessorRunner> {
    // Resolve processors - overrides replace user-configured but auto-derived (memory, skills) are kept
    const inputProcessors = await this.listResolvedInputProcessors(requestContext, inputProcessorOverrides);
    const outputProcessors = await this.listResolvedOutputProcessors(requestContext, outputProcessorOverrides);
    const errorProcessors = await this.#resolveErrorProcessors({
      requestContext,
      overrides: errorProcessorOverrides,
    });

    return new ProcessorRunner({
      inputProcessors,
      outputProcessors,
      errorProcessors,
      logger: this.logger,
      agentName: this.name,
      agent: this,
      processorStates,
    });
  }

  /**
   * Combines multiple processors into a single workflow.
   * Each processor becomes a step in the workflow, chained together.
   * If there's only one item and it's already a workflow, returns it as-is.
   * @internal
   */
  private combineProcessorsIntoWorkflow<T extends InputProcessorOrWorkflow | OutputProcessorOrWorkflow>(
    processors: T[],
    workflowId: string,
  ): T[] {
    // No processors - return empty array
    if (processors.length === 0) {
      return [];
    }

    // Single item that's already a workflow - mark it as processor type and return
    if (processors.length === 1 && isProcessorWorkflow(processors[0]!)) {
      const workflow = processors[0];
      // Mark the workflow as a processor workflow if not already set
      // Note: This mutates the workflow, but processor workflows are expected to be
      // dedicated to this purpose and not reused as regular workflows
      if (!workflow.type) {
        workflow.type = 'processor';
      }
      return [workflow];
    }

    // Filter out invalid processors (objects that don't implement any processor methods)
    const validProcessors = processors.filter(p => isProcessorWorkflow(p) || isProcessor(p));

    if (validProcessors.length === 0) {
      return [];
    }

    // If after filtering we have a single workflow, mark it as processor type and return
    if (validProcessors.length === 1 && isProcessorWorkflow(validProcessors[0]!)) {
      const workflow = validProcessors[0];
      // Mark the workflow as a processor workflow if not already set
      if (!workflow.type) {
        workflow.type = 'processor';
      }
      return [workflow];
    }

    // Create a single workflow with all processors chained
    // Mark it as a processor workflow type
    // validateInputs is disabled because ProcessorStepSchema contains z.custom() fields
    // that may hold user-provided Zod schemas. When users use Zod 4 schemas while Mastra
    // uses Zod 3 internally, validation fails due to incompatible internal structures.
    let workflow = createWorkflow({
      id: workflowId,
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
      type: 'processor',
      options: {
        validateInputs: false,
        // Internal processor workflows are transient and non-resumable, so they must never
        // write snapshot rows to the user's storage (mirrors the execution-workflow fix in #17344).
        shouldPersistSnapshot: () => false,
        // Never stored, so only the agent call that owns it can cancel it.
        localCancellationOnly: true,
        tracingPolicy: {
          // mark all workflow spans related to processor execution as internal
          internal: InternalSpans.WORKFLOW,
        },
      },
    });
    workflow.__setLogger(this.logger);

    const stateSignalProcessors: Processor[] = [];
    const streamSteps: ReturnType<typeof createStepFromProcessor>[] = [];
    const streamProcessorIds: string[] = [];

    for (const [index, processorOrWorkflow] of validProcessors.entries()) {
      // Convert processor to step, or use workflow directly (nested workflows are allowed)
      let step: Step<string, unknown, any, any, any, any>;
      if (isProcessorWorkflow(processorOrWorkflow)) {
        step = processorOrWorkflow;
        stateSignalProcessors.push(...(processorOrWorkflow.__stateSignalProcessors ?? []));
      } else {
        // Set processorIndex on the processor for span attributes
        const processor = processorOrWorkflow as Processor;
        processor.processorIndex = index;
        const processorStep = createStepFromProcessor(processor);
        step = processorStep;
        if (processor.processOutputStream) {
          streamSteps.push(processorStep);
          streamProcessorIds.push(processor.id);
        }
        const toolProvider = processor as ProcessorLoadedToolsProvider;
        if (typeof toolProvider.getLoadedToolsForRequestContext === 'function') {
          (step as ProcessorLoadedToolsProvider).getLoadedToolsForRequestContext =
            toolProvider.getLoadedToolsForRequestContext.bind(processor);
        }
        if (processor.computeStateSignal) {
          stateSignalProcessors.push(processor);
        }
      }
      workflow = workflow.then(step);
    }

    const committedWorkflow = workflow.commit() as T;
    if (isProcessorWorkflow(committedWorkflow)) {
      committedWorkflow.__processOutputStream = validProcessors.some(
        processor => isProcessorWorkflow(processor) || !!processor.processOutputStream,
      );
      committedWorkflow.__processOutputStep = validProcessors.some(
        processor => isProcessorWorkflow(processor) || !!processor.processOutputStep || !!processor.processLLMResponse,
      );
      committedWorkflow.__processToolResult = validProcessors.some(
        processor => isProcessorWorkflow(processor) || !!processor.processToolResult,
      );
      if (validProcessors.every(processor => !isProcessorWorkflow(processor))) {
        committedWorkflow.__executeOutputStream = async ({ inputData, ...context }) => {
          let result = inputData;
          for (const step of streamSteps) {
            if (result.part == null) break;
            result = await step.execute({ inputData: result, ...context });
          }
          return result;
        };
        committedWorkflow.__flushOutputStream = async ({ inputData, ...context }) => {
          const released: ChunkType[] = [];
          const { processorStates } = inputData as { processorStates?: Map<string, ProcessorState> };
          // Runs a part through the steps from `start` on. A part a step stashes for
          // reprocessing re-enters at that step, never upstream, where a holder that
          // has already released everything would keep it.
          const runFrom = async (part: ChunkType, start: number): Promise<void> => {
            let result: ProcessorStepOutput = { ...inputData, part };
            const stashed: Array<[ChunkType, number]> = [];
            for (let index = start; index < streamSteps.length && result.part != null; index++) {
              result = await streamSteps[index]!.execute({ inputData: result, ...context });
              const custom = processorStates?.get(streamProcessorIds[index]!)?.customState;
              if (custom?.[REPROCESS_PART_KEY]) {
                stashed.push([custom[REPROCESS_PART_KEY] as ChunkType, index]);
                delete custom[REPROCESS_PART_KEY];
              }
            }
            if (result.part != null) released.push(result.part as ChunkType);
            for (const [next, index] of stashed) await runFrom(next, index);
          };
          for (const index of streamSteps.keys()) {
            const held = await takeHeldParts(processorStates?.get(streamProcessorIds[index]!)?.customState);
            for (const part of held) await runFrom(part, index + 1);
          }
          return released;
        };
        committedWorkflow.__discardOutputStream = async processorStates => {
          // A later processor holds parts that passed the earlier ones first, so it goes first.
          const kept: ChunkType[] = [];
          for (const id of [...streamProcessorIds].reverse()) {
            kept.push(...(await takeHeldParts(processorStates?.get(id)?.customState, { discard: true })));
          }
          return kept;
        };
      }
    }
    // Register the parent Mastra instance on this internal processor workflow so that its
    // createRun() -> getWorkflowRunById() can read configured storage instead of logging
    // "Cannot get workflow run. Mastra storage is not initialized" on every run (then falling
    // back to in-memory). Combined with shouldPersistSnapshot:()=>false above, this does not
    // write any processor-workflow rows to storage. Mirrors the execution-workflow fix in #17344.
    if (this.#mastra && isProcessorWorkflow(committedWorkflow)) {
      committedWorkflow.__registerMastra(this.#mastra);
    }
    if (stateSignalProcessors.length > 0 && isProcessorWorkflow(committedWorkflow)) {
      committedWorkflow.__stateSignalProcessors = stateSignalProcessors;
    }

    // The resulting workflow is compatible with both Input and Output processor types
    return [committedWorkflow];
  }

  /**
   * Resolves and returns output processors from agent configuration.
   * All processors are combined into a single workflow for consistency.
   * @internal
   */
  private async listResolvedOutputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: OutputProcessorOrWorkflow[],
  ): Promise<OutputProcessorOrWorkflow[]> {
    // Get configured output processors - use overrides if provided (from generate/stream options),
    // otherwise use agent constructor processors
    const configuredProcessors = configuredProcessorOverrides
      ? configuredProcessorOverrides
      : this.#outputProcessors
        ? await resolveDynamicArgument(this.#outputProcessors, {
            requestContext: requestContext || new RequestContext(),
          })
        : [];

    // Get memory output processors (with deduplication)
    // Use getMemory() to ensure storage is injected from Mastra if not explicitly configured
    const memory = await this.getMemory({ requestContext: requestContext || new RequestContext() });

    const memoryProcessors = memory ? await memory.getOutputProcessors(configuredProcessors, requestContext) : [];
    const effectiveMemoryProcessors = this.#inheritedMemory(requestContext)
      ? memoryProcessors.filter(processor => processor.id !== 'observational-memory')
      : memoryProcessors;

    // Get channel output processors (with deduplication) — mirrors the input
    // processor hookup. Channels render the agent's stream to the originating
    // chat platform via this processor; without it, replies never reach Slack.
    const channelProcessors = this.#agentChannels ? this.#agentChannels.getOutputProcessors(configuredProcessors) : [];
    // Combine all processors into a single workflow
    // User-configured processors run first so they can transform chunks
    // (e.g. PII redaction, translation) before the channel renders them.
    // Memory processors run last to persist the final form.
    const allProcessors = [...configuredProcessors, ...channelProcessors, ...effectiveMemoryProcessors];
    return this.combineProcessorsIntoWorkflow(allProcessors, `${this.id}-output-processor`);
  }

  /**
   * Resolves input processors from agent configuration in execution order.
   * @internal
   */
  private async resolveInputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
  ): Promise<InputProcessorOrWorkflow[]> {
    // Get configured input processors - use overrides if provided (from generate/stream options),
    // otherwise use agent constructor processors
    const configuredProcessors = configuredProcessorOverrides
      ? configuredProcessorOverrides
      : this.#inputProcessors
        ? await resolveDynamicArgument(this.#inputProcessors, {
            requestContext: requestContext || new RequestContext(),
          })
        : [];

    // Get memory input processors (with deduplication)
    // Use getMemory() to ensure storage is injected from Mastra if not explicitly configured
    const memory = await this.getMemory({ requestContext: requestContext || new RequestContext() });

    const memoryProcessors = memory ? await memory.getInputProcessors(configuredProcessors, requestContext) : [];
    const effectiveMemoryProcessors = this.#inheritedMemory(requestContext)
      ? memoryProcessors.filter(processor => processor.id !== 'observational-memory')
      : memoryProcessors;

    // Get workspace instructions processors (with deduplication)
    const workspaceProcessors = await this.getWorkspaceInstructionsProcessors(configuredProcessors, requestContext);

    // Knowledge usage instructions, and pins when there is a Memory thread to carry their state signal
    const knowledgeProcessors = this.#getKnowledgeProcessors(configuredProcessors, Boolean(memory));

    // Get skills processors if skills are configured (with deduplication)
    const skillsProcessors = await this.getSkillsProcessors(configuredProcessors, requestContext);

    // Get channel input processors (with deduplication)
    const channelProcessors = this.#agentChannels ? this.#agentChannels.getInputProcessors(configuredProcessors) : [];

    // Get browser context processors (with deduplication)
    const browserProcessors = this.#browser
      ? this.#browser.getInputProcessors(configuredProcessors, { stateSignal: Boolean(memory) })
      : [];

    // Memory processors should run first (to fetch history, semantic recall, working memory)
    // Workspace instructions run after memory
    // Skills processors run after workspace
    // Channel processors run after skills (context injection for platform awareness)
    // Browser processors run after channel processors to inject browser context
    // User-configured processors run after auto-derived layers to allow customization
    return [
      ...effectiveMemoryProcessors,
      ...workspaceProcessors,
      ...knowledgeProcessors,
      ...skillsProcessors,
      ...channelProcessors,
      ...browserProcessors,
      ...configuredProcessors,
    ];
  }

  /**
   * Resolves and returns input processors from agent configuration.
   * All processors are combined into a single workflow for consistency.
   * @internal
   */
  private async listResolvedInputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
  ): Promise<InputProcessorOrWorkflow[]> {
    const processors = await this.resolveInputProcessors(requestContext, configuredProcessorOverrides);
    return this.combineProcessorsIntoWorkflow(processors, `${this.id}-input-processor`);
  }

  /**
   * Resolves and returns input processors for the provider-boundary LLM request hook.
   * These processors stay uncombined because processLLMRequest runs after conversion to model prompt format.
   *
   * Error-phase processors are included, so a `ProviderHistoryCompat` placed only in `errorProcessors`
   * still receives `processLLMRequest`. Processors without that method are inert here, and processor
   * workflows are skipped because `runProcessLLMRequest` skips them too.
   * @internal
   */
  private async listResolvedLLMRequestProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
    errorProcessorOverrides?: ErrorProcessorOrWorkflow[],
  ): Promise<LLMRequestProcessorOrWorkflow[]> {
    const inputProcessors = await this.resolveInputProcessors(requestContext, configuredProcessorOverrides);
    const errorProcessors = await this.#resolveErrorProcessors({
      requestContext: requestContext ?? new RequestContext(),
      overrides: errorProcessorOverrides,
    });

    const inputProcessorIds = new Set(
      inputProcessors.filter(processor => !isProcessorWorkflow(processor)).map(processor => processor.id),
    );
    const additionalErrorProcessors = errorProcessors.filter(
      processor => !isProcessorWorkflow(processor) && !inputProcessorIds.has(processor.id),
    );

    return additionalErrorProcessors.length ? [...inputProcessors, ...additionalErrorProcessors] : inputProcessors;
  }

  /**
   * Returns the input processors for this agent, resolving function-based processors if necessary.
   */
  public async listInputProcessors(requestContext?: RequestContext): Promise<InputProcessorOrWorkflow[]> {
    return this.listResolvedInputProcessors(requestContext);
  }

  /**
   * Returns the output processors for this agent, resolving function-based processors if necessary.
   */
  public async listOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessorOrWorkflow[]> {
    return this.listResolvedOutputProcessors(requestContext);
  }

  /**
   * Returns the error processors for this agent: your configured list plus whichever shared
   * stability defaults it does not already name. A configured processor whose id matches a default
   * means that default is not added again. Each added default is placed at the position its id gives
   * it, so the defaults keep their relative order even when you name only one of them — the two
   * processors that repair a request stay ahead of the retry processor, which would otherwise resend
   * a request they could have fixed. An empty configured list resolves to the defaults; with
   * `errorProcessorDefaults: false` only the configured list is returned.
   */
  public async listErrorProcessors(requestContext?: RequestContext): Promise<ErrorProcessorOrWorkflow[]> {
    return this.#resolveErrorProcessors({
      requestContext: requestContext as RequestContext,
    });
  }

  /**
   * Resolves a processor by its ID from both input and output processors.
   * This method resolves dynamic processor functions and includes memory-derived processors.
   * Returns the processor if found, null otherwise.
   *
   * @example
   * ```typescript
   * const omProcessor = await agent.resolveProcessorById('observational-memory');
   * if (omProcessor) {
   *   // Observational memory is configured
   * }
   * ```
   */
  public async resolveProcessorById<TId extends string = string>(
    processorId: TId,
    requestContext?: RequestContext,
  ): Promise<Processor<TId> | null> {
    const ctx = requestContext || new RequestContext();

    // Get raw input processors (before combining into workflow)
    const configuredInputProcessors = this.#inputProcessors
      ? await resolveDynamicArgument(this.#inputProcessors, { requestContext: ctx })
      : [];

    // Get memory input processors
    const memory = await this.getMemory({ requestContext: ctx });
    const memoryInputProcessors = memory ? await memory.getInputProcessors(configuredInputProcessors, ctx) : [];

    // Search all input processors
    for (const p of [...memoryInputProcessors, ...configuredInputProcessors]) {
      if (!isProcessorWorkflow(p) && isProcessor(p) && p.id === processorId) {
        return p as Processor<TId>;
      }
    }

    // Get raw output processors (before combining into workflow)
    const configuredOutputProcessors = this.#outputProcessors
      ? await resolveDynamicArgument(this.#outputProcessors, { requestContext: ctx })
      : [];

    // Get memory output processors
    const memoryOutputProcessors = memory ? await memory.getOutputProcessors(configuredOutputProcessors, ctx) : [];

    // Search all output processors
    for (const p of [...memoryOutputProcessors, ...configuredOutputProcessors]) {
      if (!isProcessorWorkflow(p) && isProcessor(p) && p.id === processorId) {
        return p as Processor<TId>;
      }
    }

    return null;
  }

  /**
   * Returns only the user-configured input processors, excluding memory-derived processors.
   * Useful for scenarios where memory processors should not be applied (e.g., network routing agents).
   *
   * Unlike `listInputProcessors()` which includes both memory and configured processors,
   * this method returns only what was explicitly configured via the `inputProcessors` option.
   */
  public async listConfiguredInputProcessors(requestContext?: RequestContext): Promise<InputProcessorOrWorkflow[]> {
    if (!this.#inputProcessors) return [];

    const configuredProcessors = await resolveDynamicArgument(this.#inputProcessors, {
      requestContext: requestContext || new RequestContext(),
    });

    return configuredProcessors;
  }

  /**
   * Returns only the user-configured output processors, excluding memory-derived processors.
   * Useful for scenarios where memory processors should not be applied (e.g., network routing agents).
   *
   * Unlike `listOutputProcessors()` which includes both memory and configured processors,
   * this method returns only what was explicitly configured via the `outputProcessors` option.
   */
  public async listConfiguredOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessorOrWorkflow[]> {
    if (!this.#outputProcessors) return [];

    const configuredProcessors = await resolveDynamicArgument(this.#outputProcessors, {
      requestContext: requestContext || new RequestContext(),
    });

    return configuredProcessors;
  }

  /**
   * Returns the IDs of the raw configured error processors, without combining
   * them into workflows and without the framework defaults. Unlike
   * `getConfiguredProcessorIds` this resolves only the error lane, so a
   * rejecting input or output processor resolver cannot block the caller.
   */
  public async getConfiguredErrorProcessorIds(requestContext?: RequestContext): Promise<string[]> {
    const ctx = requestContext || new RequestContext();
    const errorProcessors = await this.#resolveErrorProcessors({ requestContext: ctx, includeDefaults: false });
    return errorProcessors.map(p => p.id).filter(Boolean);
  }

  /**
   * Returns the IDs of the raw configured input, output, and error processors,
   * without combining them into workflows. Used by the editor to clone
   * agent processor configuration to storage.
   */
  public async getConfiguredProcessorIds(
    requestContext?: RequestContext,
  ): Promise<{ inputProcessorIds: string[]; outputProcessorIds: string[]; errorProcessorIds: string[] }> {
    const ctx = requestContext || new RequestContext();

    let inputProcessorIds: string[] = [];
    if (this.#inputProcessors) {
      const processors = await resolveDynamicArgument(this.#inputProcessors, { requestContext: ctx });
      inputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    let outputProcessorIds: string[] = [];
    if (this.#outputProcessors) {
      const processors = await resolveDynamicArgument(this.#outputProcessors, { requestContext: ctx });
      outputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    const errorProcessors = await this.#resolveErrorProcessors({ requestContext: ctx, includeDefaults: false });
    const errorProcessorIds = errorProcessors.map(p => p.id).filter(Boolean);

    return { inputProcessorIds, outputProcessorIds, errorProcessorIds };
  }

  /**
   * Returns configured processor workflows for registration with Mastra.
   * This excludes memory-derived processors to avoid triggering memory factory functions.
   * @internal
   */
  public async getConfiguredProcessorWorkflows(): Promise<ProcessorWorkflow[]> {
    const workflows: ProcessorWorkflow[] = [];

    // Get input processors (static or from function)
    if (this.#inputProcessors) {
      const inputProcessors = await resolveDynamicArgument(this.#inputProcessors, {
        requestContext: new RequestContext(),
      });

      const combined = this.combineProcessorsIntoWorkflow(inputProcessors, `${this.id}-input-processor`);
      for (const p of combined) {
        if (isProcessorWorkflow(p)) {
          workflows.push(p);
        }
      }
    }

    // Get output processors (static or from function)
    if (this.#outputProcessors) {
      const outputProcessors = await resolveDynamicArgument(this.#outputProcessors, {
        requestContext: new RequestContext(),
      });

      const combined = this.combineProcessorsIntoWorkflow(outputProcessors, `${this.id}-output-processor`);
      for (const p of combined) {
        if (isProcessorWorkflow(p)) {
          workflows.push(p);
        }
      }
    }

    return workflows;
  }

  /**
   * Returns whether this agent has its own memory configured.
   *
   * @example
   * ```typescript
   * if (agent.hasOwnMemory()) {
   *   const memory = await agent.getMemory();
   * }
   * ```
   */
  /**
   * Whether this run has memory available, either configured on the agent or
   * inherited from a delegating supervisor via the run's RequestContext.
   */
  #hasEffectiveMemory(requestContext?: RequestContext): boolean {
    return Boolean(this.#memory ?? this.#inheritedMemory(requestContext));
  }

  /**
   * Memory a delegating agent handed to this agent for the current run, if any.
   * Addressed to a single agent id so a memory-less sub-agent that delegates
   * further does not hand it on to its own sub-agents.
   */
  #inheritedMemory(requestContext?: RequestContext): DynamicArgument<MastraMemory, TRequestContext> | undefined {
    const inherited = requestContext?.getRaw(MASTRA_INHERITED_MEMORY_KEY) as
      | { agentId: string; memory: DynamicArgument<MastraMemory, any> }
      | undefined;
    return inherited?.agentId === this.id
      ? (inherited.memory as DynamicArgument<MastraMemory, TRequestContext>)
      : undefined;
  }

  public hasOwnMemory(): boolean {
    return Boolean(this.#memory);
  }

  /**
   * Whether the agent's memory is a fixed instance, so it resolves to the same
   * store on every call. Function memory and memory inherited from a delegating
   * agent depend on the request context, which a resume may not repeat.
   * @internal
   */
  __hasFixedMemory(): boolean {
    return Boolean(this.#memory) && typeof this.#memory !== 'function';
  }

  /**
   * Gets the memory instance for this agent, resolving function-based memory if necessary.
   * The memory system enables conversation persistence, semantic recall, and working memory.
   *
   * @example
   * ```typescript
   * const memory = await agent.getMemory();
   * if (memory) {
   *   // Memory is configured
   * }
   * ```
   */
  public async getMemory({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}): Promise<
    MastraMemory | undefined
  > {
    // When a supervisor delegates to a memory-less sub-agent it passes its own
    // memory through the delegated run's RequestContext, so the inheritance
    // lasts for exactly that invocation instead of being grafted onto the
    // shared sub-agent instance. See issue #21625.
    const memoryConfig = this.#memory ?? this.#inheritedMemory(requestContext);

    if (!memoryConfig) {
      return undefined;
    }

    let resolvedMemory: MastraMemory;

    if (typeof memoryConfig !== 'function') {
      resolvedMemory = memoryConfig;
    } else {
      const result = resolveDynamicArgument(memoryConfig, {
        requestContext,
        mastra: this.#mastra,
      });
      resolvedMemory = await Promise.resolve(result);

      if (!resolvedMemory) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_MEMORY_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based memory returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }
    }

    // Record which agent resolved this memory so missing-storage diagnostics can
    // name it when the agent was never attached to a Mastra instance. Memory-like
    // objects that do not implement the hook are left untouched.
    resolvedMemory.__registerAgent?.(this.name);

    if (this.#mastra && resolvedMemory) {
      resolvedMemory.__registerMastra(this.#mastra);

      if (!resolvedMemory.hasOwnStorage) {
        const storage = this.#mastra.getStorage();
        if (storage) {
          resolvedMemory.setStorage(storage);
        }
      }
    }

    return resolvedMemory;
  }

  /**
   * Checks if this agent has its own workspace configured.
   *
   * @example
   * ```typescript
   * if (agent.hasOwnWorkspace()) {
   *   const workspace = await agent.getWorkspace();
   * }
   * ```
   */
  public hasOwnWorkspace(): boolean {
    return Boolean(this.#workspace);
  }

  /**
   * The Knowledge attached to this agent, resolving a registered key through Mastra.
   * @experimental
   */
  public getKnowledge(): Knowledge | undefined {
    if (typeof this.#knowledge !== 'string') return this.#knowledge;
    if (!this.#mastra) {
      throw new MastraError({
        id: 'AGENT_KNOWLEDGE_NOT_REGISTERED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" references Knowledge "${this.#knowledge}" by key, but the agent is not registered with Mastra.`,
      });
    }
    return this.#mastra.getKnowledge(this.#knowledge);
  }

  /**
   * Gets the workspace instance for this agent, resolving function-based workspace if necessary.
   * The workspace provides filesystem and sandbox capabilities for file operations and code execution.
   *
   * @example
   * ```typescript
   * const workspace = await agent.getWorkspace();
   * if (workspace) {
   *   await workspace.writeFile('/data.json', JSON.stringify(data));
   *   const result = await workspace.executeCode('console.log("Hello")');
   * }
   * ```
   */
  public async getWorkspace({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<AnyWorkspace | undefined> {
    // If agent has its own workspace configured, use it
    if (this.#workspace) {
      if (typeof this.#workspace !== 'function') {
        this.#setBrowserFromWorkspace(this.#workspace);
        return this.#workspace;
      }

      const result = resolveDynamicArgument(this.#workspace, {
        requestContext,
        mastra: this.#mastra,
      });
      const resolvedWorkspace = await Promise.resolve(result);

      if (!resolvedWorkspace) {
        // Clear derived browser when factory returns no workspace
        if (!this.#hasExplicitBrowser) {
          this.#browser = undefined;
        }
        return undefined;
      }

      // Propagate logger to factory-resolved workspace
      resolvedWorkspace.__setLogger(this.logger);

      // Auto-register dynamically created workspace with Mastra for lookup via listWorkspaces()/getWorkspaceById()
      if (this.#mastra) {
        this.#mastra.addWorkspace(resolvedWorkspace, undefined, {
          source: 'agent',
          agentId: this.id,
          agentName: this.name,
          agentSource: this.source,
        });
      }

      this.#setBrowserFromWorkspace(resolvedWorkspace);

      return resolvedWorkspace;
    }

    // Fall back to Mastra's global workspace
    const globalWorkspace = this.#mastra?.getWorkspace();
    if (globalWorkspace) {
      this.#setBrowserFromWorkspace(globalWorkspace);
    } else if (!this.#hasExplicitBrowser) {
      // Clear derived browser when no workspace available
      this.#browser = undefined;
    }
    return globalWorkspace;
  }

  /**
   * Programmatically invoke a skill by name.
   *
   * Loads the full skill instructions and returns them, or returns the skill
   * object directly. This is the programmatic equivalent of the `skill` tool
   * that the LLM calls — useful in workflows and custom pipelines.
   *
   * @param skillName - Name or path of the skill to invoke
   * @param options - Optional request context for dynamic skill resolution
   * @returns The full Skill object with instructions, or null if not found
   *
   * @example
   * ```typescript
   * // In a workflow step
   * const skill = await agent.getSkill('code-review');
   * if (skill) {
   *   console.log(skill.instructions); // Full skill instructions
   *   console.log(skill.references);   // Available reference files
   * }
   * ```
   */
  public async getSkill(skillName: string, options?: { requestContext?: RequestContext }): Promise<Skill | null> {
    const skills = await this.resolveSkills(options?.requestContext);
    if (!skills) return null;
    return skills.get(skillName);
  }

  /**
   * List all skills available to this agent (from both agent-level and workspace).
   *
   * @param options - Optional request context for dynamic skill resolution
   * @returns Array of skill metadata (name, description, path)
   *
   * @example
   * ```typescript
   * const skills = await agent.listSkills();
   * for (const skill of skills) {
   *   console.log(`${skill.name}: ${skill.description}`);
   * }
   * ```
   */
  public async listSkills(options?: { requestContext?: RequestContext }): Promise<SkillMetadata[]> {
    const skills = await this.resolveSkills(options?.requestContext);
    if (!skills) return [];
    return skills.list();
  }

  /**
   * Sets the agent's browser from workspace if:
   * 1. Agent doesn't already have a browser configured (SDK approach)
   * 2. Workspace has a browser configured (CLI approach)
   * @internal
   */
  #setBrowserFromWorkspace(workspace: AnyWorkspace): void {
    // Skip if agent has an explicitly configured browser (SDK approach takes precedence)
    if (this.#hasExplicitBrowser) {
      return;
    }

    // Keep browser in sync with workspace per-request; clear when absent
    // This allows factory workspaces to return different browsers per request
    this.#browser = workspace.browser;
  }

  get voice() {
    if (typeof this.#voice === 'function') {
      const mastraError = new MastraError({
        id: 'AGENT_VOICE_INCOMPATIBLE_WITH_FUNCTION_VOICE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'Voice is not compatible when voice is a function. Please use getVoice() instead.',
      });
      this.logger.trackException(mastraError);
      throw mastraError;
    }

    if (typeof this.#instructions === 'function') {
      const mastraError = new MastraError({
        id: 'AGENT_VOICE_INCOMPATIBLE_WITH_FUNCTION_INSTRUCTIONS',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'Voice is not compatible when instructions are a function. Please use getVoice() instead.',
      });
      this.logger.trackException(mastraError);
      throw mastraError;
    }

    return this.#voice;
  }

  /**
   * Gets the request context schema for this agent.
   * Returns the Zod schema used to validate request context values, or undefined if not set.
   */
  get requestContextSchema() {
    return this.#requestContextSchema;
  }

  /**
   * Gets the workflows configured for this agent, resolving function-based workflows if necessary.
   * Workflows are step-based execution flows that can be triggered by the agent.
   *
   * @example
   * ```typescript
   * const workflows = await agent.listWorkflows();
   * const workflow = workflows['myWorkflow'];
   * ```
   */
  public async listWorkflows({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<Record<string, AnyWorkflow>> {
    let workflowRecord;
    if (typeof this.#workflows === 'function') {
      workflowRecord = await Promise.resolve(
        resolveDynamicArgument(this.#workflows, { requestContext, mastra: this.#mastra }),
      );
    } else {
      workflowRecord = this.#workflows ?? {};
    }

    Object.entries(workflowRecord || {}).forEach(([_workflowName, workflow]) => {
      if (this.#mastra) {
        workflow.__registerMastra(this.#mastra);
      }
    });

    return workflowRecord;
  }

  /**
   * Applies the agent's `scopes` option to a run's incoming scopes and returns the run's scopes:
   * the incoming ones when the option is unset, the incoming ones plus the static list, or what
   * the function returns for them. `scopes` defaults to none.
   */
  async getScopes({
    requestContext = new RequestContext(),
    scopes = [],
  }: { requestContext?: RequestContext; scopes?: string[] } = {}): Promise<string[]> {
    return applyAgentScopesConfig(this.#scopes, {
      scopes,
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });
  }

  async listScorers({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<MastraScorers> {
    if (typeof this.#scorers !== 'function') {
      return this.#scorers;
    }

    const result = resolveDynamicArgument(this.#scorers, {
      requestContext,
      mastra: this.#mastra,
    });
    return resolveMaybePromise(result, scorers => {
      if (!scorers) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_SCORERS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based scorers returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      // Statically-configured filters are validated in the constructor; the
      // function form is only checkable once resolved.
      for (const entry of Object.values(scorers)) {
        if (entry?.filter) validateScoringPredicate(entry.filter);
      }

      return scorers;
    });
  }

  /**
   * Gets the voice instance for this agent with tools and instructions configured.
   * The voice instance enables text-to-speech and speech-to-text capabilities.
   *
   * When `voice` is configured as a resolver (`({ requestContext }) => new SomeVoice(...)`),
   * each call resolves a fresh, session-owned instance. The resolver is responsible for
   * configuring its own tools/instructions/request context, so this method does not mutate
   * the resolved instance. The caller owns the lifecycle (e.g. `disconnect()`) of that instance.
   *
   * A static voice instance is shared across calls and is configured with the current
   * tools/instructions on each call (appropriate for one-shot TTS).
   *
   * @example
   * ```typescript
   * const voice = await agent.getVoice();
   * const audioStream = await voice.speak('Hello world');
   * ```
   */
  public async getVoice({ requestContext }: { requestContext?: RequestContext } = {}) {
    if (!this.#voice) {
      return new DefaultVoice();
    }

    if (typeof this.#voice === 'function') {
      const resolved = await resolveDynamicArgument(this.#voice, {
        requestContext: requestContext ?? new RequestContext(),
        mastra: this.#mastra,
      });
      return resolved ?? new DefaultVoice();
    }

    const voice = this.#voice;

    const resolvedRequestContext = requestContext ?? new RequestContext();
    const rawTools = await this.listTools({ requestContext: resolvedRequestContext });
    const toolEntries = Object.entries(rawTools || {});
    const model = toolEntries.length ? await this.getModel({ requestContext: resolvedRequestContext }) : undefined;
    const mastraProxy = this.#mastra ? createMastraProxy({ mastra: this.#mastra, logger: this.logger }) : undefined;
    const wrappedTools = Object.fromEntries(
      await Promise.all(
        toolEntries.map(async ([k, tool]) => {
          if (!tool) return [k, tool];
          const options: ToolOptions = {
            name: k,
            logger: this.logger,
            mastra: mastraProxy as MastraUnion | undefined,
            agentName: this.name,
            agentId: this.id,
            requestContext: resolvedRequestContext,
            tracingPolicy: this.#options?.tracingPolicy,
            requireApproval: (tool as any).requireApproval,
            backgroundConfig: (tool as any).background,
            agentBackgroundConfig: this.#backgroundTasks,
            model,
          };
          return [k, makeCoreTool(tool, options)];
        }),
      ),
    );
    voice?.addTools(wrappedTools as TTools);

    const instructions = await this.getInstructions({ requestContext: resolvedRequestContext });
    voice?.addInstructions(convertInstructionsToString(instructions));
    return voice;
  }

  /**
   * Gets the instructions for this agent, resolving function-based instructions if necessary.
   * Instructions define the agent's behavior and capabilities.
   *
   * @example
   * ```typescript
   * const instructions = await agent.getInstructions();
   * console.log(instructions); // 'You are a helpful assistant'
   * ```
   */
  public getInstructions({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | AgentInstructions
    | Promise<AgentInstructions> {
    if (typeof this.#instructions === 'function') {
      const result = resolveDynamicArgument(this.#instructions, {
        requestContext,
        mastra: this.#mastra,
      });
      return resolveMaybePromise(result, instructions => {
        if (!instructions) {
          const mastraError = new MastraError({
            id: 'AGENT_GET_INSTRUCTIONS_FUNCTION_EMPTY_RETURN',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
            },
            text: 'Instructions are required to use an Agent. The function-based instructions returned an empty value.',
          });
          this.logger.trackException(mastraError);
          throw mastraError;
        }

        return instructions;
      });
    }

    return this.#instructions;
  }

  private async getMcpServerGuidance({
    requestContext,
    toolsets,
    clientTools,
  }: {
    requestContext: RequestContext;
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
  }): Promise<string | undefined> {
    const tools: Array<{ mcpMetadata?: McpMetadata } | undefined> = [];

    const assignedTools = await this.listTools({ requestContext, resolveWebSearch: false });
    tools.push(...(Object.values(assignedTools || {}) as { mcpMetadata?: McpMetadata }[]));

    for (const toolset of Object.values(toolsets || {})) {
      tools.push(...(Object.values(toolset || {}) as { mcpMetadata?: McpMetadata }[]));
    }

    tools.push(...(Object.values(clientTools || {}) as { mcpMetadata?: McpMetadata }[]));

    if (tools.length === 0) {
      return undefined;
    }

    return buildMcpServerGuidance(tools);
  }

  /**
   * Returns the description of the agent.
   *
   * @example
   * ```typescript
   * const description = agent.getDescription();
   * console.log(description); // 'A helpful weather assistant'
   * ```
   */
  public getDescription(): string {
    return this.#description ?? '';
  }

  /**
   * Attach the schedules declared under `agents/<id>/schedules/`. Called by
   * `assembleAgentFromFsEntry` during file-based agent assembly.
   *
   * @internal — not part of the public agent API.
   */
  public __setDeclaredSchedules(schedules: DeclaredAgentSchedule[]): void {
    this.#declaredSchedules = schedules;
  }

  /**
   * Returns the schedules declared by this agent's `schedules/` directory, in
   * stable (path-sorted) order. Mastra syncs these into schedule storage at
   * boot; see `registerDeclarativeSchedules`.
   */
  public getDeclaredSchedules(): DeclaredAgentSchedule[] {
    return this.#declaredSchedules;
  }

  /**
   * Returns the tracing policy configured at agent construction time.
   *
   * Exposed so out-of-process consumers (e.g. the durable agent runner) can
   * forward the same policy onto AGENT_RUN spans without reaching into private
   * fields.
   */
  public getTracingPolicy(): TracingPolicy | undefined {
    return this.#options?.tracingPolicy;
  }

  /**
   * Gets the metadata for this agent, resolving function-based metadata if necessary.
   * Metadata is a classification bag for clients and is never read by the agent runtime.
   *
   * @example
   * ```typescript
   * const metadata = await agent.getMetadata();
   * console.log(metadata?.type); // 'support'
   * ```
   */
  public getMetadata({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | Record<string, unknown>
    | undefined
    | Promise<Record<string, unknown> | undefined> {
    if (this.#metadata === undefined) {
      return undefined;
    }
    if (typeof this.#metadata !== 'function') {
      return this.#metadata;
    }
    const result = resolveDynamicArgument(this.#metadata, {
      requestContext,
      mastra: this.#mastra,
    });
    return resolveMaybePromise(result, m => m);
  }

  /**
   * Gets the legacy handler instance, initializing it lazily if needed.
   * @internal
   */
  private getLegacyHandler(): AgentLegacyHandler {
    if (!this.#legacyHandler) {
      this.#legacyHandler = new AgentLegacyHandler({
        logger: this.logger,
        name: this.name,
        id: this.id,
        mastra: this.#mastra,
        getDefaultGenerateOptionsLegacy: this.getDefaultGenerateOptionsLegacy.bind(this),
        getDefaultStreamOptionsLegacy: this.getDefaultStreamOptionsLegacy.bind(this),
        hasOwnMemory: this.hasOwnMemory.bind(this),
        getScopes: this.getScopes.bind(this),
        getInstructions: async (options: { requestContext: RequestContext }) => {
          const result = await this.getInstructions(options);
          return result;
        },
        getLLM: this.getLLM.bind(this) as any,
        getMemory: this.getMemory.bind(this),
        convertTools: this.convertTools.bind(this),
        getMemoryMessages: (...args) => this.getMemoryMessages(...args),
        __runInputProcessors: this.__runInputProcessors.bind(this),
        __runProcessInputStep: this.__runProcessInputStep.bind(this),
        getMostRecentUserMessage: this.getMostRecentUserMessage.bind(this),
        genTitle: this.genTitle.bind(this),
        resolveTitleGenerationConfig: this.resolveTitleGenerationConfig.bind(this),
        convertInstructionsToString,
        tracingPolicy: this.#options?.tracingPolicy,
        resolvedVersionId: this.toRawConfig()?.resolvedVersionId as string | undefined,
        _agentNetworkAppend: this._agentNetworkAppend,
        listResolvedOutputProcessors: this.listResolvedOutputProcessors.bind(this),
        __runOutputProcessors: this.__runOutputProcessors.bind(this),
        runScorers: this.#runScorers.bind(this),
      });
    }
    return this.#legacyHandler;
  }

  /**
   * Gets the default generate options for the legacy generate method.
   * These options are used as defaults when calling `generateLegacy()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultGenerateOptionsLegacy();
   * console.log(options.maxSteps); // 5
   * ```
   */
  public getDefaultGenerateOptionsLegacy({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): AgentGenerateOptions | Promise<AgentGenerateOptions> {
    if (typeof this.#defaultGenerateOptionsLegacy !== 'function') {
      return this.#defaultGenerateOptionsLegacy;
    }

    const result = this.#defaultGenerateOptionsLegacy({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });
    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_GENERATE_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default generate options returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the default stream options for the legacy stream method.
   * These options are used as defaults when calling `streamLegacy()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultStreamOptionsLegacy();
   * console.log(options.temperature); // 0.7
   * ```
   */
  public getDefaultStreamOptionsLegacy({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): AgentStreamOptions | Promise<AgentStreamOptions> {
    if (typeof this.#defaultStreamOptionsLegacy !== 'function') {
      return this.#defaultStreamOptionsLegacy;
    }

    const result = this.#defaultStreamOptionsLegacy({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });
    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_STREAM_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default stream options returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      return options;
    });
  }

  /** @internal Validate context-independent timeout settings without invoking dynamic defaults. */
  public __validateStaticModelTimeoutSettings(modelSettings?: AgentExecutionOptions<TOutput>['modelSettings']): void {
    const defaults = typeof this.#defaultOptions === 'function' ? undefined : this.#defaultOptions.modelSettings;
    validateModelTimeoutSettings(deepMerge(defaults ?? {}, modelSettings ?? {}).timeout);
  }

  /**
   * Gets the default options for this agent, resolving function-based options if necessary.
   * These options are used as defaults when calling `stream()` or `generate()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultStreamOptions();
   * console.log(options.maxSteps); // 5
   * ```
   */
  public getDefaultOptions({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | PublicAgentExecutionOptions<TOutput>
    | Promise<PublicAgentExecutionOptions<TOutput>> {
    if (typeof this.#defaultOptions !== 'function') {
      return this.#defaultOptions;
    }

    const result = resolveDynamicArgument(this.#defaultOptions, {
      requestContext,
      mastra: this.#mastra,
    });

    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default options returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the default NetworkOptions for this agent, resolving function-based options if necessary.
   * These options are used as defaults when calling `network()` without explicit options.
   *
   * @returns NetworkOptions containing maxSteps, completion (CompletionConfig), and other network settings
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultNetworkOptions();
   * console.log(options.maxSteps); // 20
   * console.log(options.completion?.scorers); // [testsScorer, buildScorer]
   * ```
   */
  public getDefaultNetworkOptions({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | NetworkOptions
    | Promise<NetworkOptions> {
    if (typeof this.#defaultNetworkOptions !== 'function') {
      return this.#defaultNetworkOptions;
    }

    const result = resolveDynamicArgument(this.#defaultNetworkOptions, { requestContext, mastra: this.#mastra });

    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_NETWORK_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default network options returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the tools configured for this agent, resolving function-based tools if necessary.
   * Tools extend the agent's capabilities, allowing it to perform specific actions or access external systems.
   *
   * Note: Browser tools are NOT included here. They are added at execution time via `convertTools()`.
   *
   * @example
   * ```typescript
   * const tools = await agent.listTools();
   * console.log(Object.keys(tools)); // ['calculator', 'weather', ...]
   * ```
   */
  public async listTools({
    requestContext = new RequestContext(),
    resolveWebSearch = true,
  }: { requestContext?: RequestContext; resolveWebSearch?: boolean } = {}): Promise<TTools> {
    const resolveToolList = async (tools: ToolsInput | undefined): Promise<TTools> => {
      if (!tools) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_TOOLS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based tools returned empty value`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      const ensuredTools = ensureToolProperties(tools) as ToolsInput;
      if (!resolveWebSearch || !Object.values(ensuredTools).some(isWebSearchTool)) {
        return ensuredTools as TTools;
      }

      const model = await this.getModel({ requestContext });
      return Object.fromEntries(
        Object.entries(ensuredTools).map(([key, tool]) => [
          key,
          isWebSearchTool(tool) ? createWebSearchProviderTool(normalizeWebSearchProvider(model)) : tool,
        ]),
      ) as TTools;
    };

    if (typeof this.#tools !== 'function') {
      return resolveToolList(this.#tools as ToolsInput | undefined);
    }

    const result = resolveDynamicArgument(this.#tools, {
      requestContext,
      mastra: this.#mastra,
    });

    return resolveMaybePromise(result, tools => resolveToolList(tools as ToolsInput | undefined));
  }

  /**
   * Gets or creates an LLM instance based on the provided or configured model.
   * The LLM wraps the language model with additional capabilities like error handling.
   *
   * @example
   * ```typescript
   * const llm = await agent.getLLM();
   * // Use with custom model
   * const customLlm = await agent.getLLM({ model: 'openai/gpt-5' });
   * ```
   */
  public getLLM({
    requestContext = new RequestContext(),
    model,
  }: {
    requestContext?: RequestContext;
    model?: DynamicArgument<MastraModelConfig, TRequestContext>;
  } = {}): MastraLLM | Promise<MastraLLM> {
    const modelSelectionPromise = model
      ? this.resolveModelSelection(
          model as DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext>,
          requestContext,
        )
      : this.resolveModelSelection(this.model, requestContext);

    return modelSelectionPromise.then(modelSelection => {
      const firstEnabledModel = Array.isArray(modelSelection)
        ? modelSelection.find(m => m.enabled)?.model
        : modelSelection;

      if (!firstEnabledModel) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_LLM_NO_ENABLED_MODELS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: { agentName: this.name },
          text: `[Agent:${this.name}] - No enabled models found in model list`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      const resolvedModel = this.resolveModelConfig(firstEnabledModel, requestContext);

      return resolveMaybePromise(resolvedModel, modelInfo => {
        let llm: MastraLLM | Promise<MastraLLM>;
        if (isSupportedLanguageModel(modelInfo)) {
          // Filter disabled entries before prepareModels so their model factories and
          // dynamic resolvers are never invoked on the streaming path. A disabled
          // entry's throwing/side-effecting factory must not break the request.
          const enabledSelection = Array.isArray(modelSelection)
            ? (modelSelection.filter(m => m.enabled) as typeof modelSelection)
            : modelSelection;

          llm = this.prepareModels(requestContext, enabledSelection).then(models => {
            return new MastraLLMVNext({
              models,
              mastra: this.#mastra,
              options: { tracingPolicy: this.#options?.tracingPolicy },
            });
          });
        } else {
          llm = new MastraLLMV1({
            model: modelInfo,
            mastra: this.#mastra,
            options: { tracingPolicy: this.#options?.tracingPolicy },
          });
        }

        return resolveMaybePromise(llm, resolvedLLM => {
          // Apply stored primitives if available
          if (this.#primitives) {
            resolvedLLM.__registerPrimitives(this.#primitives);
          }
          if (this.#mastra) {
            resolvedLLM.__registerMastra(this.#mastra);
          }
          return resolvedLLM;
        }) as MastraLLM;
      });
    });
  }

  /**
   * Resolves a model configuration to a LanguageModel instance
   * @param modelConfig The model configuration (magic string, config object, or LanguageModel)
   * @returns A LanguageModel instance
   * @internal
   */
  private async resolveModelConfig(
    modelConfig: DynamicArgument<MastraModelConfig>,
    requestContext: RequestContext,
  ): Promise<MastraLanguageModel | MastraLegacyLanguageModel> {
    try {
      return await resolveModelConfig(modelConfig, requestContext, this.#mastra);
    } catch (error) {
      const mastraError = new MastraError({
        id: 'AGENT_GET_MODEL_MISSING_MODEL_INSTANCE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
          originalError: error instanceof Error ? error.message : String(error),
        },
        text: `[Agent:${this.name}] - Failed to resolve model configuration`,
      });
      this.logger.trackException(mastraError);
      throw mastraError;
    }
  }

  /**
   * Type guard to check if an array is already normalized to ModelFallbacks.
   * Used to optimize and avoid double normalization.
   * @internal
   */
  private isModelFallbacks(arr: any[]): arr is ModelFallbacks {
    if (arr.length === 0) return false;
    return arr.every(
      item =>
        typeof item.id === 'string' &&
        typeof item.model !== 'undefined' &&
        typeof item.maxRetries === 'number' &&
        typeof item.maxRetriesConfigured === 'boolean' &&
        typeof item.enabled === 'boolean',
    );
  }

  /**
   * Normalizes model arrays into the internal fallback shape.
   * @internal
   */
  private normalizeModelFallbacks(models: ModelWithRetries[] | ModelFallbacks): ModelFallbacks {
    if (this.isModelFallbacks(models)) {
      return models;
    }

    return models.map(m =>
      Agent.toFallbackEntry(m, this.maxRetries ?? 0, this.#maxRetriesConfigured),
    ) as ModelFallbacks;
  }

  /**
   * Builds a single normalized fallback entry from a user-supplied `ModelWithRetries`.
   * Shared by the constructor and `normalizeModelFallbacks` to keep the mapping in one place.
   * @internal
   */
  private static toFallbackEntry(
    mdl: ModelWithRetries,
    defaultMaxRetries: number,
    defaultMaxRetriesConfigured: boolean,
  ): ModelFallbacks[number] {
    return {
      id: mdl.id ?? globalThis.crypto.randomUUID(),
      model: mdl.model as DynamicArgument<MastraModelConfig>,
      maxRetries: mdl.maxRetries ?? defaultMaxRetries,
      maxRetriesConfigured: mdl.maxRetries !== undefined || defaultMaxRetriesConfigured,
      enabled: mdl.enabled ?? true,
      modelSettings: mdl.modelSettings,
      providerOptions: mdl.providerOptions,
      headers: mdl.headers,
    };
  }

  /**
   * Ensures a model can participate in prepared multi-model execution.
   * @internal
   */
  private assertSupportsPreparedModels(
    model: MastraLanguageModel | MastraLegacyLanguageModel,
  ): asserts model is MastraLanguageModel {
    if (!isSupportedLanguageModel(model)) {
      const mastraError = new MastraError({
        id: 'AGENT_PREPARE_MODELS_INCOMPATIBLE_WITH_MODEL_ARRAY_V1',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: `[Agent:${this.name}] - Only v2/v3 models are allowed when an array of models is provided`,
      });
      this.logger.trackException(mastraError);
      throw mastraError;
    }
  }

  /**
   * Resolves model configuration that may be a dynamic function returning a single model or array of models.
   * Supports DynamicArgument for both MastraModelConfig and ModelWithRetries[].
   * Normalizes fallback arrays while preserving single-model semantics.
   *
   * @internal
   */
  private async resolveModelSelection(
    modelConfig: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks,
    requestContext: RequestContext,
  ): Promise<ResolvedModelSelection> {
    // If it's a dynamic function, resolve it
    if (typeof modelConfig === 'function') {
      const resolved = await resolveDynamicArgument(modelConfig, {
        requestContext,
        mastra: this.#mastra,
      });

      // If function returns an array, validate and normalize it to ModelFallbacks
      if (Array.isArray(resolved)) {
        if (resolved.length === 0) {
          const mastraError = new MastraError({
            id: 'AGENT_RESOLVE_MODEL_EMPTY_ARRAY',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: { agentName: this.name },
            text: `[Agent:${this.name}] - Dynamic function returned empty model array`,
          });
          this.logger.trackException(mastraError);
          throw mastraError;
        }

        return this.normalizeModelFallbacks(resolved);
      }

      return resolved;
    }

    // Already resolved - if it's a static array, check if already normalized
    if (Array.isArray(modelConfig)) {
      // Validate empty array
      if (modelConfig.length === 0) {
        const mastraError = new MastraError({
          id: 'AGENT_RESOLVE_MODEL_EMPTY_ARRAY',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: { agentName: this.name },
          text: `[Agent:${this.name}] - Empty model array provided`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      return this.normalizeModelFallbacks(modelConfig);
    }

    return modelConfig;
  }

  private resolveModelFromSelection(
    resolved: ResolvedModelSelection,
    requestContext: RequestContext,
  ): Promise<MastraLanguageModel | MastraLegacyLanguageModel> {
    if (!Array.isArray(resolved)) {
      return this.resolveModelConfig(resolved, requestContext);
    }

    const enabledModel = resolved.find(entry => entry.enabled);
    if (!enabledModel) {
      const mastraError = new MastraError({
        id: 'AGENT_GET_MODEL_MISSING_MODEL_INSTANCE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: { agentName: this.name },
        text: `[Agent:${this.name}] - No enabled models found in model list`,
      });
      this.logger.trackException(mastraError);
      throw mastraError;
    }

    return this.resolveModelConfig(enabledModel.model, requestContext);
  }

  /**
   * Gets the model instance, resolving it if it's a function or model configuration.
   * When the agent has multiple models configured, returns the first enabled model.
   *
   * @example
   * ```typescript
   * const model = await agent.getModel();
   * // Get with custom model config
   * const customModel = await agent.getModel({
   *   modelConfig: 'openai/gpt-5'
   * });
   * ```
   */
  public getModel({
    requestContext = new RequestContext(),
    modelConfig = this.model,
  }: {
    requestContext?: RequestContext;
    modelConfig?: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
  } = {}): MastraLanguageModel | MastraLegacyLanguageModel | Promise<MastraLanguageModel | MastraLegacyLanguageModel> {
    return this.resolveModelSelection(modelConfig, requestContext).then(resolved =>
      this.resolveModelFromSelection(resolved, requestContext),
    );
  }

  /**
   * Gets the list of configured models if the agent has multiple models, otherwise returns null.
   * Used for model fallback and load balancing scenarios.
   *
   * @example
   * ```typescript
   * const models = await agent.getModelList();
   * if (models) {
   *   console.log(models.map(m => m.id));
   * }
   * ```
   */
  public async getModelList(
    requestContext: RequestContext = new RequestContext(),
  ): Promise<Array<AgentModelManagerConfig> | null> {
    let models: Array<AgentModelManagerConfig>;

    if (typeof this.model === 'function') {
      const resolved = await this.resolveModelSelection(this.model, requestContext);
      if (!Array.isArray(resolved)) {
        return null;
      }
      models = await this.prepareModels(requestContext, resolved);
    } else {
      // Backward compatibility: Return null for static single-model agents
      if (!Array.isArray(this.model)) {
        return null;
      }

      // Static array configuration
      models = await this.prepareModels(requestContext);
    }

    return models.map(({ maxRetriesConfigured: _, ...model }) => model);
  }

  /** @internal */
  public async __getModelAndModelList({
    requestContext = new RequestContext(),
    model: modelOverride,
  }: {
    requestContext?: RequestContext;
    /** Per-call model override (`stream(msgs, { model })`). */
    model?: Parameters<Agent['resolveModelSelection']>[0];
  } = {}): Promise<{
    model: MastraLanguageModel | MastraLegacyLanguageModel;
    modelList: Array<AgentModelManagerConfig> | null;
    fallbackTimeouts: Array<ModelFallbackSettings['timeout'] | undefined>;
  }> {
    let selectionInput: Parameters<Agent['resolveModelSelection']>[0] = this.model;
    if (modelOverride) selectionInput = modelOverride;
    const resolvedSelection = await this.resolveModelSelection(selectionInput, requestContext);
    const model = await this.resolveModelFromSelection(resolvedSelection, requestContext);
    if (!Array.isArray(resolvedSelection)) {
      return { model, modelList: null, fallbackTimeouts: [] };
    }

    const enabledModelIndex = resolvedSelection.findIndex(entry => entry.enabled);
    const preparedModels = await this.prepareModels(requestContext, resolvedSelection, {
      index: enabledModelIndex,
      model,
    });
    const fallbackTimeouts = resolvedSelection.map((modelConfig, index) => {
      if (modelConfig.enabled) {
        return preparedModels[index]?.modelSettings?.timeout;
      }
      return typeof modelConfig.modelSettings === 'function' ? undefined : modelConfig.modelSettings?.timeout;
    });
    const modelList = preparedModels.map(({ maxRetriesConfigured: _, ...preparedModel }) => preparedModel);

    return { model, modelList, fallbackTimeouts };
  }

  /**
   * Updates the agent's instructions.
   * @internal
   */
  __updateInstructions(newInstructions: DynamicArgument<AgentInstructions, any>) {
    this.#instructions = newInstructions as DynamicArgument<AgentInstructions, TRequestContext>;
  }

  /**
   * Updates the agent's model configuration.
   * @internal
   */
  __updateModel({ model }: { model: DynamicArgument<MastraModelConfig, TRequestContext> | ModelFallbacks }) {
    this.model = model as DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
    this.logger.debug(`[Agents:${this.name}] Model updated.`, { model: this.model, name: this.name });
  }

  /**
   * Resets the agent's model to the original model set during construction.
   * Clones arrays to prevent reordering mutations from affecting the original snapshot.
   * @internal
   */
  __resetToOriginalModel() {
    const originalModel = this.#originalModel;
    if (Array.isArray(originalModel)) {
      this.model = [...originalModel];
      return;
    }
    this.model = originalModel;
  }

  /**
   * Returns the editor ownership config for this agent.
   * @internal
   */
  __getEditorConfig() {
    return this.#editorConfig;
  }

  /**
   * Returns a snapshot of the raw field values that may be overridden by stored config.
   * Used by the editor to save/restore code defaults externally.
   * @internal
   */
  __getOverridableFields() {
    return {
      instructions: this.#instructions,
      model: this.model,
      tools: this.#tools,
      workspace: this.#workspace,
    };
  }

  /**
   * Reorders a static model list. Returns false when `model` is not an array (including
   * function-valued models, whose selection is resolved per request and cannot be edited in place).
   */
  reorderModels(modelIds: string[]): boolean {
    if (!Array.isArray(this.model)) {
      this.logger.warn('Model is not an array', { agent: this.name });
      return false;
    }

    if (!(this.model as ModelFallbacks).some(m => modelIds.includes(m.id))) {
      this.logger.warn('No matching model ids to reorder', { agent: this.name });
      return false;
    }

    // TypeScript sees this.model as ModelWithRetries[] | ModelFallbacks after Array.isArray check.
    // At runtime, arrays are always normalized to ModelFallbacks (with required id) in the constructor.
    // The cast tells TypeScript to trust this runtime invariant.
    this.model = (this.model as ModelFallbacks).sort((a, b) => {
      const aIndex = modelIds.indexOf(a.id);
      const bIndex = modelIds.indexOf(b.id);
      const aPos = aIndex === -1 ? Infinity : aIndex;
      const bPos = bIndex === -1 ? Infinity : bIndex;
      return aPos - bPos;
    });
    return true;
  }

  updateModelInModelList({
    id,
    model,
    enabled,
    maxRetries,
  }: {
    id: string;
    model?: DynamicArgument<MastraModelConfig>;
    enabled?: boolean;
    maxRetries?: number;
  }): boolean {
    if (!Array.isArray(this.model)) {
      this.logger.warn('Model is not an array', { agent: this.name });
      return false;
    }

    // TypeScript sees this.model as ModelWithRetries[] | ModelFallbacks after Array.isArray check.
    // At runtime, arrays are always normalized to ModelFallbacks (with required id) in the constructor.
    // The cast tells TypeScript to trust this runtime invariant.
    const modelArray = this.model as ModelFallbacks;
    const modelToUpdate = modelArray.find(m => m.id === id);
    if (!modelToUpdate) {
      this.logger.warn('Model not found', { agent: this.name, modelId: id });
      return false;
    }

    this.model = modelArray.map(mdl => {
      if (mdl.id === id) {
        return {
          ...mdl,
          model: model ?? mdl.model,
          enabled: enabled ?? mdl.enabled,
          maxRetries: maxRetries ?? mdl.maxRetries,
          maxRetriesConfigured: maxRetries !== undefined || mdl.maxRetriesConfigured,
        };
      }
      return mdl;
    });
    return true;
  }

  #primitives?: MastraPrimitives;

  /**
   * Returns the logger registered with the agent.
   * @internal
   */
  __getLogger() {
    return this.logger;
  }

  /**
   * Registers  logger primitives with the agent.
   * @internal
   */
  __registerPrimitives(p: MastraPrimitives) {
    if (p.logger) {
      this.__setLogger(p.logger);
      this.#agentChannels?.__setLogger(p.logger);
    }

    // Store primitives for later use when creating LLM instances
    this.#primitives = p;
  }

  /**
   * Registers the Mastra instance with the agent.
   * @internal
   */
  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    this.#executionEngine?.registerMastra(mastra);

    // Drop any ephemeral Mastra now that a real one is attached; we no longer
    // need the storage fallback.
    if (this.#ephemeralMastra) {
      this.#ephemeralMastra = undefined;
    }

    this.#streamBus?.registerMastra(mastra.pubsub);

    // Propagate logger to workspace if it's a direct instance (not a factory function)
    if (this.#workspace && typeof this.#workspace !== 'function') {
      this.#workspace.__setLogger(this.logger);
    }
    // Mastra will be passed to the LLM when it's created in getLLM()

    // Auto-register tools with the Mastra instance
    if (this.#tools && typeof this.#tools === 'object') {
      Object.entries(this.#tools).forEach(([key, tool]) => {
        try {
          // Only add tools that have an id property (ToolAction type)
          if (tool && typeof tool === 'object' && 'id' in tool) {
            // Use tool's intrinsic ID to avoid collisions across agents
            const toolKey = typeof (tool as any).id === 'string' ? (tool as any).id : key;
            mastra.addTool(tool as any, toolKey);
          }
        } catch (error) {
          // Tool might already be registered, that's okay
          if (error instanceof MastraError && error.id !== 'MASTRA_ADD_TOOL_DUPLICATE_KEY') {
            throw error;
          }
        }
      });
    }

    // Auto-register input processors with the Mastra instance
    if (this.#inputProcessors && Array.isArray(this.#inputProcessors)) {
      this.#inputProcessors.forEach(processor => {
        try {
          mastra.addProcessor(processor);
        } catch (error) {
          // Processor might already be registered, that's okay
          if (error instanceof MastraError && error.id !== 'MASTRA_ADD_PROCESSOR_DUPLICATE_KEY') {
            throw error;
          }
        }
        // Always register the configuration with agent context
        mastra.addProcessorConfiguration(processor, this.id, 'input', this.source);
      });
    }

    // Auto-register output processors with the Mastra instance
    if (this.#outputProcessors && Array.isArray(this.#outputProcessors)) {
      this.#outputProcessors.forEach(processor => {
        try {
          mastra.addProcessor(processor);
        } catch (error) {
          // Processor might already be registered, that's okay
          if (error instanceof MastraError && error.id !== 'MASTRA_ADD_PROCESSOR_DUPLICATE_KEY') {
            throw error;
          }
        }
        // Always register the configuration with agent context
        mastra.addProcessorConfiguration(processor, this.id, 'output', this.source);
      });
    }

    // Propagate Mastra instance to signal providers and the processors they
    // contributed. Those instances were recorded when the agent wired them into
    // its chain, so this reaches exactly the processors that run.
    if (this.#signals) {
      for (const provider of this.#signals) {
        provider.__registerMastra(mastra);
      }
    }
    registerProviderProcessors(this.#signalProviderProcessors, mastra);
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   * @internal
   */
  __setTools(tools: DynamicArgument<TTools, any>) {
    this.#tools = tools as DynamicArgument<TTools, TRequestContext>;
  }

  /**
   * Create a lightweight clone of this agent that can be independently mutated
   * without affecting the original instance. Used by the editor to apply
   * version overrides without mutating the singleton agent.
   * @internal
   */
  __fork(): Agent<TAgentId, TTools, TOutput, TRequestContext> {
    const fork = new Agent<TAgentId, TTools, TOutput, TRequestContext>({
      ...this.#config,
      rawConfig: this.toRawConfig(),
    } as AgentConfig<TAgentId, TTools, TOutput, TRequestContext>);

    // Preserve runtime state that may have been set after construction
    // (e.g. when Mastra registers agents via __registerMastra / __registerPrimitives).
    // Assign fields directly to avoid re-triggering tool/processor registration
    // side effects that __registerMastra would cause.
    if (this.#mastra && !this.#config.mastra) {
      fork.#mastra = this.#mastra;
      // The fork collected its own processor instances during construction,
      // before the instance above was assigned, so those never got registered.
      // Register here to match the parent — this is the same propagation
      // `__registerMastra` does, not tool/processor registration.
      registerProviderProcessors(fork.#signalProviderProcessors, this.#mastra);
    }
    if (this.#primitives) {
      fork.#primitives = this.#primitives;
    }

    fork.#executionEnginePolicy = this.#executionEnginePolicy.clone();
    fork.#inheritedPubSub = this.#inheritedPubSub;
    fork.#defaultStreamPubsub = this.#defaultStreamPubsub ??= new EventEmitterPubSub();
    fork.source = this.source;
    fork._agentNetworkAppend = this._agentNetworkAppend;
    // A version fork runs inside this agent's `untilIdle` wrapper, so it must see that wrapper
    // to know a finished background task is already being reported.
    fork.activeStreamUntilIdle = this.activeStreamUntilIdle;

    return fork;
  }

  /**
   * Mark this agent as a stored-version fork so execution does not attempt
   * to resolve a version override for it again.
   * @internal
   */
  __markStoredVersionApplied() {
    this.#storedVersionApplied = true;
  }

  /**
   * Whether this agent is a stored-version fork produced by
   * `Mastra.resolveVersionedAgent()`. Subclasses that implement their own
   * resume paths (e.g. DurableAgent) use this to skip re-pinning a version
   * that the caller already resolved explicitly.
   * @internal
   */
  __isStoredVersionApplied(): boolean {
    return this.#storedVersionApplied;
  }

  /**
   * Extract plain text lines from a single message's parts array.
   * Modeled after observational memory's formatObserverMessage — switches on
   * part type, emits role-prefixed text, and drops all metadata.
   */
  private formatMessagePartsForTitle(parts: Array<{ type: string; [key: string]: any }>, role: string): string[] {
    const lines: string[] = [];
    for (const part of parts) {
      if (part.type === 'text') {
        lines.push(`${role}: ${part.text}`);
      } else if (part.type === 'tool-invocation') {
        const inv = part.toolInvocation;
        if (inv.state === 'result') {
          const resultStr = typeof inv.result === 'string' ? inv.result : JSON.stringify(inv.result);
          lines.push(`Tool Result ${inv.toolName}: ${resultStr.slice(0, 200)}`);
        } else {
          lines.push(`Tool Call ${inv.toolName}: ${JSON.stringify(inv.args).slice(0, 200)}`);
        }
      } else if (part.type === 'reasoning') {
        if (part.reasoning) {
          lines.push(`Reasoning: ${part.reasoning}`);
        }
      } else if (part.type === 'source-url') {
        lines.push(`${role}: User added URL: ${part.url.substring(0, 100)}`);
      } else if (part.type === 'file') {
        lines.push(`${role}: User added ${part.mediaType} file: ${part.url.slice(0, 100)}`);
      }
    }
    return lines;
  }

  /**
   * Format an array of UI messages into plain text for title generation.
   * Like observational memory's formatMessagesForObserver — loops over messages,
   * formats each one's parts with role context, and joins the results.
   */
  formatMessagesForTitle(
    messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; [key: string]: any }> }>,
  ): string {
    const lines: string[] = [];
    for (const msg of messages) {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      // AIV4 UI messages can carry the same text in both `content` and a text part.
      // Skip `content` only when a text part carries the exact same text, so each
      // message's text is emitted once without ever dropping distinct content.
      const hasContent = typeof msg.content === 'string' && msg.content !== '';
      const contentDuplicatedByPart =
        hasContent && msg.parts?.some(part => part.type === 'text' && part.text === msg.content);
      if (hasContent && !contentDuplicatedByPart) {
        lines.push(`${role}: ${msg.content}`);
      }
      if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
        lines.push(...this.formatMessagePartsForTitle(msg.parts, role));
      }
    }
    return lines.join('\n');
  }

  async generateTitleFromUserMessage({
    message,
    messages,
    requestContext = new RequestContext(),
    model,
    instructions,
    ...rest
  }: {
    message?: string | MessageInput;
    messages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; [key: string]: any }> }>;
    requestContext?: RequestContext;
    model?: DynamicArgument<MastraModelConfig, TRequestContext>;
    instructions?: DynamicArgument<string>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    // need to use text, not object output or it will error for models that don't support structured output (eg Deepseek R1)
    const llm = await this.getLLM({ requestContext, model });
    // Register Mastra on the LLM (if any) so the inner agentic loop has access
    // for storage/observability. Idempotent.
    if (this.#mastra) {
      llm.__registerMastra(this.#mastra);
    }

    let userContent: string;

    if (messages && messages.length > 0) {
      // Multi-message path: format all messages with roles
      userContent = this.formatMessagesForTitle(messages);
    } else if (message) {
      // Single message path (backward compat): normalize and format
      const normMessage = new MessageList().add(message, 'user').get.all.aiV5.ui().at(-1);
      if (!normMessage) {
        throw new Error(`Could not generate title from input ${JSON.stringify(message)}`);
      }
      userContent = this.formatMessagesForTitle([normMessage]);
    } else {
      throw new Error('Either message or messages must be provided');
    }

    if (!userContent) {
      return undefined;
    }

    // Resolve instructions using the dedicated method
    const systemInstructions = await this.resolveTitleInstructions(requestContext, instructions);

    let text = '';

    if (isSupportedLanguageModel(llm.getModel())) {
      const messageList = new MessageList()
        .add(
          [
            {
              role: 'system',
              content: systemInstructions,
            },
          ],
          'system',
        )
        .add(
          [
            {
              role: 'user',
              content: userContent,
            },
          ],
          'input',
        );
      const result = (llm as MastraLLMVNext).stream({
        methodType: 'generate',
        requestContext,
        ...observabilityContext,
        messageList,
        agentId: this.id,
        agentName: this.name,
      });

      text = await result.text;
    } else {
      const result = await (llm as MastraLLMV1).__text({
        requestContext,
        ...observabilityContext,
        messages: [
          {
            role: 'system',
            content: systemInstructions,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      });

      text = result.text;
    }

    // Strip out any r1 think tags if present
    const cleanedText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return cleanedText;
  }

  getMostRecentUserMessage(messages: Array<UIMessage | UIMessageWithMetadata>) {
    const userMessages = messages.filter(message => message.role === 'user');
    return userMessages.at(-1);
  }

  /**
   * Restrict UI messages to those that belong to the given thread. Memory can
   * load messages from other threads of the same resource into the message list
   * (resource-scoped recall); those must not influence the generated title.
   */
  filterUiMessagesByThread<T extends { id: string }>(messageList: MessageList, threadId: string, uiMessages: T[]): T[] {
    const threadMessageIds = new Set(
      messageList.get.all
        .db()
        .filter(m => !m.threadId || m.threadId === threadId)
        .map(m => m.id),
    );
    return uiMessages.filter(m => threadMessageIds.has(m.id));
  }

  async genTitle(
    userMessage: string | MessageInput | undefined,
    requestContext: RequestContext,
    observabilityContext: ObservabilityContext,
    model?: DynamicArgument<MastraModelConfig, TRequestContext>,
    instructions?: DynamicArgument<string>,
    uiMessages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; [key: string]: any }> }>,
  ) {
    try {
      if (uiMessages && uiMessages.length > 0) {
        return await this.generateTitleFromUserMessage({
          messages: uiMessages,
          requestContext,
          ...observabilityContext,
          model,
          instructions,
        });
      }
      if (userMessage) {
        const normMessage = new MessageList().add(userMessage, 'user').get.all.ui().at(-1);
        if (normMessage) {
          return await this.generateTitleFromUserMessage({
            message: normMessage,
            requestContext,
            ...observabilityContext,
            model,
            instructions,
          });
        }
      }
      // If no user message, return undefined so existing title is preserved
      return undefined;
    } catch (e) {
      this.logger.error('Error generating title', { agent: this.name, error: e });
      // Return undefined on error so existing title is preserved
      return undefined;
    }
  }

  public __setMemory(memory: DynamicArgument<MastraMemory, TRequestContext>) {
    this.#memory = memory;
  }

  public __setKnowledge(knowledge: Knowledge) {
    this.#knowledge = knowledge;
  }

  public __setPubSub(pubsub: PubSub) {
    this.#inheritedPubSub = pubsub;
  }

  public __setWorkspace(workspace: DynamicArgument<AnyWorkspace | undefined, TRequestContext>) {
    this.#workspace = workspace;
    if (this.#mastra && workspace && typeof workspace !== 'function') {
      workspace.__setLogger(this.logger);
      this.#mastra.addWorkspace(workspace, undefined, {
        source: 'agent',
        agentId: this.id,
        agentName: this.name,
        agentSource: this.source,
      });
    }
  }

  /**
   * Retrieves and converts memory tools to CoreTool format.
   * @internal
   */
  private async listMemoryTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    memoryConfig,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    getModel,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    memoryConfig?: MemoryConfigInternal;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedMemoryTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug('Skipping memory tools (agent network context)', { agent: this.name, runId });
      return convertedMemoryTools;
    }

    // Get memory tools if available
    const memory = await this.getMemory({ requestContext });

    // Skip memory tools if there's no usable context — thread-scoped needs threadId, resource-scoped needs resourceId
    if (!threadId && !resourceId) {
      this.logger.debug('Skipping memory tools (no thread or resource context)', { agent: this.name, runId });
      return convertedMemoryTools;
    }

    const memoryTools = memory?.listTools?.(memoryConfig);

    if (memoryTools) {
      for (const [toolName, tool] of Object.entries(memoryTools)) {
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await getModel(),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
          backgroundConfig: (toolObj as any).background,
          agentBackgroundConfig: this.#backgroundTasks,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        convertedMemoryTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedMemoryTools;
  }

  /**
   * Lists the tools of the attached Knowledge, if any.
   * @internal
   */
  private async listKnowledgeTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    getModel,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const converted: Record<string, CoreTool> = {};
    if (this._agentNetworkAppend) return converted;
    const knowledge = this.getKnowledge();
    if (!knowledge) return converted;

    const observabilityContext = resolveObservabilityContext(rest);
    for (const [toolName, tool] of Object.entries(knowledge.createTools())) {
      const options: ToolOptions = {
        name: toolName,
        runId,
        threadId,
        resourceId,
        logger: this.logger,
        mastra: mastraProxy as MastraUnion | undefined,
        agentName: this.name,
        agentId: this.id,
        requestContext,
        ...observabilityContext,
        model: await getModel(),
        tracingPolicy: this.#options?.tracingPolicy,
        requireApproval: (tool as any).requireApproval,
        backgroundConfig: (tool as any).background,
        agentBackgroundConfig: this.#backgroundTasks,
      };
      converted[toolName] = makeCoreTool(tool, options, undefined, autoResumeSuspendedTools, backgroundTaskEnabled);
    }
    return converted;
  }

  /**
   * Lists workspace tools if a workspace is configured.
   * @internal
   */
  private async listWorkspaceTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    getModel,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedWorkspaceTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug('Skipping workspace tools (agent network context)', { agent: this.name, runId });
      return convertedWorkspaceTools;
    }

    // Get workspace tools if available
    const workspace = await this.getWorkspace({ requestContext });

    if (!workspace) {
      return convertedWorkspaceTools;
    }

    // Read-before-write records persist per thread in the `threadState`
    // storage domain (alongside task lists and goal objectives), so they
    // survive suspend/resume, later turns, and process restarts. Without
    // thread identity or storage, tracking falls back to per-run.
    const threadStateStore = threadId ? await this.#mastra?.getStorage()?.getStore('threadState') : undefined;
    const workspaceTools = await createWorkspaceTools(workspace, {
      requestContext: requestContext ? Object.fromEntries(requestContext.entries()) : {},
      workspace,
      readTracker:
        threadStateStore && threadId
          ? new ThreadStateFileReadTracker({ threadId, store: threadStateStore, logger: this.logger })
          : undefined,
    });

    if (Object.keys(workspaceTools).length > 0) {
      this.logger.debug('Adding workspace tools', { agent: this.name, tools: Object.keys(workspaceTools), runId });

      for (const [toolName, tool] of Object.entries(workspaceTools)) {
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await getModel(),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
          backgroundConfig: (toolObj as any).background,
          agentBackgroundConfig: this.#backgroundTasks,
          workspace,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        convertedWorkspaceTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedWorkspaceTools;
  }

  /**
   * Returns skill tools (skill, skill_search, skill_read) when the workspace
   * has skills configured. These are added at the Agent level (like workspace
   * tools) rather than inside a processor, so they persist across turns and
   * survive serialization across tool-approval pauses.
   * @internal
   */
  private async listSkillTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    suppressEagerSkillTools,
    getModel,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    suppressEagerSkillTools: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedSkillTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      return convertedSkillTools;
    }

    const workspace = await this.getWorkspace({ requestContext });

    // Resolve skills from agent-level config and/or workspace (pass workspace to avoid double resolution)
    const skills = await this.resolveSkills(
      requestContext,
      workspace ?? undefined,
      observabilityContext.tracingContext,
    );
    if (!skills) {
      return convertedSkillTools;
    }

    const skillTools = createSkillTools(skills);

    if (Object.keys(skillTools).length > 0) {
      this.logger.debug('Adding skill tools', { agent: this.name, tools: Object.keys(skillTools), runId });

      for (const [toolName, tool] of Object.entries(skillTools)) {
        if (suppressEagerSkillTools && (toolName === 'skill' || toolName === 'skill_search')) {
          continue;
        }
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await getModel(),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: false, // Skill tools never require approval
          backgroundConfig: (toolObj as any).background,
          agentBackgroundConfig: this.#backgroundTasks,
          workspace,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        // Exempt from a global `requireToolApproval` too, not just tool-level approval.
        markApprovalExempt(convertedToCoreTool);
        convertedSkillTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedSkillTools;
  }

  /**
   * Lists browser tools if a browser is configured.
   * @internal
   */
  private async listBrowserTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    getModel,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedBrowserTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      return convertedBrowserTools;
    }

    // Check if browser is configured
    if (!this.#browser) {
      return convertedBrowserTools;
    }

    // Get browser tools from the provider
    const browserTools = this.#browser.getTools();

    if (Object.keys(browserTools).length > 0) {
      this.logger.debug(`[Agent:${this.name}] - Adding browser tools: ${Object.keys(browserTools).join(', ')}`, {
        runId,
      });

      for (const [toolName, tool] of Object.entries(browserTools)) {
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: undefined,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await getModel(),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
          backgroundConfig: (toolObj as any).background,
          agentBackgroundConfig: this.#backgroundTasks,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        convertedBrowserTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedBrowserTools;
  }

  /**
   * Returns tools that input processors loaded into their own state.
   * These tools need to be available before a resumed approval call enters toolCallStep.
   * Otherwise the resumed workflow bypasses processInputStep and loses dynamic executors.
   * @internal
   */
  private async listInputProcessorLoadedTools({
    processors,
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    tools,
    getModel,
    memoryConfig,
    runMessages,
    ...rest
  }: {
    processors: InputProcessorOrWorkflow[];
    memoryConfig?: MemoryConfigInternal;
    /** In-flight messages of the run, not yet in memory (durable recovery). */
    runMessages?: MastraDBMessage[];
    /**
     * Tools already resolved for this request. A processor that made a
     * request-scoped tool searchable needs them to rebuild its executor here,
     * since the resumed run never re-enters processInputStep.
     */
    tools?: Record<string, unknown>;
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedProcessorTools: Record<string, CoreTool> = {};

    // Resumed runs never re-enter processInputStep, so processors that derive loaded
    // state from the conversation (e.g. ToolSearchProcessor storage: 'context') read
    // the persisted thread here. Loaded lazily and at most once.
    let messagesPromise: Promise<MastraDBMessage[]> | undefined;
    const getMessages = (): Promise<MastraDBMessage[]> => {
      if (!threadId) return Promise.resolve(runMessages ?? []);
      messagesPromise ??= this.getMemoryMessages({
        threadId,
        resourceId,
        vectorMessageSearch: '',
        memoryConfig,
        requestContext,
        returnEmptyIfThreadMissing: true,
        runId,
      }).then(result => {
        if (!runMessages?.length) return result.messages;
        const seen = new Set(result.messages.map(m => m.id));
        return [...result.messages, ...runMessages.filter(m => !seen.has(m.id))];
      });
      return messagesPromise;
    };

    const collectLoadedTools = async (processor: InputProcessorOrWorkflow | unknown) => {
      if (isProcessorWorkflow(processor)) {
        for (const childProcessor of listProcessorWorkflowChildren(processor)) {
          await collectLoadedTools(childProcessor);
        }
      }

      const toolProvider = processor as ProcessorLoadedToolsProvider;

      if (typeof toolProvider.getLoadedToolsForRequestContext !== 'function') {
        return;
      }

      const loadedTools = await toolProvider.getLoadedToolsForRequestContext({
        requestContext,
        tools,
        getMessages,
        runMessages,
      });
      if (!loadedTools || Object.keys(loadedTools).length === 0) {
        return;
      }

      const workspace = await this.getWorkspace({ requestContext });
      const memory = await this.getMemory({ requestContext });
      const model = await getModel();

      for (const [toolName, tool] of Object.entries(loadedTools)) {
        if (isMastraTool(tool) || isProviderTool(tool)) {
          convertedProcessorTools[toolName] = makeCoreTool(
            tool as unknown as ToolToConvert,
            {
              name: toolName,
              runId,
              threadId,
              resourceId,
              logger: this.logger,
              mastra: mastraProxy as MastraUnion | undefined,
              memory,
              agentName: this.name,
              agentId: this.id,
              requestContext,
              ...observabilityContext,
              model,
              outputWriter,
              tracingPolicy: this.#options?.tracingPolicy,
              requireApproval: (tool as any).requireApproval,
              backgroundConfig: (tool as any).background,
              agentBackgroundConfig: this.#backgroundTasks,
              workspace,
            },
            undefined,
            autoResumeSuspendedTools,
            backgroundTaskEnabled,
          );
        } else {
          convertedProcessorTools[toolName] = tool as CoreTool;
        }
      }
    };

    for (const processor of processors) {
      await collectLoadedTools(processor);
    }

    return convertedProcessorTools;
  }

  /**
   * Executes input processors on the message list before LLM processing.
   * @internal
   */
  private async __runInputProcessors({
    requestContext,
    messageList,
    inputProcessorOverrides,
    processorStates,
    ...observabilityContext
  }: {
    requestContext: RequestContext;
    messageList: MessageList;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
  } & ObservabilityContext): Promise<{
    messageList: MessageList;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }> {
    let tripwire: { reason: string; retry?: boolean; metadata?: unknown; processorId?: string } | undefined;

    if (
      inputProcessorOverrides?.length ||
      this.#inputProcessors ||
      this.#hasEffectiveMemory(requestContext) ||
      this.#skills ||
      this.#workspace ||
      this.#mastra?.getWorkspace() ||
      this.#browser ||
      this.#agentChannels
    ) {
      const runner = await this.getProcessorRunner({
        requestContext,
        inputProcessorOverrides,
        processorStates,
      });
      try {
        messageList = await runner.runInputProcessors(messageList, observabilityContext, requestContext, 0);
      } catch (error) {
        if (error instanceof TripWire) {
          tripwire = {
            reason: error.message,
            retry: error.options?.retry,
            metadata: error.options?.metadata,
            processorId: error.processorId,
          };
          this.logger.warn('Input processor tripwire triggered', {
            agent: this.name,
            reason: error.message,
            processorId: error.processorId,
            retry: error.options?.retry,
          });
        } else {
          throw new MastraError(
            {
              id: 'AGENT_INPUT_PROCESSOR_ERROR',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
              text: `[Agent:${this.name}] - Input processor error`,
            },
            error,
          );
        }
      }
    }

    return {
      messageList,
      tripwire,
    };
  }

  /**
   * Runs processInputStep phase on input processors.
   * Used by legacy path to execute per-step input processing (e.g., Observational Memory)
   * that would otherwise only run in the v5 agentic loop.
   * @internal
   */
  private async __runProcessInputStep(
    args: Partial<ObservabilityContext> & {
      requestContext: RequestContext;
      messageList: MessageList;
      stepNumber?: number;
      inputProcessorOverrides?: InputProcessorOrWorkflow[];
      processorStates?: Map<string, ProcessorState>;
      tools?: Record<string, CoreTool>;
      runId?: string;
      threadId?: string;
      resourceId?: string;
      outputWriter?: OutputWriter;
      autoResumeSuspendedTools?: boolean;
      backgroundTaskEnabled?: boolean;
      providerOptions?: ProviderOptions;
    },
  ): Promise<{
    messageList: MessageList;
    tools?: Record<string, CoreTool>;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }> {
    const {
      requestContext,
      messageList,
      stepNumber = 0,
      inputProcessorOverrides,
      processorStates,
      tools,
      runId,
      threadId,
      resourceId,
      outputWriter,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      providerOptions,
      ...rest
    } = args;
    const observabilityContext = resolveObservabilityContext(rest);

    let tripwire: { reason: string; retry?: boolean; metadata?: unknown; processorId?: string } | undefined;
    let nextTools = tools;

    if (
      inputProcessorOverrides?.length ||
      this.#inputProcessors ||
      this.#hasEffectiveMemory(requestContext) ||
      this.#skills
    ) {
      const runner = await this.getProcessorRunner({
        requestContext,
        inputProcessorOverrides,
        processorStates,
      });
      try {
        const llm = await this.getLLM({ requestContext });
        const model = llm.getModel();
        const processInputProviderOptions =
          llm instanceof MastraLLMVNext
            ? mergeProviderOptions(providerOptions, llm.getProviderOptions())
            : providerOptions;
        const memory = await this.getMemory({ requestContext });
        const result = await runner.runProcessInputStep({
          messageList,
          runId,
          stepNumber,
          steps: [],
          ...observabilityContext,
          requestContext,
          memory,
          resourceId,
          threadId,
          // Cast needed: legacy v1 models return LanguageModelV1 which doesn't satisfy MastraLanguageModel.
          // OM's processInputStep doesn't use the model parameter, so this is safe.
          model: model as MastraLanguageModel,
          tools,
          providerOptions: processInputProviderOptions,
          retryCount: 0,
        });
        if (result.tools) {
          const workspace = await this.getWorkspace({ requestContext });
          const memory = await this.getMemory({ requestContext });
          const mastraProxy = this.#mastra
            ? createMastraProxy({ mastra: this.#mastra, logger: this.logger })
            : undefined;
          const convertedTools: Record<string, CoreTool> = {};
          const resolvedModel =
            Object.keys(result.tools).length > 0 ? await this.getModel({ requestContext }) : undefined;

          for (const [name, tool] of Object.entries(result.tools)) {
            if (isMastraTool(tool) || isProviderTool(tool)) {
              convertedTools[name] = makeCoreTool(
                tool as unknown as ToolToConvert,
                {
                  name,
                  runId,
                  threadId,
                  resourceId,
                  logger: this.logger,
                  mastra: mastraProxy as MastraUnion | undefined,
                  memory,
                  agentName: this.name,
                  agentId: this.id,
                  requestContext,
                  ...observabilityContext,
                  model: resolvedModel,
                  outputWriter,
                  tracingPolicy: this.#options?.tracingPolicy,
                  requireApproval: (tool as any).requireApproval,
                  backgroundConfig: (tool as any).background,
                  agentBackgroundConfig: this.#backgroundTasks,
                  workspace,
                },
                undefined,
                autoResumeSuspendedTools,
                backgroundTaskEnabled,
              );
            } else {
              convertedTools[name] = tool as CoreTool;
            }
          }

          nextTools = convertedTools;
        }
      } catch (error) {
        if (error instanceof TripWire) {
          tripwire = {
            reason: error.message,
            retry: error.options?.retry,
            metadata: error.options?.metadata,
            processorId: error.processorId,
          };
          this.logger.warn('Input step processor tripwire triggered', {
            agent: this.name,
            reason: error.message,
            processorId: error.processorId,
            retry: error.options?.retry,
          });
        } else {
          throw new MastraError(
            {
              id: 'AGENT_INPUT_STEP_PROCESSOR_ERROR',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
              text: `[Agent:${this.name}] - Input step processor error`,
            },
            error,
          );
        }
      }
    }

    return {
      messageList,
      tools: nextTools,
      tripwire,
    };
  }

  /**
   * Executes output processors on the message list after LLM processing.
   * @internal
   */
  private async __runOutputProcessors({
    requestContext,
    messageList,
    outputProcessorOverrides,
    ...observabilityContext
  }: {
    requestContext: RequestContext;
    messageList: MessageList;
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
  } & ObservabilityContext): Promise<{
    messageList: MessageList;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }> {
    let tripwire: { reason: string; retry?: boolean; metadata?: unknown; processorId?: string } | undefined;

    if (outputProcessorOverrides?.length || this.#outputProcessors || this.#hasEffectiveMemory(requestContext)) {
      const runner = await this.getProcessorRunner({
        requestContext,
        outputProcessorOverrides,
      });

      try {
        messageList = await runner.runOutputProcessors(messageList, observabilityContext, requestContext);
      } catch (e) {
        if (e instanceof TripWire) {
          tripwire = {
            reason: e.message,
            retry: e.options?.retry,
            metadata: e.options?.metadata,
            processorId: e.processorId,
          };
          this.logger.warn('Output processor tripwire triggered', {
            agent: this.name,
            reason: e.message,
            processorId: e.processorId,
            retry: e.options?.retry,
          });
        } else {
          throw e;
        }
      }
    }

    return {
      messageList,
      tripwire,
    };
  }

  /**
   * Fetches remembered messages from memory for the current thread.
   * @internal
   */
  private async getMemoryMessages({
    resourceId,
    threadId,
    vectorMessageSearch,
    memoryConfig,
    requestContext,
    returnEmptyIfThreadMissing,
    runId,
  }: {
    resourceId?: string;
    threadId: string;
    vectorMessageSearch: string;
    memoryConfig?: MemoryConfigInternal;
    requestContext: RequestContext;
    returnEmptyIfThreadMissing?: boolean;
    runId?: string;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const memory = await this.getMemory({ requestContext });
    if (!memory) {
      return { messages: [] };
    }

    const threadConfig = memory.getMergedThreadConfig(memoryConfig || {});
    const history = normalizeMessageHistoryConfig(threadConfig.lastMessages, threadConfig.messageHistory);
    if (!history.enabled && !threadConfig.semanticRecall) {
      return { messages: [] };
    }

    if (returnEmptyIfThreadMissing && !(await memory.getThreadById({ threadId }))) {
      this.logger.debug('Skipping processor-loaded tool history (thread does not exist yet)', {
        agent: this.name,
        runId,
        threadId,
      });
      return { messages: [] };
    }

    return memory.recall({
      threadId,
      resourceId,
      // Let recall apply the normalized count/token history configuration. In particular,
      // token-only history must page backwards instead of mapping to `perPage: false`.
      // The agent only consumes `messages` from recall; skip the COUNT(*) work.
      includeTotal: false,
      threadConfig: memoryConfig,
      // The new user messages aren't in the list yet cause we add memory messages first to try to make sure ordering is correct (memory comes before new user messages)
      vectorSearchString: threadConfig.semanticRecall && vectorMessageSearch ? vectorMessageSearch : undefined,
    });
  }

  /**
   * Retrieves and converts assigned tools to CoreTool format.
   * @internal
   */
  private async listAssignedTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    model: activeModel,
    getModel,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    model?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};

    const memory = await this.getMemory({ requestContext });

    // Mastra tools passed into the Agent
    const assignedTools = await this.listTools({ requestContext, resolveWebSearch: false });

    const assignedToolEntries = Object.entries(assignedTools || {});
    const model = activeModel ?? (assignedToolEntries.length > 0 ? await getModel() : undefined);

    const assignedCoreToolEntries = await Promise.all(
      assignedToolEntries.map(async ([k, tool]) => {
        if (!tool) {
          return;
        }

        const toolToConvert = isWebSearchTool(tool)
          ? createWebSearchProviderTool(normalizeWebSearchProvider(model))
          : tool;

        const options: ToolOptions = {
          name: k,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model,
          outputWriter,
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (tool as any).requireApproval,
          backgroundConfig: (tool as any).background,
          agentBackgroundConfig: this.#backgroundTasks,
        };
        return [k, makeCoreTool(toolToConvert, options, undefined, autoResumeSuspendedTools, backgroundTaskEnabled)];
      }),
    );

    const assignedToolEntriesConverted = Object.fromEntries(
      assignedCoreToolEntries.filter((entry): entry is [string, CoreTool] => Boolean(entry)),
    );

    toolsForRequest = {
      ...assignedToolEntriesConverted,
    };

    return toolsForRequest;
  }

  /**
   * Retrieves and converts toolset tools to CoreTool format.
   * @internal
   */
  private async listToolsets({
    runId,
    threadId,
    resourceId,
    toolsets,
    requestContext,
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    getModel,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    toolsets: ToolsetsInput;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};

    const memory = await this.getMemory({ requestContext });
    const toolsetEntries = Object.entries(toolsets || {});

    if (toolsetEntries.length > 0) {
      this.logger.debug('Adding tools from toolsets', {
        agent: this.name,
        toolsets: toolsetEntries.map(([toolsetName]) => toolsetName),
        runId,
      });
      // Toolsets are flattened by tool name, so a later toolset replaces an earlier
      // toolset's tool with the same name. Keep that behavior, but say so.
      const toolsetByToolName = new Map<string, string>();
      for (const [toolsetName, toolset] of toolsetEntries) {
        for (const [toolName, tool] of Object.entries(toolset)) {
          const earlierToolsetName = toolsetByToolName.get(toolName);
          if (earlierToolsetName !== undefined) {
            this.logger.warn(
              `Tool "${toolName}" from toolset "${toolsetName}" replaces the tool with the same name from toolset "${earlierToolsetName}", so the "${earlierToolsetName}" tool is not used. Give the tools distinct names to keep both.`,
              { agent: this.name, tool: toolName, toolsets: [earlierToolsetName, toolsetName], runId },
            );
          }
          toolsetByToolName.set(toolName, toolsetName);
          const toolObj = tool;
          const options: ToolOptions = {
            name: toolName,
            runId,
            threadId,
            resourceId,
            logger: this.logger,
            mastra: mastraProxy as MastraUnion | undefined,
            memory,
            agentName: this.name,
            agentId: this.id,
            requestContext,
            ...observabilityContext,
            model: await getModel(),
            outputWriter,
            tracingPolicy: this.#options?.tracingPolicy,
            requireApproval: (toolObj as any).requireApproval,
            backgroundConfig: (toolObj as any).background,
            agentBackgroundConfig: this.#backgroundTasks,
          };
          const convertedToCoreTool = makeCoreTool(
            toolObj,
            options,
            'toolset',
            autoResumeSuspendedTools,
            backgroundTaskEnabled,
          );
          toolsForRequest[toolName] = convertedToCoreTool;
        }
      }
    }

    return toolsForRequest;
  }

  /**
   * Retrieves and converts client-side tools to CoreTool format.
   * @internal
   */
  private async listClientTools({
    runId,
    threadId,
    resourceId,
    requestContext,
    mastraProxy,
    clientTools,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    model: activeModel,
    getModel,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    clientTools?: ToolsInput;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    model?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};
    const memory = await this.getMemory({ requestContext });
    // Convert client tools
    const clientToolsForInput = Object.entries(clientTools || {});
    if (clientToolsForInput.length > 0) {
      this.logger.debug('Adding client tools', { agent: this.name, tools: Object.keys(clientTools || {}), runId });
      for (const [toolName, tool] of clientToolsForInput) {
        const model = activeModel ?? (await getModel());
        let toolToConvert: ToolToConvert;
        if (isWebSearchTool(tool)) {
          toolToConvert = createWebSearchProviderTool(normalizeWebSearchProvider(model));
        } else if (isProviderTool(tool)) {
          toolToConvert = tool;
        } else {
          const { execute, ...toolRest } = tool;
          toolToConvert =
            'renderOnly' in tool && tool.renderOnly
              ? { ...toolRest, execute: async () => ({ acknowledged: true }) }
              : toolRest;
        }
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model,
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (tool as any).requireApproval,
          backgroundConfig: (tool as any).background,
          agentBackgroundConfig: this.#backgroundTasks,
        };
        const convertedToCoreTool = makeCoreTool(
          toolToConvert,
          options,
          'client-tool',
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        toolsForRequest[toolName] = convertedToCoreTool;
      }
    }

    return toolsForRequest;
  }

  /**
   * Strips tool parts from messages.
   *
   * When a supervisor delegates to a sub-agent, the parent's conversation
   * history may include tool_call parts for its own delegation tools
   * (agent-* and workflow-*) and other tools. The sub-agent doesn't have these tools,
   * so sending references to them causes model providers to reject or
   * mishandle the request.
   *
   * Provider-executed tool results are stripped too. When a provider runs a tool
   * itself (OpenAI hosted tool search, Anthropic server tools) AI SDK v5 places the
   * tool_result part in the *same assistant message* as its tool_call, so removing only
   * the call leaves an orphaned result that providers reject — "No tool call found for
   * tool search output with call_id ...". Client-executed results live in `role: 'tool'`
   * messages instead and are already dropped below.
   *
   * This function removes those parts while preserving all other
   * conversation context (user messages, assistant text, etc.).
   *
   * Reasoning parts are removed from assistant messages too. The parent's
   * reasoning is replayable only as part of the parent's own unmodified
   * responses: once tool calls and tool messages are removed,
   * `@ai-sdk/anthropic` merges the now-adjacent assistant steps into one
   * message, and Anthropic rejects any signed thinking (`signature` /
   * `redactedData`) in it as a modified thinking block (#29276). The forwarded
   * context never ends in a tool-use continuation, so no provider requires
   * thinking blocks in it.
   * @internal
   */
  private stripParentToolParts(messages: ModelMessage[]): ModelMessage[] {
    return messages
      .map((message): ModelMessage | null => {
        if ((message as { id?: string }).id === 'om-continuation') {
          return null;
        }

        if (message.role === 'tool') {
          return null;
        }

        if (message.role === 'assistant' && Array.isArray(message.content)) {
          const filtered = message.content.filter(
            part => part.type !== 'tool-call' && part.type !== 'tool-result' && part.type !== 'reasoning',
          );
          if (filtered.length === 0) return null;
          return { ...message, content: filtered };
        }

        return message;
      })
      .filter((message): message is ModelMessage => message !== null);
  }

  private getSubAgentToolSchemas(variant: SubAgentToolSchemaVariant = 'default'): SubAgentToolSchemas {
    let schemas = this.#subAgentToolSchemas[variant];
    if (!schemas) {
      const inputSchema = createSubAgentInputSchema({ withResultRefs: variant === 'withResultRefs' });
      const outputSchema = createSubAgentOutputSchema();

      schemas = {
        inputSchema: toStandardSchema(inputSchema) as StandardSchemaWithJSON<SubAgentToolInput>,
        outputSchema: toStandardSchema(outputSchema),
      };
      this.#subAgentToolSchemas[variant] = schemas;
    }

    return schemas;
  }

  /**
   * Retrieves and converts agent tools to CoreTool format.
   * @internal
   */
  private async listAgentTools({
    runId,
    threadId,
    resourceId,
    requestContext,
    methodType,
    autoResumeSuspendedTools,
    delegation,
    backgroundTaskEnabled,
    getModel,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
    delegation?: DelegationConfig;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedAgentTools: Record<string, CoreTool> = {};
    const agents = await this.listAgents({ requestContext });

    // Result registry for `delegation.enableResultReferences`. The delegation
    // tools are built once per run (prepare-tools-step, before the agentic loop
    // registers its run scope), so the registry lives in this closure and is
    // shared by every `agent-*` tool of the run. It is not persisted and does
    // not survive a suspend/resume rebuild.
    const refRegistry: DelegationRefRegistry | undefined = delegation?.enableResultReferences
      ? createDelegationRefRegistry()
      : undefined;

    if (Object.keys(agents).length > 0) {
      for (const [agentName, agent] of Object.entries(agents)) {
        const { inputSchema: agentInputSchema, outputSchema: agentOutputSchema } = this.getSubAgentToolSchemas(
          refRegistry ? 'withResultRefs' : 'default',
        );

        const toModelOutput = delegation?.includeSubAgentToolResultsInModelContext
          ? undefined
          : (output: SubAgentToolOutput | string) => ({
              type: 'text' as const,
              // When a sub-agent invocation is dispatched as a background task, the agentic loop
              // hands `toModelOutput` the placeholder string from tool-call-step.ts ("Background
              // task started...") instead of the agentOutputSchema object. Reading `output.text`
              // off that string is undefined, which serializes to a tool message with null content
              // that providers (e.g. Anthropic) reject with a 500. Use the string as-is in that case.
              value:
                typeof output === 'string'
                  ? output
                  : `${output.text ?? ''}${formatPendingSubAgentToolCalls(output.subAgentPendingToolCalls)}${output.ref ? `\n\n[ref: ${output.ref}]` : ''}`,
            });

        const toolObj = createTool({
          id: `agent-${agentName}`,
          description: agent.getDescription() || `Agent: ${agentName}`,
          inputSchema: agentInputSchema,
          outputSchema: agentOutputSchema,
          mastra: this.#mastra,
          ...(toModelOutput ? { toModelOutput } : {}),
          // manually wrap agent tools with tracing, so that we can pass the
          // current tool span onto the agent to maintain continuity of the trace
          execute: async (inputData: SubAgentToolInput, context) => {
            const invocationActor = getInvocationActor(context);
            const startTime = Date.now();
            const toolCallId = context?.agent?.toolCallId || globalThis.crypto.randomUUID();

            // Get messages from context - available at tool execution time
            const contextMessages = (context?.agent?.messages || []) as ModelMessage[];

            // Strip tool call/result parts from the context.
            const sanitizedMessages = this.stripParentToolParts(contextMessages);

            // Replaced with the sub-agent transcript once it runs; until then it holds the parent context.
            let fullSubAgentMessages = sanitizedMessages as unknown as MastraDBMessage[];

            // Derive iteration from the number of assistant messages (rough approximation)
            // Each iteration typically produces an assistant message. Counted on the parent
            // context with tool parts removed but reasoning kept, so dropping reasoning from
            // the forwarded context doesn't change what delegation hooks see.
            const derivedIteration = Math.max(1, countParentAssistantSteps(contextMessages));

            // The sub-agent run gets its own RequestContext map derived from the
            // parent's entries, excluding run-scoped identity keys. This isolates
            // set/delete operations across the delegation boundary and matches the
            // durable engine's snapshot/rehydrate behavior.
            const subAgentRequestContext: RequestContext = new RequestContext<unknown>(
              [...requestContext.entries()].filter(
                ([key]) =>
                  key !== 'MastraMemory' &&
                  key !== MASTRA_THREAD_ID_KEY &&
                  key !== MASTRA_RESOURCE_ID_KEY &&
                  // Inherited memory is scoped to the run that received it: a
                  // memory-less sub-agent does not pass this agent's memory further
                  // down to its own sub-agents.
                  key !== MASTRA_INHERITED_MEMORY_KEY,
              ),
            );
            // Sub-agents inherit the parent's non-identity scopes (org:, custom) and pick
            // their own resource/thread, as with the reserved ID keys above.
            const parentScopes = subAgentRequestContext.get(MASTRA_SCOPES_KEY);
            if (Array.isArray(parentScopes)) {
              const inheritedScopes = withoutIdentityAgentScopes(parentScopes);
              if (inheritedScopes.length > 0) {
                setRunAgentScopes(subAgentRequestContext, inheritedScopes);
              } else subAgentRequestContext.delete(MASTRA_SCOPES_KEY);
            }

            // Expand `contextFromRefs` into the prompt before any hook runs so
            // onDelegationStart and messageFilter see the prompt the sub-agent
            // will actually receive.
            let resolvedPrompt = inputData.prompt;
            if (refRegistry && inputData.contextFromRefs?.length) {
              const expanded = resolveDelegationRefs(refRegistry, inputData.contextFromRefs, inputData.prompt);
              resolvedPrompt = expanded.prompt;
              if (expanded.missing.length > 0) {
                this.logger.warn('Delegation referenced unknown result IDs; continuing without them', {
                  agent: this.name,
                  targetAgent: agentName,
                  missingRefs: expanded.missing,
                });
              }
            }

            // Build delegation start context
            const delegationStartContext: DelegationStartContext = {
              primitiveId: agent.id,
              primitiveType: 'agent',
              prompt: resolvedPrompt,
              params: {
                threadId: inputData.threadId || undefined,
                resourceId: inputData.resourceId || undefined,
                instructions: inputData.instructions || undefined,
                maxSteps: inputData.maxSteps || undefined,
              },
              iteration: derivedIteration,
              runId: runId || globalThis.crypto.randomUUID(),
              threadId,
              resourceId,
              parentAgentId: this.id,
              parentAgentName: this.name,
              toolCallId,
              messages: sanitizedMessages,
              requestContext: subAgentRequestContext,
            };

            // Generate sub-agent thread and resource IDs early (before any rejection)
            // These are needed for both successful execution and rejection cases
            const subAgentThreadId = inputData.threadId
              ? `${inputData.threadId}-${globalThis.crypto.randomUUID()}`
              : context?.mastra?.generateId({
                  idType: 'thread',
                  source: 'agent',
                  entityId: agentName,
                  resourceId,
                }) || globalThis.crypto.randomUUID();

            const subAgentResourceId = inputData.resourceId
              ? `${inputData.resourceId}-${agentName}`
              : context?.mastra?.generateId({
                  idType: 'generic',
                  source: 'agent',
                  entityId: agentName,
                }) || `${slugify(this.id)}-${agentName}`;

            // Record a throwing delegation hook on the run's request context so
            // callers can detect "delegation ran but the hook failed" without
            // scraping logs. Runs for every hookErrorStrategy.
            const recordHookError = (hook: DelegationHookError['hook'], hookError: unknown, logMessage: string) => {
              const error = hookError instanceof Error ? hookError : new Error(String(hookError));
              this.logger.error(logMessage, { agent: this.name, error });
              const existing =
                (requestContext.get('__mastra_delegationHookErrors') as DelegationHookError[] | undefined) ?? [];
              requestContext.set('__mastra_delegationHookErrors', [
                ...existing,
                {
                  hook,
                  primitiveId: agent.id,
                  toolCallId,
                  runId: runId || '',
                  name: error.name,
                  message: error.message,
                },
              ]);
              return error;
            };
            const hookErrorStrategy = delegation?.hookErrorStrategy ?? 'warn';
            // A hook that just threw is not in a state to handle its own
            // failure, so the failure path never re-invokes it.
            let completeHookInvoked = false;
            let result: any;

            // Call onDelegationStart before resolving the sub-agent's runtime
            // config so mutations of the delegated run's context in the hook
            // are visible to version, model, and default-options resolution
            // below. Rejection handling happens after resolution because the
            // rejection path needs the resolved model version and memory config.
            let startResult: DelegationStartResult | void | undefined;
            if (delegation?.onDelegationStart) {
              try {
                startResult = await delegation.onDelegationStart(delegationStartContext);
              } catch (hookError) {
                const error = recordHookError('onDelegationStart', hookError, 'onDelegationStart hook error');
                // Fail closed when configured: the delegation never started, so
                // this throws directly rather than routing through
                // onDelegationComplete. Otherwise continue with original values.
                if (hookErrorStrategy === 'throw') {
                  throw new MastraError(
                    {
                      id: 'AGENT_DELEGATION_HOOK_FAILED',
                      domain: ErrorDomain.AGENT,
                      category: ErrorCategory.USER,
                      details: {
                        agentName: this.name,
                        subAgentName: agent.name ?? agent.id,
                        hook: 'onDelegationStart',
                        runId: runId || '',
                      },
                    },
                    error,
                  );
                }
              }
            }

            // Resolve versioned sub-agent if a version override exists on the
            // delegated run's requestContext (inherited from the parent).
            let resolvedAgent = agent;
            const versionOverrides = subAgentRequestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
            const agentVersionSelector =
              versionOverrides?.agents?.[agent.id] ??
              (versionOverrides?.defaultStatus ? { status: versionOverrides.defaultStatus } : undefined);
            if (agentVersionSelector && this.#mastra && agent instanceof Agent) {
              try {
                resolvedAgent = await this.#mastra.resolveVersionedAgent(agent, agentVersionSelector);
              } catch (versionError) {
                this.logger.warn('Failed to resolve versioned sub-agent, using code-defined default', {
                  agent: this.name,
                  targetAgent: agentName,
                  targetAgentId: agent.id,
                  versionSelector: agentVersionSelector,
                  error: versionError,
                });
              }
            }

            // Recompute derived values from the resolved agent (may differ from
            // code-defined agent if a stored version changed the model or defaults)
            const resolvedModelVersion = (await resolvedAgent.getModel({ requestContext: subAgentRequestContext }))
              .specificationVersion;
            const resolvedDefaultOptions =
              'getDefaultOptions' in resolvedAgent
                ? await (resolvedAgent as Agent).getDefaultOptions({ requestContext: subAgentRequestContext })
                : {};
            const resolvedHasOwnMemoryConfig = resolvedDefaultOptions?.memory !== undefined;

            // Propagate parent memory to the resolved agent if it doesn't have its own.
            // This must happen before rejection handling so the rejection path can
            // save messages via resolvedAgent.getMemory().
            if (
              (methodType === 'generate' ||
                methodType === 'generateLegacy' ||
                methodType === 'stream' ||
                methodType === 'streamLegacy') &&
              supportedLanguageModelSpecifications.includes(resolvedModelVersion)
            ) {
              if (!resolvedAgent.hasOwnMemory() && this.#memory) {
                if (resolvedAgent instanceof Agent) {
                  // Pass the memory through the delegated run's context so it applies to
                  // this invocation only. Setting it on the sub-agent would permanently
                  // graft the first supervisor's memory onto an instance that is commonly
                  // a shared singleton reached by other supervisors and by direct
                  // invocations. See issue #21625.
                  subAgentRequestContext.setRaw(MASTRA_INHERITED_MEMORY_KEY, {
                    agentId: resolvedAgent.id,
                    memory: this.#memory,
                  });
                } else {
                  // Custom SubAgent implementations only expose __setMemory, so the
                  // in-place graft is the sole option available for them.
                  this.logger.warn('Injecting supervisor memory into a custom sub-agent instance', {
                    agent: this.name,
                    targetAgent: agentName,
                    targetAgentId: resolvedAgent.id,
                    reason:
                      'Custom SubAgent implementations do not support per-invocation memory inheritance, so the memory is set on the shared instance and persists for its lifetime. Configure memory on the sub-agent to avoid this.',
                  });
                  resolvedAgent.__setMemory(this.#memory as DynamicArgument<MastraMemory, TRequestContext>);
                }
              }
            }

            let effectivePrompt = resolvedPrompt;
            let effectiveInstructions = inputData.instructions;
            let effectiveMaxSteps = inputData.maxSteps;
            // Cap the LLM-provided maxSteps at the sub-agent's own configured
            // default so the supervisor's model can reduce, but never expand,
            // the developer-defined step budget. `onDelegationStart`'s
            // `modifiedMaxSteps` (developer code) below bypasses this cap.
            const subAgentMaxStepsCap = resolvedDefaultOptions?.maxSteps;
            if (
              typeof effectiveMaxSteps === 'number' &&
              typeof subAgentMaxStepsCap === 'number' &&
              effectiveMaxSteps > subAgentMaxStepsCap
            ) {
              this.logger.warn('Delegation maxSteps exceeds sub-agent default, capping', {
                agent: this.name,
                targetAgent: agentName,
                requestedMaxSteps: effectiveMaxSteps,
                cappedMaxSteps: subAgentMaxStepsCap,
              });
              effectiveMaxSteps = subAgentMaxStepsCap;
            }
            // Process the onDelegationStart result captured above (rejection
            // handling needs the resolved model version and memory config)
            if (startResult) {
              // Check if delegation should be rejected
              if (startResult.proceed === false) {
                const rejectionMessage = startResult.rejectionReason || 'Delegation rejected by onDelegationStart hook';
                this.logger.debug('Delegation rejected', {
                  agent: this.name,
                  targetAgent: agentName,
                  reason: rejectionMessage,
                });

                if (
                  (methodType === 'stream' || methodType === 'streamLegacy') &&
                  supportedLanguageModelSpecifications.includes(resolvedModelVersion)
                ) {
                  await context.writer?.write({
                    type: 'text-delta',
                    payload: {
                      id: globalThis.crypto.randomUUID(),
                      text: `[Delegation Rejected] ${rejectionMessage}`,
                    },
                    runId,
                    from: ChunkFrom.AGENT,
                  });
                }

                // Save rejection messages to sub-agent's memory so the UI can display them
                const memory = await resolvedAgent.getMemory({ requestContext: subAgentRequestContext });
                if (memory) {
                  await checkThreadFGA({
                    mastra: this.#mastra,
                    user: subAgentRequestContext.get('user'),
                    threadId: subAgentThreadId,
                    resourceId: subAgentResourceId,
                    agentId: resolvedAgent.id,
                    requestContext: subAgentRequestContext,
                    permission: MastraFGAPermissions.MEMORY_WRITE,
                    actor: invocationActor,
                  });
                  try {
                    // Create user message with the original prompt
                    const userMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || globalThis.crypto.randomUUID(),
                      role: 'user',
                      type: 'text',
                      createdAt: new Date(),
                      threadId: subAgentThreadId,
                      resourceId: subAgentResourceId,
                      content: {
                        format: 2,
                        parts: [
                          {
                            type: 'text',
                            text: effectivePrompt,
                          },
                        ],
                      },
                    };

                    // Create assistant message with the rejection
                    const assistantMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || globalThis.crypto.randomUUID(),
                      role: 'assistant',
                      type: 'text',
                      createdAt: new Date(new Date().getTime() + 1),
                      threadId: subAgentThreadId,
                      resourceId: subAgentResourceId,
                      content: {
                        format: 2,
                        parts: [
                          {
                            type: 'text',
                            text: `[Delegation Rejected] ${rejectionMessage}`,
                          },
                        ],
                      },
                    };

                    await memory.createThread({
                      resourceId: subAgentResourceId,
                      threadId: subAgentThreadId,
                      ...(startResult.threadMetadata ? { metadata: startResult.threadMetadata } : {}),
                    });

                    await memory.saveMessages({
                      messages: [userMessage, assistantMessage],
                    });
                  } catch (memoryError) {
                    this.logger.error('Failed to save rejection to sub-agent memory', {
                      agent: this.name,
                      error: memoryError,
                    });
                  }
                }

                return {
                  text: `[Delegation Rejected] ${rejectionMessage}`,
                  subAgentThreadId,
                  subAgentResourceId,
                };
              }
              // Apply modifications
              if (startResult.modifiedPrompt !== undefined) {
                effectivePrompt = startResult.modifiedPrompt;
              }
              if (startResult.modifiedInstructions !== undefined) {
                effectiveInstructions = startResult.modifiedInstructions;
              }
              if (startResult.modifiedMaxSteps !== undefined) {
                effectiveMaxSteps = startResult.modifiedMaxSteps;
              }
            }

            this.logger.debug('Delegation accepted', {
              agent: this.name,
              targetAgent: agentName,
              modifiedPrompt: effectivePrompt !== resolvedPrompt,
              modifiedInstructions: effectiveInstructions !== inputData.instructions,
              modifiedMaxSteps: effectiveMaxSteps !== inputData.maxSteps,
            });

            // Append LLM-provided instructions to the sub-agent's own instructions
            if (effectiveInstructions) {
              const agentOwnInstructions = await resolvedAgent.getInstructions({
                requestContext: subAgentRequestContext,
              });
              if (agentOwnInstructions) {
                const ownStr = convertInstructionsToString(agentOwnInstructions);
                if (ownStr) {
                  effectiveInstructions = `${ownStr}\n\n${effectiveInstructions}`;
                }
              }
            }

            try {
              this.logger.debug('Executing agent as tool', {
                agent: this.name,
                targetAgent: agentName,
                args: inputData,
                runId,
                threadId,
                resourceId,
              });

              const { resumeData, suspendedToolRunId, suspend } = context?.agent ?? {};

              // Only the framework-resolved context marker can select a suspended sub-agent run.
              // Model-authored resumeData and suspendedToolRunId arguments are not provenance.
              const shouldResumeSubAgent = resumeData !== undefined && !!suspendedToolRunId;
              const subAgentThreadMetadata = shouldResumeSubAgent
                ? undefined
                : (startResult as DelegationStartResult | undefined)?.threadMetadata;

              // Apply messageFilter callback (runs after onDelegationStart so effectivePrompt
              // reflects any hook modifications). Falls back to full context on error.
              let filteredContextMessages = sanitizedMessages;
              if (delegation?.messageFilter) {
                try {
                  filteredContextMessages = await delegation.messageFilter({
                    messages: sanitizedMessages,
                    primitiveId: agent.id,
                    primitiveType: 'agent',
                    prompt: effectivePrompt,
                    iteration: derivedIteration,
                    runId: runId || globalThis.crypto.randomUUID(),
                    threadId,
                    resourceId,
                    parentAgentId: this.id,
                    parentAgentName: this.name,
                    toolCallId,
                  });
                } catch (filterError) {
                  recordHookError('messageFilter', filterError, 'messageFilter error');
                  // Fail closed when configured (handled by the surrounding
                  // catch, which fails the delegation). Otherwise fall back to
                  // the unfiltered context.
                  if (hookErrorStrategy === 'throw') {
                    throw filterError;
                  }
                }
              }

              // Supervisor memory (thread/resource identity) is injected into the sub-agent
              // run only when the parent has thread context and the sub-agent has no memory
              // config of its own. The prompt message format and the memory option passed to
              // generate/stream below must stay in lockstep on this condition.
              const injectSupervisorMemory = Boolean(resourceId && threadId && !resolvedHasOwnMemoryConfig);
              const subAgentMemoryOption = injectSupervisorMemory
                ? {
                    // A resumed delegation must continue on the thread/resource pair the
                    // suspended run persisted, not freshly generated ones. Omitting both
                    // here lets resumeStream/resumeGenerate backfill them from the run
                    // snapshot's memory info (the cast covers the required `thread` field
                    // for that resume-only case). Passing the fresh `subAgentThreadId`
                    // makes the resumed run tag new messages (e.g. writer.custom() data-*
                    // frames) with a thread that doesn't match the snapshot-restored
                    // messageList, which throws on persistence and drops the frames from
                    // the stream (issue #22217). Passing the fresh `subAgentResourceId`
                    // alongside the snapshot-backfilled thread trips thread-ownership
                    // validation, since the thread belongs to the original run's resource.
                    memory: {
                      ...(shouldResumeSubAgent
                        ? {}
                        : {
                            resource: subAgentResourceId,
                            thread: subAgentThreadMetadata
                              ? { id: subAgentThreadId, metadata: subAgentThreadMetadata }
                              : subAgentThreadId,
                          }),
                      options: {
                        lastMessages: false as const,
                        // Title generation is a top-level thread concern. Ephemeral subagent
                        // delegation threads are never surfaced, so suppress it here to avoid
                        // an extra title-generation LLM call per delegation (issue #18738).
                        generateTitle: false,
                      },
                    } as AgentMemoryOption,
                  }
                : {};

              // Build the delegation prompt as a full DB message up front so its ID is
              // stable across every write path. MessageList preserves IDs on DB-format
              // input, so when the sub-agent run itself persists input messages (e.g.
              // observational memory finalizing a turn), the explicit save after the run
              // upserts the same row instead of inserting a duplicate prompt.
              const subAgentUserMessage: MastraDBMessage = {
                id: this.#mastra?.generateId() || globalThis.crypto.randomUUID(),
                role: 'user',
                // New runs let MessageList stamp this after it adds forwarded context.
                // Resume runs neither add the prompt again nor include it in the
                // explicit transcript save (it was persisted by the run that
                // suspended), so the timestamp is just a safety default.
                ...(resumeData ? { createdAt: new Date() } : {}),
                threadId: subAgentThreadId,
                resourceId: subAgentResourceId,
                content: {
                  format: 2,
                  parts: [
                    {
                      type: 'text',
                      text: effectivePrompt,
                    },
                  ],
                },
              } as MastraDBMessage;

              // The sub-agent run receives only the delegation prompt as input; supervisor
              // history is forwarded separately via the `context` option so it reaches the
              // LLM without being persisted to the sub-agent thread. Only pass the pre-built
              // DB message when supervisor memory is injected into the run — otherwise the
              // stamped threadId would conflict with the sub-agent's own memory thread.
              const messagesForSubAgent: MessageListInput = injectSupervisorMemory
                ? [subAgentUserMessage]
                : [{ role: 'user' as const, content: effectivePrompt }];

              // Forward the parent's abortSignal so aborting the supervisor stream/generate cancels
              // in-flight sub-agents. The signal reaches this delegation tool via the tool-execution
              // context; without forwarding it the sub-agent would run with a detached, never-aborted
              // signal and keep looping after the parent is cancelled. See issue #14820.
              const subAgentAbortOptions = context?.abortSignal ? { abortSignal: context.abortSignal } : {};

              if (
                (methodType === 'generate' || methodType === 'generateLegacy') &&
                supportedLanguageModelSpecifications.includes(resolvedModelVersion)
              ) {
                const generateResult = shouldResumeSubAgent
                  ? await resolvedAgent.resumeGenerate(resumeData, {
                      runId: suspendedToolRunId,
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages,
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    })
                  : await resolvedAgent.generate(messagesForSubAgent, {
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages,
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    });

                const agentResponseMessages = generateResult.response.dbMessages ?? [];
                const subAgentToolResults = generateResult.toolResults?.map(toolResult => ({
                  toolName: toolResult.payload.toolName,
                  toolCallId: toolResult.payload.toolCallId,
                  result: toolResult.payload.result,
                  args: toolResult.payload.args,
                  isError: toolResult.payload.isError,
                }));
                // On resume the run continued on the thread persisted by the suspended run
                // (backfilled from the snapshot), so target that thread for the transcript
                // save and skip re-saving the prompt — it was already persisted (with its
                // original ID) by the run that suspended; a fresh copy would duplicate it.
                const resumedGenerateThreadId = shouldResumeSubAgent ? agentResponseMessages[0]?.threadId : undefined;
                const effectiveGenerateThreadId = resumedGenerateThreadId ?? subAgentThreadId;
                // Same for the resource: the restored thread belongs to the suspended run's
                // resource, so persisting or reporting the fresh ID would trip thread
                // ownership again (or mislabel the transcript).
                const effectiveGenerateResourceId =
                  (shouldResumeSubAgent ? agentResponseMessages[0]?.resourceId : undefined) ?? subAgentResourceId;
                fullSubAgentMessages = shouldResumeSubAgent
                  ? agentResponseMessages
                  : [subAgentUserMessage, ...agentResponseMessages];

                // Save response messages to sub-agent's memory so the UI can display them
                const memory = await resolvedAgent.getMemory({ requestContext: subAgentRequestContext });
                if (memory) {
                  await checkThreadFGA({
                    mastra: this.#mastra,
                    user: subAgentRequestContext.get('user'),
                    threadId: effectiveGenerateThreadId,
                    resourceId: effectiveGenerateResourceId,
                    agentId: resolvedAgent.id,
                    requestContext: subAgentRequestContext,
                    permission: MastraFGAPermissions.MEMORY_WRITE,
                    actor: invocationActor,
                  });
                  try {
                    // On resume the thread already exists; re-creating it would overwrite its metadata.
                    if (
                      !shouldResumeSubAgent ||
                      !(await memory.getThreadById({ threadId: effectiveGenerateThreadId }))
                    ) {
                      await memory.createThread({
                        resourceId: effectiveGenerateResourceId,
                        threadId: effectiveGenerateThreadId,
                        ...(subAgentThreadMetadata ? { metadata: subAgentThreadMetadata } : {}),
                      });
                    }

                    await memory.saveMessages({
                      messages: fullSubAgentMessages,
                    });
                  } catch (memoryError) {
                    this.logger.error('Failed to save messages to sub-agent memory', {
                      agent: this.name,
                      error: memoryError,
                    });
                  }
                }

                if (generateResult.finishReason === 'suspended') {
                  return suspend?.(generateResult.suspendPayload, {
                    resumeSchema: generateResult.resumeSchema,
                    runId: generateResult.runId,
                    isAgentSuspend: true,
                    // generate() resolves suspendPayload to the sub-agent's pause chunk payload.
                    ...getDelegatedPauseIdentity(generateResult.suspendPayload),
                  });
                }

                const subAgentPendingToolCalls = getPendingSubAgentToolCalls(
                  generateResult.toolCalls,
                  generateResult.toolResults,
                  agentResponseMessages,
                );
                if (subAgentPendingToolCalls.length > 0) {
                  logPendingSubAgentToolCalls(this.logger, agentName, subAgentPendingToolCalls);
                }

                result = {
                  text: generateResult.text,
                  finishReason: generateResult.finishReason,
                  subAgentThreadId: effectiveGenerateThreadId,
                  subAgentResourceId: effectiveGenerateResourceId,
                  subAgentToolResults,
                  ...(subAgentPendingToolCalls.length > 0 ? { subAgentPendingToolCalls } : {}),
                  usage: generateResult.usage,
                };
              } else if (
                (methodType === 'generate' || methodType === 'generateLegacy') &&
                resolvedModelVersion === 'v1'
              ) {
                if (typeof resolvedAgent.generateLegacy !== 'function') {
                  throw new Error(`Sub-agent ${agent.id} returned a v1 model but does not implement generateLegacy`);
                }
                const generateResult = await resolvedAgent.generateLegacy(messagesForSubAgent, {
                  requestContext: subAgentRequestContext,
                  actor: invocationActor,
                  ...resolveObservabilityContext(context ?? {}),
                  context: filteredContextMessages as CoreMessage[],
                  ...subAgentAbortOptions,
                });
                result = {
                  text: generateResult.text,
                  ...(generateResult.usage ? { usage: generateResult.usage } : {}),
                };
              } else if (
                (methodType === 'stream' || methodType === 'streamLegacy') &&
                supportedLanguageModelSpecifications.includes(resolvedModelVersion)
              ) {
                const subAgentStream = shouldResumeSubAgent
                  ? await resolvedAgent.resumeStream(resumeData, {
                      runId: suspendedToolRunId,
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages,
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    })
                  : await resolvedAgent.stream(messagesForSubAgent, {
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages,
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      // Durable sub-agents keep their stream open across a suspension by
                      // default; end it so the supervisor can suspend with the worker.
                      closeOnSuspend: true,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    });
                // Some sub-agents (e.g. durable stream()) return their MastraModelOutput nested
                // under `output` next to fullStream/runId; others return the output itself.
                const nestedStreamOutput = (subAgentStream as { output?: typeof subAgentStream }).output;
                const streamResult = nestedStreamOutput ?? subAgentStream;

                let requireToolApproval;
                let suspendedPayload;
                let resumeSchema;
                let delegatedPause: DelegatedPauseIdentity = {};
                for await (const chunk of subAgentStream.fullStream) {
                  if (context?.writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up. A durable
                      // sub-agent's run-log index means nothing in the parent's stream.
                      const { index: _childIndex, ...parentChunk } = chunk as any;
                      await context.writer.custom(parentChunk);
                    } else {
                      await context.writer.write(chunk);
                    }
                  }

                  if (chunk.type === 'data-tool-call-approval') {
                    requireToolApproval = (chunk as any).data ?? true;
                    suspendedPayload = {
                      requireToolApproval: (chunk as any).data ?? {},
                    };
                    delegatedPause = getDelegatedPauseIdentity((chunk as any).data);
                  } else if (chunk.type === 'data-tool-call-suspended') {
                    suspendedPayload = chunk.data.suspendPayload;
                    resumeSchema = chunk.data.resumeSchema;
                    delegatedPause = getDelegatedPauseIdentity(chunk.data);
                  } else if (chunk.type === 'tool-call-approval') {
                    requireToolApproval = chunk.payload ?? true;
                    suspendedPayload = {
                      requireToolApproval: chunk.payload ?? {},
                    };
                    delegatedPause = getDelegatedPauseIdentity(chunk.payload);
                  } else if (chunk.type === 'tool-call-suspended') {
                    suspendedPayload = chunk.payload.suspendPayload;
                    resumeSchema = chunk.payload.resumeSchema;
                    delegatedPause = getDelegatedPauseIdentity(chunk.payload);
                  }
                }

                const streamToolResults = await streamResult.toolResults;
                const subAgentToolResults = streamToolResults?.map(toolResult => ({
                  toolName: toolResult.payload.toolName,
                  toolCallId: toolResult.payload.toolCallId,
                  result: toolResult.payload.result,
                  args: toolResult.payload.args,
                  isError: toolResult.payload.isError,
                }));
                // Every response message of the run, including ones the worker already saved to
                // its own memory (e.g. a durable run flushes on finish), not just the unsaved ones.
                const agentResponseMessages = streamResult.messageList.getPersisted.response.db();
                // On resume the run continued on the thread persisted by the suspended run
                // (backfilled from the snapshot), so target that thread for the transcript
                // save and skip re-saving the prompt — it was already persisted (with its
                // original ID) by the run that suspended; a fresh copy would duplicate it.
                const resumedStreamThreadId = shouldResumeSubAgent ? agentResponseMessages[0]?.threadId : undefined;
                const effectiveStreamThreadId = resumedStreamThreadId ?? subAgentThreadId;
                // Same for the resource: the restored thread belongs to the suspended run's
                // resource, so persisting or reporting the fresh ID would trip thread
                // ownership again (or mislabel the transcript).
                const effectiveStreamResourceId =
                  (shouldResumeSubAgent ? agentResponseMessages[0]?.resourceId : undefined) ?? subAgentResourceId;
                fullSubAgentMessages = shouldResumeSubAgent
                  ? agentResponseMessages
                  : [subAgentUserMessage, ...agentResponseMessages];

                // Save response messages to sub-agent's memory so the UI can display them
                const streamMemory = await resolvedAgent.getMemory({ requestContext: subAgentRequestContext });
                if (streamMemory) {
                  await checkThreadFGA({
                    mastra: this.#mastra,
                    user: subAgentRequestContext.get('user'),
                    threadId: effectiveStreamThreadId,
                    resourceId: effectiveStreamResourceId,
                    agentId: resolvedAgent.id,
                    requestContext: subAgentRequestContext,
                    permission: MastraFGAPermissions.MEMORY_WRITE,
                    actor: invocationActor,
                  });
                  try {
                    // On resume the thread already exists; re-creating it would overwrite its metadata.
                    if (
                      !shouldResumeSubAgent ||
                      !(await streamMemory.getThreadById({ threadId: effectiveStreamThreadId }))
                    ) {
                      await streamMemory.createThread({
                        resourceId: effectiveStreamResourceId,
                        threadId: effectiveStreamThreadId,
                        ...(subAgentThreadMetadata ? { metadata: subAgentThreadMetadata } : {}),
                      });
                    }

                    // Apply tool transcript transforms, as the worker's own saves do, so this
                    // same-id re-save can't overwrite redacted rows with raw tool payloads.
                    await streamMemory.saveMessages({
                      messages: streamResult.messageList.transformMessagesForTranscript(fullSubAgentMessages),
                    });
                  } catch (memoryError) {
                    this.logger.error('Failed to save messages to sub-agent memory', {
                      agent: this.name,
                      error: memoryError,
                    });
                  }
                }

                // Use streamResult.text (a delayed promise) which resolves to the
                // output-processor-modified text, rather than the raw accumulated text-deltas.
                const processedText = await streamResult.text;
                const subAgentFinishReason = await streamResult.finishReason;
                const subAgentUsage = await streamResult.usage;
                // Calls that are waiting on approval or suspension also lack results, but
                // those return through suspend() below and never reach the delegation result.
                const isSuspending = !!(requireToolApproval || suspendedPayload || resumeSchema);
                const subAgentPendingToolCalls = isSuspending
                  ? []
                  : getPendingSubAgentToolCalls(await streamResult.toolCalls, streamToolResults, agentResponseMessages);
                if (subAgentPendingToolCalls.length > 0) {
                  logPendingSubAgentToolCalls(this.logger, agentName, subAgentPendingToolCalls);
                }

                result = {
                  text: processedText,
                  finishReason: subAgentFinishReason,
                  subAgentThreadId: effectiveStreamThreadId,
                  subAgentResourceId: effectiveStreamResourceId,
                  subAgentToolResults,
                  ...(subAgentPendingToolCalls.length > 0 ? { subAgentPendingToolCalls } : {}),
                  usage: subAgentUsage,
                };

                // Keep partial results available to the failure hook and saved transcript.
                if (streamResult.error) {
                  throw streamResult.error;
                }

                if (requireToolApproval || suspendedPayload || resumeSchema) {
                  return suspend?.(suspendedPayload, {
                    resumeSchema,
                    requireToolApproval,
                    runId: subAgentStream.runId,
                    isAgentSuspend: true,
                    ...delegatedPause,
                  });
                }
              } else {
                if (typeof resolvedAgent.streamLegacy !== 'function') {
                  throw new Error(`Sub-agent ${agent.id} returned a v1 model but does not implement streamLegacy`);
                }
                const streamResult = await resolvedAgent.streamLegacy(effectivePrompt, {
                  requestContext: subAgentRequestContext,
                  actor: invocationActor,
                  ...resolveObservabilityContext(context ?? {}),
                  ...subAgentAbortOptions,
                });

                let fullText = '';
                for await (const chunk of streamResult.fullStream) {
                  if (context?.writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up. A durable
                      // sub-agent's run-log index means nothing in the parent's stream.
                      const { index: _childIndex, ...parentChunk } = chunk as any;
                      await context.writer.custom(parentChunk);
                    } else {
                      await context.writer.write(chunk);
                    }
                  }

                  if (chunk.type === 'text-delta') {
                    fullText += chunk.textDelta;
                  }
                }

                result = { text: fullText };
              }

              // Note: `usage` is included in `result` for successful generate, generateLegacy,
              // and stream code paths. The `streamLegacy` path accumulates text only and won't
              // have `usage`. Error/rejected delegation callbacks may also omit it.

              // Call onDelegationComplete hook if provided
              if (delegation?.onDelegationComplete) {
                try {
                  let bailed = false;
                  const delegationCompleteContext: DelegationCompleteContext = {
                    primitiveId: agent.id,
                    primitiveType: 'agent',
                    prompt: effectivePrompt,
                    result,
                    duration: Date.now() - startTime,
                    success: result.finishReason !== 'error',
                    iteration: derivedIteration,
                    runId: runId || globalThis.crypto.randomUUID(),
                    toolCallId,
                    parentAgentId: this.id,
                    parentAgentName: this.name,
                    messages: fullSubAgentMessages,
                    bail: () => {
                      bailed = true;
                    },
                  };

                  completeHookInvoked = true;
                  const completeResult = await delegation.onDelegationComplete(delegationCompleteContext);

                  // If bailed, add a marker to the result and signal via requestContext
                  if (bailed) {
                    requestContext.set('__mastra_delegationBailed', true);
                    // A finish reason establishes failure, but not its cause. Thrown
                    // errors take the catch path below, which classifies the actual error.
                    if (result.finishReason === 'error')
                      recordDelegationFailure(requestContext, { outcome: 'error', stopReason: null });
                  }

                  // Apply an in-run replacement for the text the parent model sees,
                  // so the hook can correct a misleading result before the parent reasons on it.
                  if (typeof completeResult?.resultText === 'string') {
                    result = { ...result, text: completeResult.resultText };
                  }

                  // Handle feedback if provided
                  if (completeResult?.feedback) {
                    const feedbackMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || globalThis.crypto.randomUUID(),
                      role: 'assistant',
                      type: 'text',
                      createdAt: new Date(),
                      content: {
                        format: 2,
                        parts: [{ type: 'text', text: completeResult.feedback }],
                        metadata: {
                          mode: 'stream',
                          completionResult: {
                            suppressFeedback: true,
                          },
                        },
                      },
                      threadId,
                      resourceId,
                    };
                    const supervisorMemory = await this.getMemory({ requestContext });
                    if (supervisorMemory && threadId && resourceId) {
                      await checkThreadFGA({
                        mastra: this.#mastra,
                        user: requestContext.get('user'),
                        threadId,
                        resourceId,
                        agentId: this.id,
                        requestContext,
                        permission: MastraFGAPermissions.MEMORY_WRITE,
                        actor: invocationActor,
                      });
                      try {
                        await supervisorMemory.saveMessages({
                          messages: [feedbackMessage],
                        });
                      } catch (memoryError) {
                        this.logger.error('Failed to save feedback to supervisor memory', {
                          agent: this.name,
                          error: memoryError,
                        });
                      }
                    }
                  }
                } catch (hookError) {
                  recordHookError('onDelegationComplete', hookError, 'onDelegationComplete hook error');
                  // Fail closed when configured: the surrounding catch turns
                  // this into a tool failure for the parent.
                  if (hookErrorStrategy === 'throw') {
                    throw hookError;
                  }
                }
              }

              // Mint the reference after the hook so a `resultText` replacement is
              // what later delegations receive. Empty or failed results get no ref.
              // Background delegations get none either: the parent already received
              // a placeholder, so a `[ref: …]` marker would never reach its model.
              if (
                refRegistry &&
                !context?.agent?.isBackgroundTask &&
                typeof result?.text === 'string' &&
                result.text.trim() &&
                result.finishReason !== 'error'
              ) {
                result = { ...result, ref: refRegistry.register(agentName, result.text) };
              }
              return result;
            } catch (err) {
              let bailed = false;
              let completeHookError: Error | undefined;
              let failureResultText: string | undefined;
              // Call onDelegationComplete with error if hook is provided.
              // Skipped when the success path already invoked it — including
              // when that invocation is what threw us into this catch.
              if (delegation?.onDelegationComplete && !completeHookInvoked) {
                try {
                  const delegationCompleteContext: DelegationCompleteContext = {
                    primitiveId: agent.id,
                    primitiveType: 'agent',
                    prompt: effectivePrompt,
                    result: result ?? { text: '' },
                    duration: Date.now() - startTime,
                    success: false,
                    error: err instanceof Error ? err : new Error(String(err)),
                    iteration: derivedIteration,
                    runId: runId || globalThis.crypto.randomUUID(),
                    toolCallId,
                    parentAgentId: this.id,
                    parentAgentName: this.name,
                    messages: fullSubAgentMessages,
                    bail: () => {
                      bailed = true;
                    },
                  };

                  const completeResult = await delegation.onDelegationComplete(delegationCompleteContext);

                  if (typeof completeResult?.resultText === 'string') {
                    failureResultText = completeResult.resultText;
                  }

                  if (bailed) {
                    requestContext.set('__mastra_delegationBailed', true);
                    recordDelegationFailure(requestContext, executionFailureTermination(err));
                  }

                  if (completeResult?.feedback) {
                    const feedbackMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || globalThis.crypto.randomUUID(),
                      role: 'assistant',
                      type: 'text',
                      createdAt: new Date(),
                      content: {
                        format: 2,
                        parts: [{ type: 'text', text: completeResult.feedback }],
                        metadata: {
                          mode: 'stream',
                          completionResult: {
                            suppressFeedback: true,
                          },
                        },
                      },
                      threadId,
                      resourceId,
                    };
                    const supervisorMemory = await this.getMemory({ requestContext });
                    if (supervisorMemory && threadId && resourceId) {
                      await checkThreadFGA({
                        mastra: this.#mastra,
                        user: requestContext.get('user'),
                        threadId,
                        resourceId,
                        agentId: this.id,
                        requestContext,
                        permission: MastraFGAPermissions.MEMORY_WRITE,
                        actor: invocationActor,
                      });
                      try {
                        await supervisorMemory.saveMessages({
                          messages: [feedbackMessage],
                        });
                      } catch (memoryError) {
                        this.logger.error('Failed to save feedback to supervisor memory', {
                          agent: this.name,
                          error: memoryError,
                        });
                      }
                    }
                  }
                } catch (hookError) {
                  // Never rethrown, even under `throw`: the original delegation
                  // error is strictly more informative than the hook's, so it
                  // is surfaced below with the hook error attached as detail.
                  completeHookError = recordHookError(
                    'onDelegationComplete',
                    hookError,
                    'onDelegationComplete hook error on failure',
                  );
                }
              }

              const mastraError = new MastraError(
                {
                  id: 'AGENT_AGENT_TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  details: {
                    agentName: this.name,
                    subAgentName: agent.name ?? agent.id,
                    ...(result?.subAgentThreadId
                      ? { subAgentThreadId: result.subAgentThreadId, subAgentResourceId: result.subAgentResourceId }
                      : {}),
                    runId: runId || '',
                    threadId: threadId || '',
                    resourceId: resourceId || '',
                    ...(completeHookError ? { hookError: completeHookError.message } : {}),
                  },
                  text: failureResultText ?? `[Agent:${this.name}] - Failed agent tool execution for ${agentName}`,
                },
                err,
              );
              this.logger.trackException(mastraError);
              throw mastraError;
            }
          },
        });

        // Derive a ToolBackgroundConfig from the sub-agent's tools/config so the
        // parent can dispatch the entire sub-agent invocation as a background task
        // when appropriate.
        const subAgentBackgroundConfig = backgroundTaskEnabled
          ? await this.deriveSubAgentBackgroundConfig(agent, requestContext)
          : undefined;

        const options: ToolOptions = {
          name: `agent-${agentName}`,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: this.#mastra,
          memory: await this.getMemory({ requestContext }),
          agentName: this.name,
          agentId: this.id,
          requestContext,
          model: await getModel(),
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
          backgroundConfig: subAgentBackgroundConfig,
          agentBackgroundConfig: this.#backgroundTasks,
        };

        convertedAgentTools[`agent-${agentName}`] = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
      }
    }

    return convertedAgentTools;
  }

  /**
   * Retrieves and converts workflow tools to CoreTool format.
   * @internal
   */
  private async listWorkflowTools({
    runId,
    threadId,
    resourceId,
    requestContext,
    methodType,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    getModel,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedWorkflowTools: Record<string, CoreTool> = {};
    const workflows = await this.listWorkflows({ requestContext });
    if (Object.keys(workflows).length > 0) {
      for (const [workflowName, workflow] of Object.entries(workflows)) {
        // Build input/output schemas as JSONSchema7 to avoid Zod composition issues
        // when workflow schemas are StandardSchemaWithJSON wrappers (e.g. from storage)
        const inputDataJsonSchema: JSONSchema7 = workflow.inputSchema
          ? standardSchemaToJSONSchema(workflow.inputSchema, { io: 'input' })
          : { type: 'object', additionalProperties: true };

        const inputProperties: Record<string, JSONSchema7> = {
          inputData: inputDataJsonSchema,
        };
        const inputRequired = ['inputData'];

        if (workflow.stateSchema) {
          inputProperties.initialState = standardSchemaToJSONSchema(workflow.stateSchema, { io: 'input' });
        }

        const extendedInputSchema: JSONSchema7 = {
          type: 'object',
          properties: inputProperties,
          required: inputRequired,
          additionalProperties: true,
        };

        const outputResultProperties: Record<string, JSONSchema7> = {
          runId: { type: 'string', description: 'Unique identifier for the workflow run' },
        };
        if (workflow.outputSchema) {
          outputResultProperties.result = standardSchemaToJSONSchema(workflow.outputSchema, { io: 'output' });
        }

        const outputSchema: JSONSchema7 = {
          anyOf: [
            {
              type: 'object',
              properties: outputResultProperties,
              required: ['runId'],
            },
            {
              type: 'object',
              properties: {
                runId: { type: 'string', description: 'Unique identifier for the workflow run' },
                error: { type: 'string', description: 'Error message if workflow execution failed' },
              },
              required: ['runId', 'error'],
            },
          ],
        };

        const toolObj = createTool({
          id: `workflow-${workflowName}`,
          description: workflow.description || `Workflow: ${workflowName}`,
          inputSchema: extendedInputSchema,
          outputSchema,
          // Advertise suspension so tool-call concurrency gates serialize this tool.
          // Permissive because any suspending step's payload may be forwarded.
          ...(workflowCanSuspend(workflow) ? { suspendSchema: z.any() } : {}),
          mastra: this.#mastra,
          // manually wrap workflow tools with tracing, so that we can pass the
          // current tool span onto the workflow to maintain continuity of the trace
          execute: async (inputData, context) => {
            const invocationActor = getInvocationActor(context);
            const abortSignal = context?.abortSignal;
            const savedMastraMemory = requestContext.get('MastraMemory');
            let runIdToUse: string | undefined;
            try {
              const { initialState, inputData: workflowInputData } = inputData as any;
              const { resumeData, suspendedToolRunId, suspend } = context?.agent ?? {};
              // Use a unique runId for every fresh workflow delegation. Only a run ID
              // resolved by the framework from persisted suspension state may select an
              // existing run; model-authored arguments never control run identity.
              const shouldResumeWorkflow = resumeData !== undefined && !!suspendedToolRunId;
              runIdToUse = shouldResumeWorkflow ? suspendedToolRunId : globalThis.crypto.randomUUID();
              this.logger.debug('Executing workflow as tool', {
                agent: this.name,
                workflow: workflowName,
                description: workflow.description,
                args: inputData,
                runId: runIdToUse,
                threadId,
                resourceId,
              });

              abortSignal?.throwIfAborted();
              const run = await workflow.createRun({ runId: runIdToUse, resourceId });

              // Aborting the tool (parent abort, background cancel or timeout) must stop the run it started.
              if (abortSignal?.aborted) {
                // createRun stored a pending run; cancel it rather than leave it orphaned.
                await run.cancel();
                abortSignal.throwIfAborted();
              }
              const cancelRun = () => {
                // An event listener has no caller to surface a cancel failure to.
                run.cancel().catch(error => {
                  this.logger.error(`Failed to cancel workflow "${workflowName}" run ${run.runId}`, error);
                });
              };
              abortSignal?.addEventListener('abort', cancelRun, { once: true });

              let result: WorkflowResult<any, any, any, any, 1 | 2> | undefined = undefined;
              try {
                if (methodType === 'generate' || methodType === 'generateLegacy') {
                  if (shouldResumeWorkflow) {
                    result = await run.resume({
                      resumeData,
                      requestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                    });
                  } else {
                    result = await run.start({
                      inputData: workflowInputData,
                      requestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(initialState && { initialState }),
                    });
                  }
                } else if (methodType === 'streamLegacy') {
                  const streamResult = run.streamLegacy({
                    inputData: workflowInputData,
                    requestContext,
                    actor: invocationActor,
                    ...resolveObservabilityContext(context ?? {}),
                  });

                  if (context?.writer) {
                    await streamResult.stream.pipeTo(context.writer);
                  } else {
                    for await (const _chunk of streamResult.stream) {
                      // complete the stream
                    }
                  }

                  result = await streamResult.getWorkflowState();
                } else if (methodType === 'stream') {
                  const streamResult = shouldResumeWorkflow
                    ? run.resumeStream({
                        resumeData,
                        requestContext,
                        actor: invocationActor,
                        ...resolveObservabilityContext(context ?? {}),
                      })
                    : run.stream({
                        inputData: workflowInputData,
                        requestContext,
                        actor: invocationActor,
                        ...resolveObservabilityContext(context ?? {}),
                        ...(initialState && { initialState }),
                      });

                  if (context?.writer) {
                    await streamResult.fullStream.pipeTo(context.writer);
                  }

                  result = await streamResult.result;
                }
              } finally {
                abortSignal?.removeEventListener('abort', cancelRun);
              }
              // A run cancelled by the abort has no result for the model; report the abort itself.
              abortSignal?.throwIfAborted();

              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }

              if (result?.status === 'success') {
                const workflowOutput = result.result || { ...result, steps: await loadStepResults(result.steps) };
                return { result: workflowOutput, runId: run.runId };
              } else if (result?.status === 'failed') {
                const workflowOutputError = result?.error;
                return {
                  error: workflowOutputError?.message || String(workflowOutputError) || 'Workflow execution failed',
                  runId: run.runId,
                };
              } else if (result?.status === 'suspended') {
                const suspendedStep = result?.suspended?.[0]?.[0]!;
                // A storage v2 result's `steps` is a loader; it holds the suspended results without reading storage.
                const steps = typeof result.steps === 'function' ? residentStepResults(result.steps) : result.steps;
                const suspendPayload = steps?.[suspendedStep]?.suspendPayload;
                const suspendedStepIds = result?.suspended?.map(stepPath => stepPath.join('.'));
                const firstSuspendedStepPath = [...(result?.suspended?.[0] ?? [])];
                let wflowStep = workflow;
                while (firstSuspendedStepPath.length > 0) {
                  const key = firstSuspendedStepPath.shift();
                  if (key) {
                    if (!wflowStep.steps[key]) {
                      this.logger.warn('Suspended step not found in workflow', {
                        agent: this.name,
                        step: key,
                        workflow: workflowName,
                      });
                      break;
                    }
                    wflowStep = wflowStep.steps[key] as any;
                  }
                }
                const resumeSchema = (wflowStep as Step<any, any, any, any, any, any>)?.resumeSchema;
                if (suspendPayload?.__workflow_meta) {
                  delete suspendPayload.__workflow_meta;
                }
                // Normalize resumeSchema to StandardSchemaWithJSON before extracting JSON Schema
                const normalizedResumeSchema = resumeSchema ? toStandardSchema(resumeSchema) : undefined;
                return suspend?.(suspendPayload, {
                  resumeLabel: suspendedStepIds,
                  resumeSchema: normalizedResumeSchema
                    ? JSON.stringify(standardSchemaToJSONSchema(normalizedResumeSchema))
                    : undefined,
                  runId: runIdToUse,
                });
              }
              // This is to satisfy the execute fn's return value for typescript
              return {
                error: `Workflow should never reach this path, workflow returned no status`,
                runId: run.runId,
              };
            } catch (err) {
              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }

              // An aborted call is a cancellation, not a workflow failure.
              if (abortSignal?.aborted) throw err;

              const mastraError = new MastraError(
                {
                  id: 'AGENT_WORKFLOW_TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  details: {
                    agentName: this.name,
                    runId: runIdToUse || runId || '',
                    threadId: threadId || '',
                    resourceId: resourceId || '',
                  },
                  text: `[Agent:${this.name}] - Failed workflow tool execution`,
                },
                err,
              );
              this.logger.trackException(mastraError);
              throw mastraError;
            }
          },
        });

        const options: ToolOptions = {
          name: `workflow-${workflowName}`,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: this.#mastra,
          memory: await this.getMemory({ requestContext }),
          agentName: this.name,
          agentId: this.id,
          requestContext,
          model: await getModel(),
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
          agentBackgroundConfig: this.#backgroundTasks,
        };

        const workflowTool = makeCoreTool(toolObj, options, undefined, autoResumeSuspendedTools, backgroundTaskEnabled);
        // Its results are marked `mastra.workflowTool` so tracing can show them (#30219).
        markAgentWorkflowTool(workflowTool);
        convertedWorkflowTools[`workflow-${workflowName}`] = workflowTool;
      }
    }

    return convertedWorkflowTools;
  }

  /**
   * Get tools for execution.
   *
   * This method assembles all tools from various sources (assigned tools, memory tools,
   * toolsets, client tools, agent tools, workflow tools) into a unified CoreTool dictionary.
   *
   * This is useful for durable execution where tools need to be reconstructed from
   * serialized state rather than stored in a registry.
   *
   * @param options - Options for tool assembly
   * @returns A record of tool names to CoreTool instances
   */
  async getToolsForExecution(options: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext?: RequestContext;
    outputWriter?: OutputWriter;
    memoryConfig?: MemoryConfig;
    autoResumeSuspendedTools?: boolean;
    hooks?: ToolHooks;
    delegation?: DelegationConfig;
    methodType?: AgentMethodType;
    backgroundTaskEnabled?: boolean;
    backgroundTaskPolicy?: AgentExecutionOptionsBase<any>['backgroundTaskPolicy'];
    model?: MastraLanguageModel | MastraLegacyLanguageModel;
    /** @internal In-flight run messages, so recovery can restore processor-loaded tools. */
    runMessages?: MastraDBMessage[];
    /** @internal Defaults already evaluated for this invocation. */
    resolvedDefaultOptions?: AgentExecutionOptionsBase<any>;
  }): Promise<Record<string, CoreTool>> {
    const requestContext = options.requestContext ?? new RequestContext();
    const defaultOptions = options.resolvedDefaultOptions ?? (await this.getDefaultOptions({ requestContext }));
    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      { ...withDefinedToolHooks(options), requestContext } as Record<string, unknown>,
    ) as AgentExecutionOptions & typeof options;
    const optionMemory = (options as { memory?: AgentExecutionOptionsBase<any>['memory'] }).memory;
    const mergedMemory = mergedOptions.memory;
    const threadIdFromContext = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;
    const explicitThreadFromArgs = resolveThreadIdFromArgs({
      memory: optionMemory,
      threadId: options.threadId,
      overrideId: threadIdFromContext,
    });
    const defaultThreadFromArgs = resolveThreadIdFromArgs({
      memory: mergedMemory,
      overrideId: threadIdFromContext,
    });
    const resourceIdFromContext = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;

    return this.convertTools({
      toolsets: mergedOptions.toolsets,
      clientTools: mergedOptions.clientTools,
      threadId: explicitThreadFromArgs?.id ?? defaultThreadFromArgs?.id,
      resourceId: resourceIdFromContext || options.resourceId || optionMemory?.resource || mergedMemory?.resource,
      runId: mergedOptions.runId,
      requestContext,
      outputWriter: mergedOptions.outputWriter,
      memoryConfig: options.memoryConfig ?? mergedMemory?.options,
      autoResumeSuspendedTools: mergedOptions.autoResumeSuspendedTools,
      // Use the deep-merged delegation so default callbacks (e.g. messageFilter)
      // survive when callers pass a partial per-call delegation override.
      delegation: mergedOptions.delegation,
      hooks: mergedOptions.hooks,
      methodType: options.methodType ?? 'stream',
      backgroundTaskEnabled: options.backgroundTaskEnabled,
      backgroundTaskPolicy: mergedOptions.backgroundTaskPolicy,
      model: options.model,
      runMessages: options.runMessages,
    });
  }

  /**
   * Assembles all tools from various sources into a unified CoreTool dictionary.
   * @internal
   */
  private async convertTools({
    toolsets,
    clientTools,
    threadId,
    resourceId,
    runId,
    requestContext,
    outputWriter,
    methodType,
    memoryConfig,
    autoResumeSuspendedTools,
    delegation,
    backgroundTaskEnabled,
    backgroundTaskPolicy,
    inputProcessors,
    hooks,
    model,
    runMessages,
    ...rest
  }: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext: RequestContext;
    outputWriter?: OutputWriter;
    methodType: AgentMethodType;
    memoryConfig?: MemoryConfigInternal;
    autoResumeSuspendedTools?: boolean;
    delegation?: DelegationConfig;
    backgroundTaskEnabled?: boolean;
    backgroundTaskPolicy?: {
      allowToolDispatch: boolean;
      allowDelegationDispatch: boolean;
    };
    inputProcessors?: InputProcessorOrWorkflow[];
    hooks?: ToolHooks;
    model?: MastraLanguageModel | MastraLegacyLanguageModel;
    runMessages?: MastraDBMessage[];
  } & Partial<ObservabilityContext>): Promise<Record<string, CoreTool>> {
    const observabilityContext = resolveObservabilityContext(rest);
    let mastraProxy = undefined;
    const logger = this.logger;

    if (this.#mastra) {
      mastraProxy = createMastraProxy({ mastra: this.#mastra, logger });
    }

    // Resolve the effective model lazily, at most once per convertTools call, so every
    // tool source shares a single snapshot instead of re-running the (possibly dynamic)
    // resolver per tool. Sources without tools never resolve it, and a per-call `model`
    // override (e.g. generate({ model })) wins over the configured model for all sources.
    let modelSnapshot: Promise<MastraLanguageModel | MastraLegacyLanguageModel> | undefined;
    const getResolvedModel = () => (modelSnapshot ??= Promise.resolve(model ?? this.getModel({ requestContext })));

    // Tool sources resolve before the first model call; name the slow ones so a trace shows what held the run up.
    const prepareSpan = observabilityContext.tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.GENERIC,
      name: 'agent:prepare-tools',
    });
    const slowSourcesMs: Record<string, number> = {};
    let failedSource: string | undefined;
    const traced = async <T extends object>(source: string, list: () => Promise<T>): Promise<T> => {
      const startedAt = Date.now();
      try {
        return await list();
      } catch (error) {
        failedSource = source;
        throw error;
      } finally {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= SLOW_TOOL_SOURCE_MS) slowSourcesMs[source] = elapsed;
      }
    };

    let allTools: Record<string, CoreTool>;
    try {
      const assignedTools = await traced('assigned', () =>
        this.listAssignedTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          outputWriter,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          model,
          getModel: getResolvedModel,
        }),
      );

      const memoryTools = await traced('memory', () =>
        this.listMemoryTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          memoryConfig,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      const toolsetTools = await traced('toolsets', () =>
        this.listToolsets({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          toolsets: toolsets!,
          outputWriter,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      const clientSideTools = await traced('client', () =>
        this.listClientTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          clientTools: clientTools!,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          model,
          getModel: getResolvedModel,
        }),
      );

      // Preserve `onOutput` and `toModelOutput` from server-declared execute-less
      // tools when the serialized client copy overwrites them below. Normal
      // server-executed tools never hand hooks to client-controlled input. Copy
      // instead of mutating so a future cache inside listClientTools cannot leak
      // hooks across requests.
      const serverDeclaredTools = { ...assignedTools, ...toolsetTools };
      for (const [name, clientSideTool] of Object.entries(clientSideTools)) {
        const serverTool = serverDeclaredTools[name];
        if (!serverTool || serverTool.execute) continue;
        const preserveOnOutput = !clientSideTool.onOutput && typeof serverTool.onOutput === 'function';
        const preserveToModelOutput = !clientSideTool.toModelOutput && typeof serverTool.toModelOutput === 'function';
        if (preserveOnOutput || preserveToModelOutput) {
          clientSideTools[name] = {
            ...clientSideTool,
            ...(preserveOnOutput ? { onOutput: serverTool.onOutput } : {}),
            ...(preserveToModelOutput ? { toModelOutput: serverTool.toModelOutput } : {}),
          };
        }
      }

      const agentTools = await traced('agents', () =>
        this.listAgentTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          methodType,
          ...observabilityContext,
          autoResumeSuspendedTools,
          delegation,
          backgroundTaskEnabled: backgroundTaskPolicy?.allowDelegationDispatch ?? backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      const workflowTools = await traced('workflows', () =>
        this.listWorkflowTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          methodType,
          ...observabilityContext,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      const workspaceTools = await traced('workspace', () =>
        this.listWorkspaceTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      const knowledgeTools = await traced('knowledge', () =>
        this.listKnowledgeTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      const configuredInputProcessors =
        inputProcessors ??
        (await traced('input-processor-config', () => this.listConfiguredInputProcessors(requestContext)));
      const hasOnDemandProcessor = hasOnDemandSkillDiscoveryProcessor(configuredInputProcessors);
      const hasSkillsProcessor = hasEagerSkillsProcessor(configuredInputProcessors);

      const skillTools = await traced('skills', () =>
        this.listSkillTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          suppressEagerSkillTools: hasOnDemandProcessor && !hasSkillsProcessor,
          getModel: getResolvedModel,
        }),
      );

      const browserTools = await traced('browser', () =>
        this.listBrowserTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      const requestResolvedTools = {
        ...assignedTools,
        ...memoryTools,
        ...toolsetTools,
        ...clientSideTools,
        ...agentTools,
        ...workflowTools,
        ...workspaceTools,
        ...knowledgeTools,
        ...skillTools,
        ...browserTools,
      };

      const inputProcessorLoadedTools = await traced('input-processors', () =>
        this.listInputProcessorLoadedTools({
          processors: configuredInputProcessors,
          tools: requestResolvedTools,
          memoryConfig,
          runMessages,
          runId,
          resourceId,
          threadId,
          requestContext,
          ...observabilityContext,
          mastraProxy,
          outputWriter,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          getModel: getResolvedModel,
        }),
      );

      allTools = {
        ...requestResolvedTools,
        ...inputProcessorLoadedTools,
      };
      prepareSpan?.end({
        output: {
          toolCount: Object.keys(allTools).length,
          ...(Object.keys(slowSourcesMs).length > 0 ? { slowSourcesMs } : {}),
        },
      });
    } catch (error) {
      // Covers every tool source and the skill detection between them, so the span never stays open.
      prepareSpan?.error({
        error: error instanceof Error ? error : new Error(String(error)),
        endSpan: true,
        metadata: { ...(failedSource ? { failedSource } : {}), slowSourcesMs },
      });
      throw error;
    }

    const formattedTools = this.formatTools(allTools);
    return this.wrapToolsWithHooks(formattedTools, this.resolveToolHooks(hooks));
  }

  /**
   * Returns the agent's statically-configured tool hooks, if any.
   *
   * @internal Used by dataset experiments to compose item-level tool mocks with
   * the user's configured `beforeToolCall`/`afterToolCall` hooks. Run-level hooks
   * override these via {@link resolveToolHooks}, so callers that need to preserve
   * the configured hooks must read and compose them explicitly.
   */
  getConfiguredToolHooks(): ToolHooks | undefined {
    return this.#hooks;
  }

  private resolveToolHooks(hooks?: ToolHooks): ToolHooks | undefined {
    const runHooks = definedToolHooks(hooks);
    if (!this.#hooks) return runHooks;
    if (!runHooks) return this.#hooks;

    return deepMerge(this.#hooks as Record<string, unknown>, runHooks as Record<string, unknown>) as ToolHooks;
  }

  private wrapToolsWithHooks(tools: Record<string, CoreTool>, hooks?: ToolHooks): Record<string, CoreTool> {
    if (!hooks?.beforeToolCall && !hooks?.afterToolCall) return tools;

    return Object.fromEntries(
      Object.entries(tools).map(([toolName, tool]) => [toolName, this.wrapToolWithHooks(toolName, tool, hooks)]),
    );
  }

  private wrapToolWithHooks(toolName: string, tool: CoreTool, hooks: ToolHooks): CoreTool {
    if (typeof tool.execute !== 'function') return tool;

    const wrapped: CoreTool = {
      ...tool,
      execute: async (input: unknown, context: MastraToolInvocationOptions) => {
        const hookContext = {
          toolName,
          input,
          context,
          metadata: {
            agentId: this.id,
            agentName: this.name,
          },
        };
        const beforeResult = await hooks.beforeToolCall?.(hookContext);
        if (beforeResult?.proceed === false) {
          return beforeResult.output;
        }

        let output: unknown;
        try {
          output = await tool.execute!(input, context);
        } catch (error) {
          await hooks.afterToolCall?.({ ...hookContext, output, error });
          throw error;
        }

        await hooks.afterToolCall?.({ ...hookContext, output });
        return output;
      },
    };
    // The spread drops the non-enumerable exemption marker.
    if (isApprovalExempt(tool)) markApprovalExempt(wrapped);
    return wrapped;
  }

  /**
   * Formats and validates tool names to comply with naming restrictions.
   * @internal
   */
  private formatTools(tools: Record<string, CoreTool>): Record<string, CoreTool> {
    const INVALID_CHAR_REGEX = /[^a-zA-Z0-9_\-]/g;
    const STARTING_CHAR_REGEX = /[a-zA-Z_]/;

    for (const key of Object.keys(tools)) {
      if (tools[key] && (key.length > 63 || key.match(INVALID_CHAR_REGEX) || !key[0]!.match(STARTING_CHAR_REGEX))) {
        let newKey = key.replace(INVALID_CHAR_REGEX, '_');
        if (!newKey[0]!.match(STARTING_CHAR_REGEX)) {
          newKey = '_' + newKey;
        }
        newKey = newKey.slice(0, 63);

        if (tools[newKey]) {
          const mastraError = new MastraError({
            id: 'AGENT_TOOL_NAME_COLLISION',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
              toolName: newKey,
            },
            text: `Two or more tools resolve to the same name "${newKey}". Please rename one of the tools to avoid this collision.`,
          });
          this.logger.trackException(mastraError);
          throw mastraError;
        }

        tools[newKey] = tools[key];
        delete tools[key];
      }
    }

    return tools;
  }

  async #runScorers({
    messageList,
    runId,
    requestContext,
    structuredOutput,
    overrideScorers,
    threadId,
    resourceId,
    memory,
    ...observabilityContext
  }: {
    messageList: MessageList;
    runId: string;
    memory?: MastraMemory;
    requestContext: RequestContext;
    structuredOutput?: boolean;
    overrideScorers?:
      | MastraScorers
      | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig; filter?: ScoringFilter }>;
    threadId?: string;
    resourceId?: string;
  } & ObservabilityContext) {
    let scorers: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig; filter?: ScoringFilter }> =
      {};
    try {
      scorers = overrideScorers
        ? this.resolveOverrideScorerReferences(overrideScorers)
        : await this.listScorers({ requestContext });
    } catch (e) {
      this.logger.warn('Failed to get scorers', { agent: this.name, error: e });
      return;
    }

    if (Object.keys(scorers || {}).length === 0) {
      return;
    }

    const scorerInput: ScorerRunInputForAgent = {
      inputMessages: messageList.getPersisted.input.db(),
      rememberedMessages: messageList.getPersisted.remembered.db(),
      systemMessages: messageList.getSystemMessages(),
      taggedSystemMessages: messageList.getPersisted.taggedSystemMessages,
    };

    let scorerOutput: ScorerRunOutputForAgent;
    try {
      // A resumed run knows the response messages pruned before it suspended by id only.
      scorerOutput = await messageList.getRunResponseMessages(createStoredMessageLoader(memory));
    } catch (e) {
      this.logger.warn('Failed to load run response messages for scorers', { agent: this.name, error: e });
      return;
    }

    for (const [_id, scorerObject] of Object.entries(scorers)) {
      runScorer({
        mastra: this.#mastra ?? this.#ephemeralMastra,
        scorerId: scorerObject.scorer.id,
        scorerObject: scorerObject,
        runId,
        input: scorerInput,
        output: scorerOutput,
        requestContext,
        entity: {
          id: this.id,
          name: this.name,
        },
        source: 'LIVE',
        entityType: 'AGENT',
        structuredOutput: !!structuredOutput,
        threadId,
        resourceId,
        ...observabilityContext,
      });
    }
  }

  /**
   * Resolves scorer name references to actual scorer instances from Mastra.
   * @internal
   */
  private resolveOverrideScorerReferences(
    overrideScorers:
      | MastraScorers
      | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig; filter?: ScoringFilter }>,
  ) {
    const result: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig; filter?: ScoringFilter }> =
      {};
    for (const [id, scorerObject] of Object.entries(overrideScorers)) {
      // If the scorer is a string (scorer name), we need to get the scorer from the mastra instance
      if (typeof scorerObject.scorer === 'string') {
        try {
          if (!this.#mastra) {
            throw new MastraError({
              id: 'AGENT_GENEREATE_SCORER_NOT_FOUND',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
              text: `Mastra not found when fetching scorer. Make sure to fetch agent from mastra.getAgent()`,
            });
          }

          const scorer = this.#mastra.getScorerById(scorerObject.scorer);
          result[id] = { scorer, sampling: scorerObject.sampling, filter: scorerObject.filter };
        } catch (error) {
          this.logger.warn('Failed to get scorer', { agent: this.name, scorer: scorerObject.scorer, error });
        }
      } else {
        result[id] = scorerObject;
      }
    }

    // Only throw if scorers were provided but none could be resolved
    if (Object.keys(result).length === 0 && Object.keys(overrideScorers).length > 0) {
      throw new MastraError({
        id: 'AGENT_GENEREATE_SCORER_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `No scorers found in overrideScorers`,
      });
    }

    return result;
  }

  /**
   * Resolves and prepares model configurations for the LLM.
   * @internal
   */
  private async prepareModels(
    requestContext: RequestContext,
    resolvedSelection?: ResolvedModelSelection,
    resolvedModel?: {
      index: number;
      model: MastraLanguageModel | MastraLegacyLanguageModel;
    },
  ): Promise<Array<AgentModelManagerConfig>> {
    const selection =
      resolvedSelection ??
      (await this.resolveModelSelection(
        this.model as DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks,
        requestContext,
      ));

    if (!Array.isArray(selection)) {
      const resolvedModel = await this.resolveModelConfig(selection, requestContext);
      this.assertSupportsPreparedModels(resolvedModel);

      let headers: Record<string, string> | undefined;
      if (resolvedModel instanceof ModelRouterLanguageModel) {
        headers = (resolvedModel as any).config?.headers;
      }

      return [
        {
          id: 'main',
          model: resolvedModel,
          maxRetries: this.maxRetries ?? 0,
          maxRetriesConfigured: this.#maxRetriesConfigured,
          enabled: true,
          headers,
        },
      ];
    }

    const models = await Promise.all(
      selection.map(async (modelConfig, index) => {
        const model =
          resolvedModel?.index === index
            ? resolvedModel.model
            : await this.resolveModelConfig(modelConfig.model, requestContext);
        this.assertSupportsPreparedModels(model);

        const modelId = modelConfig.id || model.modelId;
        if (!modelId) {
          const mastraError = new MastraError({
            id: 'AGENT_PREPARE_MODELS_MISSING_MODEL_ID',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
            },
            text: `[Agent:${this.name}] - Unable to determine model ID. Please provide an explicit ID in the model configuration.`,
          });
          this.logger.trackException(mastraError);
          throw mastraError;
        }

        // Extract headers from ModelRouterLanguageModel if available
        let routerHeaders: Record<string, string> | undefined;
        if (model instanceof ModelRouterLanguageModel) {
          routerHeaders = (model as any).config?.headers;
        }

        // Disabled entries are filtered out in getLLM(); skip resolving their dynamic
        // fields so a throwing or side-effecting resolver on an unused entry can't
        // break the whole fallback array.
        const isEnabled = modelConfig.enabled ?? true;
        const [resolvedModelSettings, resolvedProviderOptions, resolvedUserHeaders] = isEnabled
          ? await Promise.all([
              this.resolveFallbackDynamic(modelConfig.modelSettings, requestContext),
              this.resolveFallbackDynamic(modelConfig.providerOptions, requestContext),
              this.resolveFallbackDynamic(modelConfig.headers, requestContext),
            ])
          : [undefined, undefined, undefined];

        const mergedHeaders =
          routerHeaders || resolvedUserHeaders
            ? { ...(routerHeaders ?? {}), ...(resolvedUserHeaders ?? {}) }
            : undefined;

        return {
          id: modelId,
          model: model,
          maxRetries: modelConfig.maxRetries ?? 0,
          maxRetriesConfigured: modelConfig.maxRetriesConfigured,
          enabled: isEnabled,
          headers: mergedHeaders,
          modelSettings: resolvedModelSettings,
          providerOptions: resolvedProviderOptions,
        };
      }),
    );

    return models;
  }

  /** @internal */
  private async resolveFallbackDynamic<T>(
    value: DynamicArgument<T> | undefined,
    requestContext: RequestContext,
  ): Promise<T | undefined> {
    if (value === undefined) return undefined;
    return await resolveDynamicArgument(value, { requestContext, mastra: this.#mastra });
  }

  /**
   * Loads the agentic-loop workflow snapshot for resume, or throws an actionable error.
   * Used by resumeStream and resumeGenerate to fail fast at the agent boundary.
   * @internal
   */
  #throwIfRunAborted(runId: string) {
    if (agentThreadStreamRuntime.isResumeFenced(runId, this.getPubSub())) {
      throw new MastraError({
        id: 'AGENT_RESUME_ABORTED_RUN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" cannot resume aborted run "${runId}".`,
        details: { agentName: this.name, runId },
      });
    }
  }

  async #loadAgenticLoopSnapshotOrThrow({ runId, method }: { runId: string; method: string }) {
    this.#throwIfRunAborted(runId);
    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const workflowsStore = await effectiveMastra?.getStorage()?.getStore('workflows');
    let claimedThenFinished = false;
    const existingSnapshot = await waitForSuspendedSnapshot(workflowsStore, 'agentic-loop', runId, {
      missingSnapshotGraceReads: 3,
      onClaimedRunFinished: () => {
        claimedThenFinished = true;
      },
    });

    // The run was claimed by another resume while we waited, then finished and was cleaned up.
    if (claimedThenFinished) throw alreadyClaimedResumeError({ agentName: this.name, method, runId });

    if (!existingSnapshot) {
      const hasStorage = !!workflowsStore;
      throw new MastraError({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" ${method}() could not find a suspended run for runId "${runId}". ` +
          (hasStorage
            ? `The run has already finished (for example, an earlier approval or resume already handled it), never suspended, or the runId is invalid. `
            : `No storage is configured on this Mastra instance, so workflow snapshots can't be persisted. Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL). See https://mastra.ai/docs/storage. `) +
          `Ensure you are calling ${method}() only with a runId from a currently-suspended run.`,
        details: {
          runId,
          agentName: this.name,
          hasStorage,
        },
      });
    }

    return existingSnapshot;
  }

  #getSnapshotMemoryInfo(existingSnapshot: WorkflowRunState | null | undefined): AgentSnapshotMemoryInfo | undefined {
    // Canonical extraction shared with storage adapters — see
    // `getSnapshotMemoryInfo` in storage/domains/workflows/snapshot-memory-info.ts.
    return getSnapshotMemoryInfo(existingSnapshot);
  }

  #getSnapshotAgentId(existingSnapshot: WorkflowRunState | null | undefined): string | undefined {
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      if (step && step.status === 'suspended' && step.suspendPayload?.__agentId) {
        return step.suspendPayload.__agentId;
      }
    }

    // Durable agentic-loop snapshots persist the owning agent id on the
    // serialized workflow input instead of in suspend payloads.
    const durableAgentId = (existingSnapshot?.context as Record<string, any> | undefined)?.input?.agentId;
    if (typeof durableAgentId === 'string') {
      return durableAgentId;
    }

    return undefined;
  }

  /**
   * Exact stored version id the run was executing when it suspended, if any. Absent for
   * code-defined agents and for snapshots written before version pinning existed.
   */
  #getSnapshotAgentVersionId(existingSnapshot: WorkflowRunState | null | undefined): string | undefined {
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      if (step && step.status === 'suspended' && step.suspendPayload?.__agentVersionId) {
        return step.suspendPayload.__agentVersionId;
      }
    }

    return undefined;
  }

  #getSuspendedToolCalls(existingSnapshot: WorkflowRunState | null | undefined): AgentRunToolCall[] {
    const toolCalls: AgentRunToolCall[] = [];

    const collectFromPayload = (payload: Record<string, any>, stepKey: string) => {
      if (payload.requireToolApproval) {
        toolCalls.push({
          toolCallId: payload.requireToolApproval.toolCallId,
          toolName: payload.requireToolApproval.toolName,
          args: payload.requireToolApproval.args,
          requiresApproval: true,
        });
      } else if (payload.type === 'approval' && payload.toolCallId) {
        // Durable tool-call step suspending a directly approval-gated tool.
        toolCalls.push({
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          args: payload.args,
          requiresApproval: true,
        });
      } else if (payload.toolCallSuspended || payload.toolName || payload.toolCallId) {
        toolCalls.push({
          toolCallId: payload.toolCallId ?? this.#findResumeLabelForStep(existingSnapshot, stepKey),
          toolName: payload.toolName,
          requiresApproval: false,
          suspendPayload: payload.toolCallSuspended,
        });
      }
    };

    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      if (step?.status !== 'suspended') continue;
      const payload = step.suspendPayload;
      if (!payload) continue;

      // A foreach step (e.g. parallel tool calls in the agentic loop) can park several
      // iterations at once, but its step-level suspendPayload only carries the first
      // suspended iteration. The full set lives in `__workflow_meta.foreachOutput`,
      // where each suspended entry keeps its own per-iteration payload — surface every
      // one of them so all pending tool calls are discoverable and resumable.
      const suspendedIterations = this.#getSuspendedForeachIterations(payload);
      if (suspendedIterations.length > 0) {
        for (const iteration of suspendedIterations) {
          collectFromPayload(iteration.suspendPayload, key);
        }
      } else {
        collectFromPayload(payload, key);
      }
    }

    return toolCalls;
  }

  #getSuspendedForeachIterations(
    payload: Record<string, any>,
  ): { status: 'suspended'; suspendPayload: Record<string, any> }[] {
    // The default engine persists foreach aggregation as an array; the evented
    // engine persists it as an object keyed by iteration index.
    const foreachOutput = payload.__workflow_meta?.foreachOutput;
    const entries = Array.isArray(foreachOutput)
      ? foreachOutput
      : foreachOutput && typeof foreachOutput === 'object'
        ? Object.values(foreachOutput)
        : [];
    return entries.filter(
      (entry: any): entry is { status: 'suspended'; suspendPayload: Record<string, any> } =>
        entry?.status === 'suspended' && !!entry.suspendPayload,
    );
  }

  /**
   * Ensures `toolCallId` is suspended in a snapshot for this run, and returns the
   * snapshot that contains that suspension.
   *
   * Immediate auto-approvals (AgentController `allow` policy) can resume the next
   * sequential tool call before the new suspended snapshot replaces the previous
   * one. Polling only for `status === "suspended"` can therefore hand back a stale
   * prior snapshot. Returning the matching snapshot keeps resume hydration aligned
   * with the tool call being approved.
   *
   * @internal
   */
  async #validateSuspendedToolCallTarget({
    snapshot,
    toolCallId,
    runId,
    method,
  }: {
    snapshot: WorkflowRunState;
    toolCallId: string | undefined;
    runId: string;
    method: string;
  }): Promise<WorkflowRunState> {
    if (toolCallId === undefined) return snapshot;

    const suspendedToolCallIds = (currentSnapshot: WorkflowRunState | null | undefined) =>
      this.#getSuspendedToolCalls(currentSnapshot)
        .map(toolCall => toolCall.toolCallId)
        .filter((id): id is string => id !== undefined);
    const isTargetSuspended = (currentSnapshot: WorkflowRunState | null | undefined) =>
      suspendedToolCallIds(currentSnapshot).includes(toolCallId);

    if (isTargetSuspended(snapshot)) return snapshot;

    // The suspension for an approval-gated tool call is written to the nested
    // `executionWorkflow` row first and only later to the parent `agentic-loop`
    // row that resume hydration reads. The `tool-call-approval` chunk is emitted
    // before either row is durable, so a client can approve before the parent row
    // exists. Snapshot write time scales with snapshot size, so a fixed deadline
    // wrongly rejects large, genuinely-suspended runs (issue #22413).
    //
    // Instead of a blind fixed-duration poll of the parent, decide wait-vs-reject
    // from observed persistence: keep waiting for the parent to carry the target
    // suspension while the run is still progressing toward it (the nested row shows
    // the target suspended, or either row is still running), and reject early only
    // when the target is not suspended anywhere AND either a different tool call is
    // suspended (a stale toolCallId, see #19377) or the run has settled.
    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const workflowsStore = await effectiveMastra?.getStorage()?.getStore('workflows');

    // `timedOut` marks a run that may still suspend on the target once its snapshot is durable,
    // so callers can retry it instead of treating the tool call as answered.
    const throwNotSuspended = (timedOut = false): never => {
      throw new MastraError({
        id: 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() cannot resume tool call "${toolCallId}" because it is not suspended.`,
        details: {
          agentName: this.name,
          method,
          runId,
          toolCallId,
          ...(timedOut ? { timedOut } : {}),
        },
      });
    };

    if (!workflowsStore) throwNotSuspended();

    const parentWorkflowNames = ['agentic-loop', DurableStepIds.AGENTIC_LOOP];
    const nestedWorkflowNames = ['executionWorkflow', DurableStepIds.AGENTIC_EXECUTION];
    const loadFirstSnapshot = async (workflowNames: string[]): Promise<WorkflowRunState | null> => {
      for (const workflowName of workflowNames) {
        const loaded = await workflowsStore!.loadWorkflowSnapshot({ workflowName, runId });
        if (loaded) return loaded;
      }
      return null;
    };

    const deadline = Date.now() + RESUME_SUSPEND_DURABILITY_TIMEOUT_MS;
    let pollIntervalMs: number = RESUME_SNAPSHOT_POLL_INTERVAL_MS;
    while (Date.now() < deadline) {
      const parentSnapshot = await loadFirstSnapshot(parentWorkflowNames);
      if (parentSnapshot && isTargetSuspended(parentSnapshot)) {
        // Resume hydration re-runs the agentic-loop workflow, so the returned
        // snapshot must always be the parent row.
        return parentSnapshot;
      }

      const nestedSnapshot = await loadFirstSnapshot(nestedWorkflowNames);

      const targetSuspendedNested = suspendedToolCallIds(nestedSnapshot).includes(toolCallId);
      const runLive = [parentSnapshot, nestedSnapshot].some(s => !!s && RESUME_SNAPSHOT_WAIT_STATUSES.has(s.status));

      // The nested row already carries the target suspension, or a row is still
      // progressing toward it: keep waiting for the parent to become durable.
      // Back off so a slow write does not turn into thousands of snapshot reads.
      if (targetSuspendedNested || runLive) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        pollIntervalMs = Math.min(pollIntervalMs * 2, RESUME_SUSPEND_DURABILITY_MAX_POLL_INTERVAL_MS);
        continue;
      }

      // A different tool call is suspended (stale target), or the run has settled
      // without the target suspended anywhere: this is a genuine rejection.
      throwNotSuspended();
    }

    return throwNotSuspended(true);
  }

  /**
   * Rejects resume data that fails the suspended tool's `resumeSchema` while the run is
   * still suspended. Otherwise the tool-call step hands the validation error to the model,
   * the run finishes and the caller can never resume it with corrected data.
   */
  async #validateToolResumeData({
    snapshot,
    toolCallId,
    resumeData,
    requestContext,
    toolsets,
    clientTools,
    runId,
    method,
  }: {
    snapshot: WorkflowRunState;
    toolCallId: string | undefined;
    resumeData: unknown;
    requestContext: RequestContext | undefined;
    toolsets?: Record<string, Record<string, unknown>>;
    clientTools?: Record<string, unknown>;
    runId: string;
    method: string;
  }): Promise<void> {
    // A run pinned to a stored version resolves that version's tools later; the current
    // agent's schema may differ, so leave validation to the tool-call step.
    if (this.#getSnapshotAgentVersionId(snapshot)) return;

    // Without a toolCallId the target is only certain when exactly one call is suspended.
    const suspended = this.#getSuspendedToolCalls(snapshot);
    const target =
      toolCallId !== undefined
        ? suspended.find(call => call.toolCallId === toolCallId)
        : suspended.length === 1
          ? suspended[0]
          : undefined;
    if (!target?.toolName || target.requiresApproval) return;

    const assigned = (await this.listTools({ requestContext, resolveWebSearch: false })) as Record<string, any>;
    const tools: Record<string, any> = {
      ...assigned,
      ...Object.assign({}, ...Object.values(toolsets ?? {})),
      ...clientTools,
    };
    const tool = tools[target.toolName] ?? Object.values(tools).find(t => t?.id === target.toolName);
    // Tools resolved elsewhere (workspace, processors) keep the tool-call step's validation.
    if (!tool?.resumeSchema) return;
    const validation = validateToolInput(tool.resumeSchema, resumeData, target.toolName);
    if (!validation.error) return;

    throw new MastraError({
      id: 'AGENT_RESUME_INVALID_DATA',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Agent "${this.name}" ${method}() received resume data that does not match the resumeSchema of tool "${target.toolName}". The run is still suspended. ${validation.error.message}`,
      details: { agentName: this.name, method, runId, toolName: target.toolName, toolCallId: target.toolCallId ?? '' },
    });
  }

  /**
   * The intent `recoverResume()` replays: the one persisted by the resume that holds the run's
   * current claim. Whether that claim is abandoned is left to the claim's takeover rules.
   */
  #getRecoverableResumeIntent(snapshot: WorkflowRunState, runId: string) {
    const intent = snapshot.resumeClaimIntent;
    if (intent && RESUME_SNAPSHOT_WAIT_STATUSES.has(snapshot.status) && intent.claimedAt === snapshot.resumeClaimedAt) {
      return intent;
    }
    throw new MastraError({
      id: 'AGENT_RESUME_NOTHING_TO_RECOVER',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Agent "${this.name}" recoverResume() found no resume to recover for run "${runId}". Either no resume has claimed the run, or the claim was taken by a Mastra version that did not persist the resume data. Continue the run with approveToolCall(), declineToolCall(), or resumeStream().`,
      details: { agentName: this.name, runId, status: snapshot.status },
    });
  }

  /**
   * Claims a suspended agentic-loop run for one resume before the resumed loop starts, so
   * concurrent approvals/resumes of the same run (double clicks, client retries, two tabs)
   * cannot both execute the suspended tool. Losers throw `AGENT_RESUME_ALREADY_CLAIMED`.
   *
   * Stores that support atomic updates get compare-and-set transitions that hold across
   * processes, and the resumed run starts from the claimed snapshot. Other stores only get an
   * in-process guard. The `agentic-loop` row moves:
   *
   * - `suspended -> pending` when claimed, stamped with `resumeClaimedAt`.
   * - `pending -> running` in `claim.start()`, right before the resumed run executes. Only one
   *   caller can make this move, so only one resume executes the tool.
   * - back to `suspended` in `claim.release()` when the resume fails before the run executes.
   *
   * A `pending` claim (claimed, never started or released) is abandoned once it was claimed
   * `AGENT_RESUME_CLAIM_STALE_MS` ago. A later resume takes it over and claims the suspension
   * again; a live claimant that loses it this way fails in `start()`.
   *
   * On stores with run fencing, the claim is also held as a run-ownership lease, renewed every
   * `AGENT_RESUME_CLAIM_RENEW_MS` while the resumed run executes. A `running` claim whose lease
   * lapsed (its process died mid-run) is abandoned too, and a later resume takes it over and
   * resumes from the suspended snapshot, so the tool that was in flight runs again. A takeover is
   * one ownership claim on the generation the taker read, so only one taker wins, and the row never
   * goes back to `suspended` while someone may still run it. Without run fencing a `running` claim
   * is never taken over: nothing can tell a dead claimant from a slow one.
   *
   * Every claim write also persists what the resume resumes the run with (`resumeClaimIntent`), so
   * `recoverResume()` can finish a resume whose process died. A recovery passes the `claimedAt` of
   * the intent it replays as `recoverClaimedAt`, and only takes over that exact claim.
   *
   * `claim.release()` is idempotent. The loop calls it when the resumed run ends; resume methods
   * also call it on any failure before or after handing the claim to the loop. It hands the
   * suspension back to later callers only if the resumed run never started executing.
   */
  async #claimSuspendedAgenticLoopRun({
    snapshot,
    runId,
    toolCallId,
    resumeData,
    recoverClaimedAt,
    method,
  }: {
    snapshot: WorkflowRunState;
    runId: string;
    toolCallId: string | undefined;
    resumeData: unknown;
    recoverClaimedAt?: number;
    method: string;
  }): Promise<AgentLoopResumeClaim> {
    const throwAlreadyClaimed = (): never => {
      throw alreadyClaimedResumeError({ agentName: this.name, method, runId, toolCallId });
    };

    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const workflowsStore = await effectiveMastra?.getStorage()?.getStore('workflows');
    // The run may have been aborted while the snapshot was loading or validating; recheck with no await before claiming.
    this.#throwIfRunAborted(runId);

    if (!workflowsStore?.supportsConcurrentUpdates()) {
      if (workflowsStore) {
        this.logger.warn(
          `[Agent:${this.name}] - The configured workflow storage does not support concurrent updates, so concurrent ${method}() calls for run ${runId} are only de-duplicated within this process. Resumes arriving at other processes may execute the suspended tool more than once.`,
        );
      }
      if (inFlightUnclaimedResumes.has(runId)) throwAlreadyClaimed();
      inFlightUnclaimedResumes.add(runId);
      return {
        release: async () => {
          inFlightUnclaimedResumes.delete(runId);
        },
      };
    }

    const claimFrom = (expectedStatus: WorkflowRunStatus | undefined) => {
      const claimedAt = Date.now();
      return workflowsStore.updateWorkflowState({
        workflowName: AGENTIC_LOOP_WORKFLOW_ID,
        runId,
        opts: {
          status: 'pending',
          expectedStatus,
          resumeClaimedAt: claimedAt,
          resumeClaimIntent: { claimedAt, toolCallId, resumeData },
        },
      });
    };
    const claim = () => claimFrom('suspended');
    // A recovery replays one dead claim's intent, so it must not take over any other claim.
    const throwIfNotRecoveredClaim = (current: WorkflowRunState | null | undefined) => {
      if (recoverClaimedAt !== undefined && current?.resumeClaimedAt !== recoverClaimedAt) throwAlreadyClaimed();
    };

    // A probe that fails leaves the claim unleased, which is how a store without fencing behaves.
    const leased = await Promise.resolve()
      .then(() => workflowsStore.supportsRunFencing())
      .catch(() => false);
    // Keyed apart from the run's own id, which workflow and durable-agent executions may fence.
    const ownershipRunId = `${AGENTIC_LOOP_WORKFLOW_ID}:resume-claim:${runId}`;
    let fence: RunFence | undefined;
    const acquireLease = async (opts: { force?: boolean; expectedGeneration?: number }) => {
      const ownerId = globalThis.crypto.randomUUID();
      const result = await workflowsStore.claimRunOwnership({
        runId: ownershipRunId,
        ownerId,
        leaseMs: AGENT_RESUME_CLAIM_STALE_MS,
        ...opts,
      });
      if (result.acquired) fence = { runId: ownershipRunId, generation: result.record.generation, ownerId };
      return result.acquired;
    };
    const renewLease = async () =>
      !!fence && (await workflowsStore.renewRunOwnership({ ...fence, leaseMs: AGENT_RESUME_CLAIM_STALE_MS })).renewed;
    let leaseReleased = false;
    const releaseLease = async () => {
      if (!fence || leaseReleased) return;
      leaseReleased = true;
      try {
        await workflowsStore.releaseRunOwnership(fence);
      } catch (error) {
        this.logger.warn(`[Agent ${this.name}] Failed to release resume claim lease for run ${runId}`, { error });
      }
    };

    let claimed = await claim();
    if (claimed && leased) {
      // Only this caller moved the row out of `suspended`, so the claim is ours: replace whatever
      // lease an earlier resume of this run left behind.
      await acquireLease({ force: true });
    } else if (!claimed && leased) {
      const current = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
      const claimStatus = current?.status;
      const abandoned =
        current?.timestamp === snapshot.timestamp &&
        typeof current.resumeClaimedAt === 'number' &&
        (claimStatus === 'running'
          ? current.resumeLeasedClaimAt === current.resumeClaimedAt
          : claimStatus === 'pending' && Date.now() - current.resumeClaimedAt >= AGENT_RESUME_CLAIM_STALE_MS);
      if (!abandoned) throwAlreadyClaimed();
      throwIfNotRecoveredClaim(current);
      const owner = await workflowsStore.getRunOwnership({ runId: ownershipRunId });
      if (owner?.live) throwAlreadyClaimed();
      // Racing takers read the same generation, so only one of them gets the lease.
      if (!(await acquireLease({ expectedGeneration: owner?.generation ?? 0 }))) throwAlreadyClaimed();
      if (recoverClaimedAt !== undefined) {
        // Another resume may have claimed the run between the read above and taking the lease. Holding
        // the lease, no other resume can claim it now, so this read settles which claim is recovered.
        const held = await workflowsStore
          .loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId })
          .catch(async error => {
            await releaseLease();
            throw error;
          });
        if (held?.status !== claimStatus || held?.resumeClaimedAt !== recoverClaimedAt) {
          await releaseLease();
          throwAlreadyClaimed();
        }
      }

      this.logger.warn(
        claimStatus === 'running'
          ? `[Agent:${this.name}] - Taking over resume claim for run ${runId} whose lease lapsed; the suspended tool call runs again.`
          : `[Agent:${this.name}] - Taking over resume claim for run ${runId} that was not started within ${AGENT_RESUME_CLAIM_STALE_MS}ms.`,
      );
      claimed = await claimFrom(claimStatus);
      if (!claimed) {
        await releaseLease();
        throwAlreadyClaimed();
      }
    } else if (!claimed) {
      const current = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
      const abandoned =
        current?.status === 'pending' &&
        current.timestamp === snapshot.timestamp &&
        typeof current.resumeClaimedAt === 'number' &&
        Date.now() - current.resumeClaimedAt >= AGENT_RESUME_CLAIM_STALE_MS;
      if (!abandoned) throwAlreadyClaimed();
      throwIfNotRecoveredClaim(current);

      // Hand the abandoned suspension back, then claim it like any other. If a concurrent caller
      // re-claimed it in between, this hand-back can only make that caller's `start()` fail; the
      // single `pending -> running` move still lets at most one resume execute.
      this.logger.warn(
        `[Agent:${this.name}] - Taking over resume claim for run ${runId} that was not started within ${AGENT_RESUME_CLAIM_STALE_MS}ms.`,
      );
      await workflowsStore.updateWorkflowState({
        workflowName: AGENTIC_LOOP_WORKFLOW_ID,
        runId,
        opts: { status: 'suspended', expectedStatus: 'pending' },
      });
      if (recoverClaimedAt !== undefined) {
        // The hand-back cannot tell claims apart, so it may have knocked back a newer claim taken
        // since the read above. Recover only if the run still carries the claim that was read.
        const handedBack = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
        throwIfNotRecoveredClaim(handedBack);
      }
      claimed = await claim();
      if (!claimed) throwAlreadyClaimed();
    }

    const claimedAt = claimed!.resumeClaimedAt;
    let claimStatus: 'pending' | 'running' = 'pending';
    let started = false;
    let released = false;

    // Renew the lease while the resumed run executes, so later resumes can tell this live claimant
    // from one whose process died. Stops once the lease is no longer this claim's.
    let renewTimer: ReturnType<typeof setInterval> | undefined;
    let renewing = false;
    const stopRenewing = () => {
      if (renewTimer) clearInterval(renewTimer);
      renewTimer = undefined;
    };
    const renew = async () => {
      if (renewing) return;
      renewing = true;
      try {
        if (!(await renewLease())) stopRenewing();
      } catch (error) {
        this.logger.warn(`[Agent ${this.name}] Failed to renew resume claim lease for run ${runId}`, { error });
      } finally {
        renewing = false;
      }
    };

    const release = async () => {
      stopRenewing();
      if (started || released) {
        await releaseLease();
        return;
      }
      released = true;
      try {
        // Skip when a later resume took this claim over: the suspension is no longer ours.
        const current = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
        if (current?.resumeClaimedAt !== claimedAt) return;
        if (fence && !matchesRunFence(await workflowsStore.getRunOwnership({ runId: ownershipRunId }), fence)) return;
        await workflowsStore.updateWorkflowState({
          workflowName: AGENTIC_LOOP_WORKFLOW_ID,
          runId,
          opts: { status: 'suspended', expectedStatus: claimStatus },
        });
      } catch (error) {
        this.logger.warn(`[Agent ${this.name}] Failed to release resume claim for run ${runId}`, { error });
      } finally {
        await releaseLease();
      }
    };

    // Another resume can claim, run, and re-suspend the run between the validation read and this
    // claim. Every suspend persist rewrites the snapshot timestamp, so a different timestamp means
    // this caller claimed a newer suspension than the one it validated.
    if (claimed!.timestamp !== snapshot.timestamp) {
      await release();
      throwAlreadyClaimed();
    }

    return {
      snapshot,
      start: async () => {
        // A claim whose lease lapsed before it started may have been taken over already.
        if (fence && !(await renewLease())) {
          released = true;
          throwAlreadyClaimed();
        }
        const running = await workflowsStore.updateWorkflowState({
          workflowName: AGENTIC_LOOP_WORKFLOW_ID,
          runId,
          opts: fence
            ? { status: 'running', expectedStatus: 'pending', resumeLeasedClaimAt: claimedAt }
            : { status: 'running', expectedStatus: 'pending' },
        });
        if (!running) {
          // A later resume took this claim over as abandoned; it owns the suspension now.
          released = true;
          await releaseLease();
          throwAlreadyClaimed();
        }
        claimStatus = 'running';
        if (fence && !released) {
          renewTimer = setInterval(() => void renew(), AGENT_RESUME_CLAIM_RENEW_MS);
          renewTimer.unref?.();
        }
      },
      onExecutionStarted: () => {
        started = true;
      },
      release,
    };
  }

  /**
   * Suspend payloads persisted before they carried `toolCallId` only hold the
   * id as the workflow resume label (`resumeLabels[toolCallId] = { stepId }`).
   * Recover it when exactly one label points at the suspended step.
   */
  #findResumeLabelForStep(existingSnapshot: WorkflowRunState | null | undefined, stepId: string): string | undefined {
    const labels = Object.entries(existingSnapshot?.resumeLabels ?? {}).filter(
      ([, target]) => target.stepId === stepId,
    );
    return labels.length === 1 ? labels[0]![0] : undefined;
  }

  #getSuspendedToolInfo(
    existingSnapshot: WorkflowRunState | null | undefined,
    targetToolCallId?: string,
  ): { toolCallId?: string; toolName?: string } | undefined {
    const suspendedToolCalls = this.#getSuspendedToolCalls(existingSnapshot);
    // Several tool calls can be parked at once. Never label an explicitly targeted
    // resume with a sibling if this snapshot predates the target's persistence.
    const info =
      targetToolCallId !== undefined
        ? (suspendedToolCalls.find(toolCall => toolCall.toolCallId === targetToolCallId) ?? {
            toolCallId: targetToolCallId,
            toolName: undefined,
          })
        : suspendedToolCalls[0];
    return info ? { toolCallId: info.toolCallId, toolName: info.toolName } : undefined;
  }

  /**
   * The scopes a suspended network run held. Its run-scoped request context (persisted with the
   * network workflow snapshot) carries the non-identity scopes; its input carries the thread and
   * resource. Returns undefined when no snapshot is stored.
   */
  async #getNetworkSnapshotScopes(runId: string): Promise<AgentScopesSnapshot | undefined> {
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: 'agent-loop-main-workflow', runId });
    if (!snapshot) return undefined;
    const scopes = snapshot.requestContext?.[MASTRA_SCOPES_KEY];
    if (scopes !== undefined && (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string'))) {
      // A malformed persisted set must not be coerced to "no scopes": that would both
      // drop the run's scopes and falsely reject re-supplied ones as additions.
      throw new MastraError({
        id: 'AGENT_SCOPES_INVALID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        // Corrupted persisted state is a system fault, not a caller error: no
        // `details.status`, so server handlers surface it as HTTP 500.
        text: `Agent "${this.name}" resume(${runId}): persisted network run scopes are malformed; expected an array of strings.`,
        details: { agentName: this.name, runId },
      });
    }
    const input = snapshot.context?.input as { threadId?: string; threadResourceId?: string } | undefined;
    return {
      resourceId: input?.threadResourceId,
      threadId: input?.threadId,
      // `network()` records the run's scope set unconditionally ([] included), so a recorded
      // empty set is authoritative: a resume may not add scopes. An ABSENT key marks a run
      // suspended before the scopes upgrade — it adopts the supplied scopes, the same trust
      // posture as a fresh run (identity stays pinned by the snapshot's resource/thread above).
      scopes: Array.isArray(scopes) ? scopes : undefined,
    };
  }

  /** The full scope set a suspended run resolved, persisted beside its stream state. */
  #getSnapshotScopes(existingSnapshot: WorkflowRunState | null | undefined): string[] | undefined {
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      const persisted = step?.status === 'suspended' ? step.suspendPayload?.__resolvedScopes : undefined;
      if (persisted === undefined) continue;
      // Corrupted persisted state is a system fault, not a client error: coercing it to
      // "no scopes" would silently drop the run's scope set and misreport a re-supplied
      // scope as AGENT_SCOPES_CONFLICT. Mirrors the durable resume and network snapshot
      // rehydration guards.
      if (!Array.isArray(persisted)) {
        throw new MastraError({
          id: 'AGENT_SCOPES_INVALID',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: `Agent "${this.name}": persisted run scopes are malformed; expected an array of strings.`,
          details: { agentName: this.name },
        });
      }
      return persisted;
    }
    return undefined;
  }

  /** The run-level `returnScorerData` a suspended run started with, persisted beside its stream state. */
  #getSnapshotReturnScorerData(existingSnapshot: WorkflowRunState | null | undefined): boolean | undefined {
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      const persisted = step?.status === 'suspended' ? step.suspendPayload?.__returnScorerData : undefined;
      if (typeof persisted === 'boolean') return persisted;
    }
    return undefined;
  }

  /**
   * Resolves a run's scopes (see `resolveAgentScopes`) and returns the options the run
   * executes with. When scopes carry `resource:`/`thread:`, `memory` is set from them so
   * every downstream reader sees the same identity. When the run has scopes, the options
   * carry a run-scoped copy of the request context (`deriveAgentRunRequestContext`); the
   * caller's context is never modified. Options without scopes are returned unchanged.
   */
  async #resolveRunScopes<T extends { requestContext?: RequestContext; memory?: AgentMemoryOption }>(
    options: T,
    {
      callScopes,
      defaultScopes,
      existingSnapshot,
      snapshot,
    }: {
      callScopes?: string[];
      defaultScopes?: string[];
      existingSnapshot?: WorkflowRunState | null;
      snapshot?: AgentScopesSnapshot;
    },
  ): Promise<{ options: T; resolved: ResolvedAgentScopes }> {
    const requestContext = options.requestContext ?? new RequestContext();
    const snapshotMemoryInfo = this.#getSnapshotMemoryInfo(existingSnapshot);
    const resumeSnapshot =
      snapshot ??
      (existingSnapshot
        ? {
            resourceId: snapshotMemoryInfo?.resourceId,
            threadId: snapshotMemoryInfo?.threadId,
            // Suspensions persist their scope set unconditionally ([] included), so a recorded
            // empty set is authoritative: a resume may not add scopes. An ABSENT set marks a
            // run suspended before the scopes upgrade — it adopts the supplied scopes, the
            // same trust posture as a fresh run (identity is still pinned by the snapshot's
            // resource/thread above).
            scopes: this.#getSnapshotScopes(existingSnapshot),
          }
        : undefined);
    // A resumed run keeps its suspended scopes, so the Agent's configuration is not consulted.
    const incomingScopes = resumeSnapshot?.scopes
      ? undefined
      : incomingAgentScopes({ requestContext, callScopes, defaultScopes, mastra: this.#mastra });
    const agentScopes = incomingScopes ? await this.getScopes({ requestContext, scopes: incomingScopes }) : undefined;
    const resolved = resolveAgentScopes({
      requestContext,
      agentScopes,
      incomingScopes,
      callScopes,
      memory: options.memory,
      snapshot: resumeSnapshot,
      mastra: this.#mastra,
    });

    return { options: applyResolvedAgentScopes(options, resolved, requestContext), resolved };
  }

  #getAgentExecutionResourceId({
    requestContext,
    memory,
    snapshotMemoryInfo,
  }: {
    requestContext?: RequestContext;
    memory?: AgentExecutionOptionsBase<any>['memory'];
    snapshotMemoryInfo?: AgentSnapshotMemoryInfo;
  }): string | undefined {
    const resourceIdFromContext = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    return resourceIdFromContext || memory?.resource || snapshotMemoryInfo?.resourceId;
  }

  /**
   * Enforce agent-level FGA (`agents:execute`) before running the agent.
   * `protected` so durable/evented subclasses can enforce the same gate before
   * their workflow-based execution (they override the public entry points and
   * would otherwise bypass it).
   */
  protected async requireAgentExecutionFGA({
    requestContext,
    memory,
    runId,
    snapshotMemoryInfo,
    actor,
  }: {
    requestContext?: RequestContext;
    memory?: AgentExecutionOptionsBase<any>['memory'];
    runId?: string;
    snapshotMemoryInfo?: AgentSnapshotMemoryInfo;
    actor?: ActorSignal;
  }): Promise<void> {
    const fgaProvider = this.#mastra?.getServer()?.fga;
    if (!fgaProvider) {
      return;
    }

    const user = requestContext?.get('user');
    const executionResourceId = this.#getAgentExecutionResourceId({ requestContext, memory, snapshotMemoryInfo });
    const { getAgentFGAResourceId, requireFGA } = await import('../auth/ee/fga-check');
    await requireFGA({
      fgaProvider,
      user,
      resource: { type: 'agent', id: getAgentFGAResourceId(this.id) },
      permission: MastraFGAPermissions.AGENTS_EXECUTE,
      requestContext,
      actor,
      context: {
        resourceId: executionResourceId,
      },
      metadata: {
        agentId: this.id,
        agentName: this.name,
        runId,
        executionResourceId,
      },
    });
  }

  /**
   * Lazily build (and cache) an ephemeral in-memory Mastra. A `new Agent(...)`
   * that isn't wired into a Mastra still needs *some* storage for internal
   * snapshot lookups (agentic-loop resume, suspended-run discovery). Reused
   * for every subsequent call on this agent; `__registerMastra(real)` clears
   * it.
   */
  async #getOrCreateEphemeralMastra(): Promise<Mastra> {
    if (this.#ephemeralMastra) {
      return this.#ephemeralMastra;
    }
    // Resolve the Mastra constructor without a static `agent → mastra` runtime
    // edge (see the type-only import at the top of this file). In any app that
    // constructed a Mastra, the holder is already populated and no dynamic
    // import runs; the `await import` is a fallback for standalone agents that
    // never loaded the Mastra module.
    const MastraClass = mastraCtorHolder.ctor ?? (await import('../mastra')).Mastra;
    const ephemeral = new MastraClass({
      logger: false,
      storage: new InMemoryStore(),
      pubsub: new EventEmitterPubSub(),
      // Skip module-level scorer-hook registration: the hook can never resolve
      // a scorer on this registry-less instance, and it would pin the whole
      // ephemeral graph against GC for the process lifetime (#19404).
      __ephemeral: true,
    });
    this.#ephemeralMastra = ephemeral;
    return ephemeral;
  }

  /**
   * Executes the agent call, handling tools, memory, and streaming.
   * @internal
   */
  async #prepareAndStartPlainWorkflow<OUTPUT>({
    methodType,
    resumeContext,
    _threadStreamPubSub,
    ...options
  }: InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub }) {
    const threadStreamPubSub = _threadStreamPubSub ?? this.getPubSub();
    const existingSnapshot = resumeContext?.snapshot;
    const snapshotMemoryInfo = this.#getSnapshotMemoryInfo(existingSnapshot);
    const requestContext = options.requestContext || new RequestContext();

    const requestVersions = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
    const mergedVersions = resolveVersionContext(
      requestContext,
      requestVersions,
      this.#mastra?.getVersionOverrides(),
      options,
    );

    // A run that suspended while executing a stored version must resume on *that* version.
    // The exact id was persisted into the suspend payload, so prefer it over any status
    // selector, which would otherwise re-resolve to whatever is published now. Kept as a
    // local value: the caller's requestContext keeps its original selector so their later
    // (new) runs still hot-switch.
    const pinnedVersionId =
      existingSnapshot &&
      (() => {
        const snapshotAgentId = this.#getSnapshotAgentId(existingSnapshot);
        // Sub-agent suspensions carry the sub-agent's id/version; those must not pin the root.
        if (snapshotAgentId && snapshotAgentId !== this.id) return undefined;
        return this.#getSnapshotAgentVersionId(existingSnapshot);
      })();

    // Resolve a versioned variant of *this* agent when a version override
    // selects it (by id or defaultStatus) and delegate execution to it. This
    // keeps direct programmatic calls consistent with HTTP routes and
    // sub-agent delegation, which already honor version overrides.
    if ((mergedVersions || pinnedVersionId) && !this.#storedVersionApplied && this.#mastra) {
      const callSiteSelector = options.versions?.agents?.[this.id];
      const selfVersionSelector =
        // An explicit exact version at the call site is an operator escape hatch and wins
        // over the pin; status selectors and defaults do not.
        (callSiteSelector && 'versionId' in callSiteSelector ? callSiteSelector : undefined) ??
        (pinnedVersionId ? { versionId: pinnedVersionId } : undefined) ??
        mergedVersions?.agents?.[this.id] ??
        (mergedVersions?.defaultStatus ? { status: mergedVersions.defaultStatus } : undefined);
      if (selfVersionSelector) {
        try {
          const resolved = await this.#mastra.resolveVersionedAgent(this as unknown as Agent, selfVersionSelector);
          if (resolved !== (this as unknown as Agent)) {
            // Cast: reassembled options are exactly this method's input. The
            // `unknown` annotation breaks the circular return-type inference
            // of the self-recursion (TS7023).
            const delegated: unknown = (resolved as unknown as this).#prepareAndStartPlainWorkflow<OUTPUT>({
              methodType,
              resumeContext,
              _threadStreamPubSub,
              ...options,
              requestContext,
            } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub });
            return delegated as never;
          }
        } catch (versionError) {
          this.logger.warn('Failed to resolve versioned agent for direct call, using code-defined default', {
            agent: this.name,
            agentId: this.id,
            versionSelector: selfVersionSelector,
            error: versionError,
          });
        }
      }
    }

    // Resolve workspace early so we can get browser from it if needed
    const earlyWorkspace = await this.getWorkspace({ requestContext });

    // Inject browser context for BrowserContextProcessor
    // Check both agent's browser (SDK providers) and workspace's browser (CLI providers)
    const browser = this.#browser ?? earlyWorkspace?.browser;
    if (browser && !requestContext.has('browser')) {
      // Get threadId early for browser context - can come from requestContext, options, or snapshot
      // Normalize memory.thread which can be a string or { id, ... } object
      const memoryThread = options.memory?.thread;
      const memoryThreadId = typeof memoryThread === 'string' ? memoryThread : memoryThread?.id;
      const browserThreadId =
        (requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined) ||
        memoryThreadId ||
        snapshotMemoryInfo?.threadId;

      // Use thread-aware running check to avoid cross-thread state leakage
      // In thread scope, only report running if this specific thread has a session
      const isThreadRunning = browserThreadId
        ? browser.hasThreadSession(browserThreadId) && browser.isBrowserRunning(browserThreadId)
        : browser.isBrowserRunning();

      const getBrowserContextState = async (): Promise<Partial<BrowserContext> | undefined> => {
        const running = browserThreadId
          ? browser.hasThreadSession(browserThreadId) && browser.isBrowserRunning(browserThreadId)
          : browser.isBrowserRunning();
        if (!running) {
          const state = browser.getLastBrowserState(browserThreadId);
          const activeTab = state?.tabs[state.activeTabIndex];
          return {
            isOpen: false,
            currentUrl: activeTab?.url,
            pageTitle: activeTab?.title,
            tabCount: state?.tabs.length,
            closeReason: state?.closeReason,
          };
        }

        try {
          const state = await browser.getBrowserState(browserThreadId);
          const activeTab = state?.tabs[state.activeTabIndex];
          return {
            isOpen: true,
            currentUrl: activeTab?.url ?? (await browser.getCurrentUrl(browserThreadId)) ?? undefined,
            pageTitle: activeTab?.title,
            tabCount: state?.tabs.length,
            activeUrlChangeSource: state?.activeUrlChangeSource,
          };
        } catch {
          return { isOpen: false, closeReason: 'error' };
        }
      };
      const currentBrowserState = await getBrowserContextState();
      const browserCtx: BrowserContext = {
        provider: browser.provider,
        providerType: browser.providerType,
        sessionId: browser.getSessionId(browserThreadId),
        headless: browser.headless,
        ...currentBrowserState,
        getState: getBrowserContextState,
        // For CLI providers, include CDP URL so agent can pass it to CLI commands
        // Only expose CDP URL if the thread is actually running to avoid stale endpoints
        cdpUrl:
          browser.providerType === 'cli' && isThreadRunning
            ? (browser.getCdpUrl(browserThreadId) ?? undefined)
            : undefined,
      };
      requestContext.set('browser', browserCtx);
    }

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const threadIdFromContext = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;

    const threadFromArgs = resolveThreadIdFromArgs({
      memory: {
        ...options.memory,
        thread: options.memory?.thread || snapshotMemoryInfo?.threadId,
      },
      overrideId: threadIdFromContext,
    });

    const resourceId = this.#getAgentExecutionResourceId({
      requestContext,
      memory: options.memory,
      snapshotMemoryInfo,
    });
    const memoryConfig = options.memory?.options;

    const llm = (await this.getLLM({
      requestContext,
      model: options.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
    })) as MastraLLMVNext;

    const resolvedModel = llm.getModel();
    const isGatewayModel =
      typeof resolvedModel === 'object' &&
      resolvedModel !== null &&
      'gatewayId' in resolvedModel &&
      resolvedModel.gatewayId === 'mastra';
    // Only warn for ids the caller passed in `memory` args. Reserved request-context ids are set
    // per request (auth middleware, AgentController) and inherited by every agent in that request,
    // including internal memory-less agents such as the OM Observer and Reflector.
    if (
      options.memory?.resource &&
      options.memory?.thread &&
      !this.hasOwnMemory() &&
      !this.#knowledge &&
      !isGatewayModel
    ) {
      this.logger.warn('No memory is configured but resourceId and threadId were passed in args', { agent: this.name });
    }

    // Apply null→undefined transform for OpenAI structured output validation.
    // OpenAI strict mode sends null for optional fields, but schemas like Zod's .optional()
    // reject null. The wrapper transforms null→undefined for non-required fields before
    // validation, working with any schema type (Zod, ArkType, JSON Schema, etc.).
    //
    // Skip when structuredOutput.model is provided because the StructuredOutputProcessor will
    // create its own inner agent call, which will apply its own transform.
    if ('structuredOutput' in options && options.structuredOutput?.schema && !options.structuredOutput?.model) {
      const structuredOutputModel = llm.getModel();
      const targetProvider = structuredOutputModel.provider;
      const targetModelId = structuredOutputModel.modelId;

      if (
        targetProvider.includes('openai') ||
        targetModelId?.includes('openai') ||
        usesOpenAIStrictJsonSchema(
          structuredOutputModel,
          mergeProviderOptions(options.providerOptions, llm.getProviderOptions()),
        )
      ) {
        options = {
          ...options,
          structuredOutput: {
            ...options.structuredOutput,
            schema: wrapSchemaWithNullTransform(options.structuredOutput.schema as any) as any,
          },
        };
      }
    }

    const runId =
      options.runId ||
      this.#mastra?.generateId({
        idType: 'run',
        source: 'agent',
        entityId: this.id,
        threadId: threadFromArgs?.id,
        resourceId,
      }) ||
      globalThis.crypto.randomUUID();
    const keptOutputProcessors = this.#suspendedRunOutputProcessors.get(runId);
    this.#suspendedRunOutputProcessors.delete(runId);
    if (resumeContext && options.outputProcessors === undefined && keptOutputProcessors) {
      options = { ...options, outputProcessors: keptOutputProcessors };
    }
    const instructions = options.instructions || (await this.getInstructions({ requestContext }));
    const mcpServerGuidance = await this.getMcpServerGuidance({
      requestContext,
      toolsets: options.toolsets,
      clientTools: options.clientTools,
    });

    // Set Tracing context
    // Note this span is ended at the end of #executeOnFinish
    // For resumed runs, surface resumeData as the span input and link the resumed
    // span back to the original suspended trace. Mirrors Workflow.resume tracing.
    const isResume = !!resumeContext;
    const suspendedToolInfo = isResume
      ? this.#getSuspendedToolInfo(resumeContext?.snapshot, options.toolCallId)
      : undefined;
    const persistedTracingContext = isResume
      ? (resumeContext?.snapshot?.tracingContext as ResumeTracingContext | undefined)
      : undefined;

    const spanInput = isResume ? buildResumeSpanInput(resumeContext.resumeData, suspendedToolInfo) : options.messages;
    const startingSignal = isResume ? undefined : signalSpanAttributes(options.messages);

    const agentSpan = getOrCreateSpan({
      type: SpanType.AGENT_RUN,
      outcome: null,
      name: `agent run: '${this.id}'${isResume ? ' (resumed)' : ''}`,
      entityType: EntityType.AGENT,
      entityId: this.id,
      entityName: this.name,
      input: spanInput,
      attributes: {
        conversationId: threadFromArgs?.id,
        instructions: convertInstructionsToString(instructions),
        ...modelSpanAttributes(resolvedModel),
        ...(startingSignal ? { signal: startingSignal } : {}),
        // @deprecated — use entityVersionId (top-level span context field) instead.
        // Kept for backward compatibility during migration.
        ...(this.toRawConfig()?.resolvedVersionId
          ? { resolvedVersionId: this.toRawConfig()!.resolvedVersionId as string }
          : {}),
      },
      metadata: {
        runId,
        resourceId,
        threadId: threadFromArgs?.id,
        ...(isResume ? { resumed: true, resumedFromSpanId: persistedTracingContext?.spanId } : {}),
        ...(this.toRawConfig()?.resolvedVersionId
          ? { entityVersionId: this.toRawConfig()!.resolvedVersionId as string }
          : {}),
      },
      tracingPolicy: this.#options?.tracingPolicy,
      tracingOptions: options.tracingOptions,
      tracingContext: options.tracingContext,
      requestContext,
      mastra: this.#mastra,
      resumeFrom: persistedTracingContext,
    });

    const memory = await this.getMemory({ requestContext });
    // Reuse early workspace (resolved earlier for browser context) to avoid
    // duplicate factory resolution which could create different instances
    const workspace = earlyWorkspace;

    const saveQueueManager = new SaveQueueManager({
      logger: this.logger,
      memory,
    });

    // Create a capabilities object with bound methods
    const capabilities = {
      agent: this,
      agentName: this.name,
      logger: this.logger,
      onRunSuspended: () => {
        if (options.outputProcessors?.length) this.#suspendedRunOutputProcessors.set(runId, options.outputProcessors);
      },
      getMemory: this.getMemory.bind(this),
      getModel: this.getModel.bind(this),
      generateMessageId: this.#mastra?.generateId?.bind(this.#mastra) || (() => globalThis.crypto.randomUUID()),
      mastra: this.#mastra,
      _agentNetworkAppend:
        '_agentNetworkAppend' in this
          ? Boolean((this as unknown as { _agentNetworkAppend: unknown })._agentNetworkAppend)
          : undefined,
      convertTools: this.convertTools.bind(this),
      getMemoryMessages: this.getMemoryMessages.bind(this),
      runInputProcessors: this.__runInputProcessors.bind(this),
      executeOnFinish: this.#executeOnFinish.bind(this),
      inputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
      }) => this.listResolvedInputProcessors(requestContext, overrides),
      llmRequestInputProcessors: async ({
        requestContext,
        overrides,
        errorOverrides,
      }: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
        errorOverrides?: ErrorProcessorOrWorkflow[];
      }) => this.listResolvedLLMRequestProcessors(requestContext, overrides, errorOverrides),
      outputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: OutputProcessorOrWorkflow[];
      }) => this.listResolvedOutputProcessors(requestContext, overrides),
      errorProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: ErrorProcessorOrWorkflow[];
      }) => this.__resolveRunErrorProcessors(requestContext, overrides),
      llm,
    };

    const toolPayloadTransform =
      normalizeToolPayloadTransformPolicy(options.transform ?? (options as any).toolPayloadProjection) ??
      this.#toolPayloadTransform ??
      normalizeToolPayloadTransformPolicy(
        this.#mastra?.getToolPayloadTransform?.() ?? (this.#mastra as any)?.getToolPayloadProjection?.(),
      );

    const priorRunRecord = await this.#assertRunIdAvailable(runId, resourceId, {
      resuming: Boolean(resumeContext?.claim),
    });

    // A finished run's log stays on the topic until its cleanup timer fires, so a reused id
    // starts the new run on top of the old frames: a reader replaying from the start would
    // get the previous finish event and close before the new run says anything. Suspended
    // runs keep their log, because that is the history the resume continues.
    if (priorRunRecord?.status === 'finished') {
      await this.__getStreamBus()?.pubsub.clearTopic(AGENT_STREAM_TOPIC(runId));
    }

    const streamPublisher = this.#createStreamPublisher(runId, {
      resourceId,
      threadId: threadFromArgs?.id,
      abortSignal: options.abortSignal,
    });

    // Create the workflow with all necessary context
    const executionWorkflow = createPrepareStreamWorkflow<OUTPUT>({
      capabilities: capabilities as AgentCapabilities,
      // The loop runs under the publisher's signal so a stop request from another reader can reach it. The run's step
      // bookkeeping stays on the signal the runtime prepared, or a lease retake would read the run as idle.
      options: {
        ...options,
        ...(streamPublisher ? { abortSignal: streamPublisher.abortSignal } : {}),
        stepOwner: options.abortSignal,
        methodType,
      } as any,
      threadFromArgs,
      resourceId,
      runId,
      requestContext,
      agentSpan: agentSpan!,
      methodType,
      instructions,
      mcpServerGuidance,
      memoryConfig,
      memory,
      saveQueueManager,
      returnScorerData: options.returnScorerData,
      requireToolApproval: options.requireToolApproval,
      toolCallConcurrency: options.toolCallConcurrency,
      streamPublisher,
      // Resolved to a boolean here, at the one entry point the contract covers, rather
      // than left undefined and defaulted deep in the loop. Anything that reaches the
      // agentic-execution workflow without coming through a regular agent call — the
      // durable steps, a direct `loop()` caller — therefore has to opt in by passing
      // `true`, instead of inheriting the default by omission.
      eagerToolExecution: options.eagerToolExecution ?? true,
      resumeContext,
      agentId: this.id,
      actor: options.actor,
      agentVersionId: this.toRawConfig()?.resolvedVersionId as string | undefined,
      resolvedScopes: options.resolvedScopes,
      agentName: this.name,
      toolCallId: options.toolCallId,
      workspace,
      toolPayloadTransform,
      ...(options.disableBackgroundTasks || options.backgroundTaskPolicy?.allowToolDispatch === false
        ? {}
        : {
            backgroundTaskManager: this.#mastra?.backgroundTaskManager,
            agentBackgroundConfig: this.#backgroundTasks,
          }),
      skipBgTaskWait: options._skipBgTaskWait,
      drainPendingSignals: (runId, scope) =>
        agentThreadStreamRuntime.drainPendingSignals(runId, threadStreamPubSub, scope),
      subscribePendingSignals: (runId, listener) =>
        agentThreadStreamRuntime.subscribePendingSignals(runId, listener, threadStreamPubSub),
    });

    // Register Mastra (if any) on the workflow for storage/observability access.
    // The agent's prepare-stream workflow runs in-process via the default
    // execution engine, so no pubsub workers or internal workflow registration
    // are needed.
    if (this.#mastra) {
      executionWorkflow.__registerMastra(this.#mastra);
    }

    const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });
    try {
      const run = await executionWorkflow.createRun();
      const result = await run.start({ requestContext, actor: options.actor, ...observabilityContext });
      // The loop never started, so its publisher would otherwise stay open.
      if (result.status === 'failed') void streamPublisher?.fail(result.error);
      // A step failure surfaces as a resolved 'failed' result, not a rejection.
      // The stream terminal handlers never ran, so close the span tree here.
      if (result.status !== 'success' && agentSpan && !agentSpan.endTime) {
        if (result.status === 'failed') {
          // The workflow serializes step errors, so result.error may be a
          // plain { message, stack } object rather than an Error instance;
          // MastraError extracts a usable message from any cause shape.
          const raw = result.error as unknown;
          const error =
            raw instanceof Error
              ? raw
              : new MastraError(
                  {
                    id: 'AGENT_PREPARE_STREAM_FAILED',
                    domain: ErrorDomain.AGENT,
                    category: ErrorCategory.SYSTEM,
                    details: { runId },
                  },
                  raw,
                );
          agentSpan.error({ error, ...executionFailureTermination(error), endTree: true });
        } else {
          agentSpan.end({ endTree: true });
        }
      }
      return result;
    } catch (error) {
      // Rejections are not guaranteed to be Error instances; MastraError
      // extracts a usable message from any cause shape.
      const spanError =
        error instanceof Error
          ? error
          : new MastraError(
              {
                id: 'AGENT_PREPARE_STREAM_REJECTED',
                domain: ErrorDomain.AGENT,
                category: ErrorCategory.SYSTEM,
                details: { runId },
              },
              error,
            );
      agentSpan?.error({ error: spanError, ...executionFailureTermination(spanError), endTree: true });
      void streamPublisher?.fail(error);
      throw error;
    }
  }

  /**
   * Handles post-execution tasks including memory persistence and title generation.
   * @internal
   */
  async #executeOnFinish({
    termination,
    result,
    readOnlyMemory,
    thread: threadAfter,
    threadId,
    resourceId,
    memoryConfig,
    outputText,
    requestContext,
    agentSpan,
    runId,
    messageList,
    threadExists,
    structuredOutput = false,
    overrideScorers,
    writer,
    abortSignal,
    onTitleGenerated,
    waitUntil,
  }: AgentExecuteOnFinishOptions) {
    const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });

    const resToLog = {
      text: result.text,
      object: result.object,
      toolResults: result.toolResults,
      toolCalls: result.toolCalls,
      usage: result.usage,
      steps: result.steps.map(s => {
        return {
          stepType: s.stepType,
          text: s.text,
          toolResults: s.toolResults,
          toolCalls: s.toolCalls,
          usage: s.usage,
        };
      }),
    };
    this.logger.debug('Post processing LLM response', {
      agent: this.name,
      runId,
      result: resToLog,
      threadId,
      resourceId,
    });

    const memory = await this.getMemory({ requestContext });
    const memoryRunState = memory ? getMemoryRunState(requestContext, memory, threadId, resourceId) : undefined;
    // re-read the latest thread so metadata written mid-run (working memory, processors) isn't overwritten.
    // This write path stays authoritative and never reads through the run snapshot, which is captured
    // before the run and can't see mid-run metadata writes.
    const thread = (!readOnlyMemory && threadId ? await memory?.getThreadById({ threadId }) : undefined) ?? threadAfter;

    // Add LLM response messages to the list
    // Prefer dbMessages (MastraDBMessage[] with original IDs) over response.messages
    // (ModelMessage[] without IDs) to avoid generating new IDs during format conversion
    let responseMessages: MessageInput[] | undefined = result.response.dbMessages?.length
      ? result.response.dbMessages
      : result.response.messages;
    if ((!responseMessages || responseMessages.length === 0) && result.object) {
      responseMessages = [
        {
          id: result.response.id,
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: outputText, // outputText contains the stringified object
            },
          ],
        },
      ];
    }

    if (responseMessages?.length) {
      messageList.add(responseMessages, 'response');
    }

    if (memory && resourceId && thread && !readOnlyMemory) {
      try {
        // The run snapshot only skips this create when prepare-memory-step already persisted
        // and ownership-validated the thread for this run.
        if (!threadExists && !memoryRunState?.ownershipValidated) {
          await memory.createThread({
            threadId: thread.id,
            metadata: thread.metadata,
            title: thread.title,
            memoryConfig,
            resourceId: thread.resourceId,
          });
        }

        // Generate title if needed
        // Note: Message saving is now handled by MessageHistory output processor
        // Use threadExists to determine if this is the first turn - it's reliable regardless
        // of whether MessageHistory processor is loaded (e.g., when lastMessages is disabled)
        const config = memory.getMergedThreadConfig(memoryConfig);
        const {
          shouldGenerate,
          model: titleModel,
          instructions: titleInstructions,
          minMessages,
          emitEvent,
        } = this.resolveTitleGenerationConfig(
          config?.generateTitle as
            | boolean
            | {
                model?: DynamicArgument<MastraModelConfig, TRequestContext>;
                instructions?: DynamicArgument<string>;
                minMessages?: number;
                emitEvent?: boolean;
              }
            | undefined,
        );

        const uiMessages = messageList.get.all.ui();
        const requiredMessages = minMessages ?? 1;

        if (shouldGenerate && !thread.title) {
          const threadUiMessages = this.filterUiMessagesByThread(messageList, thread.id, uiMessages);

          if (threadUiMessages.length >= requiredMessages) {
            const userMessage = this.getMostRecentUserMessage(threadUiMessages);

            if (userMessage) {
              // Fire-and-forget so generate()/stream() stay fast — unless the caller
              // opted into streaming the title on this run, in which case `finish`
              // waits for persist+emit below. On serverless runtimes that freeze
              // after the response, pass `serverless.waitUntil` so the platform
              // keeps this promise alive (#20682).
              const persistAndEmitPromise = this.genTitle(
                userMessage,
                requestContext,
                observabilityContext,
                titleModel,
                titleInstructions,
                threadUiMessages,
              )
                .then(async title => {
                  if (title) {
                    // Update-only write: the thread may have been deleted while the
                    // title was generating, and an upsert would resurrect it (#25203).
                    const existingThread = await memory.getThreadById({ threadId: thread.id });
                    if (!existingThread) {
                      this.logger.debug('Skipping generated title save: thread was deleted', {
                        threadId: thread.id,
                      });
                      return undefined;
                    }
                    try {
                      await memory.updateThread({ id: thread.id, title, memoryConfig });
                    } catch (error) {
                      // A delete can still land between the check and the update; only swallow that case.
                      if (!(await memory.getThreadById({ threadId: thread.id }))) return undefined;
                      throw error;
                    }

                    if (emitEvent && writer && !abortSignal?.aborted) {
                      try {
                        // Transient chunk: delivered to stream consumers before
                        // `finish`, never persisted to the message history.
                        await writer.custom({
                          type: 'data-thread-title',
                          data: { threadId: thread.id, title },
                          transient: true,
                        });
                      } catch {
                        // The stream may already be closed by the consumer; the
                        // title is still persisted above.
                        this.logger.debug('Failed to emit data-thread-title chunk: stream already closed');
                      }
                    }

                    return title;
                  }
                  return undefined;
                })
                .catch(error => {
                  this.logger.error('Error persisting generated title:', error);
                  return undefined as string | undefined;
                });

              // The user callback runs after persist+emit but never holds `finish`.
              const titlePromise = persistAndEmitPromise
                .then(title => {
                  if (title && typeof onTitleGenerated === 'function') {
                    return onTitleGenerated(title);
                  }
                })
                .catch(error => {
                  this.logger.error('Error in onTitleGenerated callback:', error);
                });

              if (emitEvent && writer && !abortSignal?.aborted) {
                // Hold `finish` until the title is generated, persisted, and emitted
                // so the `data-thread-title` chunk lands before `finish`. An abort
                // during the wait releases `finish` immediately; title generation
                // continues detached and still persists.
                if (abortSignal) {
                  let onAbort: () => void = () => {};
                  const abortedDuringWait = new Promise<'aborted'>(resolve => {
                    onAbort = () => resolve('aborted');
                    if (abortSignal.aborted) {
                      onAbort();
                    } else {
                      abortSignal.addEventListener('abort', onAbort, { once: true });
                    }
                  });
                  try {
                    await Promise.race([persistAndEmitPromise, abortedDuringWait]);
                  } finally {
                    abortSignal.removeEventListener('abort', onAbort);
                  }
                } else {
                  await persistAndEmitPromise;
                }

                if (typeof waitUntil === 'function') {
                  waitUntil(titlePromise);
                } else {
                  void titlePromise;
                }
              } else if (typeof waitUntil === 'function') {
                waitUntil(titlePromise);
              } else {
                void titlePromise;
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof MastraError) {
          throw e;
        }
        const mastraError = new MastraError(
          {
            id: 'AGENT_MEMORY_PERSIST_RESPONSE_MESSAGES_FAILED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.SYSTEM,
            details: {
              agentName: this.name,
              runId: runId || '',
              threadId: threadId || '',
              result: JSON.stringify(resToLog),
            },
          },
          e,
        );
        this.logger.trackException(mastraError);
        throw mastraError;
      }
    }

    await this.#runScorers({
      messageList,
      runId,
      requestContext,
      structuredOutput,
      overrideScorers,
      threadId,
      resourceId,
      memory,
      ...observabilityContext,
    });

    agentSpan?.end({
      ...termination,
      output: {
        text: result.text,
        object: result.object,
        files: result.files,
        ...(result.tripwire ? { tripwire: result.tripwire } : {}),
      },
      ...(result.tripwire
        ? {
            attributes: {
              tripwireAbort: {
                reason: result.tripwire.reason,
                processorId: result.tripwire.processorId,
                retry: result.tripwire.retry,
                metadata: result.tripwire.metadata,
              },
            },
          }
        : {}),
    });
  }

  /**
   * Executes a network loop where multiple agents can collaborate to handle messages.
   * The routing agent delegates tasks to appropriate sub-agents based on the conversation.
   *
   * @experimental
   *
   * @example
   * ```typescript
   * const result = await agent.network('Find the weather in Tokyo and plan an activity', {
   *   memory: {
   *     thread: 'user-123',
   *     resource: 'my-app'
   *   },
   *   maxSteps: 10
   * });
   *
   * for await (const chunk of result.stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async network(
    messages: MessageListInput,
    options?: MultiPrimitiveExecutionOptions<undefined>,
  ): Promise<MastraAgentNetworkStream<undefined>>;
  async network<OUTPUT extends {}>(
    messages: MessageListInput,
    options?: MultiPrimitiveExecutionOptions<OUTPUT>,
  ): Promise<MastraAgentNetworkStream<OUTPUT>>;
  async network<OUTPUT = undefined>(messages: MessageListInput, options?: MultiPrimitiveExecutionOptions<OUTPUT>) {
    const callerRequestContext = options?.requestContext || new RequestContext();

    // Merge default network options with call-specific options
    const defaultNetworkOptions = await this.getDefaultNetworkOptions({ requestContext: callerRequestContext });
    const { options: mergedOptions, resolved: resolvedScopes } = await this.#resolveRunScopes(
      {
        ...defaultNetworkOptions,
        ...options,
        requestContext: callerRequestContext,
        routing: { ...defaultNetworkOptions?.routing, ...options?.routing },
        completion: { ...defaultNetworkOptions?.completion, ...options?.completion },
      },
      { callScopes: options?.scopes, defaultScopes: defaultNetworkOptions?.scopes },
    );
    let requestContextToUse = mergedOptions.requestContext;
    // Persist the run's scope set unconditionally — [] included — so a resume can tell
    // "held no scopes" (recorded [], re-supplied scopes are rejected) from a pre-upgrade
    // snapshot (key absent, supplied scopes are adopted). The derived run context omits
    // the key when the run has no non-identity scopes, so stamp a marked empty set on a
    // copy (never the caller's context) before the workflow run snapshots it. Mirrors
    // prepareForDurableExecution's persisted-entries stamp.
    if (!Array.isArray(requestContextToUse.get(MASTRA_SCOPES_KEY))) {
      const stamped = new RequestContext(Array.from(requestContextToUse.entries())) as typeof requestContextToUse;
      setRunAgentScopes(stamped, []);
      requestContextToUse = stamped;
    }

    const runId = mergedOptions?.runId || this.#mastra?.generateId() || globalThis.crypto.randomUUID();

    // Reserved keys from requestContext take precedence for security (see resolveAgentScopes).
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const { threadId, resourceId } = resolvedScopes;

    return await networkLoop<OUTPUT>({
      networkName: this.name,
      requestContext: requestContextToUse,
      runId,
      routingAgent: this,
      routingAgentOptions: {
        model: mergedOptions?.model,
        modelSettings: mergedOptions?.modelSettings,
        memory: mergedOptions?.memory,
      },
      generateId: context => this.#mastra?.generateId(context) || globalThis.crypto.randomUUID(),
      maxIterations: mergedOptions?.maxSteps || 1,
      messages,
      threadId,
      resourceId,
      validation: mergedOptions?.completion,
      routing: mergedOptions?.routing,
      onIterationComplete: mergedOptions?.onIterationComplete,
      autoResumeSuspendedTools: mergedOptions?.autoResumeSuspendedTools,
      mastra: this.#mastra,
      structuredOutput: mergedOptions?.structuredOutput as OUTPUT extends {} ? StructuredOutputOptions<OUTPUT> : never,
      onStepFinish: mergedOptions?.onStepFinish as NetworkOptions<OUTPUT>['onStepFinish'],
      onError: mergedOptions?.onError,
      onAbort: mergedOptions?.onAbort,
      abortSignal: mergedOptions?.abortSignal,
    });
  }

  /**
   * Resumes a suspended network loop where multiple agents can collaborate to handle messages.
   * The routing agent delegates tasks to appropriate sub-agents based on the conversation.
   *
   * @experimental
   *
   * @example
   * ```typescript
   * const result = await agent.resumeNetwork({ approved: true }, {
   *   runId: 'previous-run-id',
   *   memory: {
   *     thread: 'user-123',
   *     resource: 'my-app'
   *   },
   *   maxSteps: 10
   * });
   *
   * for await (const chunk of result.stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async resumeNetwork(resumeData: any, options: Omit<MultiPrimitiveExecutionOptions, 'runId'> & { runId: string }) {
    const runId = options.runId;
    const callerRequestContext = options?.requestContext || new RequestContext();

    // Merge default network options with call-specific options
    const defaultNetworkOptions = await this.getDefaultNetworkOptions({ requestContext: callerRequestContext });
    const { options: mergedOptions, resolved: resolvedScopes } = await this.#resolveRunScopes(
      {
        ...defaultNetworkOptions,
        ...options,
        requestContext: callerRequestContext,
        routing: { ...defaultNetworkOptions?.routing, ...options?.routing },
        completion: { ...defaultNetworkOptions?.completion, ...options?.completion },
      },
      {
        callScopes: options?.scopes,
        defaultScopes: defaultNetworkOptions?.scopes,
        // Without a stored snapshot at all there is nothing to resume against, so a resume
        // may not add scopes. Key-absent-on-snapshot (pre-upgrade) adopts — see
        // #getNetworkSnapshotScopes.
        snapshot: (await this.#getNetworkSnapshotScopes(runId)) ?? { scopes: [] },
      },
    );
    const requestContextToUse = mergedOptions.requestContext;

    // The snapshot is used only to check re-supplied scopes. Identity comes from scopes when
    // present, else from the reserved keys then memory, as before scopes existed.
    const hasScopeIdentity = (type: 'resource' | 'thread') =>
      resolvedScopes.scopes.some(scope => parseAgentScope(scope)?.type === type);
    const threadId = hasScopeIdentity('thread')
      ? resolvedScopes.threadId
      : (requestContextToUse.get(MASTRA_THREAD_ID_KEY) as string | undefined) ||
        (typeof mergedOptions?.memory?.thread === 'string'
          ? mergedOptions.memory.thread
          : mergedOptions?.memory?.thread?.id);
    const resourceId = hasScopeIdentity('resource')
      ? resolvedScopes.resourceId
      : (requestContextToUse.get(MASTRA_RESOURCE_ID_KEY) as string | undefined) || mergedOptions?.memory?.resource;

    return await networkLoop({
      networkName: this.name,
      requestContext: requestContextToUse,
      runId,
      routingAgent: this,
      routingAgentOptions: {
        model: mergedOptions?.model,
        modelSettings: mergedOptions?.modelSettings,
        memory: mergedOptions?.memory,
      },
      generateId: context => this.#mastra?.generateId(context) || globalThis.crypto.randomUUID(),
      maxIterations: mergedOptions?.maxSteps || 1,
      messages: [],
      threadId,
      resourceId,
      resumeData,
      validation: mergedOptions?.completion,
      routing: mergedOptions?.routing,
      onIterationComplete: mergedOptions?.onIterationComplete,
      autoResumeSuspendedTools: mergedOptions?.autoResumeSuspendedTools,
      mastra: this.#mastra,
      onStepFinish: mergedOptions?.onStepFinish,
      onError: mergedOptions?.onError,
      onAbort: mergedOptions?.onAbort,
      abortSignal: mergedOptions?.abortSignal,
    });
  }

  /**
   * Approves a pending network tool call and resumes execution.
   * Used when `tool.requireApproval` is enabled to allow the agent to proceed with a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.approveNetworkToolCall({
   *   runId: 'pending-run-id'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async approveNetworkToolCall(options: Omit<MultiPrimitiveExecutionOptions, 'runId'> & { runId: string }) {
    return this.resumeNetwork({ approved: true }, options);
  }

  /**
   * Declines a pending network tool call and resumes execution.
   * Used when `tool.requireApproval` is enabled to allow the agent to proceed with a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.declineNetworkToolCall({
   *   runId: 'pending-run-id'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async declineNetworkToolCall(
    options: Omit<MultiPrimitiveExecutionOptions, 'runId'> & { runId: string; reason?: string },
  ) {
    const { reason, ...resumeOptions } = options;
    return this.resumeNetwork({ approved: false, ...(reason !== undefined ? { reason } : {}) }, resumeOptions);
  }

  async #validateRequestContext(requestContext?: RequestContext): Promise<void> {
    if (this.#requestContextSchema) {
      const contextValues = getRequestContextInputValues(requestContext);
      const validation = await this.#requestContextSchema['~standard'].validate(contextValues);
      if (validation.issues) {
        throwAgentRequestContextValidationError({
          issues: validation.issues,
          agentId: this.id,
          agentName: this.name,
        });
      }
    }
  }

  async #resolvePlainRunOptions<OUTPUT>(
    options?: AgentExecutionOptionsBase<OUTPUT> & { model?: DynamicArgument<MastraModelConfig> },
  ) {
    await this.#validateRequestContext(options?.requestContext);
    const defaultOptions = await this.getDefaultOptions({ requestContext: options?.requestContext });
    this.#warnInheritedExecutionOptions(defaultOptions);
    const { options: mergedOptions, resolved: resolvedScopes } = await this.#resolveRunScopes(
      deepMerge(
        withDefaultToolCallConcurrencyLimit(defaultOptions, options) as Record<string, unknown>,
        (withDefinedToolHooks(options) ?? {}) as Record<string, unknown>,
      ) as AgentExecutionOptions<OUTPUT> & { model?: DynamicArgument<MastraModelConfig> },
      { callScopes: options?.scopes, defaultScopes: defaultOptions?.scopes },
    );
    validateModelTimeoutSettings(mergedOptions.modelSettings?.timeout);
    return { mergedOptions, resolvedScopes };
  }

  async #startPlainRun<OUTPUT>(
    messages: MessageListInput,
    mergedOptions: AgentExecutionOptions<OUTPUT> & { model?: DynamicArgument<MastraModelConfig> },
    resolvedScopes: ResolvedAgentScopes,
    methodType: 'generate',
  ): Promise<FullOutput<OUTPUT>>;
  async #startPlainRun<OUTPUT>(
    messages: MessageListInput,
    mergedOptions: AgentExecutionOptions<OUTPUT> & { model?: DynamicArgument<MastraModelConfig> },
    resolvedScopes: ResolvedAgentScopes,
    methodType: 'stream',
  ): Promise<MastraModelOutput<OUTPUT>>;
  async #startPlainRun<OUTPUT>(
    messages: MessageListInput,
    mergedOptions: AgentExecutionOptions<OUTPUT> & { model?: DynamicArgument<MastraModelConfig> },
    resolvedScopes: ResolvedAgentScopes,
    methodType: 'generate' | 'stream',
  ): Promise<FullOutput<OUTPUT> | MastraModelOutput<OUTPUT>> {
    const loopOptions = { ...mergedOptions };
    const actor = mergedOptions.actor;
    delete loopOptions.actor;

    await this.requireAgentExecutionFGA({
      requestContext: mergedOptions.requestContext,
      memory: mergedOptions.memory,
      runId: mergedOptions.runId,
      actor,
    });

    const llm = await this.getLLM({
      requestContext: mergedOptions.requestContext,
      model: mergedOptions.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
    });

    const modelInfo = llm.getModel();

    if (!isSupportedLanguageModel(modelInfo)) {
      const modelId = modelInfo.modelId || 'unknown';
      const provider = modelInfo.provider || 'unknown';
      const specVersion = modelInfo.specificationVersion;

      throw new MastraError({
        id: methodType === 'generate' ? 'AGENT_GENERATE_V1_MODEL_NOT_SUPPORTED' : 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          specVersion === 'v1'
            ? `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with ${methodType}(). Please use AI SDK v5+ models or call the ${methodType}Legacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
            : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6), v4 (AI SDK v7). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details: {
          agentName: this.name,
          modelId,
          provider,
          specificationVersion: specVersion,
        },
      });
    }

    // Reserve the thread before execution so concurrent invocations and signals
    // cannot start a second run before registerRun below.
    const threadStreamPubSub = this.getPubSub();
    mergedOptions.runId ??= resolveRunId(undefined, () =>
      this.#mastra?.generateId({
        idType: 'run',
        source: 'agent',
        entityId: this.id,
      }),
    );
    await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
      this as Agent<any, any, any, any>,
      { ...loopOptions, runId: mergedOptions.runId } as AgentExecutionOptions<OUTPUT>,
      threadStreamPubSub,
    );

    const preparedOptions = agentThreadStreamRuntime.prepareRunOptions(
      { ...loopOptions, runId: mergedOptions.runId, actor } as AgentExecutionOptions<OUTPUT>,
      threadStreamPubSub,
      () => this.#deleteAbortedSuspendedRun(mergedOptions.runId!),
    );

    const executeOptions = {
      ...preparedOptions,
      actor,
      structuredOutput: mergedOptions.structuredOutput
        ? {
            ...mergedOptions.structuredOutput,
            // Convert PublicSchema to StandardSchemaWithJSON at API boundary
            // This follows the same pattern as Tool/Workflow constructors
            schema: toStandardSchema(mergedOptions.structuredOutput.schema),
          }
        : undefined,
      messages,
      resolvedScopes: resolvedScopes.scopes,
      methodType,
      // Use agent's maxProcessorRetries as default, allow options to override
      maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
      _threadStreamPubSub: threadStreamPubSub,
    } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub };

    try {
      const result = await this.#prepareAndStartPlainWorkflow(executeOptions);

      if (result.status !== 'success') {
        if (result.status === 'failed') {
          throw new MastraError(
            {
              id: methodType === 'generate' ? 'AGENT_GENERATE_FAILED' : 'AGENT_STREAM_FAILED',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
            },
            // pass original error to preserve stack trace
            result.error,
          );
        }
        throw new MastraError({
          id: methodType === 'generate' ? 'AGENT_GENERATE_UNKNOWN_ERROR' : 'AGENT_STREAM_UNKNOWN_ERROR',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: 'An unknown error occurred while streaming',
        });
      }

      if (methodType === 'generate' && typeof result.result?.getFullOutput !== 'function') {
        throw new MastraError({
          id: 'AGENT_GENERATE_MALFORMED_RESULT',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: 'Execution workflow produced a result without getFullOutput',
        });
      }

      await agentThreadStreamRuntime.registerRun(
        this as Agent<any, any, any, any>,
        result.result,
        preparedOptions as AgentExecutionOptions<OUTPUT>,
        threadStreamPubSub,
      );

      if (methodType === 'generate') {
        const fullOutput = await result.result.getFullOutput();
        if (fullOutput.error) throw fullOutput.error;
        return fullOutput;
      }
      return result.result;
    } catch (error) {
      // Release the thread reservation taken by waitForCrossAgentThreadRun so
      // a failed setup does not block subsequent runs on this thread.
      agentThreadStreamRuntime.releaseThreadRunReservation(
        mergedOptions.runId,
        threadStreamPubSub,
        {
          agent: this,
          streamOptions: preparedOptions,
        },
        preparedOptions.abortSignal,
      );
      throw error;
    }
  }

  /**
   * Runs the agent to completion and resolves with a {@link FullOutput}: final `text`, every
   * step, all tool calls and results, usage, and `object` when `structuredOutput` is set.
   * Use `stream()` instead to consume output as it is produced.
   *
   * - `messages`: a string, a message object (`{ role, content }`, AI SDK UI/model messages
   *   included), or an array mixing both.
   * - `options`: per-call {@link AgentExecutionOptionsBase} (`maxSteps`, `memory`,
   *   `requestContext`, `modelSettings`, `toolChoice`, ...). They are merged over the
   *   agent's `defaultOptions`.
   * - Tool calls loop until the model stops calling tools or the step limit is hit
   *   (`maxSteps`; 5 steps when neither `maxSteps` nor `stopWhen` is set).
   * - Rejects with the run's error if the run fails.
   * - Tool data is wrapped in `payload`: read `result.toolCalls[i].payload.args` and
   *   `result.toolResults[i].payload.result`.
   *
   * This overload: `structuredOutput.schema` is a schema such as a Zod object, so
   * `result.object` is typed from that schema.
   *
   * @example
   * ```ts
   * const result = await agent.generate('What is the weather in Paris?', { maxSteps: 3 });
   * console.log(result.text);
   * for (const call of result.toolCalls) console.log(call.payload.toolName, call.payload.args);
   * for (const res of result.toolResults) console.log(res.payload.toolName, res.payload.result);
   *
   * const { object } = await agent.generate('List three colors', {
   *   structuredOutput: { schema: z.object({ colors: z.array(z.string()) }) },
   * });
   * ```
   *
   * @see [Agent.generate() reference](https://mastra.ai/reference/agents/generate)
   */
  async generate<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<T>>;
  /**
   * Runs the agent to completion with `structuredOutput`, typing `result.object` as `OUTPUT`.
   * See the first `generate()` overload for full behavior.
   *
   * @see [Agent.generate() reference](https://mastra.ai/reference/agents/generate)
   */
  async generate<OUTPUT extends {}>(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT>>;
  /**
   * Runs the agent to completion with per-call options and no `structuredOutput`; resolves
   * with a {@link FullOutput} (`text`, `steps`, `toolCalls`, `toolResults`, `usage`, ...).
   * Tool data is under `payload`, e.g. `result.toolCalls[0].payload.args`.
   * See the first `generate()` overload for full behavior.
   *
   * @see [Agent.generate() reference](https://mastra.ai/reference/agents/generate)
   */
  async generate(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<TOutput>>;
  /**
   * Runs the agent to completion using its `defaultOptions`; resolves with a {@link FullOutput}.
   * `messages` is a string, a message object, or an array of either.
   * See the first `generate()` overload for full behavior.
   *
   * @example
   * ```ts
   * const { text } = await agent.generate('Hello!');
   * ```
   *
   * @see [Agent.generate() reference](https://mastra.ai/reference/agents/generate)
   */
  async generate<OUTPUT = TOutput>(messages: MessageListInput): Promise<FullOutput<OUTPUT>>;
  async generate<OUTPUT = TOutput>(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT> | FullOutput<TOutput>> {
    // Extract and forward any client observability data attached to
    // tool-result messages before they reach the loop/model.
    this.#extractClientObservability(messages);
    this.#beginExecutionPolicy();
    if (this.#resolveExecutionEngine())
      return this.#generateDurable(messages, options as DurableAgentStreamOptions<TOutput>);

    const { mergedOptions, resolvedScopes } = await this.#resolvePlainRunOptions<OUTPUT>(options);
    return this.#startPlainRun(messages, mergedOptions, resolvedScopes, 'generate');
  }

  subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions & { withRunStatus: true; withInitialHistory: true | { perPage?: number } },
  ): Promise<AgentThreadSubscription<OUTPUT, true, true>>;
  subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions & { withRunStatus: true; withInitialHistory?: false },
  ): Promise<AgentThreadSubscription<OUTPUT, false, true>>;
  subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions & { withRunStatus: true },
  ): Promise<AgentThreadSubscription<OUTPUT, boolean, true>>;
  subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions & { withRunStatus?: false; withInitialHistory: true | { perPage?: number } },
  ): Promise<AgentThreadSubscription<OUTPUT, true>>;
  subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions & { withRunStatus?: false; withInitialHistory?: false },
  ): Promise<AgentThreadSubscription<OUTPUT>>;
  subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions & { withRunStatus?: false },
  ): Promise<AgentThreadSubscription<OUTPUT, boolean>>;
  subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions,
  ): Promise<AgentThreadSubscription<OUTPUT, boolean, boolean>>;
  async subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions,
  ): Promise<AgentThreadSubscription<OUTPUT, boolean, boolean>> {
    return agentThreadStreamRuntime.subscribeToThread<OUTPUT>(this.#getThreadRuntimeAgent(), options, this.getPubSub());
  }

  async claimThreadOwnership<OUTPUT = TOutput>(options: {
    resourceId: string;
    threadId: string;
    streamOptions?:
      | AgentExecutionOptions<OUTPUT>
      | (() => AgentExecutionOptions<OUTPUT> | Promise<AgentExecutionOptions<OUTPUT>>);
    peer?: false | AgentClaimThreadPeerOptions;
    /**
     * Called when another process asks to claim this thread. Return `true` to
     * transfer the claim to that requester when leasing is available, or release
     * it on lease-less transports.
     */
    yieldOwnership?: () => boolean;
    /** Called after this claim has been transferred or released for the requester. */
    onOwnershipYielded?: () => void;
    /** Called when lease renewal proves that another live owner has taken this claim. */
    onOwnershipLost?: () => void;
  }): Promise<{ claimed: boolean; unsubscribe: () => void }> {
    return agentThreadStreamRuntime.claimThreadOwnership(
      this.#getThreadRuntimeAgent(),
      options as Parameters<typeof agentThreadStreamRuntime.claimThreadOwnership>[1],
      this.getPubSub(),
    );
  }

  updateThreadPeerAdvertisement(options: {
    resourceId: string;
    threadId: string;
    peer: AgentUpdateThreadPeerOptions;
  }): boolean {
    return agentThreadStreamRuntime.updateThreadPeerAdvertisement(
      this as Agent<any, any, any, any>,
      options,
      this.getPubSub(),
    );
  }

  async discoverThreadPeers(options?: DiscoverAgentThreadPeersOptions): Promise<AgentThreadPeerAdvertisement[]> {
    return agentThreadStreamRuntime.discoverThreadPeers(options, this.getPubSub(), this.#getThreadRuntimeAgent());
  }

  getActiveThreadRunId(options: AgentThreadIdentityOptions): string | undefined {
    return agentThreadStreamRuntime.getActiveThreadRunId(options, this.getPubSub());
  }

  listActiveThreadRuns(): ActiveThreadRun[] {
    return agentThreadStreamRuntime.listActiveThreadRuns(this.getPubSub());
  }

  /**
   * The resource and thread that a `runId`-only `sendSignal`, `sendMessage` or `queueMessage`
   * target resolves to, or undefined when this process doesn't track the run. Servers use it to
   * check that a caller owns the run before sending to it. Core rejects a target whose `resourceId` doesn't own
   * its `runId`, but that is a consistency check, not authorization: Core doesn't know who is calling and trusts a
   * `runId`-only target. Callers that take `runId` from untrusted input must authenticate the caller and compare
   * this owner with the caller's trusted resource before sending.
   */
  getThreadRunTarget(runId: string): { resourceId?: string; threadId: string } | undefined {
    return agentThreadStreamRuntime.getThreadRunTarget(runId, this.getPubSub());
  }

  /**
   * Lists suspended agent runs from workflow snapshot storage — runs waiting on
   * a tool-call approval (`requireApproval` / `requireToolApproval`) or on a
   * tool that called `suspend()`.
   *
   * Unlike {@link getActiveThreadRunId}, which only knows about runs started by the
   * current process, this is backed by storage: it works after a server restart and
   * across multiple server instances. Pass the returned `runId` to `resumeStream()`,
   * `approveToolCall()`, or `declineToolCall()`.
   *
   * Results are scoped to runs started by this agent: snapshots persist the owning
   * agent's id, and runs whose snapshots carry a different id are skipped. Filter by
   * `threadId`/`resourceId` to scope results to a conversation.
   *
   * Storage pagination is offset-based, so concurrent changes or rows with tied sort
   * values can make a multi-page discovery reflect the storage adapter's ordering
   * rather than a transactional snapshot.
   *
   * @example
   * ```typescript
   * const { runs } = await agent.listSuspendedRuns({ threadId, resourceId });
   * if (runs[0]) {
   *   await agent.approveToolCall({ runId: runs[0].runId });
   * }
   * ```
   */
  async listSuspendedRuns(options: AgentListSuspendedRunsOptions = {}): Promise<AgentListSuspendedRunsResult> {
    const { threadId, resourceId, fromDate, toDate, perPage, page } = options;

    if (perPage !== undefined && (!Number.isInteger(perPage) || perPage <= 0)) {
      throw new MastraError({
        id: 'AGENT_LIST_SUSPENDED_RUNS_INVALID_PER_PAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" listSuspendedRuns() requires perPage to be a positive integer.`,
        details: { agentName: this.name, perPage },
      });
    }
    if (page !== undefined && (!Number.isInteger(page) || page < 0)) {
      throw new MastraError({
        id: 'AGENT_LIST_SUSPENDED_RUNS_INVALID_PAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" listSuspendedRuns() requires page to be a non-negative integer.`,
        details: { agentName: this.name, page },
      });
    }

    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const workflowsStore = await effectiveMastra?.getStorage()?.getStore('workflows');

    if (!workflowsStore) {
      throw new MastraError({
        id: 'AGENT_LIST_SUSPENDED_RUNS_NO_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" listSuspendedRuns() requires storage to discover suspended runs. ` +
          `Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL). See https://mastra.ai/docs/storage`,
        details: { agentName: this.name },
      });
    }

    // resourceId is a storage column and threadId is a best-effort JSON-path
    // filter, so push both down to narrow the query where the adapter supports
    // them. The in-process checks below stay as the correctness backstop:
    // adapters silently skip filters they can't evaluate (missing column,
    // non-JSON snapshot storage) and return a superset, and rows persisted
    // before the resourceId column was populated carry the resource only in
    // the snapshot. Durable agents persist their agentic loop under a separate
    // workflow name, so query both — otherwise suspended durable runs are
    // never discoverable. Durable wrappers from other engines (e.g. Inngest)
    // namespace that name and advertise it on the runtime agent.
    const storagePageSize = 100;
    const isPaginated = perPage !== undefined && page !== undefined;
    const firstRequestedMatch = isPaginated ? page * perPage : 0;
    const pastLastRequestedMatch = isPaginated ? firstRequestedMatch + perPage : Number.POSITIVE_INFINITY;
    const matchedRuns: AgentRun[] = [];
    let total = 0;

    const runtimeLoopWorkflowName = (
      this.#threadRuntimeAgent as Partial<Pick<DurableAgentLike, 'durableLoopWorkflowName'>> | undefined
    )?.durableLoopWorkflowName;
    const workflowNames = new Set(['agentic-loop', DurableStepIds.AGENTIC_LOOP]);
    if (typeof runtimeLoopWorkflowName === 'string') workflowNames.add(runtimeLoopWorkflowName);

    for (const workflowName of workflowNames) {
      for (let storagePage = 0; ; storagePage++) {
        const { runs: workflowRuns } = await workflowsStore.listWorkflowRuns({
          workflowName,
          status: 'suspended',
          resourceId,
          threadId,
          fromDate,
          toDate,
          perPage: storagePageSize,
          page: storagePage,
        });

        for (const run of workflowRuns) {
          let snapshot = run.snapshot;
          if (typeof snapshot === 'string') {
            try {
              snapshot = JSON.parse(snapshot) as WorkflowRunState;
            } catch {
              continue;
            }
          }
          if (snapshot?.status !== 'suspended') continue;

          // Snapshots persist the owning agent's id, so runs started by other
          // agents sharing the same agentic-loop snapshot storage are skipped.
          // Default-deny: a snapshot whose owning agent id is missing or does not
          // match is not surfaced, so runs cannot leak across agents.
          const runAgentId = this.#getSnapshotAgentId(snapshot);
          if (runAgentId !== this.id) continue;

          // thread/resource info travels in the suspended stream state; the run row's
          // resourceId column is used as the primary source when present.
          const memoryInfo = this.#getSnapshotMemoryInfo(snapshot);
          const runThreadId = memoryInfo?.threadId;
          const runResourceId = run.resourceId ?? memoryInfo?.resourceId;
          if (threadId && runThreadId !== threadId) continue;
          if (resourceId && runResourceId !== resourceId) continue;

          // Storage pagination bounds candidate snapshots. Filtered output
          // pagination still needs to scan every batch to return an exact total.
          const matchingIndex = total++;
          if (matchingIndex < firstRequestedMatch || matchingIndex >= pastLastRequestedMatch) continue;

          matchedRuns.push({
            runId: run.runId,
            status: 'suspended',
            threadId: runThreadId,
            resourceId: runResourceId,
            suspendedAt: run.updatedAt,
            toolCalls: this.#getSuspendedToolCalls(snapshot),
          });
        }

        if (workflowRuns.length < storagePageSize) break;
      }
    }

    return { runs: matchedRuns, total };
  }

  /** @internal Allows server adapters to detect thread-wide cancellation and clear-on-abort support. */
  get __supportsThreadSignalCancellation(): boolean {
    return true;
  }

  /**
   * @internal Whether a finished background task is already handled by an
   * `untilIdle` stream: one is open for the thread and will report it, or the
   * caller stopped the stream that was waiting for it.
   */
  __untilIdleHandlesBackgroundTask(threadId: string, resourceId: string, taskId: string): boolean {
    return untilIdleHandlesBackgroundTask(this.activeStreamUntilIdle, threadId, resourceId, taskId);
  }

  /**
   * @internal Tells the agent that a deferred background task on a thread has
   * finished and its result is now on the tool call. An open `untilIdle` stream
   * for the thread already reports it with its own follow-up turn, and a caller
   * that stopped the stream waiting for the task doesn't want a reply, so this
   * does nothing then. It also does nothing when the background task config
   * sets `notifyAgentOnFinish: false`. Otherwise it sends a signal to the thread: an active run gets
   * it on its next step, and an idle thread wakes so the agent can report the
   * outcome. The signal names the tool call, never the result: the result is
   * already in the thread, and tool output may hold data that must not be
   * copied into a prompt.
   */
  async __notifyBackgroundTaskFinished(params: {
    threadId: string;
    resourceId: string;
    taskId: string;
    toolCallId: string;
    toolName: string;
    status: 'completed' | 'failed';
    /** The dispatching run's request context, so a woken run resolves model, instructions and memory as it did. */
    requestContext?: RequestContext;
  }): Promise<void> {
    const { threadId, resourceId, taskId, toolCallId, toolName, status } = params;
    if (this.#mastra?.backgroundTaskManager?.config.notifyAgentOnFinish === false) return;
    if (this.__untilIdleHandlesBackgroundTask(threadId, resourceId, taskId)) return;
    const outcome = status === 'completed' ? 'completed' : 'failed';
    // A copy, so later writes by the finished run don't reach the woken one. A tool's
    // schema-transformed view is copied in its input form: the woken run validates it again.
    const requestContext = params.requestContext
      ? new RequestContext((getRequestContextInputSource(params.requestContext) ?? params.requestContext).entries())
      : undefined;
    const ifIdleStreamOptions = requestContext ? { streamOptions: { requestContext } } : {};
    const signal: AgentSignal = {
      type: 'notification',
      tagName: 'background-task',
      contents:
        `Background task ${taskId} for tool call ${toolCallId} (${toolName}) has ${outcome}. ` +
        `It ran as a background task: when called, the tool returned only a placeholder with the task id, and ` +
        `that placeholder has now been replaced with the task's ${status === 'completed' ? 'result' : 'error'}. ` +
        `Earlier messages saying it was running, and the task id they quoted, were correct; don't correct them. ` +
        `Tell the user the outcome. Do not call the tool again for it.`,
      attributes: { taskId, toolCallId, toolName, status },
    };
    try {
      const result = this.sendSignal<unknown>(signal, {
        threadId,
        resourceId,
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'wake', ...ifIdleStreamOptions },
      });
      const accepted = await result.accepted;
      // Another agent's run holds the thread (e.g. waiting for approval, or in another
      // process). Queue the notice so it starts this agent's run once that run ends.
      if (accepted.action === 'blocked' && accepted.reason === 'thread-blocked') {
        const queued = { ...signal, id: result.signal.id };
        const target = {
          threadId,
          resourceId,
          ...(requestContext ? { ifIdle: { streamOptions: { requestContext } } } : {}),
        };
        // Queueing is refused too while the lease is held by a suspended run this process
        // evicted, or is mid-handover. Both clear within a lease TTL, and nothing else
        // reports this task, so try again until then.
        const deadline = Date.now() + 2 * AGENT_LEASE_TTL_MS;
        for (;;) {
          const queuedAccepted = await this.queueSignal<unknown>(queued, target).accepted;
          if (queuedAccepted.action !== 'blocked' || queuedAccepted.reason !== 'thread-blocked') break;
          if (Date.now() >= deadline) {
            this.logger.warn('Could not notify the agent that a background task finished: the thread stayed blocked', {
              taskId,
              toolCallId,
            });
            break;
          }
          await new Promise(resolve => setTimeout(resolve, AGENT_LEASE_RENEW_INTERVAL_MS));
        }
      }
    } catch (error) {
      this.logger.warn('Could not notify the agent that a background task finished', {
        taskId,
        toolCallId,
        error,
      });
    }
  }

  abortThreadStream(options: AgentAbortThreadOptions): boolean {
    const aborted = this.#abortThreadStreamLocally(options);
    // The synchronous API cannot report the asynchronous lease-owner lookup.
    if (this.__hasDurableExecution() && !aborted && !options.localOnly) {
      void this.#abortThreadLeaseOwner(options).catch(error => {
        this.#mastra?.getLogger?.()?.warn?.('Failed to abort durable agent thread run on another process', {
          agentId: this.id,
          threadId: options.threadId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return aborted;
  }

  #abortThreadStreamLocally(options: AgentAbortThreadOptions): boolean {
    const scopeKey = `${options.threadId ?? ''}|${options.resourceId ?? ''}`;
    const wrapperClose = getScopeStreamSlot(this.activeStreamUntilIdle, scopeKey, options.expectedRunId);
    if (wrapperClose) {
      wrapperClose();
      return true;
    }
    // Aborting releases the lease, so resolve its run first.
    const runId = agentThreadStreamRuntime.getActiveThreadRunId(options, this.getPubSub());
    const parked = !!runId && agentThreadStreamRuntime.isRunParked(runId, this.getPubSub());
    const aborted = agentThreadStreamRuntime.abortThread(options, this.getPubSub());
    if (aborted && parked && !options.localOnly) void this.#deleteAbortedSuspendedRun(runId);
    if (this.__hasDurableExecution() && aborted && runId && !options.localOnly) {
      this.#abortLocalController(runId);
      void this.requestRemoteAbort(runId);
    }
    return aborted;
  }

  /** @internal Abort the thread's run even when another process executes it, reporting whether one was asked to stop. */
  async __abortThreadStreamAcrossProcesses(options: AgentAbortThreadOptions): Promise<boolean> {
    if (!this.#resolveExecutionEngine()) return this.abortThreadStream(options);
    const aborted = this.#abortThreadStreamLocally(options);
    if (aborted || options.localOnly) return aborted;
    return this.#abortThreadLeaseOwner(options);
  }

  /** Stop the lease owner even when this process has no thread subscription. */
  async #abortThreadLeaseOwner(options: AgentAbortThreadOptions): Promise<boolean> {
    this.#resolveExecutionEngine();
    const runId = await agentThreadStreamRuntime.getThreadLeaseOwnerRunId(this.getPubSub(), options);
    if (!runId) return false;
    // Never stop a successor run the caller didn't mean (#24422).
    if (options.expectedRunId !== undefined && options.expectedRunId !== runId) return false;
    // Only the thread request clears queued input before the run drains it.
    const pubsub = this.__getStreamBus(true)!.forRun(this.__usesSharedRunLog()).pubsub;
    await Promise.all([
      agentThreadStreamRuntime.requestThreadRunAbort(this.getPubSub(), options, runId),
      options.clearPendingSignals ? undefined : publishAbortRequest(pubsub, runId),
    ]);
    return true;
  }

  abortRunStream(runId: string): boolean {
    const aborted = this.__abortLocalRun(runId);
    if (aborted) return true;
    // A published run may be executing in another process; it listens on its
    // control topic.
    void this.requestRemoteAbort(runId);
    return (
      this.__hasDurableExecution() &&
      (this.executionRunRegistry.has(runId) ||
        getRunRegistryEntry(runId, this.#mastra) !== undefined ||
        agentThreadStreamRuntime.hasThreadRun(runId, this.getPubSub()))
    );
  }

  /** Abort `runId` if this process executes it or holds it parked. */
  private __abortLocalRun(runId: string): boolean {
    const wrapperClose = getRunStreamSlot(this.activeStreamUntilIdle, runId);
    wrapperClose?.();
    if (wrapperClose !== undefined) return true;
    const parked = agentThreadStreamRuntime.isRunParked(runId, this.getPubSub());
    const aborted = agentThreadStreamRuntime.abortRun(runId, this.getPubSub());
    if (aborted && parked) void this.#deleteAbortedSuspendedRun(runId);
    const engine = this.#resolveExecutionEngine();
    if (!engine) return aborted;
    const controller = (this.executionRunRegistry.get(runId) ?? getRunRegistryEntry(runId, this.#mastra))
      ?.abortController;
    this.#abortLocalController(runId);
    // An evented caller's controller does not confirm that its executor stopped.
    return aborted || (engine.resolveWorkflowEngine(this.workflowEngine, this.logger) === 'default' && !!controller);
  }

  /** Flip the controller this process holds for `runId`, if it holds one. */
  #abortLocalController(runId: string): void {
    const controller = (this.executionRunRegistry.get(runId) ?? getRunRegistryEntry(runId, this.#mastra))
      ?.abortController;
    if (controller && !controller.signal.aborted) controller.abort(new Error('Aborted'));
  }

  /**
   * Abort `runId` wherever it executes and report whether that was confirmed:
   * true when this process aborted it, or when the executing process answered
   * the request on the run's control topic; false when nobody answered in
   * time (the run finished, is parked elsewhere, or the transport dropped the
   * request). Rejects when the request cannot be published.
   * @internal Used by the server's run abort route.
   */
  async __abortRunAcknowledged(runId: string): Promise<boolean> {
    if (this.#resolveExecutionEngine()) return this.#abortDurableRunAcknowledged(runId);
    if (this.__abortLocalRun(runId)) return true;
    const bus = this.__getStreamBus();
    if (!bus) return false;
    return requestAcknowledgedAbort(bus.pubsub, runId);
  }

  /**
   * A registry entry alone is not confirmation: evented steps may execute elsewhere.
   * Keep the local executor alive until its correlated abort request is answered.
   */
  async #abortDurableRunAcknowledged(runId: string): Promise<boolean> {
    const wrapperClose = getRunStreamSlot(this.activeStreamUntilIdle, runId);
    if (wrapperClose) {
      wrapperClose();
      return true;
    }
    const engine = this.executionEngine;
    const pubsub = this.__getStreamBus(true)!.forRun(this.__usesSharedRunLog()).pubsub;
    if (agentThreadStreamRuntime.abortRun(runId, this.getPubSub())) {
      this.#abortLocalController(runId);
      void this.requestRemoteAbort(runId);
      if (await engine.cancelParkedRun(runId)) {
        await engine.announceCanceledRun(runId, pubsub);
        await releaseRemoteAbortListener(runId, this.#mastra);
      }
      return true;
    }
    try {
      const canceled = await engine.cancelParkedRun(runId);
      if (canceled) await engine.announceCanceledRun(runId, pubsub);
      const acknowledged = await requestAcknowledgedAbort(pubsub, runId);
      if (canceled) await releaseRemoteAbortListener(runId, this.#mastra);
      return acknowledged || canceled;
    } finally {
      this.#abortLocalController(runId);
    }
  }

  /**
   * An aborted suspended run can never be resumed, so drop its workflow
   * registration and snapshot rows; otherwise it stays listed as suspended.
   */
  async #deleteAbortedSuspendedRun(runId: string): Promise<boolean> {
    const mastra = this.#mastra ?? this.#ephemeralMastra;
    if (!mastra) return true;
    const runtimeLoopWorkflowName = (
      this.#threadRuntimeAgent as Partial<Pick<DurableAgentLike, 'durableLoopWorkflowName'>> | undefined
    )?.durableLoopWorkflowName;
    const workflowNames = new Set([
      AGENTIC_LOOP_WORKFLOW_ID,
      AGENTIC_EXECUTION_WORKFLOW_ID,
      DurableStepIds.AGENTIC_LOOP,
      DurableStepIds.AGENTIC_EXECUTION,
    ]);
    if (typeof runtimeLoopWorkflowName === 'string') workflowNames.add(runtimeLoopWorkflowName);
    try {
      mastra.__unregisterInternalWorkflow(AGENTIC_LOOP_WORKFLOW_ID, runId);
      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      await Promise.all(
        [...workflowNames].map(workflowName => workflowsStore?.deleteWorkflowRunById({ runId, workflowName })),
      );
      return true;
    } catch (error) {
      this.logger.warn(`Failed to delete snapshot of aborted suspended run ${runId}`, { runId, error });
      return false;
    }
  }

  sendMessage<OUTPUT = TOutput>(
    message: AgentMessageInput,
    target: SendAgentMessageOptions<OUTPUT>,
  ): SendAgentMessageResult<OUTPUT> {
    return agentThreadStreamRuntime.sendMessage<OUTPUT>(
      this.#getThreadRuntimeAgent(),
      message,
      target,
      this.getPubSub(),
    );
  }

  queueMessage<OUTPUT = TOutput>(
    message: AgentMessageInput,
    target: QueueAgentMessageOptions<OUTPUT>,
  ): QueueAgentMessageResult<OUTPUT> {
    return agentThreadStreamRuntime.queueMessage<OUTPUT>(
      this.#getThreadRuntimeAgent(),
      message,
      target,
      this.getPubSub(),
    );
  }

  /**
   * Queues a typed signal to start a new run after the active thread run completes, or wakes
   * the thread immediately when it is idle. Shares the queue used by `queueMessage()`.
   */
  queueSignal<OUTPUT = TOutput>(
    signal: AgentSignal,
    target: QueueAgentSignalOptions<OUTPUT>,
  ): QueueAgentSignalResult<OUTPUT> {
    return agentThreadStreamRuntime.queueSignal<OUTPUT>(
      this.#getThreadRuntimeAgent(),
      signal,
      target,
      this.getPubSub(),
    );
  }

  cancelQueuedMessages(target: CancelQueuedAgentMessagesOptions): CancelQueuedAgentMessagesResult {
    return agentThreadStreamRuntime.cancelQueuedMessages(this as Agent<any, any, any, any>, target, this.getPubSub());
  }

  subscribeThreadEvents(scope: SubscribeAgentThreadEventsOptions, listener: AgentThreadEventListener): () => void {
    return agentThreadStreamRuntime.subscribeThreadEvents(
      this as Agent<any, any, any, any>,
      scope,
      listener,
      this.getPubSub(),
    );
  }

  sendStateSignal<OUTPUT = TOutput>(
    state: AgentStateSignalInput,
    target: SendAgentStateSignalOptions<OUTPUT>,
  ): Promise<SendAgentStateSignalResult<OUTPUT>> {
    return agentThreadStreamRuntime.sendStateSignal<OUTPUT>(
      this.#getThreadRuntimeAgent(),
      state,
      target,
      this.getPubSub(),
    );
  }

  /**
   * Run this agent's notification delivery policy for a record. Called at
   * receipt time by `sendNotificationSignal` and again at delivery time by the
   * notification dispatch workflow, so a deferred delivery can carry
   * freshly-resolved decision fields (e.g. `streamOptions` with the request
   * context a woken idle thread needs to resolve a model).
   */
  resolveNotificationDeliveryDecision(input: NotificationDeliveryPolicyInput): Promise<NotificationDeliveryDecision> {
    return resolveNotificationDeliveryDecision({
      config: this.#notifications?.deliveryPolicy,
      ...input,
    });
  }

  async sendNotificationSignal<OUTPUT = TOutput>(
    notification: SendNotificationSignalInput,
    target: SendAgentNotificationSignalOptions<OUTPUT>,
  ): Promise<SendAgentNotificationSignalResult<OUTPUT>>;
  async sendNotificationSignal<OUTPUT = TOutput>(
    notification: SendNotificationSignalInput[],
    target: SendAgentNotificationSignalOptions<OUTPUT>,
  ): Promise<SendAgentNotificationSignalResult<OUTPUT>[]>;
  async sendNotificationSignal<OUTPUT = TOutput>(
    notification: SendNotificationSignalInput | SendNotificationSignalInput[],
    target: SendAgentNotificationSignalOptions<OUTPUT>,
  ): Promise<SendAgentNotificationSignalResult<OUTPUT> | SendAgentNotificationSignalResult<OUTPUT>[]> {
    const isBatch = Array.isArray(notification);
    const inputs = isBatch ? notification : [notification];
    const results = await this.#sendNotificationSignalBatch<OUTPUT>(inputs, target);
    return isBatch ? results : results[0]!;
  }

  /**
   * A run's scopes are fixed when it starts, so a notification naming other scopes than the
   * run active on its thread can't join that run: it queues to start its own run after it.
   */
  async #sendNotificationRunSignal<OUTPUT>(
    signal: CreatedAgentSignal,
    target: SendAgentSignalOptions<OUTPUT>,
  ): Promise<SendAgentSignalResult<OUTPUT>> {
    const result = agentThreadStreamRuntime.sendSignal<OUTPUT>(
      this.#getThreadRuntimeAgent(),
      signal,
      target,
      this.getPubSub(),
    );
    if (!target.scopes?.length) return result;
    // A rejection still reaches the caller through `result.accepted`.
    const accepted = await result.accepted.catch(() => undefined);
    if (accepted?.action !== 'blocked' || accepted.reason !== 'scope-mismatch') return result;
    return agentThreadStreamRuntime.queueSignal<OUTPUT>(
      this.#getThreadRuntimeAgent(),
      signal,
      target,
      this.getPubSub(),
    );
  }

  async #sendNotificationSignalBatch<OUTPUT = TOutput>(
    inputs: SendNotificationSignalInput[],
    target: SendAgentNotificationSignalOptions<OUTPUT>,
  ): Promise<SendAgentNotificationSignalResult<OUTPUT>[]> {
    const notifications = await this.#mastra?.getStorage()?.getStore('notifications');
    if (!notifications) {
      throw new Error('sendNotificationSignal requires a notifications storage domain');
    }

    const records = [];
    // A delayed delivery rebuilds its target from the record, so the routing
    // requirement the caller asked for has to travel with it. Without it the
    // retry would fall back to running the thread wherever the dispatch happens
    // rather than on the process that claims it.
    const routingRequirement = {
      requireClaimedOwner: target.ifIdle?.requireClaimedOwner === true,
      scopes: target.scopes,
      // A persist-only send must stay persist-only when the delivery is delayed:
      // the deferred dispatch would otherwise wake the idle thread the caller
      // explicitly asked not to wake.
      ...(target.ifIdle?.behavior === 'persist' ? { idleBehavior: 'persist' as const } : {}),
    };
    for (const notification of inputs) {
      records.push(
        await notifications.createNotification({
          ...notification,
          agentId: this.id,
          resourceId: target.resourceId,
          threadId: target.threadId,
          metadata: applyNotificationRoutingRequirement(notification.metadata, routingRequirement),
        }),
      );
    }

    const threadState = agentThreadStreamRuntime.getThreadState(
      { resourceId: target.resourceId, threadId: target.threadId },
      this.getPubSub(),
    );
    const now = new Date();
    const planned: Array<
      | { record: NotificationRecord; decision: NotificationDeliveryDecision }
      | { record: NotificationRecord; error: unknown }
    > = [];
    for (const record of records) {
      try {
        planned.push({
          record,
          decision: await this.resolveNotificationDeliveryDecision({ now, record, threadState }),
        });
      } catch (error) {
        planned.push({ record, error });
      }
    }

    const results: SendAgentNotificationSignalResult<OUTPUT>[] = [];
    // Set when a record stays pending with a scheduled deliverAt/summaryAt —
    // those are delivered later by the notification dispatch workflow, so the
    // dispatcher schedule (and scheduler) must be lazily activated.
    let needsDispatcher = false;
    for (const entry of planned) {
      const { record } = entry;
      if ('error' in entry) {
        // The record already exists with no schedule, so a throwing policy here
        // would leave it pending forever: no dispatch pass considers it due.
        // Fail this attempt and give it a due time, as a dispatch-time throw
        // does, so the dispatcher retries it up to the attempt limit.
        const failed = await notifications.updateNotification({
          id: record.id,
          threadId: record.threadId,
          deliverAt: now,
          ...resolveDeliveryFailureUpdate(record),
          lastDeliveryAttemptAt: new Date(),
          lastDeliveryError: entry.error instanceof Error ? entry.error.message : String(entry.error),
        });
        needsDispatcher = true;
        results.push({
          record: failed,
          decision: { action: 'defer', deliverAt: now, reason: 'delivery-policy-failed' },
        });
        continue;
      }
      const { decision } = entry;
      if (decision.action === 'discard') {
        const updated = await notifications.updateNotification({
          id: record.id,
          threadId: record.threadId,
          status: 'discarded',
          deliveryReason: decision.reason,
        });
        results.push({ record: updated, decision });
        continue;
      }

      if (decision.action === 'persist') {
        const updated = await notifications.updateNotification({
          id: record.id,
          threadId: record.threadId,
          deliveryReason: decision.reason,
        });
        results.push({ record: updated, decision });
        continue;
      }

      if (decision.action === 'defer' || decision.action === 'summarize') {
        const shouldEmitSummaryNow = Boolean(
          decision.action === 'summarize' &&
          decision.summaryAt &&
          decision.summaryAt.getTime() <= now.getTime() &&
          (record.priority === 'medium' || (record.priority === 'high' && decision.deliverAt)),
        );
        const updated = await notifications.updateNotification({
          id: record.id,
          threadId: record.threadId,
          deliverAt: decision.action === 'defer' ? decision.deliverAt : (decision.deliverAt ?? record.deliverAt),
          summaryAt: shouldEmitSummaryNow
            ? null
            : decision.action === 'summarize'
              ? decision.summaryAt
              : (decision.summaryAt ?? record.summaryAt),
          deliveryReason: decision.reason,
        });

        if (updated.deliverAt != null || updated.summaryAt != null) {
          needsDispatcher = true;
        }

        if (shouldEmitSummaryNow) {
          const signal = createNotificationSummarySignal(summarizeNotifications([updated]));
          const result = await this.#sendNotificationRunSignal<OUTPUT>(signal, {
            ...target,
            ifIdle: {
              // Caller-supplied stream options win over the policy's. The
              // policy's options are typed on the default OUTPUT, matching
              // how deliveries run.
              ...(decision.streamOptions
                ? { streamOptions: decision.streamOptions as AgentExecutionOptions<OUTPUT> }
                : {}),
              ...target.ifIdle,
              behavior: record.priority === 'high' ? 'persist' : 'wake',
            },
          });
          let summaryAccepted: SendAgentSignalAccepted<OUTPUT>;
          try {
            summaryAccepted = await result.accepted;
          } catch (error) {
            const failed = await notifications.updateNotification({
              id: updated.id,
              threadId: updated.threadId,
              // `summaryAt` was cleared to emit this summary. Restore it so the
              // record stays due and the dispatcher can retry it.
              summaryAt: now,
              ...resolveDeliveryFailureUpdate(updated),
              lastDeliveryAttemptAt: new Date(),
              lastDeliveryError: error instanceof Error ? error.message : 'Notification summary signal was rejected',
            });
            results.push({ record: failed, decision });
            continue;
          }
          // The routing policy can resolve to `persist`/`discard` (no run, no
          // delivery). Only stamp `summarySignalId` when a run actually picked
          // the signal up (`wake`/`deliver`).
          if (summaryAccepted.action === 'persist' || summaryAccepted.action === 'discard') {
            results.push({
              record: updated,
              decision,
              signal: result.signal,
              persisted: result.persisted,
              accepted: result.accepted,
            });
            continue;
          }
          const summarized = await notifications.updateNotification({
            id: updated.id,
            threadId: updated.threadId,
            summarySignalId: result.signal.id,
          });
          results.push({
            record: summarized,
            decision,
            runId: 'runId' in summaryAccepted ? summaryAccepted.runId : undefined,
            signal: result.signal,
            persisted: result.persisted,
            accepted: result.accepted,
          });
          continue;
        }

        results.push({ record: updated, decision });
        continue;
      }

      const signal = createNotificationSignal({ ...record, status: 'delivered' });
      // An immediate `deliver` to an idle thread is a wake, so it needs the
      // policy's stream options as much as a deferred dispatch does.
      // Caller-supplied stream options win over the policy's.
      const deliverTarget =
        decision.streamOptions && !target.ifIdle?.streamOptions
          ? {
              ...target,
              ifIdle: { ...target.ifIdle, streamOptions: decision.streamOptions as AgentExecutionOptions<OUTPUT> },
            }
          : target;
      const result = await this.#sendNotificationRunSignal<OUTPUT>(signal, deliverTarget);
      let delivered: SendAgentSignalAccepted<OUTPUT>;
      try {
        delivered = await result.accepted;
      } catch (error) {
        // An immediate `deliver` record carries no schedule: without one a
        // failed attempt leaves it pending forever, because no dispatch pass
        // considers it due. That also makes the `pending` -> `failed`
        // transition unreachable for these records, so a sender that queued a
        // signal could never learn it terminally failed. Give it a due time so
        // the dispatcher retries it up to MAX_NOTIFICATION_DELIVERY_ATTEMPTS,
        // and activate the dispatcher schedule for it.
        const failed = await notifications.updateNotification({
          id: record.id,
          threadId: record.threadId,
          deliverAt: now,
          ...resolveDeliveryFailureUpdate(record),
          lastDeliveryAttemptAt: new Date(),
          lastDeliveryError: error instanceof Error ? error.message : 'Notification signal was rejected',
          deliveryReason: decision.reason,
        });
        needsDispatcher = true;
        results.push({ record: failed, decision });
        continue;
      }

      // The routing policy can resolve to `persist`/`discard` (no run picked the
      // signal up). Don't mark the notification `delivered` in that case — the
      // record stays in its current state with the emitted signal attached.
      if (delivered.action === 'persist' || delivered.action === 'discard') {
        results.push({
          record,
          decision,
          signal: result.signal,
          persisted: result.persisted,
          accepted: result.accepted,
        });
        continue;
      }

      const updated = await notifications.updateNotification({
        id: record.id,
        threadId: record.threadId,
        status: 'delivered',
        deliveredSignalId: result.signal.id,
        deliveryReason: decision.reason,
      });

      results.push({
        record: updated,
        decision,
        runId: 'runId' in delivered ? delivered.runId : undefined,
        signal: result.signal,
        persisted: result.persisted,
        accepted: result.accepted,
      });
    }

    if (needsDispatcher) {
      await this.#mastra?.__ensureNotificationDispatchReady();
    }

    return results;
  }

  sendSignal<OUTPUT = TOutput>(
    signal: AgentSignal,
    target: SendAgentSignalOptions<OUTPUT>,
  ): SendAgentSignalResult<OUTPUT> {
    return agentThreadStreamRuntime.sendSignal<OUTPUT>(this.#getThreadRuntimeAgent(), signal, target, this.getPubSub());
  }

  async stream<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async stream<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async stream(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async stream(messages: MessageListInput): Promise<MastraModelOutput<TOutput>>;
  async stream<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT> | MastraModelOutput<TOutput> | DurableAgentStreamResult<TOutput>> {
    // Extract and forward any client observability data attached to
    // tool-result messages before they reach the loop/model.
    this.#extractClientObservability(messages);
    this.#beginExecutionPolicy();
    if (this.#resolveExecutionEngine()) {
      const result = await this.#streamDurable(messages, streamOptions as DurableAgentStreamOptions<TOutput>);
      if (this.returnsDurableStreamResult) return result;
      return Object.assign(result.output, {
        abort: result.abort,
        cleanup: result.cleanup,
        threadId: result.threadId,
        resourceId: result.resourceId,
      });
    }

    const { mergedOptions, resolvedScopes } = await this.#resolvePlainRunOptions<OUTPUT>(streamOptions);

    // Delegate to the idle-loop wrapper when `untilIdle` is set (from
    // per-call options OR defaultOptions). Strip `untilIdle` before passing
    // to the wrapper so its internal agent.stream() call doesn't recurse.
    if (mergedOptions.untilIdle) {
      const { untilIdle, ...rest } = mergedOptions ?? {};
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      return runStreamUntilIdle<OUTPUT>(
        this,
        messages,
        // Continuations re-enter stream() and resolve scopes again, so they get the
        // caller's own request context rather than this call's run-scoped copy.
        { ...rest, requestContext: streamOptions?.requestContext, maxIdleMs },
        {
          activeStreams: this.activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
      );
    }

    return this.#startPlainRun(messages, mergedOptions, resolvedScopes, 'stream');
  }

  /**
   * @deprecated Use `stream(messages, { untilIdle: true })` instead.
   *
   * Streams the agent's response and keeps the stream open until all
   * background tasks dispatched during this turn (and any triggered by
   * follow-up turns) complete. When a background task finishes, its tool
   * result is injected into memory by the tool-call-step's `onResult` hook,
   * and this method re-enters the agentic loop via `agent.stream([], ...)`
   * so the LLM can process the result immediately — without waiting for a
   * new user message.
   *
   * Invariants:
   * - Only one inner LLM stream runs at a time (a completion arriving
   *   mid-turn is queued and processed after the current turn ends).
   * - When there are no running background tasks and no queued completions,
   *   the outer stream closes.
   * - If the agent has no memory configured, this falls through to a plain
   *   `stream()` call since continuation requires memory.
   *
   * Return shape: `streamUntilIdle` returns a `MastraModelOutput` that looks
   * like the one from `stream()` — *only* `fullStream` spans the initial
   * turn **and** any auto-continuations. Aggregate properties (`text`,
   * `toolCalls`, `toolResults`, `finishReason`, `messageList`,
   * `getFullOutput()`) still resolve against the **first turn's** internal
   * buffer. If you need an aggregate view across continuations, consume
   * `fullStream` yourself and accumulate — or follow up with `agent.generate`
   * once the stream closes.
   *
   * @example
   * ```typescript
   * const stream = await agent.streamUntilIdle('Research solana for me', {
   *   memory: { thread: 't1', resource: 'u1' },
   * });
   *
   * for await (const chunk of stream.fullStream) {
   *   // chunks from the initial turn AND any continuation turns
   *   // triggered by background task completions flow through here
   * }
   * ```
   */
  async streamUntilIdle<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async streamUntilIdle<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async streamUntilIdle(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async streamUntilIdle(messages: MessageListInput): Promise<MastraModelOutput<TOutput>>;
  async streamUntilIdle<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      /** Close the outer stream after this many ms of idleness. Default: 5 minutes. */
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT> | MastraModelOutput<TOutput>> {
    if (this.#resolveExecutionEngine()) {
      const { maxIdleMs, structuredOutput, ...options } = streamOptions ?? {};
      const untilIdle = maxIdleMs === undefined ? true : { maxIdleMs };
      if (structuredOutput) {
        return this.stream(messages, { ...options, structuredOutput, untilIdle });
      }
      return this.stream(messages, { ...options, untilIdle });
    }

    return runStreamUntilIdle<OUTPUT>(this, messages, streamOptions, {
      activeStreams: this.activeStreamUntilIdle,
      bgManager: this.#mastra?.backgroundTaskManager,
    });
  }

  /**
   * @deprecated Use `resumeStream(resumeData, { untilIdle: true, ... })` instead.
   *
   * Resume-flavored counterpart to {@link streamUntilIdle}. Resumes a
   * previously suspended stream identified by `streamOptions.runId`, then
   * keeps the outer stream open across any continuations that background
   * task completions trigger — same idle-loop semantics as `streamUntilIdle`.
   *
   * Use this when (a) the suspended run produced a background task whose
   * completion should drive a follow-up turn, or (b) a tool dispatched as a
   * background task from inside the resume itself needs the outer stream to
   * stay open until it finishes.
   *
   * @example
   * ```typescript
   * const stream = await agent.resumeStreamUntilIdle(
   *   { approved: true },
   *   { runId: 'previous-run-id', memory: { thread: 't1', resource: 'u1' } },
   * );
   *
   * for await (const chunk of stream.fullStream) {
   *   // chunks from the resumed turn AND any continuation turns
   * }
   * ```
   */
  async resumeStreamUntilIdle<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      toolCallId?: string;
      /** Close the outer stream after this many ms of idleness. Default: 5 minutes. */
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async resumeStreamUntilIdle<OUTPUT extends {}>(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      toolCallId?: string;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async resumeStreamUntilIdle(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      toolCallId?: string;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async resumeStreamUntilIdle(
    resumeData: any,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      toolCallId?: string;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<any>> {
    if (!this.__hasDurableExecution()) {
      return runResumeStreamUntilIdle(this, resumeData, streamOptions, {
        activeStreams: this.activeStreamUntilIdle,
        bgManager: this.#mastra?.backgroundTaskManager,
      });
    }
    const { maxIdleMs, structuredOutput, ...options } = streamOptions ?? {};
    const untilIdle = maxIdleMs === undefined ? true : { maxIdleMs };
    if (structuredOutput) {
      return this.resumeStream(resumeData, { ...options, structuredOutput, untilIdle });
    }
    return this.resumeStream(resumeData, { ...options, untilIdle });
  }

  /**
   * Resumes a previously suspended stream execution.
   * Used to continue execution after a suspension point (e.g., tool approval, workflow suspend).
   *
   * @example
   * ```typescript
   * // Resume after suspension
   * const stream = await agent.resumeStream(
   *   { approved: true },
   *   { runId: 'previous-run-id' }
   * );
   * ```
   */
  async resumeStream<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async resumeStream<OUTPUT extends {}>(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async resumeStream(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async resumeStream<OUTPUT = TOutput>(
    resumeData: any,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT> | MastraModelOutput<TOutput>> {
    if (this.#resolveExecutionEngine())
      return this.#resumeDurableStream(resumeData, streamOptions as DurableAgentResumeOptions<TOutput>);
    return this.#resumeStream<OUTPUT>(resumeData, streamOptions, false);
  }

  async #resumeDurableStream(
    resumeData: unknown,
    streamOptions?: DurableAgentResumeOptions<TOutput> & { runId?: string },
  ): Promise<AgentStreamOutput<TOutput>> {
    const runId = streamOptions?.runId;
    if (!runId) {
      throw new Error('resumeStream() on DurableAgent requires a runId in streamOptions.');
    }
    const { runId: _runId, ...resumeOptions } = streamOptions;
    const result = await this.resume(runId, resumeData, {
      ...resumeOptions,
      // Close when the resumed workflow suspends again so the caller's reader terminates.
      closeOnSuspend: resumeOptions.closeOnSuspend ?? true,
    });
    return Object.assign(result.output, {
      abort: result.abort,
      cleanup: result.cleanup,
      threadId: result.threadId,
      resourceId: result.resourceId,
    });
  }

  /**
   * `resumeStream()`, or with `recover` set, `recoverResume()`: resumes with the intent a dead
   * claim persisted instead of the caller's `resumeData` and `toolCallId`.
   */
  async #resumeStream<OUTPUT>(
    resumeData: unknown,
    streamOptions:
      | (AgentExecutionOptionsBase<any> & {
          structuredOutput?: PublicStructuredOutputOptions<any>;
          toolCallId?: string;
        } & { model?: DynamicArgument<MastraModelConfig> })
      | undefined,
    recover: boolean,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const method = recover ? 'recoverResume' : 'resumeStream';
    const defaultOptions = await this.getDefaultOptions({
      requestContext: streamOptions?.requestContext,
    });

    const mergedStreamOptions = deepMerge(
      withDefaultToolCallConcurrencyLimit(defaultOptions, streamOptions) as Record<string, unknown>,
      (withDefinedToolHooks(streamOptions) ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions & { model?: DynamicArgument<MastraModelConfig> };
    validateModelTimeoutSettings(mergedStreamOptions.modelSettings?.timeout);
    const loopStreamOptions = { ...mergedStreamOptions };
    const actor = mergedStreamOptions.actor;
    delete loopStreamOptions.actor;

    // Delegate to the idle-loop wrapper when `untilIdle` is set (from
    // per-call options OR defaultOptions). Strip `untilIdle` before passing
    // to the wrapper so its internal agent.stream() call doesn't recurse.
    if (mergedStreamOptions.untilIdle) {
      const { untilIdle, ...rest } = mergedStreamOptions ?? {};
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      return runResumeStreamUntilIdle<OUTPUT>(
        this,
        resumeData,
        { ...rest, maxIdleMs },
        {
          activeStreams: this.activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
        recover ? opts => this.#resumeStream<OUTPUT>(undefined, opts, true) : undefined,
      );
    }

    const runId = streamOptions?.runId ?? '';
    const existingSnapshot = await this.#loadAgenticLoopSnapshotOrThrow({ runId, method });
    const intent = recover ? this.#getRecoverableResumeIntent(existingSnapshot, runId) : undefined;
    const toolCallId = intent ? intent.toolCallId : streamOptions?.toolCallId;
    const resumeWith = intent ? intent.resumeData : resumeData;
    const snapshotMemoryInfo = this.#getSnapshotMemoryInfo(existingSnapshot);
    // Precedence: resume call > the run's own flag > defaultOptions (merged above).
    const persistedReturnScorerData =
      streamOptions?.returnScorerData === undefined ? this.#getSnapshotReturnScorerData(existingSnapshot) : undefined;
    if (persistedReturnScorerData !== undefined) {
      mergedStreamOptions.returnScorerData = loopStreamOptions.returnScorerData = persistedReturnScorerData;
    }

    if (snapshotMemoryInfo?.threadId) {
      mergedStreamOptions.memory = {
        ...(mergedStreamOptions.memory ?? {}),
        thread: mergedStreamOptions.memory?.thread ?? snapshotMemoryInfo.threadId,
        resource: mergedStreamOptions.memory?.resource ?? snapshotMemoryInfo.resourceId,
      };
      loopStreamOptions.memory = mergedStreamOptions.memory;
    }

    const { options: scopedStreamOptions, resolved: resolvedScopes } = await this.#resolveRunScopes(
      mergedStreamOptions,
      { callScopes: streamOptions?.scopes, defaultScopes: defaultOptions?.scopes, existingSnapshot },
    );
    mergedStreamOptions.memory = loopStreamOptions.memory = scopedStreamOptions.memory;
    mergedStreamOptions.requestContext = loopStreamOptions.requestContext = scopedStreamOptions.requestContext;

    await this.requireAgentExecutionFGA({
      requestContext: mergedStreamOptions.requestContext,
      memory: mergedStreamOptions.memory,
      runId: mergedStreamOptions.runId,
      snapshotMemoryInfo,
      actor,
    });
    const resumeSnapshot = await this.#validateSuspendedToolCallTarget({
      snapshot: existingSnapshot,
      toolCallId,
      runId,
      method,
    });
    await this.#validateToolResumeData({
      snapshot: resumeSnapshot,
      toolCallId,
      resumeData: resumeWith,
      requestContext: mergedStreamOptions.requestContext,
      toolsets: mergedStreamOptions.toolsets,
      clientTools: mergedStreamOptions.clientTools,
      runId,
      method,
    });
    const resumeClaim = await this.#claimSuspendedAgenticLoopRun({
      snapshot: resumeSnapshot,
      runId,
      toolCallId,
      resumeData: resumeWith,
      recoverClaimedAt: intent?.claimedAt,
      method,
    });

    let preparedOptions: AgentExecutionOptions<OUTPUT> | undefined;
    const threadStreamPubSub = this.getPubSub();
    try {
      const llm = await this.getLLM({
        requestContext: mergedStreamOptions.requestContext,
        model: mergedStreamOptions.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
      });

      if (!isSupportedLanguageModel(llm.getModel())) {
        const modelInfo = llm.getModel();
        const specVersion = modelInfo.specificationVersion;
        throw new MastraError({
          id: 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text:
            specVersion === 'v1'
              ? 'V1 models are not supported for resumeStream. Please use streamLegacy instead.'
              : `Model has unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6), v4 (AI SDK v7). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
          details: {
            modelId: modelInfo.modelId,
            provider: modelInfo.provider,
            specificationVersion: specVersion,
          },
        });
      }

      // A parked run whose thread lease lapsed must hold it again before it runs: a successor that now holds the
      // thread refuses this resume instead of running beside it, and the run stays parked.
      await agentThreadStreamRuntime.reacquireParkedRunLease(runId, threadStreamPubSub);
      await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
        this as Agent<any, any, any, any>,
        loopStreamOptions as unknown as AgentExecutionOptions<OUTPUT>,
        threadStreamPubSub,
      );
      preparedOptions = agentThreadStreamRuntime.prepareRunOptions(
        { ...loopStreamOptions, actor } as unknown as AgentExecutionOptions<OUTPUT>,
        threadStreamPubSub,
        () => this.#deleteAbortedSuspendedRun(runId),
      );

      const result = await this.#prepareAndStartPlainWorkflow({
        ...preparedOptions,
        actor,
        structuredOutput: mergedStreamOptions.structuredOutput
          ? {
              ...mergedStreamOptions.structuredOutput,
              schema: toStandardSchema(mergedStreamOptions.structuredOutput.schema),
            }
          : undefined,
        messages: [],
        resolvedScopes: resolvedScopes.scopes,
        toolCallId,
        resumeContext: {
          resumeData: resumeWith,
          snapshot: resumeSnapshot,
          claim: resumeClaim,
        },
        methodType: 'stream',
        // Use agent's maxProcessorRetries as default, allow options to override
        maxProcessorRetries: mergedStreamOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
        _threadStreamPubSub: threadStreamPubSub,
      } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub });

      if (result.status !== 'success') {
        if (result.status === 'failed') {
          throw new MastraError(
            {
              id: 'AGENT_STREAM_FAILED',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
            },
            // pass original error to preserve stack trace
            result.error,
          );
        }
        throw new MastraError({
          id: 'AGENT_STREAM_UNKNOWN_ERROR',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: 'An unknown error occurred while streaming',
        });
      }

      await agentThreadStreamRuntime.registerRun(
        this as Agent<any, any, any, any>,
        result.result as unknown as MastraModelOutput<OUTPUT>,
        preparedOptions as AgentExecutionOptions<OUTPUT>,
        threadStreamPubSub,
      );

      return result.result as unknown as MastraModelOutput<OUTPUT>;
    } catch (error) {
      await resumeClaim.release();
      // Release the thread reservation taken by waitForCrossAgentThreadRun so
      // a failed resume does not block subsequent runs on this thread.
      if (preparedOptions) {
        agentThreadStreamRuntime.releaseThreadRunReservation(
          runId,
          threadStreamPubSub,
          undefined,
          preparedOptions.abortSignal,
        );
      }
      throw error;
    }
  }

  async #resumeDurableGenerate(args: unknown[]): Promise<FullOutput<TOutput>> {
    const { runId, resumeData, options } = normalizeResumeGenerateArgs<DurableAgentResumeOptions<TOutput>>(args);
    const result = await this.resume(runId, resumeData, {
      ...options,
      closeOnSuspend: true,
    });
    let suspended = false;
    try {
      const fullOutput = await result.output.getFullOutput();
      if (fullOutput.error) throw fullOutput.error;
      suspended = fullOutput.finishReason === 'suspended';
      if (suspended) {
        await getRunRegistryEntry(result.runId, this.#mastra)?.workflowExecution;
      }
      if (!fullOutput.runId) {
        fullOutput.runId = result.runId;
      }
      return fullOutput;
    } finally {
      if (!suspended) result.cleanup();
    }
  }

  /**
   * Resumes a previously suspended generate execution.
   * Used to continue execution after a suspension point (e.g., tool approval, workflow suspend).
   *
   * @example
   * ```typescript
   * // Resume after suspension
   * const stream = await agent.resumeGenerate(
   *   { approved: true },
   *   { runId: 'previous-run-id' }
   * );
   * ```
   */
  async resumeGenerate<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    resumeData: any,
    options: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<T>>;
  async resumeGenerate<OUTPUT extends {}>(
    resumeData: any,
    options: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT>>;
  async resumeGenerate(
    resumeData: any,
    options: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<TOutput>>;
  async resumeGenerate<OUTPUT = TOutput>(
    ...args: [
      resumeData: any,
      options?: AgentExecutionOptionsBase<any> & {
        structuredOutput?: PublicStructuredOutputOptions<any>;
        toolCallId?: string;
      } & { model?: DynamicArgument<MastraModelConfig> },
      legacyOptions?: DurableAgentResumeOptions<TOutput>,
    ]
  ): Promise<FullOutput<OUTPUT> | FullOutput<TOutput>> {
    if (this.#resolveExecutionEngine()) return this.#resumeDurableGenerate(args);
    const [resumeData, options] = args;
    const defaultOptions = await this.getDefaultOptions({
      requestContext: options?.requestContext,
    });

    const mergedOptions = deepMerge(
      withDefaultToolCallConcurrencyLimit(defaultOptions, options) as Record<string, unknown>,
      (withDefinedToolHooks(options) ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions & { model?: DynamicArgument<MastraModelConfig> };
    validateModelTimeoutSettings(mergedOptions.modelSettings?.timeout);
    const loopOptions = { ...mergedOptions };
    const actor = mergedOptions.actor;
    delete loopOptions.actor;

    const runId = options?.runId ?? '';
    const existingSnapshot = await this.#loadAgenticLoopSnapshotOrThrow({ runId, method: 'resumeGenerate' });
    // Precedence: resume call > the run's own flag > defaultOptions (merged above).
    const persistedReturnScorerData =
      options?.returnScorerData === undefined ? this.#getSnapshotReturnScorerData(existingSnapshot) : undefined;
    if (persistedReturnScorerData !== undefined) {
      mergedOptions.returnScorerData = loopOptions.returnScorerData = persistedReturnScorerData;
    }
    const { options: scopedOptions, resolved: resolvedScopes } = await this.#resolveRunScopes(mergedOptions, {
      callScopes: options?.scopes,
      defaultScopes: defaultOptions?.scopes,
      existingSnapshot,
    });
    mergedOptions.memory = loopOptions.memory = scopedOptions.memory;
    mergedOptions.requestContext = loopOptions.requestContext = scopedOptions.requestContext;
    await this.requireAgentExecutionFGA({
      requestContext: mergedOptions.requestContext,
      memory: mergedOptions.memory,
      runId: mergedOptions.runId,
      snapshotMemoryInfo: this.#getSnapshotMemoryInfo(existingSnapshot),
      actor,
    });
    const resumeSnapshot = await this.#validateSuspendedToolCallTarget({
      snapshot: existingSnapshot,
      toolCallId: options?.toolCallId,
      runId,
      method: 'resumeGenerate',
    });
    await this.#validateToolResumeData({
      snapshot: resumeSnapshot,
      toolCallId: options?.toolCallId,
      resumeData,
      requestContext: mergedOptions.requestContext,
      toolsets: mergedOptions.toolsets,
      clientTools: mergedOptions.clientTools,
      runId,
      method: 'resumeGenerate',
    });
    const resumeClaim = await this.#claimSuspendedAgenticLoopRun({
      snapshot: resumeSnapshot,
      runId,
      toolCallId: options?.toolCallId,
      resumeData,
      method: 'resumeGenerate',
    });

    let fullOutput: Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
    try {
      const llm = await this.getLLM({
        requestContext: mergedOptions.requestContext,
        model: mergedOptions.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
      });

      const modelInfo = llm.getModel();

      if (!isSupportedLanguageModel(modelInfo)) {
        const modelId = modelInfo.modelId || 'unknown';
        const provider = modelInfo.provider || 'unknown';
        const specVersion = modelInfo.specificationVersion;
        throw new MastraError({
          id: 'AGENT_GENERATE_V1_MODEL_NOT_SUPPORTED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text:
            specVersion === 'v1'
              ? `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with generate(). Please use AI SDK v5+ models or call the generateLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
              : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6), v4 (AI SDK v7). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
          details: {
            agentName: this.name,
            modelId,
            provider,
            specificationVersion: specVersion,
          },
        });
      }

      // A parked run whose thread lease lapsed must hold it again before it runs: a successor that now holds the
      // thread refuses this resume instead of running beside it, and the run stays parked.
      await agentThreadStreamRuntime.reacquireParkedRunLease(runId, this.getPubSub());
      const result = await this.#prepareAndStartPlainWorkflow({
        ...loopOptions,
        actor,
        structuredOutput: mergedOptions.structuredOutput
          ? {
              ...mergedOptions.structuredOutput,
              schema: toStandardSchema(mergedOptions.structuredOutput.schema),
            }
          : undefined,
        messages: [],
        resolvedScopes: resolvedScopes.scopes,
        resumeContext: {
          resumeData,
          snapshot: resumeSnapshot,
          claim: resumeClaim,
        },
        methodType: 'generate',
        // Use agent's maxProcessorRetries as default, allow options to override
        maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
      } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub });

      if (result.status !== 'success') {
        if (result.status === 'failed') {
          throw new MastraError(
            {
              id: 'AGENT_GENERATE_FAILED',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
            },
            // pass original error to preserve stack trace
            result.error,
          );
        }
        throw new MastraError({
          id: 'AGENT_GENERATE_UNKNOWN_ERROR',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: 'An unknown error occurred while generating',
        });
      }

      if (typeof result.result?.getFullOutput !== 'function') {
        throw new MastraError({
          id: 'AGENT_GENERATE_MALFORMED_RESULT',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: 'Execution workflow produced a result without getFullOutput',
        });
      }

      fullOutput = (await result.result.getFullOutput()) as Awaited<
        ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>
      >;
    } catch (error) {
      await resumeClaim.release();
      throw error;
    }

    if (fullOutput.error) throw fullOutput.error;
    return fullOutput;
  }

  /**
   * Finishes a resume whose process died before the run finished, with the approval decision or
   * resume data that resume persisted when it claimed the run. Use it when `approveToolCall()`,
   * `declineToolCall()`, or `resumeStream()` was called but the process handling it stopped, and
   * the decision is no longer at hand.
   *
   * The claim must be abandoned: claimed and not started for `AGENT_RESUME_CLAIM_STALE_MS`, or, on
   * storage with run fencing, started and no longer renewed for that long. Rejects with
   * `AGENT_RESUME_ALREADY_CLAIMED` before then, and with `AGENT_RESUME_NOTHING_TO_RECOVER` when no
   * resume has claimed the run. The resumed tool call runs again, and abandonment is judged by age,
   * so a stalled claimant may still be running it.
   *
   * @example
   * ```typescript
   * const stream = await agent.recoverResume({ runId: 'claimed-run-id' });
   * ```
   */
  async recoverResume<OUTPUT = TOutput>(
    options: AgentExecutionOptionsBase<any> & {
      runId: string;
      structuredOutput?: PublicStructuredOutputOptions<any>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>> {
    // A durable/evented run keeps its resume intent in the engine's snapshot, not the plain
    // loop's; refuse before the plain lookup reports the suspension as missing.
    if (!this.returnsDurableStreamResult && this.#resolveExecutionEngine())
      throw new MastraError({
        id: 'AGENT_RECOVER_RESUME_UNSUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" recoverResume() is not supported when the agent runs on a durable or evented execution engine. Use recover(runId) to continue an interrupted run.`,
        details: { agentName: this.name, runId: options.runId },
      });
    return this.#resumeStream<OUTPUT>(undefined, options, true);
  }

  /**
   * Approves a pending tool call and resumes execution.
   * Used when `requireToolApproval` is enabled to allow the agent to proceed with a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.approveToolCall({
   *   runId: 'pending-run-id'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async approveToolCall<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string } & {
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<MastraModelOutput<OUTPUT>> {
    // @ts-expect-error - the types here are wrong
    return this.resumeStream({ approved: true }, options);
  }

  async sendStreamResume<OUTPUT = undefined>(
    options: SendAgentStreamResumeOptions<OUTPUT>,
  ): Promise<SendAgentStreamResumeResult> {
    const { threadId, resourceId, runId, toolCallId, resumeData, streamOptions } = options;

    if (!threadId || !resourceId || !runId) {
      throw new MastraError({
        id: 'AGENT_SEND_STREAM_RESUME_MISSING_TARGET',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'sendStreamResume() requires threadId, resourceId, and runId.',
        details: { threadId, resourceId, runId, agentName: this.name },
      });
    }

    const pubsub = this.getPubSub();
    let resumableRun = agentThreadStreamRuntime.getResumableThreadRun(
      { threadId, resourceId, runId, toolCallId },
      pubsub,
    );
    const resumableFromLocal = Boolean(resumableRun);

    if (!resumableRun) {
      // A local run can belong to an earlier segment of a cross-instance
      // execution. Check storage when it does not hold this suspension.
      let suspendedRuns: AgentRun[] = [];
      try {
        ({ runs: suspendedRuns } = await this.listSuspendedRuns({ threadId, resourceId }));
      } catch (error) {
        if (!(error instanceof MastraError) || error.id !== 'AGENT_LIST_SUSPENDED_RUNS_NO_STORAGE') {
          throw error;
        }
      }

      const storedRun = suspendedRuns.find(
        run =>
          run.runId === runId && (!toolCallId || run.toolCalls.some(toolCall => toolCall.toolCallId === toolCallId)),
      );
      if (storedRun) {
        resumableRun = { runId, toolCallId };
      }
    }

    if (!resumableRun) {
      throw new MastraError({
        id: 'AGENT_SEND_STREAM_RESUME_NO_SUSPENDED_THREAD_RUN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" sendStreamResume() could not find a suspended run "${runId}" for thread "${threadId}".`,
        details: {
          threadId,
          resourceId,
          runId,
          agentName: this.name,
        },
      });
    }

    const resumeOptions = (streamOptions ?? {}) as AgentExecutionOptionsBase<unknown> & { toolCallId?: string };

    await agentThreadStreamRuntime.queueStreamResume(
      runId,
      async () => {
        const queuedResumableRun = resumableFromLocal
          ? agentThreadStreamRuntime.getResumableThreadRun(
              { threadId, resourceId, runId, toolCallId: resumableRun.toolCallId },
              this.getPubSub(),
            )
          : resumableRun;
        if (!queuedResumableRun) {
          throw new MastraError({
            id: 'AGENT_SEND_STREAM_RESUME_NO_SUSPENDED_THREAD_RUN',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            text: `Agent "${this.name}" sendStreamResume() could not find a suspended run "${runId}" for thread "${threadId}".`,
            details: {
              threadId,
              resourceId,
              runId,
              agentName: this.name,
            },
          });
        }

        return this.resumeStream(resumeData, {
          ...resumeOptions,
          runId,
          ...(queuedResumableRun.toolCallId ? { toolCallId: queuedResumableRun.toolCallId } : {}),
          memory: {
            ...(resumeOptions.memory ?? {}),
            thread: threadId,
            resource: resourceId,
          },
        });
      },
      this.getPubSub(),
    );

    return { accepted: true, runId, toolCallId: resumableRun.toolCallId };
  }

  async sendToolApproval<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & {
      threadId: string;
      resourceId: string;
      toolCallId?: string;
      approved: boolean;
      resumeData?: unknown;
      declineContext?: { reason?: string; message?: string };
      messages?: MessageListInput;
      streamOptions?: AgentExecutionOptions<OUTPUT>;
    },
  ): Promise<{ accepted: true; runId: string; toolCallId?: string }> {
    const {
      threadId,
      resourceId,
      approved,
      resumeData: customResumeData,
      declineContext,
      messages,
      streamOptions,
      ...executionOptions
    } = options;

    if (messages && approved) {
      const continuation = agentThreadStreamRuntime.continueWithMessages(
        this as Agent<any, any, any, any>,
        messages,
        {
          resourceId,
          threadId,
          runId: executionOptions.runId,
          streamOptions: deepMerge(
            (streamOptions ?? {}) as Record<string, unknown>,
            executionOptions as Record<string, unknown>,
          ) as unknown as AgentExecutionOptions<OUTPUT>,
        },
        this.getPubSub(),
      );
      return { accepted: continuation.accepted, runId: continuation.runId, toolCallId: options.toolCallId };
    }

    let runId = executionOptions.runId ?? this.getActiveThreadRunId({ threadId, resourceId });
    let suspendedRun: AgentRun | undefined;
    // Tracks whether runId was recovered from storage (not the in-memory active-run
    // map). This path resumes directly because the snapshot has already been
    // discovered here, avoiding a second storage lookup in sendStreamResume().
    let resolvedFromStorage = false;

    if (!runId) {
      // The in-memory active-run map only knows about runs started by this process.
      // After a server restart (or on another instance) fall back to storage-backed
      // suspended-run discovery so approvals stay durable.
      let suspendedRuns: AgentRun[] = [];
      try {
        ({ runs: suspendedRuns } = await this.listSuspendedRuns({ threadId, resourceId }));
      } catch (error) {
        // Only swallow the expected no-storage case — storage outages and
        // store-driver errors must surface instead of masquerading as
        // "no suspended run exists".
        if (!(error instanceof MastraError) || error.id !== 'AGENT_LIST_SUSPENDED_RUNS_NO_STORAGE') {
          throw error;
        }
      }

      const matchingRuns = options.toolCallId
        ? suspendedRuns.filter(run => run.toolCalls.some(toolCall => toolCall.toolCallId === options.toolCallId))
        : suspendedRuns;

      if (matchingRuns.length > 1) {
        throw new MastraError({
          id: 'AGENT_SEND_TOOL_APPROVAL_AMBIGUOUS_SUSPENDED_RUNS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text:
            `Agent "${this.name}" sendToolApproval() found ${matchingRuns.length} suspended runs for thread "${threadId}". ` +
            `Pass a toolCallId to disambiguate, or resume a specific run with approveToolCall()/declineToolCall() and an explicit runId.`,
          details: {
            threadId,
            resourceId,
            agentName: this.name,
            runIds: matchingRuns.map(run => run.runId).join(', '),
          },
        });
      }

      suspendedRun = matchingRuns[0];
      runId = suspendedRun?.runId;
      resolvedFromStorage = runId !== undefined;
    }

    if (!runId) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_NO_ACTIVE_THREAD_RUN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" sendToolApproval() could not find an active or suspended run for thread "${threadId}". ` +
          `The run may have already completed or been resumed.`,
        details: {
          threadId,
          resourceId,
          agentName: this.name,
        },
      });
    }

    const pubsub = this.getPubSub();
    const inMemorySuspension = agentThreadStreamRuntime.getResumableThreadRunSuspension(
      { threadId, resourceId, runId, toolCallId: options.toolCallId },
      pubsub,
    );

    if (!suspendedRun && !inMemorySuspension) {
      try {
        const { runs } = await this.listSuspendedRuns({ threadId, resourceId });
        suspendedRun = runs.find(run => run.runId === runId);
      } catch (error) {
        if (!(error instanceof MastraError) || error.id !== 'AGENT_LIST_SUSPENDED_RUNS_NO_STORAGE') {
          throw error;
        }
      }
    }

    const suspendedToolCall = options.toolCallId
      ? suspendedRun?.toolCalls.find(toolCall => toolCall.toolCallId === options.toolCallId)
      : suspendedRun?.toolCalls[0];
    const approvalGated = inMemorySuspension
      ? inMemorySuspension.kind === 'approval'
      : suspendedToolCall?.requiresApproval === true;

    const resumeOptions = deepMerge(
      (streamOptions ?? {}) as Record<string, unknown>,
      executionOptions as Record<string, unknown>,
    ) as unknown as AgentExecutionOptions<OUTPUT>;

    const customResumeDataCanCarryApproval =
      typeof customResumeData === 'object' && customResumeData !== null && !Array.isArray(customResumeData);
    if (approvalGated && customResumeData !== undefined && !customResumeDataCanCarryApproval) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_INVALID_RESUME_DATA',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" sendToolApproval() requires custom resumeData to be a non-null object for an approval-gated tool call.`,
        details: {
          threadId,
          resourceId,
          runId,
          agentName: this.name,
          ...(options.toolCallId ? { toolCallId: options.toolCallId } : {}),
        },
      });
    }

    const resumeData =
      customResumeData !== undefined
        ? approvalGated && customResumeDataCanCarryApproval
          ? { ...customResumeData, ...(!approved && declineContext ? declineContext : {}), approved }
          : customResumeData
        : approved
          ? { approved }
          : declineContext
            ? { ...declineContext, approved }
            : { approved };
    const resumeStreamOptions = {
      ...resumeOptions,
      memory: {
        ...(resumeOptions.memory ?? {}),
        thread: resumeOptions.memory?.thread ?? threadId,
        resource: resumeOptions.memory?.resource ?? resourceId,
      },
    };

    if (resolvedFromStorage) {
      // Resume directly from the persisted snapshot, mirroring the explicit-runId
      // approveToolCall()/declineToolCall() entry points.
      // @ts-expect-error - resumeStream overloads don't narrow cleanly here; matches
      // the same pattern used by approveToolCall()/declineToolCall() above.
      await this.resumeStream(resumeData, {
        ...resumeStreamOptions,
        runId,
        ...(options.toolCallId ? { toolCallId: options.toolCallId } : {}),
      });
      return { accepted: true, runId, toolCallId: options.toolCallId };
    }

    return this.sendStreamResume({
      threadId,
      resourceId,
      runId,
      toolCallId: options.toolCallId,
      resumeData,
      streamOptions: resumeStreamOptions,
    });
  }

  /**
   * Declines a pending tool call and resumes execution.
   * Used when `requireToolApproval` is enabled to prevent the agent from executing a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.declineToolCall({
   *   runId: 'pending-run-id',
   *   reason: 'The user does not want to share their location'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   *
   * @param options.reason - Optional explanation for the decline. It is persisted on the
   * tool invocation's `approval.reason` and surfaced to the model in place of the default
   * "Tool call was not approved by the user" message.
   */
  async declineToolCall<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string; reason?: string } & {
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<MastraModelOutput<OUTPUT>> {
    const { reason, ...resumeOptions } = options;
    // @ts-expect-error - the types here are wrong
    return this.resumeStream({ approved: false, ...(reason !== undefined ? { reason } : {}) }, resumeOptions);
  }

  /**
   * Approves a pending tool call and returns the complete result (non-streaming).
   * Used when `requireToolApproval` is enabled with generate() to allow the agent to proceed.
   *
   * @example
   * ```typescript
   * const output = await agent.generate('Find user', { requireToolApproval: true });
   * if (output.finishReason === 'suspended') {
   *   const result = await agent.approveToolCallGenerate({
   *     runId: output.runId,
   *     toolCallId: output.suspendPayload.toolCallId
   *   });
   *   console.log(result.text);
   * }
   * ```
   */
  async approveToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string } & {
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    // @ts-expect-error - the types here are wrong
    return this.resumeGenerate({ approved: true }, options);
  }

  /**
   * Declines a pending tool call and returns the complete result (non-streaming).
   * Used when `requireToolApproval` is enabled with generate() to prevent tool execution.
   *
   * @example
   * ```typescript
   * const output = await agent.generate('Find user', { requireToolApproval: true });
   * if (output.finishReason === 'suspended') {
   *   const result = await agent.declineToolCallGenerate({
   *     runId: output.runId,
   *     toolCallId: output.suspendPayload.toolCallId,
   *     reason: 'Budget approval is required first'
   *   });
   *   console.log(result.text);
   * }
   * ```
   *
   * @param options.reason - Optional explanation for the decline, persisted on the tool
   * invocation's `approval.reason` and surfaced to the model.
   */
  async declineToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string; reason?: string } & {
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    const { reason, ...resumeOptions } = options;
    // @ts-expect-error - the types here are wrong
    return this.resumeGenerate({ approved: false, ...(reason !== undefined ? { reason } : {}) }, resumeOptions);
  }

  /**
   * Legacy implementation of generate method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models.
   *
   * @example
   * ```typescript
   * const result = await agent.generateLegacy('What is 2+2?');
   * console.log(result.text);
   * ```
   */
  async generateLegacy(
    messages: MessageListInput,
    args?: AgentGenerateOptions<undefined, undefined> & {
      output?: never;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<GenerateTextResult<any, undefined>>;
  async generateLegacy<OUTPUT extends ZodSchema | JSONSchema7>(
    messages: MessageListInput,
    args?: AgentGenerateOptions<OUTPUT, undefined> & {
      output?: OUTPUT;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<GenerateObjectResult<OUTPUT>>;
  async generateLegacy<EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7>(
    messages: MessageListInput,
    args?: AgentGenerateOptions<undefined, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<GenerateTextResult<any, EXPERIMENTAL_OUTPUT>>;
  async generateLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    generateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      model?: DynamicArgument<MastraModelConfig>;
    } = {},
  ): Promise<OUTPUT extends undefined ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT> : GenerateObjectResult<OUTPUT>> {
    return this.getLegacyHandler().generateLegacy(messages, generateOptions);
  }

  /**
   * Legacy implementation of stream method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models.
   *
   * @example
   * ```typescript
   * const result = await agent.streamLegacy('Tell me a story');
   * for await (const chunk of result.textStream) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<StreamTextResult<any, OUTPUT>>;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: OUTPUT;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<StreamObjectResult<OUTPUT extends ZodSchema | JSONSchema7 ? OUTPUT : never> & TracingProperties>;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<
    StreamTextResult<any, EXPERIMENTAL_OUTPUT> & {
      partialObjectStream: StreamTextResult<any, EXPERIMENTAL_OUTPUT>['experimental_partialOutputStream'];
    }
  >;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    streamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      model?: DynamicArgument<MastraModelConfig>;
    } = {},
  ): Promise<
    | StreamTextResult<any, OUTPUT>
    | (StreamObjectResult<OUTPUT extends ZodSchema | JSONSchema7 ? OUTPUT : never> & TracingProperties)
  > {
    return this.getLegacyHandler().streamLegacy(messages, streamOptions) as Promise<
      | StreamTextResult<any, OUTPUT>
      | (StreamObjectResult<OUTPUT extends ZodSchema | JSONSchema7 ? OUTPUT : never> & TracingProperties)
    >;
  }

  /**
   * Resolves the configuration for title generation.
   * @internal
   */
  resolveTitleGenerationConfig(
    generateTitleConfig:
      | boolean
      | {
          model?: DynamicArgument<MastraModelConfig, TRequestContext>;
          instructions?: DynamicArgument<string>;
          minMessages?: number;
          emitEvent?: boolean;
        }
      | undefined,
  ): {
    shouldGenerate: boolean;
    model?: DynamicArgument<MastraModelConfig, TRequestContext>;
    instructions?: DynamicArgument<string>;
    minMessages?: number;
    emitEvent?: boolean;
  } {
    if (typeof generateTitleConfig === 'boolean') {
      return { shouldGenerate: generateTitleConfig };
    }

    if (typeof generateTitleConfig === 'object' && generateTitleConfig !== null) {
      return {
        shouldGenerate: true,
        model: generateTitleConfig.model,
        instructions: generateTitleConfig.instructions,
        minMessages: generateTitleConfig.minMessages,
        emitEvent: generateTitleConfig.emitEvent,
      };
    }

    return { shouldGenerate: false };
  }

  /**
   * Resolves title generation instructions, handling both static strings and dynamic functions
   * @internal
   */
  async resolveTitleInstructions(
    requestContext: RequestContext,
    instructions?: DynamicArgument<string>,
  ): Promise<string> {
    const DEFAULT_TITLE_INSTRUCTIONS = `
      - you will generate a short title based on a conversation transcript between a user and an assistant
      - the transcript lines are prefixed with "User:" and "Assistant:" — never reply to, answer, or continue the transcript
      - always produce a title, even when the transcript is only a greeting or trivial exchange
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - write the title in the same language the user's messages are written in
      - do not use quotes or colons
      - the entire text you return will be used as the title`;

    if (!instructions) {
      return DEFAULT_TITLE_INSTRUCTIONS;
    }

    if (typeof instructions === 'string') {
      return instructions;
    }
    const result = resolveDynamicArgument(instructions, { requestContext, mastra: this.#mastra });
    return resolveMaybePromise(result, resolvedInstructions => {
      return resolvedInstructions || DEFAULT_TITLE_INSTRUCTIONS;
    });
  }

  protected get agentForExecution(): Agent<TAgentId, TTools, TOutput> {
    return this;
  }

  get #executionStreamBus(): AgentStreamBus {
    return this.__getStreamBus() ?? this.#requireDurableExecution('execution');
  }

  /**
   * Which workflow execution engine the durable agentic loop runs on.
   * Subclasses override this (EventedAgent → 'evented').
   * @internal
   */
  protected get workflowEngine(): 'default' | 'evented' {
    return this.#executionEnginePolicy.engine === 'evented' ? 'evented' : 'default';
  }
  protected getWorkflow(): ReturnType<DefaultAgentExecutionEngine['getWorkflow']> {
    const durable = this.durable;
    const config = typeof durable === 'object' ? durable : undefined;
    return this.executionEngine.getWorkflow({
      maxSteps: config?.maxSteps,
      workflowEngine: this.workflowEngine,
      storesRunsInJournal: config?.storageVersion === 2,
      shouldPersistSnapshot: config?.shouldPersistSnapshot,
      logger: this.logger,
      guardrailLogger: this.guardrailLogger,
    });
  }

  protected readonly executionRunRegistry = new ExtendedRunRegistry();

  #timedOutExecutions = new WeakSet<ExecutionFence>();

  /**
   * Accepted input of stream()/generate() executions. A total deadline that
   * settles the execution saves the turn from it as a terminal write.
   */
  #runInputs = new WeakMap<ExecutionFence, DurableAgenticWorkflowInput>();

  /**
   * Registry entries of recovered executions whose memory is fenced but which are not registered yet,
   * so a total deadline in that window still saves the turn.
   */
  #recoveredEntries = new WeakMap<ExecutionFence, RunRegistryEntry>();

  /**
   * Share the owner of a run this process registered, so other replicas can
   * authorize replay of its history. Lives until {@link clearPubsubTopic}. A
   * failed write only leaves other replicas refusing to replay the run.
   */
  private async attachStreamPublisher(runId: string, owner: { resourceId?: string; threadId?: string }): Promise<void> {
    const claim = getRunRegistryEntry(runId, this.#mastra)?.executionFence?.claim;
    const publisher = getExecutionStreamOwner({
      runId,
      agentId: this.id,
      mastra: this.#mastra,
      agent: this,
      claim: claim && { ...claim, ...owner },
    });
    await publisher?.ready.catch(error => {
      this.logger.warn(`[DurableAgent:${this.id}] run ${runId}: failed to attach its stream publisher`, { error });
    });
  }

  #unverifiedReaderFences = new WeakSet<ExecutionFence>();

  private scheduleReaderCleanup(executionFence: ExecutionFence, cleanup: () => void) {
    if (this.#unverifiedReaderFences.has(executionFence)) return;
    return this.#executionStreamBus.scheduleCleanup(() => {
      if (!this.#unverifiedReaderFences.has(executionFence)) cleanup();
    });
  }

  private owningReaderTerminal(runId: string, executionFence: ExecutionFence) {
    const publisher = getExecutionStreamOwner({
      runId,
      agentId: this.id,
      mastra: this.#mastra,
      agent: this,
      claim: executionFence.claim,
    });
    return async (status: 'suspended' | 'finished', generation: number | undefined) => {
      if (generation !== executionFence.generation || !executionFence.ownsRunTopics()) return;
      const currentFence = getRunRegistryEntry(runId, this.#mastra)?.executionFence;
      // A continuation can finish an earlier reader after resume replaced its execution.
      if (currentFence && currentFence !== executionFence) return;
      // The workers settle a run this process detached from. Its terminal event can arrive after the
      // detach, and the reader still delivers it.
      if (executionFence.detached) return;
      try {
        await publisher?.settle(status);
      } catch (error) {
        const unverified = error instanceof DurableExecutionFenceError && error.id === EXECUTION_UNVERIFIED_ERROR_ID;
        // The local reader still finishes, but cannot mutate shared lifecycle state.
        if (unverified) this.#unverifiedReaderFences.add(executionFence);
        // The detach can also land while the write waits in the publisher's queue.
        if (executionFence.detached) return;
        if (!unverified) throw error;
        this.logger.warn(`[DurableAgent:${this.id}] run ${runId}: terminal ownership could not be verified`, { error });
      }
    };
  }

  /**
   * Liveness of a run without an execution claim, i.e. one started before runs
   * were claimed: a live run keeps renewing its thread's lease. A run without a
   * thread has no signal and counts as not live.
   */
  #untrackedRunLiveness(runId: string, workflowInput: DurableAgenticWorkflowInput): UntrackedRunLiveness | undefined {
    const liveness = this.executionEngine.untrackedRunLiveness(runId, workflowInput);
    if (!liveness) return undefined;
    return {
      isLive: () => liveness.isLive(this.getPubSub()),
      ttlMs: liveness.ttlMs,
    };
  }

  /**
   * The transcript as of the crash. The loop snapshot's input only has the one the run
   * started with; later steps keep it in the nested execution workflow's state.
   */
  private async loadLatestMessageListState(
    workflowsStore: WorkflowsStorage,
    runId: string,
    fallbackSnapshot: WorkflowRunState,
  ): Promise<Awaited<ReturnType<typeof hydrateMessageListState>> | undefined> {
    const latest = await this.executionEngine.loadLatestMessageListState(workflowsStore, runId, fallbackSnapshot);
    if (!latest) return undefined;
    // Messages memory already stores are kept as refs; restore them so callers
    // see the full rows (e.g. ToolSearch results). loadRecalledMessages has
    // already loaded them, so this normally needs no storage read.
    return hydrateMessageListState(
      { getInitData: () => fallbackSnapshot.context?.input, mastra: this.#mastra },
      latest as Parameters<typeof hydrateMessageListState>[1],
    );
  }

  /**
   * Loads the recalled messages a persisted run keeps as refs in its transcript
   * before resume() or recover() runs anything. A memory storage failure then
   * rejects the call and leaves the run as it was. Failing in a step instead,
   * after a resumed tool already ran, would end the run.
   */
  private async loadRecalledMessages(runId: string, snapshot?: WorkflowRunState, requestContext?: RequestContext) {
    if (!snapshot) {
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      snapshot = workflowsStore
        ? (await this.executionEngine.loadPersistedRunSnapshot(workflowsStore, runId))?.snapshot
        : undefined;
    }
    if (!snapshot) return;
    await loadMessageListStateForResume({
      state: (snapshot.context as Record<string, unknown> | undefined)?.__state ?? snapshot.value,
      getInitData: () => snapshot.context?.input,
      mastra: this.#mastra,
      requestContext,
    });
  }

  /**
   * Rebuild and register the stream for a claimed recovery attempt. Rolls back
   * every partial registration and releases the claim if setup fails.
   */
  async #setupRecoveredStream({
    runId,
    workflowInput,
    requestContext,
    threadId,
    resourceId,
    messageList,
    registryEntry,
    options,
    scheduleAutoCleanup,
    executionFence,
  }: {
    runId: string;
    workflowInput: DurableAgenticWorkflowInput;
    requestContext: RequestContext;
    threadId?: string;
    resourceId?: string;
    messageList: MessageList;
    registryEntry: any;
    options?: DurableAgentRecoverOptions<TOutput>;
    scheduleAutoCleanup: () => void;
    executionFence: ExecutionFence;
  }): Promise<{
    stream: DurableStreamAdapterResult<TOutput>;
    threadRegistration?: AgentThreadRunRegistration;
  }> {
    let streamCleanup: (() => void) | undefined;
    let streamOutput: MastraModelOutput<TOutput> | undefined;
    let threadRegistration: AgentThreadRunRegistration | undefined;
    try {
      this.executionEngine.assertRecoveryActive();
      executionFence.throwIfLost();
      registryEntry.messageList = messageList;
      registryEntry.agentId = this.id;
      this.executionRunRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
      globalRunRegistry.set(runId, registryEntry);
      await this.attachStreamPublisher(runId, { threadId, resourceId });

      // Recovered runs run the agent's default lifecycle callbacks like stream() does, then the
      // caller's. Both run (rather than the caller replacing the default) because
      // recoverActiveRuns() and automatic recovery always pass their own bookkeeping callbacks.
      const defaultOptions = await this.getDefaultOptions({ requestContext });
      const onFinish = async (result: any) => {
        await defaultOptions?.onFinish?.(result);
        await options?.onFinish?.(result);
      };
      const onErrorCallback = async (error: any) => {
        await defaultOptions?.onError?.(error);
        await options?.onError?.(error);
      };
      const onAbortCallback = async (data: any) => {
        await defaultOptions?.onAbort?.(data);
        await options?.onAbort?.(data);
      };

      // Persistent backends may retain chunks from the pre-crash segment.
      const recoverOffset = await this.executionEngine.getPubsubOffset(
        this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        runId,
      );
      this.executionEngine.assertRecoveryActive();
      executionFence.throwIfLost();
      const stream = createDurableAgentStream<TOutput>({
        pubsub: this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        runId,
        minGeneration: executionFence.generation,
        onTerminalEvent: this.owningReaderTerminal(runId, executionFence),
        messageId: workflowInput.messageId ?? crypto.randomUUID(),
        model: {
          modelId: workflowInput.modelConfig?.modelId,
          provider: workflowInput.modelConfig?.provider,
          version: 'v3',
        },
        threadId,
        resourceId,
        offset: recoverOffset,
        onChunk: options?.onChunk,
        experimentalTransform: options?.experimentalTransform,
        onStepFinish: options?.onStepFinish,
        onFinish,
        onStreamFinished: scheduleAutoCleanup,
        onError: async error => {
          await onErrorCallback(error);
          scheduleAutoCleanup();
        },
        onAbort: async data => {
          try {
            await onAbortCallback(data);
          } finally {
            scheduleAutoCleanup();
          }
        },
        onSuspended: options?.onSuspended,
        // Close (when requested) on the persisted workflow result in recover(),
        // not on the SUSPENDED event, which can precede a resumable snapshot.
        closeOnSuspend: false,
        messageList,
        messageListFollowsStream: () => !this.executionEngine.executesStepsLocally,
        structuredOutput: registryEntry.structuredOutput,
        requestContext: registryEntry.requestContext,
        tracingContext: registryEntry.agentSpan ? { currentSpan: registryEntry.agentSpan } : undefined,
        returnScorerData: workflowInput.options?.returnScorerData,
      });
      streamCleanup = stream.cleanup;
      streamOutput = stream.output;
      await this.executionEngine.raceFenceLoss(stream.ready, executionFence).catch(error => {
        if (this.#timedOutExecutions.has(executionFence)) return stream.ready;
        throw error;
      });
      if (
        (await this.redeliverDeadlineError(registryEntry, executionFence)) ||
        this.#timedOutExecutions.has(executionFence)
      ) {
        return { stream, threadRegistration };
      }
      this.executionEngine.assertRecoveryActive();

      const recoverStreamOptions: AgentExecutionOptions<TOutput> = {
        runId,
        requestContext,
        ...(threadId
          ? {
              memory: {
                thread: threadId,
                ...(resourceId ? { resource: resourceId } : {}),
              },
            }
          : {}),
      } as AgentExecutionOptions<TOutput>;
      executionFence.throwIfLost();
      threadRegistration = await agentThreadStreamRuntime.registerRun(
        this as unknown as Agent<any, any, any, any>,
        stream.output,
        recoverStreamOptions,
        this.getPubSub(),
        {
          strict: true,
          ...(options?.closeOnSuspend ? {} : { continuation: 'across-suspension' as const }),
          validate: () => {
            this.executionEngine.assertRecoveryActive();
            executionFence.throwIfLost();
          },
          generation: executionFence.generation,
          ownershipLost: () => executionFence.isLost(),
          stepOwner: () => getRunRegistryEntry(runId, this.#mastra),
        },
      );
      this.executionEngine.assertRecoveryActive();
      executionFence.throwIfLost();
      return { stream, threadRegistration };
    } catch (error) {
      const settlement = await executionFence.settle(async () => {});
      try {
        // A superseded execution leaves the thread lease to the new owner,
        // which holds it under the same runId.
        await threadRegistration?.rollback({ releaseLease: settlement !== 'superseded' });
      } catch (rollbackError) {
        this.#mastra
          ?.getLogger?.()
          ?.warn?.(`[DurableAgent] recover(${runId}) failed to roll back thread registration: ${rollbackError}`);
      }
      if (streamOutput) {
        agentThreadStreamRuntime.closeRunContinuation(streamOutput, this.getPubSub());
      }
      streamCleanup?.();
      if (this.executionRunRegistry.get(runId) === registryEntry) {
        this.executionRunRegistry.cleanup(runId);
      }
      if (getRunRegistryEntry(runId, this.#mastra) === registryEntry) {
        globalRunRegistry.delete(runId);
      }
      if (settlement !== 'superseded') {
        await this.#reportRecoveryFailure(runId, error, executionFence.generation);
      }
      throw error;
    }
  }

  async #reportRecoveryFailure(runId: string, error: unknown, generation: number | undefined): Promise<boolean> {
    // Late setup can fail after pubsub teardown; preserve the failure outcome without publishing.
    if (this.#mastra?.__shuttingDown || !this.executionEngine.shouldReportRecoveryFailure(error)) return false;
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    if (normalizedError instanceof AgentThreadLeaseConflictError) {
      return false;
    }

    try {
      await this.emitError(runId, normalizedError, generation);
      return true;
    } catch (reportingError) {
      this.#mastra
        ?.getLogger?.()
        ?.warn?.(`[DurableAgent] recover(${runId}) failed to publish terminal error: ${reportingError}`);
      return false;
    }
  }

  /** Rebuilds process-local recovery state from the persisted durable workflow input. */
  async #rehydrateRecoveryState({
    runId,
    workflowInput,
    abortController,
    executionFence,
    originalSpansEnded,
    openStepsOf,
    latestMessageListState,
  }: {
    runId: string;
    workflowInput: DurableAgenticWorkflowInput;
    abortController: AbortController;
    executionFence: ExecutionFence;
    originalSpansEnded: boolean;
    /** The generations whose MODEL_STEP the crash left open, when the snapshot names them. */
    openStepsOf?: string[];
    /** The transcript as of the crash; `workflowInput` only has the one the run started with. */
    latestMessageListState?: unknown;
  }): Promise<RehydratedRecoveryState> {
    const requestContext: RequestContext = workflowInput.requestContextEntries
      ? new RequestContext(Object.entries(workflowInput.requestContextEntries) as Iterable<readonly [string, unknown]>)
      : new RequestContext();
    restoreRunAgentScopes(requestContext);

    const messageListMemoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
    const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;

    // `requestContextEntries` contains caller state captured before preparation
    // installed the run's framework-managed memory context. Rebuild that entry
    // from persisted run state so recovery never inherits a caller/parent thread.
    if (threadId && resourceId) {
      requestContext.set('MastraMemory', {
        thread: { id: threadId },
        resourceId,
        memoryConfig: workflowInput.state?.memoryConfig,
      });
    } else {
      requestContext.delete('MastraMemory');
    }

    const messageList = new MessageList({ threadId, resourceId });
    try {
      // The persisted input keeps messages memory already stores as refs.
      messageList.deserialize(
        await hydrateMessageListState(
          { getInitData: () => workflowInput, mastra: this.#mastra },
          workflowInput.messageListState,
        ),
      );
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] recover(${runId}) messageList deserialize skipped: ${error}`);
    }

    const wrapped = this.agentForExecution;
    let model;
    try {
      model = await wrapped.getModel({ requestContext });
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to resolve model during recover(${runId}): ${error}`);
    }
    // A per-call `model` is a live instance and cannot be persisted, so recovery
    // resolves the agent's own model instead. Say so rather than switching silently.
    const persistedModelId = workflowInput.modelConfig?.modelId;
    if (model && persistedModelId && model.modelId !== persistedModelId) {
      this.#mastra
        ?.getLogger?.()
        ?.warn?.(
          `[DurableAgent] recover(${runId}) continues with the agent's model '${model.modelId}'; the run started with '${persistedModelId}', which cannot be restored.`,
        );
    }
    executionFence.throwIfLost();

    // Restore the live fallback model list the run was prepared with (#22594).
    // The persisted (enabled-only, ordered) list is the source of truth for
    // the run's shape; the live resolution is the only source of real model
    // instances. Ids regenerate on every resolution (`toFallbackEntry` assigns
    // `mdl.id ?? randomUUID()`), so live entries must be rebound to the
    // persisted ids that llm-execution looks models up by — identity first,
    // position only for the unidentifiable residue (see
    // rebindRecoveredModelList).
    let modelList: RegistryModelListEntry[] | undefined;
    const persistedModelList = workflowInput.modelList;
    if (persistedModelList?.length) {
      try {
        const liveModelList = await wrapped.getModelList(requestContext);
        const enabledLive = (liveModelList ?? []).filter(entry => entry.enabled !== false);
        const rebound = rebindRecoveredModelList(persistedModelList, enabledLive);
        modelList = rebound.modelList;
        if (rebound.unbound > 0) {
          this.#mastra
            ?.getLogger?.()
            ?.warn?.(
              `[DurableAgent] recover(${runId}) model list drifted (persisted ${persistedModelList.length} enabled entries, resolved ${enabledLive.length}); ` +
                `bound ${rebound.boundById} by id, ${rebound.boundByPosition} by position; ${rebound.unbound} will resolve from serialized config`,
            );
        }
      } catch (error) {
        this.#mastra
          ?.getLogger?.()
          ?.warn?.(`[DurableAgent] Failed to resolve model list during recover(${runId}): ${error}`);
      }
    }
    executionFence.throwIfLost();

    // Like step-level rehydration, fail recovery rather than run the recovered
    // turn without memory (nothing it produces would be persisted).
    let memory;
    try {
      memory = await wrapped.getMemory({ requestContext });
    } catch (error) {
      this.#mastra
        ?.getLogger?.()
        ?.error?.(`[DurableAgent] Failed to resolve memory during recover(${runId}): ${error}`);
      throw new DurableProcessorRebuildError(this.id, error);
    }
    executionFence.throwIfLost();

    // The entry below carries a live model, so resolveRuntimeDependencies trusts
    // it as fully hydrated and never rebuilds tools — they must be restored here.
    let tools: Record<string, CoreTool> = {};
    let workspace;
    try {
      tools = await wrapped.getToolsForExecution({
        runId,
        threadId,
        resourceId,
        requestContext,
        memoryConfig: workflowInput.state?.memoryConfig,
        autoResumeSuspendedTools: workflowInput.options?.autoResumeSuspendedTools,
        clientTools: workflowInput.options?.clientTools as ToolsInput | undefined,
        // Tools a processor (ToolSearch) loaded mid-run are only recorded in the run's transcript (#26437).
        runMessages: latestMessageListState
          ? new MessageList({ threadId, resourceId })
              .deserialize(latestMessageListState as Parameters<MessageList['deserialize']>[0])
              .get.all.db()
          : undefined,
      });
      workspace = await wrapped.getWorkspace({ requestContext });
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] recover(${runId}) tool resolution failed: ${error}`);
    }
    executionFence.throwIfLost();

    const saveQueueManager = memory
      ? new SaveQueueManager({
          logger: this.#mastra?.getLogger?.() as any,
          memory,
          onSaved: recordRunSavedMessages(runId),
        })
      : undefined;
    const backgroundTasksConfig = this.getBackgroundTasksConfig?.();
    const backgroundTaskManager = this.#mastra?.backgroundTaskManager;

    let inputProcessors: any[] = [];
    let llmRequestInputProcessors: any[] = [];
    let outputProcessors: any[] = [];
    let errorProcessors: any[] = [];
    try {
      inputProcessors = (await (wrapped as any).listInputProcessors?.(requestContext)) ?? [];
      llmRequestInputProcessors = (await (wrapped as any).__listLLMRequestProcessors?.(requestContext)) ?? [];
      outputProcessors = (await (wrapped as any).listOutputProcessors?.(requestContext)) ?? [];
      errorProcessors = (await (wrapped as any).listErrorProcessors?.(requestContext)) ?? [];
    } catch (error) {
      // Running the recovered turn without its processors would silently skip guardrails.
      this.#mastra?.getLogger?.()?.error?.(`[DurableAgent] recover(${runId}) processor resolution failed: ${error}`);
      throw new DurableProcessorRebuildError(this.id, error);
    }
    executionFence.throwIfLost();

    const processorStates = new Map<string, any>();
    const origAgentSpanData = workflowInput.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined;
    const origModelSpanData = workflowInput.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined;
    let recoverAgentSpan: Span<SpanType.AGENT_RUN> | undefined;
    let recoverModelSpan: AIModelGenerationSpan | undefined;
    if (this.#mastra?.observability) {
      // The crashed process never ended the original spans, and stores persist
      // only span-end events, so end them here — otherwise the recovered span
      // below is parented under a root that never lands (or stays RUNNING).
      // Skip when they were already ended: as `suspended` before a resume, or
      // by map-final-output before the crash.
      if (!originalSpansEnded) {
        try {
          const observability = this.#mastra.observability.getSelectedInstance({ requestContext });
          const output = { status: 'interrupted' as const, reason: 'run recovered after its process stopped' };
          if (origModelSpanData)
            observability
              ?.rebuildSpan(origModelSpanData)
              ?.end({ output, outcome: 'interrupted', stopReason: null, stopReasonContext: null });
          if (origAgentSpanData)
            observability
              ?.rebuildSpan(origAgentSpanData)
              ?.end({ output, outcome: 'interrupted', stopReason: null, stopReasonContext: null });
        } catch (error) {
          this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to end interrupted spans: ${error}`);
        }
      }
      try {
        const persistedHead = persistedModelList?.find(entry => entry.enabled);
        const rawConfig =
          typeof (wrapped as any).toRawConfig === 'function' ? (wrapped as any).toRawConfig() : undefined;
        const resolvedVersionId = rawConfig?.resolvedVersionId as string | undefined;
        const agentTracingPolicy =
          typeof wrapped.getTracingPolicy === 'function' ? wrapped.getTracingPolicy() : undefined;
        recoverAgentSpan = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          outcome: null,
          name: `agent run: '${wrapped.id}' (recovered)`,
          entityType: EntityType.AGENT,
          entityId: wrapped.id,
          entityName: wrapped.name,
          // The persisted list is the run's shape: the recovered step tries its
          // first enabled entry first, as the live model rebound to that id, or
          // rebuilt from the serialized config when the resolver no longer returns it.
          attributes: modelSpanAttributes(
            modelList?.find(entry => entry.id === persistedHead?.id)?.model ?? persistedHead?.config ?? model,
          ),
          metadata: {
            runId,
            recovered: true,
            ...(origAgentSpanData?.id ? { recoveredFromSpanId: origAgentSpanData.id } : {}),
            ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
          },
          tracingPolicy: agentTracingPolicy,
          resumeFrom: getResumeTracingContext(origAgentSpanData),
          requestContext,
          mastra: this.#mastra,
        });
        recoverModelSpan = recoverAgentSpan?.createChildSpan({
          type: SpanType.MODEL_GENERATION,
          outcome: null,
          name: `llm: '${model?.modelId ?? ''}'`,
          attributes: { model: model?.modelId, provider: model?.provider, streaming: true },
          tracingPolicy: agentTracingPolicy,
          metadata: { runId, recovered: true },
          requestContext,
        });
      } catch (error) {
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to open recover span: ${error}`);
      }
    }
    // Every worker's steps report under the recovered pair and finish the MODEL_STEP the crashed
    // execution left open. The originals' own steps stay as a suspension ended them.
    carrySegmentSpans(
      requestContext,
      runId,
      recoverAgentSpan
        ? {
            ...openedSegment(recoverAgentSpan, recoverModelSpan),
            adoptsOpenSteps: true,
            ...(openStepsOf
              ? { openStepsOf }
              : originalSpansEnded && origModelSpanData?.id
                ? { endedStepsOf: origModelSpanData.id }
                : {}),
          }
        : null,
    );
    executionFence.throwIfLost();

    const restoredCompletion = await restoreCompletionPolicy({
      agent: wrapped,
      persisted: workflowInput.options?.isTaskComplete,
      requestContext,
      runId,
      logger: this.#mastra?.getLogger?.(),
    });

    const registryEntry = {
      isTaskComplete: restoredCompletion,
      // Call-time toolset tools died with the original process. Mark the entry
      // as a placeholder so the first step rebuilds tools and fails loudly
      // (DURABLE_AGENT_TOOLSETS_UNAVAILABLE) instead of running without them.
      isPlaceholder: (workflowInput.options?.toolsetToolNames?.length ?? 0) > 0,
      // Restore the original run's flag from the persisted snapshot so a
      // warm resume after recovery keeps returning scoringData without the
      // caller re-passing the option.
      returnScorerData: workflowInput.options?.returnScorerData,
      mastra: this.#mastra,
      // The live model below makes resolveRuntimeDependencies skip its rebuild,
      // so processor hooks only get the agent if it is stored here.
      agent: wrapped,
      model,
      modelList,
      tools,
      workspace,
      memory,
      saveQueueManager,
      requestContext,
      agentSpan: recoverAgentSpan,
      // Same live handles resume() installs: terminal end()/error() in this process target the
      // recovered spans instead of the persisted originals ended above.
      resumeAgentSpan: recoverAgentSpan,
      resumeModelSpan: recoverModelSpan,
      // abortController/abortSignal are installed by
      // installAbortWithTotalTimeout below, with the run-level budget
      // composed in.
      // Restore the run-level execution budget from the persisted snapshot so
      // a recovered session is bounded like the original one (#21724).
      timeoutTotalMs: workflowInput.options?.modelSettings?.timeout?.totalMs,
      // Rebuild the live structured output config from the persisted JSON Schema
      // so the recovered stream still emits `object-result` chunks.
      structuredOutput: workflowInput.options?.structuredOutput?.schema
        ? {
            ...workflowInput.options.structuredOutput,
            schema: toLiveStructuredOutputSchema(
              workflowInput.options.structuredOutput.schema,
              workflowInput.options.structuredOutput.nullToUndefined,
            ),
          }
        : undefined,
      backgroundTaskManager,
      backgroundTasksConfig,
      inputProcessors,
      llmRequestInputProcessors,
      outputProcessors,
      errorProcessors,
      processorStates,
      drainPendingSignals: (scope?: 'pending' | 'pre-run') => wrapped.__getDrainPendingSignals()(runId, scope),
      subscribePendingSignals: (listener: PendingSignalListener) =>
        wrapped.__getSubscribePendingSignals()(runId, listener),
      enqueuePendingSignal: (signalInput: AgentSignalInput) =>
        wrapped.__getEnqueuePendingSignal()({ runId, resourceId, threadId }, signalInput),
      cleanup: () => {},
    };
    this.installAbortWithTotalTimeout(registryEntry as unknown as RunRegistryEntry, abortController, executionFence);
    // The recovered run's deadline saves the turn as of the crash, until its first step snapshots it.
    this.#runInputs.set(executionFence, {
      ...workflowInput,
      messageListState:
        (latestMessageListState as DurableAgenticWorkflowInput['messageListState'] | undefined) ??
        workflowInput.messageListState,
    });

    return {
      requestContext,
      threadId,
      resourceId,
      messageList,
      recoverAgentSpan,
      recoverModelSpan,
      registryEntry,
    };
  }

  /**
   * Emit an error event to pubsub.
   *
   * @param runId - The run ID
   * @param error - The error to emit
   * @param generation - Claim generation of the execution reporting the error
   * @internal
   */
  protected async emitError(runId: string, error: Error, generation?: number): Promise<void> {
    // End the root spans on error so the trace exports (mirrors the non-durable map-results-step). Behind a broker
    // another worker may have ended the open step already, so the worker that handles its failure ends it.
    const evented = this.executionEngine.resolveWorkflowEngine(this.workflowEngine, this.logger) === 'evented';
    const bus = this.#mastra?.pubsub ?? this.getPubSub();
    endRunSpansWithError(runId, error, { endStep: !evented || !bus || !reachesOtherProcesses(bus) });
    await runOutsideRunFenceScope(() =>
      emitErrorEvent(
        this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        runId,
        error,
        generation,
        shouldRejectStream(error) ? 'reject' : undefined,
      ),
    );
  }

  /**
   * Raise the memory store the run writes to to the fence's claim before the
   * run touches memory. Settles the fence if a newer claim already covers
   * memory. Memory that cannot be resolved stays unfenced: the run's own
   * memory writes fail the same way. Warns about a memory store that can't
   * fence when the run is being recovered, or when recovery is automatic.
   */
  private async coverMemory(fence: ExecutionFence, requestContext: RequestContext, recovering = false): Promise<void> {
    if (fence.generation === undefined) return;
    let store: MemoryStorage | undefined;
    try {
      const memory = await this.getMemory({ requestContext });
      store = memory ? await memory.storage.getStore('memory') : undefined;
    } catch (error) {
      this.logger.warn(`[DurableAgent] run ${fence.runId}: memory is not fenced, failed to resolve its store`, {
        runId: fence.runId,
        error,
      });
    }
    if (recovering || this.#mastra?.recoveryConfig?.durableAgents === 'auto') {
      await this.executionEngine.warnIfUnfenced(store, 'memory', this.guardrailLogger);
    }
    try {
      await fence.coverMemory(store);
    } catch (error) {
      await fence.settle(async () => {});
      throw error;
    }
  }

  /**
   * The pubsub a run's workflow publishes on, bound to its execution.
   *
   * Once the execution loses the run, `abortController` is aborted so the LLM
   * stream and tool calls stop, and the execution's publishes are dropped:
   * the run's topics are shared with the new owner's consumers, which must not
   * see this execution's chunks or the `finish` its abort produces.
   *
   * The evented engine publishes on `mastra.pubsub` instead of this pubsub.
   * Its shared workflow controller must not be aborted on ownership loss:
   * that would publish a cancellation to the recovering execution. Durable
   * step guards instead cancel invocation-local work and suppress its stream
   * publications, leaving engine failure and settlement events untouched.
   *
   * @internal
   */
  protected fenceRunPubSub(
    executionFence: ExecutionFence | undefined,
    abortController: AbortController | undefined,
    pubsub: PubSub = this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
  ): PubSub {
    return this.executionEngine.fenceRunPubSub(
      executionFence,
      abortController,
      pubsub,
      this.workflowEngine,
      this.logger,
    );
  }

  /**
   * End an execution segment: publish the error of a failed segment and delete
   * the snapshots of a run that reached a non-suspended terminal status.
   *
   * With an execution fence these writes happen only while the segment still
   * owns the run, and the fence is released afterwards. A superseded segment
   * writes nothing — the run belongs to the execution that took it over. A
   * segment that lost its lease without being replaced still reports its error
   * but keeps the snapshots so the run stays recoverable.
   *
   * Never rejects: a pubsub that is already closing (for example during
   * shutdown) must not turn a run's own failure into an unhandledRejection.
   *
   * @internal
   */
  protected async settleExecution(
    runId: string,
    fence: ExecutionFence | undefined,
    outcome: { status?: string; error?: Error },
  ): Promise<void> {
    const { status, error } = outcome;
    if (fence && this.#timedOutExecutions.has(fence)) return;
    const totalTimeout = isMastraTimeoutError(error) && error.timeoutType === 'total';
    if (fence && totalTimeout) this.#timedOutExecutions.add(fence);
    const reportError = async (reported: Error) => {
      try {
        await this.emitError(runId, reported, fence?.generation);
      } catch (publishError) {
        this.logger.warn(`Failed to publish error event for run ${runId}`, { runId, error: publishError });
      }
    };
    // Reaching any non-suspended terminal status means the run is done and its
    // persisted snapshot rows will never be resumed. Suspended runs keep their
    // snapshots (and owner records) so `resume()` / `recoverActiveRuns()` can
    // find them.
    const finished = totalTimeout || (status !== undefined && status !== 'suspended');
    const runInput = totalTimeout && fence ? this.#runInputs.get(fence) : undefined;
    // Captured before the error below lets the caller clean the run up.
    const runInputEntry =
      runInput && (getRunRegistryEntry(runId, this.#mastra) ?? (fence && this.#recoveredEntries.get(fence)));
    let wrote = false;
    let deadlineSave: Promise<void> | undefined;
    const writeTerminalState = async () => {
      wrote = true;
      if (totalTimeout && fence) fence.deadlineError = error;
      if (runInput && runInputEntry && !runInputEntry.tripwire) {
        // The run never reaches its finish step, so the output processors get their pass here, over the
        // steps that completed in time (or just the accepted request). Saves made under the claim the
        // deadline replaced are rejected; this one writes under the replacement. Saves upsert by ID.
        // Like the finish step, memory is saved before the caller sees the run end.
        this.#runInputs.delete(fence!);
        deadlineSave = (async () => {
          // A tool the deadline aborted still gets its grace window to return; wait (bounded) so its step can be saved.
          await settledOrElapsed(
            new Promise<void>(resolve => whenRunStepsSettle(runInputEntry, resolve)),
            TOOL_ABORT_GRACE_MS + TOOL_SETTLE_MARGIN_MS,
          );
          const deadlineSpan = runInputEntry.resumeAgentSpan ?? runInputEntry.agentSpan;
          await runDurableDeadlineOutputPass({
            runId,
            initData: runInput,
            ...deadlineMessageListState(runInputEntry, runInput.messageListState),
            entry: runInputEntry,
            executionId: fence!.executionId,
            mastra: this.#mastra,
            tracingContext: deadlineSpan ? { currentSpan: deadlineSpan } : undefined,
            logger: this.logger,
          });
        })().catch(saveError => {
          this.logger.warn(`Failed to save run ${runId} at its total deadline`, { runId, error: saveError });
        });
        // Saved before the caller sees the run end, unless the store hangs: the deadline must still surface.
        await settledOrElapsed(deadlineSave, DEADLINE_SAVE_WAIT_MS);
      }
      // The observable deadline must not wait for snapshot I/O.
      if (error) await reportError(error);
      if (finished) await this.deleteRunSnapshots(runId);
      // Final runs no longer need abort listeners; suspended runs keep theirs for resume.
      if (finished) await releaseRemoteAbortListener(runId, this.#mastra);
      // The claim is held until the save lands (bounded), so it is not rejected as a stale write.
      if (deadlineSave) await settledOrElapsed(deadlineSave, DEADLINE_SAVE_CLAIM_HOLD_MS);
    };

    if (!fence) return writeTerminalState();
    let settlement;
    try {
      settlement = await fence.settle(writeTerminalState, totalTimeout);
    } catch (settlementError) {
      if (totalTimeout && !wrote && error) await reportError(error);
      throw settlementError;
    }
    // A deadline losing to normal completion or suspension must not publish a
    // second terminal event. Non-timeout bookkeeping failures still surface.
    if (!wrote && error && (settlement === 'orphaned' || (!totalTimeout && settlement === 'owned'))) {
      await reportError(error);
    }
  }

  private async redeliverDeadlineError(entry: RunRegistryEntry, fence: ExecutionFence): Promise<boolean> {
    if (!fence.deadlineError) return false;
    if (!entry.deadlineErrorRedelivered) {
      entry.deadlineErrorRedelivered = true;
      await this.emitError(fence.runId, fence.deadlineError, fence.generation);
    }
    return true;
  }

  /**
   * Install `abortController` on a registry entry with the run-level execution
   * budget (`modelSettings.timeout.totalMs`, #21724 parity port) composed in.
   *
   * Every durable step reads `abortSignal` off the registry, so composing here
   * bounds the whole session — every loop iteration, tool call and retry.
   * Pass-through when no budget is configured. The budget is armed per
   * execution session (stream/generate/resume), matching the main loop where
   * each session gets a fresh timer. The timer is torn down via the entry's
   * `cleanup` slot, which every settle path invokes through the run registry.
   */
  private installAbortWithTotalTimeout(
    entry: RunRegistryEntry,
    abortController: AbortController,
    executionFence: ExecutionFence,
  ): void {
    entry.abortController = abortController;
    entry.deadlineErrorRedelivered = false;
    const totalTimeout = createTimeoutAbortSignal({
      parentSignal: abortController.signal,
      timeoutMs: entry.timeoutTotalMs,
      timeoutType: 'total',
      // The controller is per-session, but entry cleanup can also run on registry
      // eviction while calls holding `entry.abortSignal` are still in flight (#26126).
      // Only tear down the timer so `abort()` keeps reaching them.
      detachParentOnCleanup: false,
    });
    entry.abortSignal = totalTimeout.signal;
    if (totalTimeout.timeoutPromise) {
      void totalTimeout.timeoutPromise
        .catch(async error => {
          if (!isMastraTimeoutError(error) || error.timeoutType !== 'total' || totalTimeout.signal?.reason !== error)
            return;
          await this.settleExecution(executionFence.runId, executionFence, { status: 'failed', error });
        })
        .catch(error => {
          this.logger.warn('Failed to settle durable agent at its total deadline', { error });
        });
    }
    void executionFence.whenSettled.then(() => totalTimeout.cleanup());
    const previousCleanup = entry.cleanup;
    entry.cleanup = () => {
      totalTimeout.cleanup();
      previousCleanup?.();
    };
  }

  /**
   * Delete the persisted workflow snapshot rows for a completed durable run.
   *
   * A durable agent write two rows per run: one for the outer `AGENTIC_LOOP`
   * workflow and one for the nested `AGENTIC_EXECUTION` workflow (persisted
   * under the same `runId`). Once the run reaches a non-suspended terminal
   * state neither row is needed again — leaving them behind fills snapshot
   * storage with stale `pending`/`running` rows for every completed run and
   * pollutes `listActiveRuns` / `recoverActiveRuns` on the next boot.
   *
   * Best-effort: a cleanup failure must never turn a finished run into an
   * error — a stale row is preferable to a broken exit path.
   *
   * @internal
   */
  protected async deleteRunSnapshots(runId: string): Promise<void> {
    try {
      await this.executionEngine.deleteRunSnapshots(runId, this.getWorkflow());
    } catch (error) {
      this.#mastra
        ?.getLogger?.()
        ?.warn?.(`[DurableAgent] Failed to delete workflow snapshot rows after terminal state`, { runId, error });
    }
  }

  /**
   * Recover a single durable run whose in-process agentic loop was orphaned by
   * a process restart. Streamable counterpart to
   * {@link DurableAgent.recoverActiveRuns} — where the bulk API only re-drives
   * the workflow and returns counts, `recover()` rebuilds the run's
   * non-serializable state (message list, model, tools, memory,
   * saveQueueManager, request context, agent span) from the persisted workflow
   * snapshot and returns a fresh {@link DurableAgentStreamResult} whose
   * `fullStream` observes the recovered run through pubsub.
   *
   * Because the rebuilt registry entry carries `memory` + `saveQueueManager`,
   * the durable agentic workflow's terminal step will flush new messages to
   * memory just like a fresh `stream()` call would. The single-run form is
   * useful when operators want to attach listeners to a specific recovered
   * run; for boot-time bulk recovery of every orphaned run, use
   * `recoverActiveRuns()`.
   *
   * Only orphaned runs are recovered. If another execution still owns the run
   * (its lease is live), this throws `DURABLE_AGENT_RUN_ACTIVE` with the
   * holder and a `retryAt` hint; pass `{ force: true }` to take the run over,
   * which aborts the other execution and rejects its later writes. A run this
   * process is already driving or recovering, or one that is suspended, is
   * refused with its own error id (use `resume()` for suspended runs).
   *
   * When the store doesn't fence runs, an execution whose lease lapsed with
   * nobody taking the run over keeps the thread's lease until that expires,
   * up to 15 seconds later. Until then this throws `DURABLE_AGENT_RUN_ACTIVE`
   * with `retryAt` no earlier than the expiry. The lease can't be released
   * sooner: an execution that recovers the run in the same process holds it
   * under the same run id.
   *
   * @example
   * ```typescript
   * const { fullStream, output, cleanup } = await durableAgent.recover(runId, {
   *   onChunk: chunk => process.stdout.write(chunk.payload?.text ?? ''),
   * });
   * for await (const chunk of fullStream) {
   *   // ...
   * }
   * cleanup();
   * ```
   */
  async recover(
    runId: string,
    options?: DurableAgentRecoverOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    if (!this.#resolveExecutionEngine()) return this.#requireDurableExecution('recover');
    const workflowsStore = await this.executionEngine.recoveryStore(runId, this.name, this.guardrailLogger);

    // 1. Validate the persisted durable-agent input before claiming ownership
    //    so obvious caller errors fail fast.
    let { workflowInput } = await this.executionEngine.loadRecoverableSnapshot(workflowsStore, runId, this);
    this.executionEngine.assertRecoveryActive();

    // A crashed run that was executing a stored version must recover on
    // *that* version — rehydration rebuilds tools/model/instructions from
    // whatever `this` currently resolves to, which for status selectors
    // hot-switches to the latest publish (mirrors the resume() pin above).
    // Resolution happens BEFORE lease acquisition so we never delegate to a
    // fork while holding the lease; reading the pin from the pre-claim
    // snapshot is safe because `agentVersionId` is stamped once at
    // preparation and never mutated. Unlike resume(), recover options carry
    // no call-site version selector, so the pin always wins here — recovery
    // is unattended and has no operator escape hatch.
    const pinnedVersionId = workflowInput.agentVersionId;
    if (pinnedVersionId && this.#mastra && !this.__isStoredVersionApplied()) {
      const currentVersionId = this.toRawConfig()?.resolvedVersionId as string | undefined;
      if (pinnedVersionId !== currentVersionId) {
        try {
          const resolved = await this.#mastra.resolveVersionedAgent(this as unknown as Agent, {
            versionId: pinnedVersionId,
          });
          if (resolved !== (this as unknown as Agent)) {
            return (resolved as unknown as Agent<TAgentId, TTools, TOutput>).recover(runId, options);
          }
        } catch (versionError) {
          // The pinned version may have been deleted while the run sat
          // crashed — recover on the current definition rather than failing
          // an unattended path (mirrors resume()'s deleted-pin fallback).
          this.logger.warn('Failed to resolve pinned agent version for durable recovery, using current definition', {
            agentId: this.id,
            runId,
            pinnedVersionId,
            error: versionError,
          });
        }
      }
    }

    // 2. Claim the run before resolving any live dependencies so a concurrent
    //    caller cannot finish first and leave this attempt using a stale
    //    snapshot.
    this.executionEngine.assertRecoveryActive();
    const releaseLocalRecovery = this.executionEngine.claimLocalRecovery(this.id, this.name, runId);
    const { controller: abortController } = createRunAbortController(options?.abortSignal);

    let executionFence: ExecutionFence | undefined;
    let recoveryState: RehydratedRecoveryState;
    let finishPublishedBeforeCrash: boolean;
    let claimedSnapshot: WorkflowRunState;
    try {
      // Claim the run only while no execution is live, or take it over from
      // the live one under `force`, before reading its state: from here on any
      // other execution can no longer write (#23734).
      executionFence = await this.executionEngine.claimExecution(
        runId,
        options?.force ? 'takeover' : 'recover',
        this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        this.logger,
        this.#untrackedRunLiveness(runId, workflowInput),
      );
      this.executionEngine.assertRecoveryActive();
      // An earlier owner may have completed while this one claimed. Re-read
      // after the claim and recover from that authoritative snapshot, never
      // from the pre-claim copy.
      const loaded = await this.executionEngine.loadRecoverableSnapshot(workflowsStore, runId, this);
      workflowInput = loaded.workflowInput;
      claimedSnapshot = loaded.snapshot;
      // map-final-output publishes FINISH before saving its result. Restart skips
      // that saved success, so recovery must publish FINISH for the new subscriber.
      finishPublishedBeforeCrash = loaded.finishPublishedBeforeCrash;
      // Before anything is registered, so a failed load leaves only the claim to release.
      await this.loadRecalledMessages(runId, loaded.snapshot);
      executionFence.throwIfLost();
      recoveryState = await this.#rehydrateRecoveryState({
        runId,
        workflowInput,
        abortController,
        executionFence,
        originalSpansEnded: loaded.originalSpansEnded,
        openStepsOf: loaded.openStepsOf,
        latestMessageListState: await this.loadLatestMessageListState(workflowsStore, runId, loaded.snapshot),
      });
      // Memory is resolved from the rehydrated context; rehydration does not write to it.
      await this.coverMemory(executionFence, recoveryState.requestContext, true);
      this.#recoveredEntries.set(executionFence, recoveryState.registryEntry as unknown as RunRegistryEntry);
      this.executionEngine.assertRecoveryActive();
    } catch (error) {
      const settlement = await executionFence?.settle(async () => {});
      if (executionFence && settlement !== 'superseded' && this.executionEngine.shouldReportRecoveryFailure(error)) {
        await this.#reportRecoveryFailure(runId, error, executionFence.generation);
      }
      releaseLocalRecovery();
      throw error;
    }
    const { requestContext, threadId, resourceId, messageList, recoverAgentSpan, recoverModelSpan, registryEntry } =
      recoveryState;
    if (executionFence.generation !== undefined) {
      // Record the earliest event from the step the persisted snapshot will re-execute.
      // A replay can then omit the abandoned tail without losing completed iterations.
      const supersededFrom = await this.executionEngine.recoverySupersededFrom(
        workflowsStore,
        runId,
        claimedSnapshot,
        () => this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        () => this.logger,
      );
      await emitOwnershipClaimedEvent(
        this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        runId,
        executionFence.generation,
        supersededFrom,
      ).catch(error => {
        this.logger.warn(`[DurableAgent] recover(${runId}) failed to announce its claim on the run stream`, {
          runId,
          error,
        });
      });
    }
    setExecutionClaim(requestContext, runId, executionFence.claim);
    registryEntry.executionFence = executionFence;

    // 3. Cleanup plumbing (mirrors stream()/resume()).
    // Assigned once the recovered stream is created below so the shared
    // performCleanup() closure can unsubscribe the pubsub reader (via
    // streamCleanup) from both the auto-cleanup timer and the explicit
    // cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;
    const cleanupOwnedRegistryState = () => {
      // A warm resume reuses the registry entry but replaces its execution fence.
      if (registryEntry.executionFence !== executionFence) return;
      if (this.executionRunRegistry.get(runId) === registryEntry) {
        this.executionRunRegistry.cleanup(runId);
      }
      if (getRunRegistryEntry(runId, this.#mastra) === registryEntry) {
        globalRunRegistry.delete(runId);
        // The topic stays when the run's latest execution here (this one or a
        // later resume()) lost the run: whoever took it over writes to it.
        if (
          !this.#unverifiedReaderFences.has(executionFence) &&
          (registryEntry.executionFence?.ownsRunTopics() ?? true)
        )
          this.clearPubsubTopic(runId, registryEntry);
      }
    };
    // Single cleanup path for the auto-cleanup timer, the explicit cleanup(),
    // and the recovery error paths. Revokes continuation before unsubscribing
    // the pubsub reader, then tears down the owned registry entries. Runs at
    // most once.
    const runCleanup = createRunCleanup({
      scheduleTimer: cleanup => this.scheduleReaderCleanup(executionFence, cleanup),
      release: () => {
        agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
        streamCleanup?.();
        cleanupOwnedRegistryState();
      },
    });
    const performCleanup = runCleanup.run;
    const scheduleAutoCleanup = runCleanup.schedule;

    let workflow: ReturnType<DefaultAgentExecutionEngine['getWorkflow']>;
    try {
      this.executionEngine.assertRecoveryActive();
      workflow = this.getWorkflow();
    } catch (error) {
      const settlement = await executionFence.settle(async () => {});
      if (settlement !== 'superseded' && this.executionEngine.shouldReportRecoveryFailure(error)) {
        await this.#reportRecoveryFailure(runId, error, executionFence.generation);
      }
      releaseLocalRecovery();
      throw error;
    }

    // 4. Register the reconstructed state and recovered stream only after
    //    claiming the run.
    const { stream, threadRegistration } = await this.#setupRecoveredStream({
      runId,
      workflowInput,
      requestContext,
      threadId,
      resourceId,
      messageList,
      registryEntry,
      options,
      scheduleAutoCleanup,
      executionFence,
    }).catch(error => {
      releaseLocalRecovery();
      throw error;
    });
    const { output, cleanup: createdStreamCleanup, ready } = stream;
    streamCleanup = createdStreamCleanup;
    const recoveryPubsub = this.fenceRunPubSub(executionFence, abortController);

    // 5. Re-drive the workflow from the persisted snapshot in the background
    //     and delete snapshot rows on non-suspended terminals (same contract
    //     as start()/resume()). Errors are also broadcast via `emitError` so
    //     observers on the pubsub topic see the failure. Callers who await
    //     the returned `workflowExecution` (e.g. `recoverActiveRuns()`) see
    //     the raw rejection so they can classify the run as failed.
    // Races the claim's loss so a recovery that lost the run settles promptly
    // even if the workflow ignores the abort.
    const workflowExecution = executionFence.run(() =>
      this.executionEngine
        .raceFenceLoss(ready, executionFence)
        .then(async () => {
          const result = await this.executionEngine.restartRun(
            workflow,
            executionFence,
            recoveryPubsub,
            this.workflowEngine,
            this.logger,
            resourceId,
            requestContext,
            createObservabilityContext({ currentSpan: recoverAgentSpan }),
          );
          if (finishPublishedBeforeCrash && result?.status === 'success') {
            // The run's result is map-final-output's saved output, passed through
            // execute-scorers unchanged: the same payload the lost FINISH carried.
            const { output: finalOutput, stepResult, tracingTermination, stopCause } = result.result;
            // map-final-output, which ends the recovered spans, did not re-run. It saved the outcome
            // it ended the run's spans with, so the recovered pair ends the same way.
            recoverModelSpan?.end({ ...tracingTermination });
            recoverAgentSpan?.end({ ...tracingTermination, output: { text: finalOutput?.text } });
            await emitFinishEvent(recoveryPubsub, runId, {
              output: finalOutput,
              stepResult,
              ...(stopCause && { stopCause }),
            });
          }
          if (result?.status === 'suspended' && options?.closeOnSuspend) {
            // Same contract as resume(): close on the persisted suspension,
            // after flushing and delivering already-published events.
            await this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub.flush();
            await stream.waitForEventDelivery();
            executionFence.throwIfLost();
            stream.detach();
          }
          // Snapshot cleanup runs for every non-suspended terminal (success or
          // failed) so storage stays bounded — mirrors the start()/resume()
          // contract — but only while this recovery still owns the run.
          const finished = !!result?.status && result.status !== 'suspended';
          await executionFence.settle(async () => {
            if (finished) await this.deleteRunSnapshots(runId);
            if (finished) await releaseRemoteAbortListener(runId, this.#mastra);
          });
          if (result?.status === 'failed') {
            throw this.executionEngine.workflowFailureError((result as any).error, 'Workflow recover failed');
          }
        })
        .catch(async error => {
          if (error?.id === RECOVER_SHUTDOWN_ERROR_ID) {
            await executionFence.abandon();
          }
          const executionError = this.executionEngine.workflowExecutionError(error, 'Workflow recover failed');
          // Settles a recovery that failed before the run finished; otherwise
          // returns the settlement reached above.
          const settlement = await executionFence.settle(async () => {});
          if (settlement === 'superseded') {
            // Nothing is reported for a superseded recovery, so nothing else
            // ends the recovered spans; stores only persist span ends.
            const output = { status: 'interrupted' as const, reason: 'recovery superseded' };
            recoverModelSpan?.end({ output, outcome: 'interrupted', stopReason: null, stopReasonContext: null });
            recoverAgentSpan?.end({ output, outcome: 'interrupted', stopReason: null, stopReasonContext: null });
            // The execution that took the run over holds the thread lease under
            // the same runId and owns the run's topic: leave both to it.
            await threadRegistration?.rollback({ releaseLease: false });
            performCleanup();
          } else if (
            !this.#timedOutExecutions.has(executionFence) &&
            !(await this.#reportRecoveryFailure(runId, executionError, executionFence.generation))
          ) {
            await threadRegistration?.rollback();
            performCleanup();
          }
          throw executionError;
        })
        .finally(releaseLocalRecovery),
    );
    const trackedRecoverEntry = getRunRegistryEntry(runId, this.#mastra);
    if (trackedRecoverEntry) {
      trackedRecoverEntry.workflowExecution = workflowExecution;
    }
    // Guard against unhandled rejection warnings for callers who don't await
    // `workflowExecution` (single-run `recover()` returns a stream, not the
    // workflow promise). Errors are already surfaced through `emitError` /
    // the stream's `onError` callback.
    workflowExecution.catch(() => {});

    // Route the explicit cleanup through the shared performCleanup() so it, the
    // auto-cleanup timer, and the recovery error paths release the same resources.
    const cleanup = performCleanup;

    const abort = async (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
      // Also stop the run wherever it is actually executing — see
      // `requestRemoteAbort`. The local controller above only reaches steps
      // running in this process.
      await this.requestRemoteAbort(runId);
      // A run parked on a suspension has no steps left to stop; release it so
      // it is no longer listed as suspended.
      if (agentThreadStreamRuntime.isRunParked(runId, this.getPubSub())) this.abortRunStream(runId);
    };

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      threadId,
      resourceId,
      traceId: output.traceId,
      spanId: output.spanId,
      cleanup,
      abort,
    };
  }

  /**
   * Clear retained pubsub state for a run's topics (cached history and, for
   * persistent transports, the underlying stream). Fire-and-forget: the
   * `clearTopic` contract is best-effort and non-throwing.
   *
   * Clears both the agent stream topic and `workflow.events.v2.<runId>`.
   * The agent stream topic is cleared only here, on both engines. For the
   * workflow events topic the engines differ:
   * - Default engine (`DurableAgent`): no other cleanup exists — without
   *   this, CachingPubSub permanently orphans a no-TTL counter key per
   *   completed run.
   * - Evented engine (`EventedAgent`): the WorkflowEventProcessor also
   *   clears `workflow.events.v2.<runId>` via its own delayed,
   *   restart-guarded terminal cleanup. The two clears overlap safely:
   *   `clearTopic` is idempotent and clearing an empty topic is a no-op.
   *
   * This needs no restart guard of its own — the lifecycle facts are
   * engine-agnostic: cleanup timers arm only on terminal outcomes
   * (FINISH/ERROR/ABORT — never SUSPENDED), `resume()` rejects runs whose
   * snapshot isn't `suspended`, and `untilIdle` continuations mint a fresh
   * runId per segment. An execution that lost its run never calls this:
   * the execution that took the run over, in this or another process, may
   * still be writing to both topics, so it clears them when it ends. The one
   * evented-only edge — at-least-once redelivery writing to the workflow
   * events topic after this clear — is covered by the WEP's own cleanup,
   * which reschedules deletion on that run's terminal end.
   */
  private clearPubsubTopic(runId: string, entry = getRunRegistryEntry(runId, this.#mastra)): void {
    const publisher = getExecutionStreamOwner({
      runId,
      agentId: this.id,
      mastra: this.#mastra,
      agent: this,
      entry,
    });
    if (publisher) void publisher.cleanup();
    else void this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub.clearTopic(AGENT_STREAM_TOPIC(runId));
    void this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub.clearTopic(`workflow.events.v2.${runId}`);
  }
  // ---------------------------------------------------------------------------
  // Durable invocation and resume orchestration
  //
  // Plain agents only publish streams; execution requires an engine.
  #beginSegment(runId: string): symbol {
    const segment = Symbol(runId);
    this.#segmentOwner.set(runId, segment);
    return segment;
  }

  #releaseSegment(runId: string, segment: symbol, entry: RunRegistryEntry): boolean {
    if (this.#segmentOwner.get(runId) !== segment) return false;
    this.#segmentOwner.delete(runId);
    if (this.executionRunRegistry.get(runId) === entry) this.executionRunRegistry.cleanup(runId);
    return true;
  }

  async #loadSuspendedIteration(
    runId: string,
  ): Promise<{ toolCalls: ToolCallChunk[]; resumedText?: { priorText: string; stepText: string } }> {
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const { toolCalls, resumedText } = await this.executionEngine.loadSuspendedIteration(workflowsStore, runId);
    const toolCallChunks: ToolCallChunk[] = toolCalls.map(toolCall => ({
      type: 'tool-call',
      runId,
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: toolCall.args,
        providerMetadata: toolCall.providerMetadata as ToolCallChunk['payload']['providerMetadata'],
        providerExecuted: toolCall.providerExecuted,
        output: toolCall.output,
      },
    }));
    return { toolCalls: toolCallChunks, resumedText };
  }

  async #resolveDurableRunOptions(
    options?: DurableAgentStreamOptions<TOutput>,
    snapshot?: AgentScopesSnapshot,
  ): Promise<DurableAgentStreamOptions<TOutput>> {
    if ((options as any)?.[RESOLVED_EXECUTION_OPTIONS]) {
      return options!;
    }

    const defaultOptions = await this.getDefaultOptions({ requestContext: options?.requestContext });
    const resolvedOptions = deepMerge(
      withDefaultToolCallConcurrencyLimit(defaultOptions ?? {}, options) as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as DurableAgentStreamOptions<TOutput>;
    this.#warnInheritedExecutionOptions(resolvedOptions);
    // Actor is a per-call trust signal, so an explicit value replaces the
    // default actor as a whole rather than inheriting any of its fields.
    if (options?.actor !== undefined) {
      resolvedOptions.actor = options.actor;
    }
    const scopedOptions = await this.#applyScopes(resolvedOptions, {
      callScopes: options?.scopes,
      defaultScopes: defaultOptions?.scopes,
      snapshot,
    });
    // Preserve the marker when the until-idle wrapper spreads these options.
    Object.defineProperty(scopedOptions, RESOLVED_EXECUTION_OPTIONS, { value: true, enumerable: true });
    Object.defineProperty(scopedOptions, RESOLVED_DEFAULT_OPTIONS, { value: defaultOptions, enumerable: true });
    return scopedOptions;
  }

  /**
   * Applies agent scopes to durable execution options. Durable runs resolve their thread and
   * resource from `memory` only, so options are returned unchanged unless the run has scopes.
   */
  async #applyScopes<T extends DurableAgentStreamOptions<TOutput>>(
    options: T,
    {
      callScopes,
      defaultScopes,
      snapshot,
    }: { callScopes?: string[]; defaultScopes?: string[]; snapshot?: AgentScopesSnapshot },
  ): Promise<T> {
    const requestContext = options.requestContext ?? new RequestContext();
    // A resumed run keeps its suspended scopes, so the Agent's configuration is not consulted.
    const incomingScopes = snapshot?.scopes
      ? undefined
      : incomingAgentScopes({ requestContext, callScopes, defaultScopes, mastra: this.#mastra });
    const agentScopes = incomingScopes ? await this.getScopes({ requestContext, scopes: incomingScopes }) : undefined;
    if (!agentScopes?.length && !callScopes?.length && !requestContext.has(MASTRA_SCOPES_KEY) && !snapshot?.scopes) {
      return options;
    }
    const resolved = resolveAgentScopes({
      requestContext,
      agentScopes,
      incomingScopes,
      callScopes,
      memory: options.memory,
      snapshot,
      mastra: this.#mastra,
    });
    return applyResolvedAgentScopes(options, resolved, requestContext);
  }

  /** Runs whose restartable start row this process wrote and may still discard. */
  #restartableStarts = new Set<string>();

  async #persistInitialInput(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    // A crash after the input is saved but before the workflow's first checkpoint would strand a
    // stored user message that no run answers, so make the run recoverable first (#30791).
    try {
      await persistDurableRunInput(runId, workflowInput, this.#mastra, async () => {
        await this.getWorkflow().__persistRestartableStart({
          runId,
          resourceId: workflowInput.state?.resourceId,
          input: workflowInput,
          requestContext: getRunRegistryEntry(runId, this.#mastra)?.requestContext,
          // A write that rejects may still have committed, so the row counts as ours from here.
          onWrite: () => this.#restartableStarts.add(runId),
        });
      });
    } catch (error) {
      await this.#discardRestartableStart(runId, workflowInput.agentId);
      throw error;
    }
  }

  /**
   * Deletes the run's restartable start row if the workflow never wrote over it. A start that
   * failed before its first checkpoint was reported to the caller, so recovery must not redo it.
   */
  async #discardRestartableStart(runId: string, agentId: string): Promise<void> {
    // Only the execution that wrote the row, and only while it still owns the run: a recoverer
    // that took over restarts from this same row until its first checkpoint.
    if (!this.#restartableStarts.delete(runId)) return;
    try {
      await assertExecutionOwned({
        runId,
        agentId,
        mastra: this.#mastra,
        requestContext: getRunRegistryEntry(runId, this.#mastra)?.requestContext,
      });
      const snapshot = await this.executionEngine.loadRunSnapshot(runId);
      const context = snapshot?.context as Record<string, unknown> | undefined;
      if (
        snapshot?.status === 'running' &&
        snapshot.activePaths?.length === 0 &&
        context &&
        Object.keys(context).length === 1 &&
        Object.hasOwn(context, 'input')
      ) {
        await this.deleteRunSnapshots(runId);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete the start snapshot of failed run ${runId}`, { runId, error });
    }
  }

  /**
   * Execute the durable workflow.
   *
   * Engines select the blocking or background execution path.
   * Subclasses such as InngestAgent may override execution for an external backend.
   *
   * @param runId - The unique run ID
   * @param workflowInput - The serialized workflow input
   * @internal
   */
  protected async executeWorkflow(
    runId: string,
    workflowInput: DurableAgenticWorkflowInput,
  ): Promise<{ status?: string } | void> {
    if (this.executionEngine.executionMode === 'background') {
      return this.#executeBackgroundWorkflow(runId, workflowInput);
    }
    const workflow = this.getWorkflow();
    const entry = getRunRegistryEntry(runId, this.#mastra);
    const requestContext = entry?.requestContext;
    // Captured now: a later resume() replaces the registry's fence.
    const executionFence = entry?.executionFence;

    // Populate the run row's resourceId column so storage-level resource
    // filters (listSuspendedRuns / listActiveRuns) can narrow the query,
    // mirroring the non-durable agentic loop (loop/workflows/stream.ts).
    const memoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const resourceId = workflowInput.state?.resourceId ?? memoryInfo?.resourceId;

    const run = await this.executionEngine.createRun(workflow, {
      runId,
      resourceId,
      pubsub: this.fenceRunPubSub(executionFence, entry?.abortController),
    });
    // Parent the workflow run under the AGENT_RUN span so the trace exports under it.
    let result;
    try {
      result = await this.#withSuspensionAfterPersist(runId, () =>
        this.executionEngine.startRun(
          run,
          workflowInput,
          requestContext,
          createObservabilityContext({ currentSpan: entry?.agentSpan }),
        ),
      );
      const outcome = this.executionEngine.finishExecution(runId, executionFence, false, { result });
      if (outcome.owner === 'agent') await this.settleExecution(runId, executionFence, outcome);
      return result;
    } finally {
      this.executionEngine.releaseRun(workflow, runId, run, result?.status);
    }
  }

  async #executeBackgroundWorkflow(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    // Captured now: a later resume() replaces the registry's fence before this
    // segment's background promise settles.
    const entry = getRunRegistryEntry(runId, this.#mastra);
    const executionFence = entry?.executionFence;
    const pubsub = this.#mastra?.pubsub ?? this.getPubSub();
    const { sharedExecution, usesRunPubSub } = this.executionEngine.prepareExecution(
      pubsub,
      executionFence,
      this.workflowEngine,
      this.logger,
      this.guardrailLogger,
    );
    if (entry) entry.eventedExecution = sharedExecution;
    try {
      const workflow = this.getWorkflow();
      await this.executionEngine.ensureEngineWorkersStarted(this.workflowEngine, this.logger);
      const memoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const threadId = workflowInput.state?.threadId ?? memoryInfo?.threadId;
      const resourceId = workflowInput.state?.resourceId ?? memoryInfo?.resourceId;
      if (sharedExecution && pubsub && entry?.requestContext && executionFence && threadId) {
        await agentThreadStreamRuntime.claimDurableThreadLease(
          pubsub,
          runId,
          threadId,
          resourceId,
          executionFence.generation,
          executionFence.executionId,
          true,
        );
        // A takeover can supersede this execution while the thread lease is contended.
        try {
          await executionFence.verify();
        } catch (error) {
          await agentThreadStreamRuntime
            .abandonDurableThreadLease(
              pubsub,
              runId,
              threadId,
              resourceId,
              executionFence.generation,
              executionFence.executionId,
            )
            .catch(releaseError =>
              this.logger.warn('Failed to release thread lease after losing execution ownership', {
                runId,
                error: releaseError,
              }),
            );
          throw error;
        }
        setExecutionClaim(entry.requestContext, runId, {
          ...executionFence.claim,
          threadId,
          resourceId,
        });
      }
      // Evented workers publish on the host bus. A default-engine fallback must
      // instead publish on this run's transport or the caller's stream hangs.
      const run = await this.executionEngine.createRun(workflow, {
        runId,
        resourceId,
        ...(usesRunPubSub ? { pubsub: this.fenceRunPubSub(executionFence, entry?.abortController) } : {}),
      });
      // Track completion so an immediate resume waits for suspension persistence.
      await this.executionEngine
        .startRun(
          run,
          workflowInput,
          entry?.requestContext,
          createObservabilityContext({ currentSpan: entry?.agentSpan }),
        )
        .then(
          result => this.executionEngine.finishExecution(runId, executionFence, sharedExecution, { result }),
          async error => {
            await this.#discardRestartableStart(runId, workflowInput.agentId);
            return this.executionEngine.finishExecution(runId, executionFence, sharedExecution, { error });
          },
        )
        .then(outcome => {
          if (outcome.owner === 'agent') return this.settleExecution(runId, executionFence, outcome);
          if (outcome.error) {
            return this.emitError(runId, outcome.error, executionFence?.generation).catch(publishError =>
              this.logger.warn(`Failed to publish error event for run ${runId}`, { runId, error: publishError }),
            );
          }
        });
    } catch (error) {
      await this.#discardRestartableStart(runId, workflowInput.agentId);
      await this.settleExecution(runId, executionFence, {
        error: this.executionEngine.workflowExecutionError(error, 'Workflow execution failed'),
      });
    }
  }

  /**
   * Run a workflow leg with suspension chunks/events held back until the leg
   * returns, i.e. until the engine has saved the suspended snapshot. Without
   * this a crash between publishing the question and saving the snapshot
   * leaves a run that `resume()` rejects (#26435).
   */
  async #withSuspensionAfterPersist<T>(runId: string, execute: () => Promise<T>): Promise<T> {
    const entry = this.executionEngine.suspendPersistedOnReturn ? getRunRegistryEntry(runId, this.#mastra) : undefined;
    if (!entry) return execute();
    const pending: Array<() => Promise<void>> = [];
    entry.pendingSuspensionEvents = pending;
    let result: T;
    try {
      result = await execute();
    } finally {
      if (entry.pendingSuspensionEvents === pending) delete entry.pendingSuspensionEvents;
    }
    // Only announce a suspension the engine actually persisted; if persisting failed,
    // the run isn't resumable and the queued events would advertise a dead question.
    if ((result as { status?: string } | undefined)?.status === 'suspended') {
      for (const publish of pending) {
        try {
          await publish();
        } catch (error) {
          this.logger.warn('Failed to publish deferred suspension event', { runId, error });
        }
      }
    }
    return result;
  }

  /**
   * Claim the run's execution fence (#23734): `acquire` for a new execution
   * segment, `takeover` when recovering an orphaned run. With a
   * `requestContext`, the claim also covers the run's memory store (see
   * {@link DurableAgent.coverMemory}).
   */
  async #claimExecution(
    runId: string,
    mode: 'acquire' | 'recover' | 'takeover',
    requestContext?: RequestContext,
    untrackedRun?: UntrackedRunLiveness,
  ): Promise<ExecutionFence> {
    const fence = await this.executionEngine.claimExecution(
      runId,
      mode,
      this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
      this.logger,
      untrackedRun,
    );
    if (requestContext) await this.coverMemory(fence, requestContext);
    return fence;
  }

  async #isRunCanceledInStorage(runId: string): Promise<boolean> {
    return this.executionEngine.isRunCanceledInStorage(runId);
  }

  /**
   * A durable run parked on a suspension has no prepared run in this process, so the
   * base abort cannot tell it was parked and never deletes its snapshot. Once a resume
   * is rejected by the abort fence the run can never continue; delete its snapshot rows
   * if they are still suspended so it drops out of `listSuspendedRuns()` (#27619), and
   * publish the abort terminal so observers still attached to the parked run close.
   * Done here rather than at abort time: a run still executing in this process unwinds
   * through its own abort path, which reads the snapshot.
   * A run the abort already marked `canceled` keeps its row, since that row is what
   * stops other servers from resuming it; its abort terminal was published by the
   * abort, and is published here only if that publish failed.
   */
  async #deleteFencedSuspendedRun(runId: string): Promise<void> {
    try {
      const snapshot = await this.executionEngine.loadRunSnapshot(runId);
      if (snapshot?.status === 'canceled') {
        await this.executionEngine.publishCanceledRunTerminal(
          runId,
          this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        );
        return;
      }
      if (snapshot?.status !== 'suspended') return;
      await this.deleteRunSnapshots(runId);
      await emitAbortEvent(this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub, runId, {
        steps: [],
        text: '',
      });
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`Failed to delete snapshot of aborted suspended run ${runId}`, {
        runId,
        error,
      });
    }
  }

  async #streamDurable(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    options = await this.#resolveDurableRunOptions(applyReservedMemoryContextKeys(options));

    // Delegate to the idle-loop wrapper when `untilIdle` is set.
    // Strip `untilIdle` before passing to the wrapper so its internal
    // agent.stream() call doesn't recurse.
    if (options?.untilIdle) {
      const { untilIdle, ...rest } = options;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      // The idle helper normally resolves defaults for scope discovery. These
      // options are already resolved, so keep its inner stream on the same values.
      const resolvedOptionsAgent = {
        id: this.id,
        getDefaultOptions: () => ({}),
        getMemory: (args?: any) => this.getMemory(args),
        // Legacy wrappers route continuations through their public stream() so subclass overrides still run.
        stream: this.returnsDurableStreamResult
          ? this.stream.bind(this)
          : (innerMessages: MessageListInput, innerOptions?: DurableAgentStreamOptions<TOutput>) =>
              this.#streamDurable(innerMessages, innerOptions),
      } as unknown as DurableAgent<any, any, TOutput>;
      return runDurableStreamUntilIdle<TOutput>(
        resolvedOptionsAgent,
        messages,
        { ...rest, maxIdleMs },
        {
          activeStreams: this.activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
      );
    }

    return this.#startDurableRun(messages, options, 'stream');
  }

  async #startDurableRun(
    messages: MessageListInput,
    options: DurableAgentStreamOptions<TOutput>,
    methodType: 'stream' | 'generate',
  ): Promise<DurableAgentStreamResult<TOutput>> {
    // Enforce agent-level FGA (agents:execute) before durable execution. The
    // base Agent enforces this in its stream()/generate(); durable execution
    // runs a workflow instead and would otherwise skip the gate. This also
    // covers evented subclasses, which inherit stream()/generate().
    await this.requireAgentExecutionFGA({
      requestContext: options?.requestContext,
      memory: options?.memory,
      runId: options?.runId,
      actor: options?.actor,
    });

    validateModelTimeoutSettings(options?.modelSettings?.timeout);

    const runId = resolveRunId(options?.runId);
    const requestContext = options?.requestContext ?? new RequestContext();
    return this.#onReservedThread(runId, options, () =>
      this.#prepareAndStartDurableRun(messages, options, methodType, runId, requestContext),
    );
  }

  /**
   * Takes the run's thread before `start` reads or writes anything, as `Agent.stream()` does, so a
   * second message on a busy thread waits for the run in flight instead of running beside it (#30069).
   * A registered run owns the thread from then on. A run that fails before it registers gives the
   * thread back.
   */
  async #onReservedThread<T>(
    runId: string,
    options: DurableAgentStreamOptions<TOutput> | undefined,
    start: () => Promise<T>,
  ): Promise<T> {
    const pubsub = this.getPubSub();
    // The same options registerRun reads, so both name the same thread.
    const reserved =
      (await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
        this as unknown as Agent<any, any, any, any>,
        { memory: options?.memory, requestContext: options?.requestContext, runId },
        pubsub,
      )) === 'reserved';
    try {
      return await start();
    } catch (error) {
      // A thread already held under this run id belongs to whoever started the run: a signal wake,
      // a queued message, or an earlier call with the same run id. It stays theirs to release.
      if (reserved) agentThreadStreamRuntime.releaseThreadRunReservation(runId, pubsub);
      throw error;
    }
  }

  async #prepareAndStartDurableRun(
    messages: MessageListInput,
    options: DurableAgentStreamOptions<TOutput>,
    methodType: 'stream' | 'generate',
    runId: string,
    requestContext: RequestContext,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    // 1. Claim the run before preparing it, so a run that is already executing
    // fails before any span or memory write is made for this call.
    const executionFence = await this.#claimExecution(runId, 'acquire', requestContext);

    // 1a. Prepare for durable execution (non-durable phase)
    let preparation: PreparationResult<TOutput>;
    try {
      preparation = await prepareForDurableExecution<TOutput>({
        agent: this.agentForExecution as Agent<string, any, TOutput>,
        messages,
        options: options as AgentExecutionOptions<TOutput>,
        runId,
        requestContext,
        optionsAreResolved: true,
        resolvedDefaultOptions: (options as any)?.[RESOLVED_DEFAULT_OPTIONS],
        scopesResolved: true,
        onRequestContextEntryOmitted: this.#executionEnginePolicy.inherited
          ? () =>
              this.#warnExecutionPolicy(
                'requestContextSnapshot',
                'Mastra-inherited durable execution omitted a value from the request context snapshot. Use JSON-safe values that fit in the snapshot if another process needs them.',
              )
          : undefined,
        mastra: this.#mastra,
        methodType,
        durableAgentId: this.id,
        durableAgentName: this.name,
      });
    } catch (error) {
      // The run never started: drop its owner record rather than leave it behind.
      await executionFence.settle(async () => {});
      throw error;
    }

    const { messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;
    // Set after preparation so request-context schema validation never sees it.
    setExecutionClaim(requestContext, runId, executionFence.claim);
    registryEntry.executionFence = executionFence;
    this.#runInputs.set(executionFence, workflowInput);

    // 1b. Install the abort controller for this run. The controller is owned
    // by this DurableAgent instance; the result's abort() method flips it,
    // and the durable LLM-execution step reads `abortSignal` off the registry
    // to thread it into the model call + abort short-circuits. If the caller
    // also supplied an external signal, forward its abort to the internal
    // controller so either source can cancel the run.
    const { controller: abortController } = createRunAbortController(options?.abortSignal);
    if (agentThreadStreamRuntime.isRunAborted(runId, this.getPubSub())) {
      abortController.abort();
    }
    this.installAbortWithTotalTimeout(registryEntry, abortController, executionFence);

    // Share the scope before either registry copies the entry.
    const readLocalRequest = createLocalRequestReader(runId, registryEntry, this.#mastra);

    // 2. Register non-serializable state (both local and global registries)
    registryEntry.agentId = this.id;
    this.executionRunRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
    const globalRegistryEntry = { ...registryEntry, messageList };
    globalRunRegistry.set(runId, globalRegistryEntry);
    await this.attachStreamPublisher(runId, { threadId, resourceId });
    const segment = methodType === 'stream' ? this.#beginSegment(runId) : undefined;

    // Assigned once the stream is created below. Declared here so the shared
    // performCleanup() closure can unsubscribe the pubsub reader (via
    // streamCleanup) from both the auto-cleanup timer and the explicit
    // cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;

    // Stream segments and generate registry entries have distinct release guards.
    // Neither may tear down state registered by a newer execution.
    const releaseRunState = () => {
      if (segment !== undefined) {
        if (!this.#releaseSegment(runId, segment, registryEntry)) return;
      } else if (this.executionRunRegistry.get(runId) === registryEntry) {
        this.executionRunRegistry.cleanup(runId);
      }
      if (getRunRegistryEntry(runId, this.#mastra) === globalRegistryEntry) {
        globalRunRegistry.delete(runId);
        if (
          !this.#unverifiedReaderFences.has(executionFence) &&
          (globalRegistryEntry.executionFence?.ownsRunTopics() ?? true)
        )
          this.clearPubsubTopic(runId, globalRegistryEntry);
      }
    };

    const runCleanup = createRunCleanup({
      scheduleTimer: cleanup => this.scheduleReaderCleanup(executionFence, cleanup),
      release: () => {
        agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
        streamCleanup?.();
        releaseRunState();
      },
      // Generate's timer releases state without disposing its draining reader.
      ...(methodType === 'generate' ? { releaseOnTimer: releaseRunState } : {}),
    });
    const performCleanup = runCleanup.run;
    // Schedule automatic registry cleanup after stream ends
    const scheduleAutoCleanup = runCleanup.schedule;

    // Generate closes at suspension; stream defaults to staying open for a
    // same-reader resume. The same value gates stream's continuation.
    const closeOnSuspend = methodType === 'generate' || (options?.closeOnSuspend ?? false);
    const closeOnPersistedSuspend =
      methodType === 'stream' && closeOnSuspend && this.executionEngine.suspendPersistedOnReturn;

    // 3. Create the durable agent stream (subscribes to pubsub)
    const {
      output,
      cleanup: createdStreamCleanup,
      detach: detachStream,
      waitForEventDelivery,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
      runId,
      minGeneration: executionFence.generation,
      onTerminalEvent: this.owningReaderTerminal(runId, executionFence),
      readLocalRequest,
      messageId,
      model: {
        modelId: workflowInput.modelConfig.modelId,
        provider: workflowInput.modelConfig.provider,
        version: 'v3',
      },
      threadId,
      resourceId,
      onChunk: options?.onChunk,
      experimentalTransform: options?.experimentalTransform,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onStreamFinished: scheduleAutoCleanup,
      onError: async error => {
        await options?.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: options?.onSuspended,
      onAbort: async data => {
        try {
          await (options?.onAbort as ((event: any) => void | Promise<void>) | undefined)?.(data);
        } finally {
          scheduleAutoCleanup();
        }
      },
      // onIterationComplete is NOT forwarded here — the dowhile predicate
      // now calls it in-process from globalRunRegistry and honors its return
      // value ({ continue, feedback }). The pubsub ITERATION_COMPLETE event
      // still fires for external observability subscribers.
      // When the engine reports the persisted suspension, the stream is closed
      // after executeWorkflow() returns (below) rather than on the SUSPENDED
      // event, which is published before the snapshot is saved.
      closeOnSuspend: closeOnSuspend && !closeOnPersistedSuspend,
      ...(methodType === 'stream' ? { hideSignals: options?.hideSignals } : {}),
      structuredOutput: registryEntry.structuredOutput as any,
      outputProcessors: registryEntry.outputProcessors,
      processorStates: registryEntry.processorStates,
      agent: registryEntry.agent,
      requestContext: registryEntry.requestContext,
      returnScorerData: workflowInput.options.returnScorerData,
      tracingContext: registryEntry.agentSpan ? { currentSpan: registryEntry.agentSpan } : undefined,
      messageList,
      messageListFollowsStream: () => !this.executionEngine.executesStepsLocally,
    });
    streamCleanup = createdStreamCleanup;

    // Install thread controls and lease renewal before shared dispatch can hand renewal to a worker.
    const threadRegistration = agentThreadStreamRuntime.registerRun(
      this as unknown as Agent<any, any, any, any>,
      output,
      options as AgentExecutionOptions<TOutput>,
      this.getPubSub(),
      {
        continuation: methodType === 'stream' && !closeOnSuspend ? 'across-suspension' : undefined,
        generation: executionFence.generation,
        ownershipLost: () => executionFence.isLost(),
        stepOwner: () => getRunRegistryEntry(runId, this.#mastra),
      },
    );

    // Wait for the stream subscription to prevent publishing before it is ready.
    const workflowExecution = executionFence.run(() =>
      Promise.all([ready, threadRegistration])
        .then(async () => {
          if (await this.redeliverDeadlineError(registryEntry, executionFence)) return;
          // Emit 'start' chunk before the workflow begins (matches regular agent's stream.ts).
          // Only initial generate()/stream() emits 'start'; resume() does not.
          await emitChunkEvent(
            fencePubSub(this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub, executionFence),
            runId,
            {
              type: 'start',
              runId,
              from: ChunkFrom.AGENT,
              payload: { id: workflowInput.agentId, messageId },
            },
          );
          if (this.__getGoalConfig()) {
            await beginGoalActivity({
              mastra: this.#mastra,
              agentId: workflowInput.agentId,
              threadId,
              runId,
              requestContext: getRunRegistryEntry(runId, this.#mastra)?.requestContext,
            });
          }
          let result: { status?: string } | void;
          try {
            await this.#persistInitialInput(runId, workflowInput);
            result = await this.executeWorkflow(runId, workflowInput);
          } catch (error) {
            await this.#discardRestartableStart(runId, workflowInput.agentId);
            throw error;
          } finally {
            // Past this point the workflow owns the row; a later failure must not delete it.
            this.#restartableStarts.delete(runId);
            await stopGoalActivity({ agentId: workflowInput.agentId, runId });
          }
          if (closeOnPersistedSuspend && result?.status === 'suspended') {
            // The workflow result is the persisted suspension boundary. Deliver
            // buffered events (including onSuspended) before closing the stream.
            await this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub.flush();
            await waitForEventDelivery();
            detachStream();
          }
          if (methodType === 'generate') return result;
        })
        .catch(error =>
          this.settleExecution(runId, executionFence, {
            error: this.executionEngine.workflowExecutionError(error, 'Workflow execution failed'),
          }),
        ),
    );
    const trackedEntry = getRunRegistryEntry(runId, this.#mastra);
    if (trackedEntry) {
      trackedEntry.workflowExecution = workflowExecution;
    }

    await threadRegistration;

    // 5. Cleanup function — routes through the shared performCleanup() so the
    // explicit call and the auto-cleanup timer release the same resources.
    // A cleanup() that arrives before the output settles waits for the run's
    // terminal event, including an error event still being published in the
    // background. Tearing down the reader first would drop it, leaving the
    // output unsettled and the thread busy forever (#25974).
    const cleanup = () => {
      if (methodType === 'generate' || runCleanup.done || output.status !== 'running') return performCleanup();
      void Promise.race([workflowExecution, executionFence.whenSettled])
        .then(() => this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub.flush())
        .then(() => waitForEventDelivery())
        .catch(() => {})
        .finally(performCleanup);
    };

    const abort = async (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
      // Also stop the run wherever it is actually executing — see
      // `requestRemoteAbort`. The local controller above only reaches steps
      // running in this process.
      await this.requestRemoteAbort(runId);
      // A run parked on a suspension has no steps left to stop; release it so
      // it is no longer listed as suspended.
      if (agentThreadStreamRuntime.isRunParked(runId, this.getPubSub())) this.abortRunStream(runId);
    };

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      threadId,
      resourceId,
      traceId: output.traceId,
      spanId: output.spanId,
      cleanup,
      abort,
    };
  }

  async #generateDurable(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<FullOutput<TOutput>> {
    options = await this.#resolveDurableRunOptions(applyReservedMemoryContextKeys(options));

    const { output, runId, cleanup } = await this.#startDurableRun(messages, options, 'generate');

    let suspended = false;
    try {
      const fullOutput = (await output.getFullOutput()) as FullOutput<TOutput>;
      if (fullOutput.error) throw fullOutput.error;
      suspended = fullOutput.finishReason === 'suspended';
      // On suspend, the SUSPENDED event is emitted from the tool-call step
      // before the workflow engine has persisted the snapshot. Awaiting the
      // workflow execution promise blocks until `run.start()` returns, which
      // happens after the suspend snapshot has been persisted — so a later
      // `resumeGenerate()` can find the snapshot. Subclasses that drive the
      // workflow with a fire-and-forget API (see `EventedAgent`) need their
      // own persistence guarantee here; their `executeWorkflow` promise may
      // resolve before the snapshot lands.
      if (suspended) {
        await getRunRegistryEntry(runId, this.#mastra)?.workflowExecution;
      }
      // Fall back to the stream-level runId if MastraModelOutput.runId wasn't
      // populated (no chunk surfaced before suspend).
      if (!fullOutput.runId) {
        (fullOutput as { runId?: string }).runId = runId;
      }
      return fullOutput;
    } finally {
      // Keep the registry entry alive on suspend so `resumeGenerate()` can
      // pick it up. Auto-cleanup is scheduled by FINISH/ERROR/ABORT paths.
      if (!suspended) {
        cleanup();
      }
    }
  }

  #requireDurableExecution(method: string): never {
    throw new MastraError({
      id: 'AGENT_DURABLE_METHOD_NOT_AVAILABLE',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Agent.${method}() requires durable execution. Set durable.executionEngine to 'default' or 'evented', or use createDurableAgent({ agent }).`,
      details: { agentId: this.id, method },
    });
  }

  /** Resume a suspended durable run. Requires createDurableAgent() or DurableAgent. */
  /**
   * Resume a suspended workflow execution.
   */
  async resume(
    runId: string,
    resumeData: unknown,
    options?: DurableAgentResumeOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    if (!this.#resolveExecutionEngine()) this.#requireDurableExecution('resume');
    const abortedRunError = () =>
      new MastraError({
        id: 'AGENT_RESUME_ABORTED_RUN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" cannot resume aborted run "${runId}".`,
        details: { agentName: this.name, runId },
      });
    if (agentThreadStreamRuntime.isResumeFenced(runId, this.getPubSub())) {
      // The fenced run can never continue, so the rejected caller must not find it in
      // listSuspendedRuns() afterwards (#27619).
      await this.#deleteFencedSuspendedRun(runId);
      throw abortedRunError();
    }
    // Marked before the first await, so a second resume of the same tool call
    // fails fast even when both start in the same tick (#27365).
    const toolCallId = options?.toolCallId;
    let releaseResumeMarker = () => {};
    if (toolCallId !== undefined) {
      const release = markResumeInFlight(runId, toolCallId);
      if (!release) {
        throw new MastraError({
          id: 'AGENT_RESUME_ALREADY_CLAIMED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it is already running.`,
          details: { agentName: this.name, runId, toolCallId },
        });
      }
      releaseResumeMarker = release;
    }
    try {
      // An abort on another server leaves the run canceled in storage.
      if (await this.#isRunCanceledInStorage(runId)) throw abortedRunError();
      return await this.#resumeRun(runId, resumeData, options, releaseResumeMarker);
    } catch (error) {
      releaseResumeMarker();
      throw error;
    }
  }

  /**
   * A resume claims the run by marking it `running` (#27619). When the process holding
   * that claim dies, nothing else moves the run on, so the run would stay unresumable.
   * Recover the run once the claim's lease has lapsed: when no running progress was
   * checkpointed (the default snapshot policy) recovery parks it at its suspension
   * again and this resume goes on; otherwise recovery finishes it.
   */
  async #takeOverResumeClaim(runId: string, workflowsStore: WorkflowsStorage): Promise<WorkflowRunState> {
    const outcome = (await this.recoverActiveRuns({ runId })).recovered[0];
    if (outcome?.status === 'skipped') {
      throw new MastraError({
        id: 'AGENT_RESUME_ALREADY_CLAIMED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it is still running.`,
        details: { agentName: this.name, runId, reason: outcome.reason ?? '', retryAt: outcome.retryAt ?? '' },
      });
    }
    if (outcome?.status === 'failed' && outcome.error) throw outcome.error;
    const persisted = await this.executionEngine.loadPersistedRunSnapshot(workflowsStore, runId);
    if (!persisted) {
      throw new MastraError({
        id: 'AGENT_RESUME_RUN_FINISHED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because it already finished: recovery completed it after the process running its previous resume stopped.`,
        details: { agentName: this.name, runId },
      });
    }
    return persisted.snapshot;
  }

  async #resumeRun(
    runId: string,
    resumeData: unknown,
    options: DurableAgentResumeOptions<TOutput> | undefined,
    releaseResumeMarker: () => void,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    let entry = this.executionRunRegistry.get(runId);
    // Scopes persisted with a run rebuilt from storage. They are the suspended run's set even when
    // the caller passes its own request context.
    let rehydratedScopes: unknown;
    let coldSnapshot: WorkflowRunState | undefined;
    if (!entry) {
      // A persisted durable run can outlive this process (or the registry TTL).
      // Rebuild the non-serializable runtime state before resuming the stored
      // workflow snapshot. Keep warm resumes on the existing path to avoid
      // racing an active registry entry with a second preparation pass.
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      const persisted = workflowsStore
        ? await this.executionEngine.loadPersistedRunSnapshot(workflowsStore, runId)
        : undefined;
      if (!persisted) {
        throw new MastraError({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `No registry entry found for run ${runId}. Cannot resume.`,
          details: { agentName: this.name, runId },
        });
      }

      let snapshot = persisted.snapshot;
      const readWorkflowInput = (snapshot: WorkflowRunState, allowRunning = false) => {
        if (snapshot?.status !== 'suspended' && !(allowRunning && snapshot?.status === 'running')) {
          throw new MastraError({
            id: 'AGENT_RESUME_RUN_NOT_SUSPENDED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because it is not waiting to be resumed (status: ${snapshot?.status}).`,
            details: { agentName: this.name, runId, status: snapshot?.status },
          });
        }
        const input = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
        if (!input || input.__workflowKind !== 'durable-agent') {
          throw new MastraError({
            id: 'DURABLE_AGENT_RESUME_INVALID_SNAPSHOT',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.SYSTEM,
            text: `DurableAgent "${this.name}" resume(${runId}): persisted snapshot does not contain a durable-agent workflow input.`,
            details: { agentName: this.name, runId },
          });
        }
        if (input.agentId !== this.id) {
          throw new MastraError({
            id: 'DURABLE_AGENT_RESUME_AGENT_MISMATCH',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            text: `DurableAgent "${this.name}" resume(${runId}): persisted run belongs to agent "${input.agentId}", not "${this.id}".`,
            details: { agentName: this.name, runId, ownerAgentId: input.agentId },
          });
        }
        return input;
      };
      let workflowInput = readWorkflowInput(snapshot, true);

      // A run that suspended while executing a stored version must resume on
      // *that* version. Cold rehydration rebuilds tools/model/instructions
      // from whatever `this` currently resolves to — which, for status
      // selectors, hot-switches to the latest publish mid-flight. Re-resolve
      // to the pinned id and delegate. An explicit exact version at the call
      // site is an operator escape hatch and wins over the pin, and forks
      // already produced by `resolveVersionedAgent` are left alone (they are
      // either this very delegation or an explicit server-side resolution).
      const pinnedVersionId = workflowInput.agentVersionId;
      if (pinnedVersionId && this.#mastra && !this.__isStoredVersionApplied()) {
        const callSiteSelector = options?.versions?.agents?.[this.id];
        const hasExplicitVersion = !!callSiteSelector && 'versionId' in callSiteSelector;
        const currentVersionId = this.toRawConfig()?.resolvedVersionId as string | undefined;
        if (!hasExplicitVersion && pinnedVersionId !== currentVersionId) {
          let resolved: Agent | undefined;
          try {
            resolved = await this.#mastra.resolveVersionedAgent(this as unknown as Agent, {
              versionId: pinnedVersionId,
            });
          } catch (versionError) {
            // The pinned version may have been deleted while the run sat
            // suspended — resume on the current definition rather than
            // failing at the approver (mirrors Agent#prepareAndStartPlainWorkflow's fallback).
            this.logger.warn('Failed to resolve pinned agent version for durable resume, using current definition', {
              agentId: this.id,
              runId,
              pinnedVersionId,
              error: versionError,
            });
          }
          if (resolved && resolved !== (this as unknown as Agent)) {
            // Hand the tool-call marker to the pinned agent's resume(), which
            // re-takes it synchronously before its first await.
            releaseResumeMarker();
            return (resolved as unknown as Agent<TAgentId, TTools, TOutput>).resume(runId, resumeData, options);
          }
        }
      }

      if (snapshot?.status === 'running' && workflowsStore) {
        // Recovery can execute the run. Dynamic defaults still require the rehydrated context below.
        this.agentForExecution.__validateStaticModelTimeoutSettings(options?.modelSettings);
        validateModelTimeoutSettings((options?.modelSettings ?? workflowInput.options?.modelSettings)?.timeout);
        snapshot = await this.#takeOverResumeClaim(runId, workflowsStore);
        workflowInput = readWorkflowInput(snapshot);
      }
      coldSnapshot = snapshot;

      const messageListMemoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
      const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;
      // The starting request's user and token are left out, so they come only from this resume.
      const snapshotRequestContext = workflowInput.requestContextEntries
        ? new RequestContext<unknown>(Object.entries(withoutLiveRequestKeys(workflowInput.requestContextEntries)))
        : undefined;
      if (snapshotRequestContext) restoreRunAgentScopes(snapshotRequestContext);
      const persistedScopes = workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY];
      if (
        persistedScopes !== undefined &&
        (!Array.isArray(persistedScopes) || persistedScopes.some(scope => typeof scope !== 'string'))
      ) {
        // A malformed persisted set must not be coerced to "no scopes": that would both
        // drop the run's scopes and falsely reject re-supplied ones as additions.
        throw new MastraError({
          id: 'AGENT_SCOPES_INVALID',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          // Corrupted persisted state is a system fault, not a caller error: no
          // `details.status`, so server handlers surface it as HTTP 500.
          text: `DurableAgent "${this.name}" resume(${runId}): persisted run scopes are malformed; expected an array of strings.`,
          details: { agentName: this.name, runId },
        });
      }
      // Absent (vs recorded []) marks a run suspended before the scopes upgrade; the resume
      // adopts the supplied scopes with the same trust posture as a fresh run.
      rehydratedScopes = persistedScopes;
      const memory = threadId
        ? {
            ...options?.memory,
            thread: threadId,
            resource: resourceId ?? options?.memory?.resource,
          }
        : options?.memory;

      // The resume below applies the suspended run's scopes, so preparation does not resolve them again.
      await this.prepare([], {
        [SCOPES_ALREADY_APPLIED]: true,
        [RESUMED_SPAN_DATA]: { agentSpanData: workflowInput.agentSpanData, modelSpanData: workflowInput.modelSpanData },
        ...(options as AgentExecutionOptions<TOutput>),
        runId,
        requestContext: options?.requestContext ?? snapshotRequestContext,
        memory,
        // Restore the original run's flag from the persisted snapshot so a
        // cross-process resume still returns scoringData; caller override wins.
        returnScorerData: options?.returnScorerData ?? workflowInput.options?.returnScorerData,
        // Restore the original run's modelSettings so the rebuilt registry
        // entry re-arms the run-level timeout budget (#21724); caller
        // override wins.
        modelSettings: options?.modelSettings ?? (workflowInput.options?.modelSettings as any),
      } as AgentExecutionOptions<TOutput>);
      entry = this.executionRunRegistry.get(runId);
    }
    if (!entry) {
      throw new Error(`Failed to rehydrate registry entry for run ${runId}. Cannot resume.`);
    }

    const memoryInfo = this.executionRunRegistry.getMemoryInfo(runId);
    const registeredMemory = memoryInfo?.threadId
      ? ({
          ...options?.memory,
          thread: memoryInfo.threadId,
          resource: memoryInfo.resourceId ?? options?.memory?.resource,
        } as DurableAgentStreamOptions<TOutput>['memory'])
      : options?.memory;

    // The suspended run's non-identity scopes live on its persisted request context;
    // its identity is the registered memory. A resume keeps that set (rule: re-supplied
    // scopes may only be a subset of it).
    // A recorded set — [] included — is authoritative: a resume may not add scopes.
    // Cold resumes read the persisted entries, which preparation stamps unconditionally,
    // so an absent value there marks a pre-upgrade snapshot whose resume adopts the
    // supplied scopes. Warm registry entries only exist for runs this (post-upgrade)
    // process started, so an absent live value simply means the run held no scopes.
    const snapshotScopes = coldSnapshot ? rehydratedScopes : (entry.requestContext?.get(MASTRA_SCOPES_KEY) ?? []);
    const resumeScopesSnapshot: AgentScopesSnapshot = {
      resourceId: memoryInfo?.resourceId,
      threadId: memoryInfo?.threadId,
      scopes: Array.isArray(snapshotScopes) ? snapshotScopes : undefined,
    };

    // The suspended run's values carry over, except the starting request's user and
    // token: those come only from this resume, so a resume without a signed-in user
    // can't act as the user who started the run.
    const carriedEntries = entry.requestContext
      ? Object.entries(withoutLiveRequestKeys(Object.fromEntries(entry.requestContext.entries())))
      : undefined;
    // Tools built for the starting request are bound to its context, so they are rebuilt below.
    const droppedStartingUser = carriedEntries !== undefined && carriedEntries.length < entry.requestContext!.size();
    // Copy only when user keys were removed; otherwise keep the run's own instance.
    let resumeRequestContext = droppedStartingUser ? new RequestContext<unknown>(carriedEntries) : entry.requestContext;
    if (options?.requestContext) {
      // Keep the caller's instance so schema-transformed contexts retain their
      // input source. Caller values win except for framework-managed memory.
      resumeRequestContext = options.requestContext;
      for (const [key, value] of carriedEntries ?? []) {
        // The suspended run's scopes are applied on the run's own context below, never the caller's.
        if (key === MASTRA_SCOPES_KEY) continue;
        if (!resumeRequestContext.has(key)) resumeRequestContext.set(key, value);
      }
      if (entry.requestContext?.has('MastraMemory')) {
        resumeRequestContext.set('MastraMemory', entry.requestContext.get('MastraMemory'));
      } else {
        resumeRequestContext.delete('MastraMemory');
      }
    }

    // The resumed segment always carries its own claim: without a context the
    // engine would restore the previous segment's claim from the snapshot.
    resumeRequestContext ??= new RequestContext();
    const resolvedOptions = (await this.#resolveDurableRunOptions(
      {
        ...(options as DurableAgentStreamOptions<TOutput>),
        requestContext: resumeRequestContext as DurableAgentStreamOptions<TOutput>['requestContext'],
        memory: registeredMemory ?? options?.memory,
      },
      resumeScopesSnapshot,
    )) as DurableAgentResumeOptions<TOutput>;
    validateModelTimeoutSettings(resolvedOptions.modelSettings?.timeout);
    // The first call's trace settings hold unless this resume call sets its own. The agent's
    // defaults are already part of them, so they must not win here.
    const { hideInput, hideOutput, requestContextKeys } = options?.tracingOptions ?? {};
    const resumeTracingOptions = { ...resolvedOptions.tracingOptions, hideInput, hideOutput, requestContextKeys };
    // Scoped runs execute on a run-scoped copy of the request context.
    resumeRequestContext = (resolvedOptions.requestContext as typeof resumeRequestContext) ?? resumeRequestContext;

    // Delegate to the idle-loop wrapper when `untilIdle` is set. Strip
    // `untilIdle` before passing to the wrapper so the inner agent.resume()
    // call (and subsequent agent.stream([]) continuations) don't recurse.
    if (resolvedOptions.untilIdle) {
      const { untilIdle, ...rest } = resolvedOptions;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      // The idle-loop wrapper re-enters resume() for this same tool call.
      releaseResumeMarker();
      const resolvedOptionsAgent = {
        id: this.id,
        getDefaultOptions: () => ({}),
        getMemory: (args?: any) => this.getMemory(args),
        resume: (innerRunId: string, innerResumeData: unknown, innerOptions?: DurableAgentResumeOptions<TOutput>) =>
          this.resume(innerRunId, innerResumeData, {
            ...innerOptions,
            tracingOptions: resumeTracingOptions,
          } as DurableAgentResumeOptions<TOutput>),
        // Legacy wrappers route continuations through their public stream() so subclass overrides still run.
        stream: this.returnsDurableStreamResult
          ? this.stream.bind(this)
          : (innerMessages: MessageListInput, innerOptions?: DurableAgentStreamOptions<TOutput>) =>
              this.#streamDurable(innerMessages, innerOptions),
      } as unknown as DurableAgent<any, any, TOutput>;
      return runResumeDurableStreamUntilIdle<TOutput>(
        resolvedOptionsAgent,
        runId,
        resumeData,
        { ...rest, maxIdleMs } as DurableAgentStreamOptions<TOutput> & { maxIdleMs?: number },
        {
          activeStreams: this.activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
      );
    }

    await this.requireAgentExecutionFGA({
      requestContext: resolvedOptions.requestContext,
      memory: resolvedOptions.memory,
      runId,
      snapshotMemoryInfo: memoryInfo,
      actor: resolvedOptions.actor,
    });

    // Settle the prior segment before claiming the run and reading its snapshot
    // and event offset. The suspension chunk can arrive before the suspended
    // snapshot is persisted, and a late suspension event replayed into the new
    // segment would close it early.
    const priorExecution = getRunRegistryEntry(runId, this.#mastra)?.workflowExecution;
    await priorExecution?.catch(() => {
      /* errors already handled by the prior segment */
    });
    // Claimed before the abort controller and timeout are replaced, so a
    // conflicting resume leaves the executing segment's state untouched.
    // Memory is covered only once the run is known to be resumable below, so a
    // resume that lost the race never raises the memory fence past the winner.
    const executionFence = await this.#claimExecution(runId, 'acquire');
    let initialToolCalls: ToolCallChunk[];
    let resumedText: { priorText: string; stepText: string } | undefined;
    let resumeOffset: number | 'latest';
    let persistedInput: DurableAgenticWorkflowInput | undefined;
    let suspendedToolCallIds: string[] = [];
    try {
      // A concurrent resume of the same suspension may have claimed and run it while this one
      // waited for the execution claim. Report that as a lost race, not a generic failure.
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      const current = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId,
      });
      // The row is gone once a run finishes (possibly in another process). When
      // this process already ran a segment of the run (settled above), a missing
      // row means there is nothing left to resume; resuming anyway would write a
      // fresh `pending` row. A run that was only prepared has no row yet.
      if (workflowsStore && !current && priorExecution) {
        throw new MastraError({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" resume(${runId}) could not find a suspended run for this runId. The run has already finished (for example, an earlier approval or resume already handled it), never suspended, or the runId is invalid.`,
          details: { agentName: this.name, runId },
        });
      }
      // Only a settled run counts: a just-suspended run's row can still read `running`
      // briefly, because the suspension chunk is emitted before the row is durable.
      if (current && !['suspended', 'running', 'pending', 'waiting'].includes(current.status)) {
        throw new MastraError({
          id: 'AGENT_RESUME_ALREADY_CLAIMED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it already ran.`,
          details: { agentName: this.name, runId },
        });
      }
      if (resumeRequestContext) await this.coverMemory(executionFence, resumeRequestContext);
      ({ toolCalls: initialToolCalls, resumedText } = await this.#loadSuspendedIteration(runId));
      // Skip events already broadcast by the original run (e.g. the SUSPENDED
      // chunk that paused it). Without this, a resume that closes on suspend
      // (resumeGenerate) would immediately close on the replayed SUSPENDED.
      resumeOffset = await this.executionEngine.getPubsubOffset(
        this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
        runId,
      );
      persistedInput = current?.context?.input as DurableAgenticWorkflowInput | undefined;
      suspendedToolCallIds = Object.keys(current?.resumeLabels ?? {});
      // A parked run that lost its thread lease must hold it again before the segment runs. Later
      // registration fails open, so take it here: a successor that now holds the thread refuses this
      // resume instead of running beside it, and the run stays parked.
      await agentThreadStreamRuntime.reacquireParkedRunLease(runId, this.getPubSub());

      // A rejected resume must not replace the context of the active segment.
      entry.requestContext = resumeRequestContext;
      entry.requestContextRebuilt = false;
      const globalEntryForContext = getRunRegistryEntry(runId, this.#mastra);
      if (globalEntryForContext) {
        globalEntryForContext.requestContext = resumeRequestContext;
        globalEntryForContext.requestContextRebuilt = false;
      }
      await this.loadRecalledMessages(runId, coldSnapshot, resumeRequestContext);
    } catch (error) {
      // The segment never started: release the run so it can be resumed again.
      await executionFence.settle(async () => {});
      throw error;
    }
    // A warm resume reuses the tools built for the first request, which close
    // over its request context, delegation hooks, and tool hooks (#25960). Rebuild them for
    // this call and swap in only entries still holding a request-built tool, so
    // tools a processor added or replaced are kept. Processor-added tools are
    // rebuilt for this call's request context instead (#27544). Cold resumes already
    // rebuilt everything in prepare() above.
    if (!coldSnapshot && (options?.requestContext || options?.delegation || options?.hooks || droppedStartingUser)) {
      try {
        const requestTools = await this.agentForExecution.getToolsForExecution({
          toolsets: resolvedOptions.toolsets,
          clientTools: resolvedOptions.clientTools,
          threadId: memoryInfo?.threadId,
          resourceId: memoryInfo?.resourceId,
          runId,
          requestContext: resumeRequestContext,
          memoryConfig: resolvedOptions.memory?.options,
          autoResumeSuspendedTools: resolvedOptions.autoResumeSuspendedTools,
          // resolvedOptions always carries defaultOptions.delegation, so only a delegation passed
          // to this resume may replace the one the first call parked on the entry.
          delegation: options?.delegation
            ? resolvedOptions.delegation
            : (entry.delegation ?? resolvedOptions.delegation),
          hooks: resolvedOptions.hooks,
          // Build for the method that started the run. `closeOnSuspend` is also a
          // stream() option and resumeStream() always sets it, so it cannot tell (#29436).
          methodType: entry.methodType ?? 'stream',
          backgroundTaskEnabled: Boolean(entry.backgroundTaskManager),
          backgroundTaskPolicy: resolvedOptions.backgroundTaskPolicy,
          model: entry.model,
        });
        const refresh = (current: Record<string, CoreTool>, previous: Record<string, CoreTool> | undefined) => {
          const next = { ...current };
          for (const [name, tool] of Object.entries(requestTools)) {
            // A name missing from current but present in previous was withheld by a processor.
            const configured = name in current ? current[name] === previous?.[name] : !previous || !(name in previous);
            if (configured) next[name] = tool;
          }
          return next;
        };
        for (const reg of new Set([entry, getRunRegistryEntry(runId, this.#mastra)])) {
          if (!reg) continue;
          reg.tools = rebindProcessorTools(refresh(reg.tools ?? {}, reg.requestTools), resumeRequestContext);
          if (reg.baseTools)
            reg.baseTools = rebindProcessorTools(refresh(reg.baseTools, reg.requestTools), resumeRequestContext);
          // Tools this rebuild did not produce still hold their earlier build, so
          // keep that as their baseline; otherwise a later resume can never refresh them.
          reg.requestTools = { ...reg.requestTools, ...requestTools };
          if (options?.delegation) reg.delegation = resolvedOptions.delegation;
        }
      } catch (error) {
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] resume(${runId}) tool resolution failed: ${error}`);
      }
    }
    setExecutionClaim(resumeRequestContext, runId, executionFence.claim);
    for (const reg of [entry, getRunRegistryEntry(runId, this.#mastra)]) {
      if (!reg) continue;
      reg.executionFence = executionFence;
      reg.resumeToolCallId = resolvedOptions.toolCallId;
    }

    // Install a fresh abort controller for the resumed segment. The original
    // controller is gone (the stream that owned it has already settled), so
    // we overwrite the registry slot. If the caller passed an external
    // signal, forward it onto the new internal controller.
    const { controller: abortController, detach: detachExternalAbort } = createRunAbortController(
      resolvedOptions.abortSignal,
    );
    if (agentThreadStreamRuntime.isRunAborted(runId, this.getPubSub())) {
      abortController.abort();
    }
    // Re-arm the run-level execution budget for the resumed session (#21724).
    // Warm resumes read the original budget parked on the registry entry;
    // cold resumes restored it from the persisted workflow input during
    // prepare(). A caller-supplied modelSettings on the resume call wins.
    const resumeTotalMs = (resolvedOptions.modelSettings as { timeout?: { totalMs?: number } } | undefined)?.timeout
      ?.totalMs;
    if (resumeTotalMs !== undefined) {
      entry.timeoutTotalMs = resumeTotalMs;
    }
    // The resumed segment's deadline saves the turn from the run's persisted input, as a first segment does.
    if (persistedInput) this.#runInputs.set(executionFence, persistedInput);
    this.installAbortWithTotalTimeout(entry, abortController, executionFence);
    const globalEntryForAbort = getRunRegistryEntry(runId, this.#mastra);
    if (globalEntryForAbort) {
      globalEntryForAbort.abortController = abortController;
      globalEntryForAbort.abortSignal = entry.abortSignal;
    }

    const segment = this.#beginSegment(runId);

    // Assigned once the stream is created below so the shared performCleanup()
    // closure can unsubscribe the pubsub reader (via streamCleanup) from both
    // the auto-cleanup timer and the explicit cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;
    // Set when a concurrent resume ran the run first: the topic is that resume's.
    let lostResumeRace = false;

    // Single cleanup path for both the auto-cleanup timer and the explicit
    // cleanup(). Revokes continuation before unsubscribing the pubsub reader,
    // then tears down the registry entries and pubsub topic this execution
    // still owns — an execution that recovered the run in this process holds
    // its own. The topic stays when the run's latest execution here (this one
    // or a later resume()) lost the run: whoever took it over, in any process,
    // writes to it. Runs at most once.
    const runCleanup = createRunCleanup({
      scheduleTimer: cleanup => this.scheduleReaderCleanup(executionFence, cleanup),
      release: () => {
        agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
        streamCleanup?.();
        if (this.#releaseSegment(runId, segment, entry)) {
          if (getRunRegistryEntry(runId, this.#mastra) === globalEntryForAbort) {
            globalRunRegistry.delete(runId);
            if (
              !this.#unverifiedReaderFences.has(executionFence) &&
              !lostResumeRace &&
              (globalEntryForAbort?.executionFence ?? executionFence).ownsRunTopics()
            ) {
              this.clearPubsubTopic(runId, globalEntryForAbort);
            }
          }
        }
      },
    });
    const performCleanup = runCleanup.run;
    const scheduleAutoCleanup = runCleanup.schedule;

    const globalEntry = getRunRegistryEntry(runId, this.#mastra);
    const resumeModel = globalEntry?.model as any;

    // Open a fresh AGENT_RUN + MODEL_GENERATION for the resumed segment on the same
    // traceId — the originals were ended as `suspended` and can't be reopened. Post-resume
    // steps + terminal end() target these via the registry override.
    // Opened before the stream adapter so per-chunk processor spans parent under it.
    const origTraceId = entry.agentSpan?.traceId;
    const origSpanId = entry.agentSpan?.id;
    // Spans this resume opened, ended by it alone if it turns out to have lost the run.
    const ownResumeSpans: Array<{ error: (options: { error: Error; endSpan: boolean }) => void } | undefined> = [];
    // The pair every worker's steps report under for this segment; none when it opened no spans.
    let resumeSegment: SegmentSpanData | null = null;
    if (origTraceId && this.#mastra?.observability) {
      try {
        const ag = this.agentForExecution as Agent<string, any, any>;
        // Match non-durable Agent.stream() resume-span shape.
        const rawConfig = typeof (ag as any).toRawConfig === 'function' ? (ag as any).toRawConfig() : undefined;
        const resolvedVersionId = rawConfig?.resolvedVersionId as string | undefined;
        const agentTracingPolicy = typeof ag.getTracingPolicy === 'function' ? ag.getTracingPolicy() : undefined;
        const suspendedToolCallId = resolvedOptions.toolCallId ?? suspendedToolCallIds[0];
        const resumeAgentSpan = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          outcome: null,
          name: `agent run: '${ag.id}' (resumed)`,
          entityType: EntityType.AGENT,
          entityId: ag.id,
          entityName: ag.name,
          input: buildResumeSpanInput(resumeData, {
            toolCallId: suspendedToolCallId,
            toolName: initialToolCalls.find(call => call.payload.toolCallId === suspendedToolCallId)?.payload.toolName,
          }),
          attributes: { conversationId: memoryInfo?.threadId, ...modelSpanAttributes(resumeModel) },
          metadata: {
            runId,
            resourceId: memoryInfo?.resourceId,
            threadId: memoryInfo?.threadId,
            resumed: true,
            ...(origSpanId ? { resumedFromSpanId: origSpanId } : {}),
            ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
          },
          resumeFrom: getWorkflowResumeTracingContext(entry.agentSpan),
          tracingPolicy: agentTracingPolicy,
          tracingOptions: { ...resumeTracingOptions, traceId: origTraceId },
          samplingDecision: entry.agentSpan?.isValid,
          requestContext: resolvedOptions.requestContext,
          mastra: this.#mastra,
        });
        const resumeModelSpan = resumeAgentSpan?.createChildSpan({
          type: SpanType.MODEL_GENERATION,
          outcome: null,
          name: `llm: '${resumeModel?.modelId ?? ''}'`,
          attributes: { model: resumeModel?.modelId, provider: resumeModel?.provider, streaming: true },
          tracingPolicy: agentTracingPolicy,
          metadata: { runId, resumed: true },
          requestContext: resolvedOptions.requestContext,
        });
        ownResumeSpans.push(resumeModelSpan, resumeAgentSpan);
        if (resumeAgentSpan) {
          resumeSegment = openedSegment(resumeAgentSpan, resumeModelSpan);
        }
        for (const reg of [entry, getRunRegistryEntry(runId, this.#mastra)]) {
          if (!reg) continue;
          reg.resumeAgentSpan = resumeAgentSpan;
          reg.resumeModelSpan = resumeModelSpan;
          // Fresh spans capture their own first-chunk clock, never a prior segment's.
          reg.resumeCompletionStartTime = undefined;
          reg.resumeTimeToFirstTokenMs = undefined;
        }
      } catch (error) {
        // Span bookkeeping must never block resume.
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to open resume spans: ${error}`);
      }
    }
    carrySegmentSpans(resumeRequestContext, runId, resumeSegment);
    const resumeSegmentSpan = entry.resumeAgentSpan ?? entry.agentSpan;

    // Same default-false semantics as the initial stream() path.
    const closeOnSuspend = (resolvedOptions as DurableAgentStreamOptions<TOutput>).closeOnSuspend ?? false;

    const {
      output,
      cleanup: createdStreamCleanup,
      detach: detachResumeStream,
      fail: failResumeStream,
      waitForEventDelivery,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub,
      runId,
      minGeneration: executionFence.generation,
      onTerminalEvent: this.owningReaderTerminal(runId, executionFence),
      messageId: crypto.randomUUID(),
      initialToolCalls,
      resumedText,
      model: {
        modelId: resumeModel?.modelId,
        provider: resumeModel?.provider,
        version: 'v3',
      },
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      offset: resumeOffset,
      onChunk: resolvedOptions.onChunk,
      experimentalTransform: resolvedOptions.experimentalTransform,
      hideSignals: resolvedOptions.hideSignals,
      onStepFinish: resolvedOptions.onStepFinish,
      onFinish: resolvedOptions.onFinish,
      onStreamFinished: scheduleAutoCleanup,
      onError: async error => {
        await resolvedOptions.onError?.(error);
        scheduleAutoCleanup();
      },
      onAbort: async data => {
        try {
          await resolvedOptions.onAbort?.(data);
        } finally {
          scheduleAutoCleanup();
        }
      },
      onSuspended: resolvedOptions.onSuspended,
      // Resume segments settle at the persisted workflow result below. A sibling
      // that was already suspended may not emit another SUSPENDED event, while
      // evented execution may emit one before its snapshot is safe to resume.
      closeOnSuspend: false,
      structuredOutput: entry.structuredOutput as any,
      outputProcessors: entry.outputProcessors,
      processorStates: entry.processorStates,
      agent: entry.agent,
      requestContext: resolvedOptions.requestContext,
      // Caller option wins, then the flag persisted at prepare time. Only fall
      // back to resolvedOptions (which merges agent defaultOptions) last, so a
      // configured default can't override the original run-level request.
      returnScorerData: options?.returnScorerData ?? entry.returnScorerData ?? resolvedOptions.returnScorerData,
      tracingContext: resumeSegmentSpan ? { currentSpan: resumeSegmentSpan } : undefined,
      messageList: globalEntry?.messageList ?? this.executionRunRegistry.getMessageList(runId),
      messageListFollowsStream: () => !this.executionEngine.executesStepsLocally,
    });
    streamCleanup = createdStreamCleanup;

    // Wait for subscription to be ready, then resume workflow
    const requestContext = resolvedOptions.requestContext;

    const workflowExecution = executionFence.run(() =>
      ready
        .then(async () => {
          if (await this.redeliverDeadlineError(entry, executionFence)) return;
          // Looked up inside the chain so a throw settles (releases) the claim.
          const workflow = this.getWorkflow();
          // The prior segment was settled above (before the event-offset
          // capture), so the snapshot is already persisted as 'suspended'.
          // Evented engine: make sure the workflow event workers are running
          // before resume — a resume in a fresh process (or after shutdown())
          // would otherwise publish events nobody consumes and hang.
          await this.executionEngine.ensureEngineWorkersStarted(this.workflowEngine, this.logger);
          const run = await workflow.createRun({
            runId,
            resourceId: memoryInfo?.resourceId,
            pubsub: this.fenceRunPubSub(executionFence, abortController),
          });
          if (this.__getGoalConfig()) {
            await beginGoalActivity({
              mastra: this.#mastra,
              agentId: this.id,
              threadId: memoryInfo?.threadId,
              runId,
              requestContext,
            });
          }
          let result;
          try {
            result = await this.#withSuspensionAfterPersist(runId, () =>
              run.resume({
                resumeData,
                label: resolvedOptions.toolCallId,
                requestContext,
                actor: resolvedOptions.actor,
                ...createObservabilityContext({ currentSpan: entry.resumeAgentSpan ?? entry.agentSpan }),
              }),
            );
          } catch (error) {
            // This resume saw the run suspended when it claimed it, so the workflow no longer
            // being suspended means a concurrent resume ran it first. The run, its topic and
            // its spans belong to that resume: release the claim without writing run state
            // and report the lost race to this caller only.
            // When the resume claim is persisted (`persistResumeClaim`), the losing CAS reports the
            // race as WORKFLOW_RESUME_ALREADY_CLAIMED instead.
            if (
              error instanceof MastraError &&
              (error.id === 'WORKFLOW_RUN_NOT_SUSPENDED' || error.id === 'WORKFLOW_RESUME_ALREADY_CLAIMED')
            ) {
              const lost = new MastraError({
                id: 'AGENT_RESUME_ALREADY_CLAIMED',
                domain: ErrorDomain.AGENT,
                category: ErrorCategory.USER,
                text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it already ran.`,
                details: { agentName: this.name, runId },
              });
              lostResumeRace = true;
              await executionFence.settle(async () => {});
              for (const span of ownResumeSpans) span?.error({ error: lost, endSpan: true });
              await failResumeStream(lost);
              return;
            }
            throw error;
          } finally {
            await stopGoalActivity({ agentId: this.id, runId });
            if (result?.status !== 'suspended' && workflow.runs.get(runId) === run) {
              workflow.runs.delete(runId);
            }
          }
          await this.settleExecution(runId, executionFence, {
            status: result?.status,
            error:
              result?.status === 'failed'
                ? this.executionEngine.workflowFailureError((result as any).error, 'Workflow resume failed')
                : undefined,
          });
          if (result?.status === 'suspended' && closeOnSuspend) {
            // The workflow result is the authoritative persisted suspension boundary.
            // Flush transport buffers, then wait for callbacks already delivered to
            // this observer before closing only the resume segment. This preserves
            // onSuspended delivery without advancing queued resumes against a stale
            // sibling snapshot. Settling first releases the run, so a queued
            // resume can claim it without waiting.
            await this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub.flush();
            await waitForEventDelivery();
            detachResumeStream();
          }
        })
        .catch(error =>
          this.settleExecution(runId, executionFence, {
            error: this.executionEngine.workflowExecutionError(error, 'Workflow resume failed'),
          }),
        )
        .finally(detachExternalAbort),
    );
    const trackedResumeEntry = getRunRegistryEntry(runId, this.#mastra);
    if (trackedResumeEntry) {
      trackedResumeEntry.workflowExecution = workflowExecution;
    }
    void workflowExecution.then(releaseResumeMarker, releaseResumeMarker);

    const resumeStreamOptions: AgentExecutionOptions<TOutput> = {
      ...resolvedOptions,
      runId,
    } as AgentExecutionOptions<TOutput>;
    const continued = agentThreadStreamRuntime.continueRun(
      this as unknown as Agent<any, any, any, any>,
      output,
      resumeStreamOptions,
      this.getPubSub(),
      { generation: executionFence.generation, ownershipLost: () => executionFence.isLost() },
    );
    if (!continued) {
      await agentThreadStreamRuntime.registerRun(
        this as unknown as Agent<any, any, any, any>,
        output,
        resumeStreamOptions,
        this.getPubSub(),
        {
          continuation: closeOnSuspend ? undefined : 'across-suspension',
          generation: executionFence.generation,
          ownershipLost: () => executionFence.isLost(),
          stepOwner: () => getRunRegistryEntry(runId, this.#mastra),
        },
      );
    }

    // Route the explicit cleanup through the shared performCleanup() so it and
    // the auto-cleanup timer release the same resources.
    const cleanup = performCleanup;

    const abort = async (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
      // Also stop the run wherever it is actually executing — see
      // `requestRemoteAbort`. The local controller above only reaches steps
      // running in this process.
      await this.requestRemoteAbort(runId);
      // A run parked on a suspension has no steps left to stop; release it so
      // it is no longer listed as suspended.
      if (agentThreadStreamRuntime.isRunParked(runId, this.getPubSub())) this.abortRunStream(runId);
    };

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      traceId: output.traceId,
      spanId: output.spanId,
      cleanup,
      abort,
    };
  }

  /**
   * List durable agent runs currently reported as `running` in workflow
   * snapshot storage.
   *
   * A `running` snapshot is a durable agent run whose agentic loop was
   * mid-execution the last time the workflow engine persisted its state. On a
   * healthy process these transition to `suspended` (waiting on
   * tool approval / resume) or a terminal status. On a crashed / restarted
   * process they are orphaned in the `running` state with no in-process
   * driver — this is the discovery API used to enumerate them for recovery
   * (see {@link Agent.recoverActiveRuns} and workflow `restart`).
   *
   * Requires persistent workflow storage. Filters `agentId` against the
   * persisted `DurableAgenticWorkflowInput.agentId`, so runs started by other
   * durable agents sharing the same storage are not surfaced.
   *
   * @example
   * ```typescript
   * const { runs } = await durableAgent.listActiveRuns({ resourceId });
   * for (const run of runs) {
   *   await durableAgent.recoverActiveRuns({ runId: run.runId });
   * }
   * ```
   */
  async listActiveRuns(options: DurableAgentListActiveRunsOptions = {}): Promise<DurableAgentListActiveRunsResult> {
    const executionEngine = this.#resolveExecutionEngine();
    if (!executionEngine) return this.#requireDurableExecution('listActiveRuns');

    return executionEngine.listActiveRuns(this.id, this.name, options);
  }

  /**
   * Bulk recover durable agent runs whose in-process agentic loop was orphaned
   * by a process restart. This is the recovery half of the discovery API
   * paired with {@link Agent.listActiveRuns} and is the typical
   * boot-time hook.
   *
   * Each targeted run is delegated to {@link Agent.recover}, which
   * rebuilds the run's non-serializable state (message list, model, memory,
   * save-queue manager, request context, agent span), re-subscribes to the
   * run's pubsub topic, and restarts the workflow in the background. Because
   * `recover()` registers `memory` + `saveQueueManager` on the run entry, the
   * durable agentic workflow's terminal step flushes new messages to memory
   * just like a fresh `stream()` call would.
   *
   * The per-run stream returned by `recover()` is discarded — this method
   * awaits each run's workflow settlement and reports summary counts instead
   * of surfacing live event streams. Callers who want to observe a specific
   * recovered run's events should use {@link Agent.recover} directly
   * (or {@link Agent.observe} with the returned `runId`).
   *
   * Failures are captured per-run so a single bad run does not block
   * recovery of the rest.
   *
   * Only orphaned runs are recovered. A run another execution still drives,
   * in this process or another, is reported as `skipped`; for one live in
   * another process, `retryAt` says when to check again. A run that finished
   * or suspended before its turn is left out.
   *
   * @example
   * ```typescript
   * // Recover every orphaned run for this agent (typical boot-time hook).
   * const { recovered, succeeded, failed } = await durableAgent.recoverActiveRuns();
   * logger.info('Recovered durable agent runs', { succeeded, failed });
   *
   * // Recover a single run by ID.
   * await durableAgent.recoverActiveRuns({ runId });
   * ```
   */
  async recoverActiveRuns(
    options: DurableAgentRecoverActiveRunsOptions = {},
  ): Promise<DurableAgentRecoverActiveRunsResult> {
    // Resolve an existing engine synchronously so discovery starts before a concurrent shutdown can begin.
    const executionEngine = this.#resolveExecutionEngine();
    if (!executionEngine) return this.#requireDurableExecution('recoverActiveRuns');
    if (this.#mastra?.__shuttingDown) return { recovered: [], succeeded: 0, failed: 0 };
    const { runId, ...discoveryOptions } = options;

    // Without fencing in the workflows store nothing is fenced, memory included.
    const storage = this.#mastra?.getStorage();
    if (
      !(await executionEngine.warnIfUnfenced(await storage?.getStore('workflows'), 'workflows', this.guardrailLogger))
    ) {
      await executionEngine.warnIfUnfenced(await storage?.getStore('memory'), 'memory', this.guardrailLogger);
    }

    let targetRunIds: string[];
    if (runId) {
      // Like discovery, an explicit run is only recovered while its snapshot is
      // `running`: a finished run has nothing to recover, and a suspended one
      // waits for resume().
      targetRunIds = (await executionEngine.isRunningSnapshot(runId)) ? [runId] : [];
    } else {
      const { runs } = await this.listActiveRuns(discoveryOptions);
      targetRunIds = runs.map(r => r.runId);
    }

    const outcomes: (DurableAgentRecoveredRun | undefined)[] = new Array(targetRunIds.length);
    const timeoutOutcome = (targetRunId: string): DurableAgentRecoveredRun => ({
      runId: targetRunId,
      status: 'skipped',
      reason: 'recovery-timeout',
      retryAt: Date.now() + TRANSIENT_RECOVERY_RETRY_DELAY_MS,
    });

    await runWithConcurrency(
      targetRunIds.map((targetRunId, index) => ({ targetRunId, index })),
      DEFAULT_RESTART_CONCURRENCY,
      async ({ targetRunId, index }) => {
        if (this.#mastra?.__shuttingDown) return;
        if (this.#hasRecoveryAttempt(targetRunId)) {
          outcomes[index] = timeoutOutcome(targetRunId);
          return;
        }
        const attempt = this.#startRecoveryAttempt(
          targetRunId,
          async (): Promise<DurableAgentRecoveredRun | undefined> => {
            if (this.#mastra?.__shuttingDown) return;
            let runError: Error | undefined;
            let started = false;
            try {
              // Delegate to the single-run streamable recover path so each run
              // benefits from the rebuilt registry entry (message list, memory,
              // saveQueueManager, request context, agent span) and the pubsub
              // stream / terminal snapshot-cleanup contract stays identical to
              // `recover()`. We don't surface the per-run stream here — bulk
              // callers only care about counts — so we just await the workflow
              // execution promise that `recover()` parks on the registry entry,
              // capture any failure it surfaces via `onError`, and drop the
              // stream. `recover()` cleans up on its own after FINISH/ERROR and keeps
              // suspended runs registered, so thread subscribers still see the
              // terminal event and a later approval can resume the run (#25891).
              // With auto-cleanup disabled nothing else releases a finished run, and
              // bulk callers never get the cleanup handle. Release it once the
              // terminal event has been delivered; suspended runs never get here.
              let releaseAfterTerminal: (() => void) | undefined;
              const onTerminal = () => {
                if (this.__getStreamBus()?.cleanupTimeoutMs === 0) setTimeout(() => releaseAfterTerminal?.(), 0);
              };
              const { cleanup } = await this.recover(targetRunId, {
                onError: ({ error }) => {
                  runError = error instanceof Error ? error : new Error(String(error));
                  onTerminal();
                },
                onFinish: onTerminal,
                onAbort: onTerminal,
              });
              started = true;
              releaseAfterTerminal = cleanup;
              try {
                const workflowExecution = getRunRegistryEntry(targetRunId, this.#mastra)?.workflowExecution;
                if (workflowExecution) {
                  await workflowExecution;
                }
              } catch (error) {
                cleanup();
                throw error;
              }
              if (runError) throw runError;
              return { runId: targetRunId, status: 'success' };
            } catch (error) {
              const errorId = (error as { id?: unknown })?.id;
              if (!runError && (errorId === RECOVER_SHUTDOWN_ERROR_ID || errorId === EXECUTION_ABANDONED_ERROR_ID)) {
                return { runId: targetRunId, status: 'skipped' };
              }
              if (!started) {
                // The checkpoint disappeared or the run suspended between discovery and recovery.
                if (
                  errorId === RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID ||
                  errorId === RECOVER_CHECKPOINT_NOT_AVAILABLE_ERROR_ID ||
                  errorId === RECOVER_RUN_SUSPENDED_ERROR_ID
                )
                  return;
                const skipped = recoverySkip(error);
                if (skipped) {
                  if (skipped.reason === 'transient-error') {
                    this.#mastra
                      ?.getLogger()
                      ?.warn(`[DurableAgent] Deferring recovery of run ${targetRunId} after a transient error`, {
                        error,
                        retryAt: skipped.retryAt,
                      });
                  }
                  return { runId: targetRunId, status: 'skipped', ...skipped };
                }
              }
              const err = runError ?? (error instanceof Error ? error : new Error(String(error)));
              this.#mastra
                ?.getLogger?.()
                ?.error?.(`[DurableAgent] Failed to recover run ${targetRunId}: ${err.message}`, { error: err });
              return { runId: targetRunId, status: 'failed', error: err };
            }
          },
        );
        const bounded = this.#mastra
          ? await this.#mastra.__awaitDurableRecoveryAttempt(attempt, `durable agent ${this.id} run ${targetRunId}`)
          : { value: await attempt };
        outcomes[index] = bounded ? bounded.value : timeoutOutcome(targetRunId);
      },
    );

    const recovered = outcomes.filter((outcome): outcome is DurableAgentRecoveredRun => outcome !== undefined);
    const succeeded = recovered.filter(outcome => outcome.status === 'success').length;
    const failed = recovered.filter(outcome => outcome.status === 'failed').length;
    return { recovered, succeeded, failed };
  }

  /** Observe a resumable run without driving it. */
  async observe(
    runId: string,
    options?: {
      /**
       * Inclusive, zero-based PubSub event index. It counts all cached run-topic events, including
       * lifecycle events, not chunks. Each chunk carries its event's index as `chunk.index`: to resume
       * after a dropped connection, pass the `index + 1` of the last chunk that has an index. Omit it to replay all available cached events. Transports
       * without numeric offsets live-tail instead. Skipping earlier text deltas produces partial text
       * and may make structured output fail to parse; beyond retained history, an offset also skips
       * lower-index live events on numeric-offset transports. See
       * https://mastra.ai/reference/agents/durable-agent#observerunid-options.
       */
      offset?: number;
      /** Close this observer at suspension, keeping the run resumable. Defaults to false. */
      closeOnSuspend?: boolean;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string; detach: () => void }> {
    if (this.#resolveExecutionEngine()) return this.#observeDurableRun(runId, options);

    const bus = this.__getStreamBus();
    if (bus) return this.#observeRun(bus, runId, options);
    throw new MastraError({
      id: 'AGENT_STREAMS_NOT_ENABLED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'Agent.observe() requires resumable streams. Register the agent on Mastra or set durable: true.',
      details: { agentId: this.id },
    });
  }

  /**
   * A replay from an offset can start past the marker of the execution that
   * took the run over, and would then accept what the lost execution still
   * publishes, its finish included. Start the reader with the floor it would
   * have reached by reading the skipped events: the highest generation among
   * them. Ordinary suspend/resume segments then still replay, since each
   * segment's events precede the next claim. When the transport keeps no
   * history to read, follow the run's current claim instead.
   * Runs fenced by a pubsub lease have no generation and are unaffected.
   * The floor only adds protection, so a failed read must not fail the reconnect;
   * the reader reads the claim again before an event can end its stream.
   */
  async #readReplayFloor(
    runId: string,
    offset: number | undefined,
    closeOnSuspend = false,
  ): Promise<
    Pick<
      DurableStreamAdapterOptions,
      'minGeneration' | 'rereadMinGeneration' | 'keepReplayEvent' | 'attachedAtLogIndex'
    > & {
      refreshReplayFilter?: () => Promise<unknown>;
    }
  > {
    const pubsub = this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub;
    try {
      const {
        keepReplayEvent: initialFilter,
        attachedAtLogIndex: initialAttachedAt,
        ...floor
      } = await this.executionEngine.readReplayFloor(pubsub, runId, offset);
      let attachedAt = initialAttachedAt;
      const attachedAtLogIndex = closeOnSuspend ? () => attachedAt : undefined;
      let refreshedFilter: Promise<typeof initialFilter> | undefined;
      let currentFilter: typeof initialFilter | undefined;
      // Subscription can replay a newer claim than the snapshot above. Refresh
      // before the first replayed event; live events and later deliveries stay synchronous.
      const refreshReplayFilter = () => {
        refreshedFilter ??= this.executionEngine
          .readReplayFloor(pubsub, runId, undefined)
          .then(evidence => {
            attachedAt = evidence.attachedAtLogIndex;
            return (currentFilter = evidence.keepReplayEvent);
          })
          .catch(() => (currentFilter = initialFilter));
        return refreshedFilter;
      };
      const keepReplayEvent = (event: AgentStreamEvent): boolean | Promise<boolean> => {
        if (event.index === undefined) return (currentFilter ?? initialFilter)(event);
        if (currentFilter) return currentFilter(event);
        return refreshReplayFilter().then(filter => filter(event));
      };
      return { ...floor, attachedAtLogIndex, keepReplayEvent, refreshReplayFilter };
    } catch (error) {
      this.logger.warn(`[DurableAgent] Couldn't read the claim of run ${runId}; observing it without a floor`, {
        error,
      });
      return { rereadMinGeneration: () => readRunGeneration(this.#mastra, runId) };
    }
  }

  /** Reconcile only after subscribing, so a completion racing attachment is not lost. */
  async #isObservationComplete(runId: string): Promise<boolean> {
    const pubsub = this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub;
    try {
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      // Read twice before concluding absence/completion. In particular a newer
      // claim must win over terminal replay from the execution it superseded.
      for (let attempt = 0; attempt < 2; attempt++) {
        const history = await pubsub.getHistory(AGENT_STREAM_TOPIC(runId), 0);
        // A newer segment's nonterminal history keeps the observer attached even
        // when ownership reads fail or an older segment ended with suspension.
        const historyGeneration = history.reduce<number | undefined>(
          (floor, event) =>
            event.generation === undefined ? floor : Math.max(floor ?? event.generation, event.generation),
          undefined,
        );
        const latest = history.findLast(
          event =>
            event.generation === undefined || historyGeneration === undefined || event.generation >= historyGeneration,
        );
        if (latest) {
          const type = latest.type === AgentStreamEventTypes.CHUNK ? latest.data?.type : latest.type;
          if (type !== 'finish' && type !== 'error' && type !== 'abort') return false;
        }
        const ownership =
          workflowsStore && (await supportsRunFencing(workflowsStore))
            ? await workflowsStore.getRunOwnership({ runId })
            : undefined;
        const minGeneration = history.reduce<number | undefined>(
          (floor, event) =>
            event.generation === undefined ? floor : Math.max(floor ?? event.generation, event.generation),
          ownership?.generation,
        );
        const keepGeneration = createRunGenerationFilter({ minGeneration });
        let hasHistory = false;
        let terminal = false;
        for (const event of history) {
          if (!(await keepGeneration(event as unknown as AgentStreamEvent))) continue;
          hasHistory = true;
          const type = event.type === AgentStreamEventTypes.CHUNK ? event.data?.type : event.type;
          if (type === 'finish' || type === 'error' || type === 'abort') terminal = true;
        }
        if (!terminal) {
          if (hasHistory || ownership?.live) return false;
          if (getRunRegistryEntry(runId, this.#mastra) || this.executionRunRegistry.get(runId)) return false;
          if (await resolveLeaseProvider(pubsub).getLeaseOwner(executionLeaseKey(this.id, runId))) {
            return false;
          }
          if (workflowsStore) {
            for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
              const record = await workflowsStore.getWorkflowRunById({ runId, workflowName });
              if (!record) continue;
              const snapshot =
                typeof record.snapshot === 'string'
                  ? (JSON.parse(record.snapshot) as WorkflowRunState)
                  : record.snapshot;
              const input = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
              if (input?.__workflowKind === 'durable-agent' && input.agentId !== this.id) {
                throw new MastraError({
                  id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  text: `DurableAgent "${this.name}" observe(${runId}): persisted run belongs to agent "${input.agentId}", not "${this.id}".`,
                  details: { agentName: this.name, runId, ownerAgentId: input.agentId },
                });
              }
              // A failed cleanup can leave terminal snapshots behind. Unknown
              // statuses stay observable, including suspension without a lease.
              if (
                !snapshot ||
                !['success', 'failed', 'tripwire', 'canceled', 'bailed', 'skipped'].includes(snapshot.status)
              ) {
                return false;
              }
            }
          }
        }
      }
      return true;
    } catch (error) {
      if (error instanceof MastraError && error.id === 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH') throw error;
      // Unavailable lifecycle evidence cannot prove that the producer is gone.
      return false;
    }
  }

  /**
   * Subscribe to a run's raw AgentStreamEvents, filtering out events from
   * executions that lost ownership and takeover markers. Callers must map
   * these events to the public frame contract produced by stream-adapter.ts's
   * createDurableAgentStream before sending them to clients; raw event
   * envelopes are not public stream frames. Resolves once subscribed, with
   * a function that unsubscribes.
   *
   * @internal
   */
  async __subscribeToRunStream(
    runId: string,
    options: { offset?: number; onComplete?: () => void },
    onEvent: (event: AgentStreamEvent) => void,
  ): Promise<() => Promise<void>> {
    const pubsub = this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub;
    const replayFloor = await this.#readReplayFloor(runId, options.offset);
    const keepGeneration = createRunGenerationFilter(replayFloor);
    const topic = AGENT_STREAM_TOPIC(runId);
    let subscribed = true;
    let activityVersion = 0;
    let bufferingReplay = true;
    const bufferedEvents: Array<() => Promise<void>> = [];

    // Step-finish events carry only the response messages that changed; rebuild the full list so
    // the frames match what the run's own stream reports. A reader starting at an offset first
    // rebuilds it from the events it skips.
    let responseMessages: ResponseMessagesReplay = { messages: [] };
    const offset = options.offset;
    if (offset !== undefined && offset > 0 && pubsub.supportsOffsets) {
      try {
        const skipped = (await pubsub.getHistory(topic, 0)).filter(
          event => typeof event.index === 'number' && event.index < offset,
        );
        responseMessages = replayResponseMessages(skipped);
      } catch (error) {
        this.logger.warn(`[DurableAgent] Couldn't read run ${runId}'s history before offset ${offset}`, { error });
      }
    }

    const deliver = (event: AgentStreamEvent) => {
      activityVersion++;
      if (
        !subscribed ||
        event.type === AgentStreamEventTypes.OWNERSHIP_CLAIMED ||
        event.type === AgentStreamEventTypes.ITERATION_START
      )
        return;
      const chunk = event.type === AgentStreamEventTypes.CHUNK ? (event.data as AgentChunkEventData) : undefined;
      if (chunk?.type === 'step-finish' && chunk.payload) {
        event = {
          ...event,
          data: {
            ...chunk,
            payload: withRebuiltResponseMessages(
              responseMessages,
              chunk.payload as unknown as AgentStreamStepFinishPayload,
            ),
          },
        };
      }
      // Keep `index`: the observe route forwards it on each frame so clients can resume at index + 1.
      onEvent(event);
    };
    const filterEvent = (streamEvent: AgentStreamEvent) => {
      const filterGeneration = () => {
        const keep = keepGeneration(streamEvent);
        if (typeof keep === 'boolean') {
          if (keep) deliver(streamEvent);
          return;
        }
        return keep.then(kept => {
          if (kept) deliver(streamEvent);
        });
      };
      const keepReplay = replayFloor.keepReplayEvent?.(streamEvent);
      if (keepReplay === undefined || keepReplay === true) return filterGeneration();
      if (keepReplay === false) return;
      return keepReplay.then(keep => {
        if (keep) return filterGeneration();
      });
    };
    // Replayed frames are held until attachment finishes and the claim history
    // is refreshed; a claim can arrive partway through replay. Acknowledge only
    // after filtering and delivery, including frames that are dropped.
    const acknowledge = withAck(event => filterEvent(event as AgentStreamEvent));
    const callback: ReturnType<typeof withAck> = (event, ...args) => {
      if (!subscribed) return args[0]?.() ?? Promise.resolve();
      activityVersion++;
      if (bufferingReplay) {
        bufferedEvents.push(async () => {
          await acknowledge(event, ...args);
        });
        return Promise.resolve();
      }
      return acknowledge(event, ...args);
    };
    const unsubscribe = async () => {
      if (!subscribed) return;
      subscribed = false;
      await pubsub.unsubscribe(topic, callback);
    };

    try {
      await (options.offset !== undefined
        ? pubsub.subscribeFromOffset(topic, options.offset, callback)
        : pubsub.subscribeWithReplay(topic, callback));
      await replayFloor.refreshReplayFilter?.();
      // Index cursor keeps the drain linear; live frames can still append while draining.
      for (let i = 0; i < bufferedEvents.length; i++) {
        await bufferedEvents[i]!();
      }
      bufferedEvents.length = 0;
      bufferingReplay = false;

      const reconciledVersion = activityVersion;
      if (options.onComplete && (await this.#isObservationComplete(runId)) && activityVersion === reconciledVersion) {
        options.onComplete();
      }
      return unsubscribe;
    } catch (error) {
      await unsubscribe();
      throw error;
    }
  }

  async #observeDurableRun(
    runId: string,
    options?: {
      /**
       * Inclusive, zero-based PubSub event index. It counts all cached run-topic events, including
       * lifecycle events, not chunks. Each chunk carries its event's index as `chunk.index`: to resume
       * after a dropped connection, pass the `index + 1` of the last chunk that has an index. Omit it to replay all available cached events. Transports
       * without numeric offsets live-tail instead. Skipping earlier text deltas produces partial text
       * and may make structured output fail to parse; beyond retained history, an offset also skips
       * lower-index live events on numeric-offset transports. See
       * https://mastra.ai/reference/agents/durable-agent#observerunid-options.
       */
      offset?: number;
      idleTimeoutMs?: number;
      isAlive?: () => boolean | Promise<boolean>;
      closeOnSuspend?: boolean;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      experimentalTransform?: MastraStreamTransformOptions<TOutput>;
      onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string; detach: () => void }> {
    const pubsub = this.#executionStreamBus.forRun(this.__usesSharedRunLog()).pubsub;
    let memoryInfo = this.executionRunRegistry.getMemoryInfo(runId);

    let terminalCompleted = false;
    let abortPending = false;
    let cleanupRequested = false;
    let streamCleanup: (() => void) | undefined;

    const localEntry = this.executionRunRegistry.get(runId);
    const observedEntry = localEntry ?? getRunRegistryEntry(runId, this.#mastra);
    const observedFence = observedEntry?.executionFence;
    const runCleanup = createRunCleanup({
      scheduleTimer: cleanup =>
        observedFence
          ? this.scheduleReaderCleanup(observedFence, cleanup)
          : this.#executionStreamBus.scheduleCleanup(cleanup),
      release: () => {
        streamCleanup?.();
        if (
          observedFence &&
          (this.#unverifiedReaderFences.has(observedFence) ||
            !observedFence.ownsRunTopics() ||
            getRunRegistryEntry(runId, this.#mastra)?.executionFence !== observedFence ||
            (localEntry &&
              (this.executionRunRegistry.get(runId) !== localEntry || localEntry.executionFence !== observedFence)))
        ) {
          return;
        }
        this.executionRunRegistry.cleanup(runId);
        deleteRunRegistryEntry(runId, this.#mastra);
        this.clearPubsubTopic(runId, observedEntry);
      },
    });
    const performCleanup = runCleanup.run;
    const scheduleAutoCleanup = runCleanup.schedule;

    const completeTerminalLifecycle = () => {
      terminalCompleted = true;
      abortPending = false;
      if (cleanupRequested) {
        performCleanup();
      } else {
        scheduleAutoCleanup();
      }
    };

    const observedAgentSpan = observedEntry?.resumeAgentSpan ?? observedEntry?.agentSpan;
    let structuredOutput = observedEntry?.structuredOutput;
    let outputProcessors = observedEntry?.outputProcessors;
    const processorStates = observedEntry?.processorStates;
    let streamAgent: Agent<any, any, any, any> = observedEntry?.agent ?? this.agentForExecution;
    let returnScorerData = observedEntry?.returnScorerData;
    let requestContext = observedEntry?.requestContext;
    let messageList = observedEntry?.messageList ?? this.executionRunRegistry.getMessageList(runId);
    // Worker entries can carry runtime dependencies without the caller's live transcript.
    const liveEntry = messageList ? observedEntry : undefined;
    if (liveEntry?.agentId !== undefined && liveEntry.agentId !== this.id) {
      throw new MastraError({
        id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" observe(${runId}): live run belongs to agent "${liveEntry.agentId}", not "${this.id}".`,
        details: { agentName: this.name, runId, ownerAgentId: liveEntry.agentId },
      });
    }
    let workflowInput: DurableAgenticWorkflowInput | undefined;
    let loopSnapshot: WorkflowRunState | undefined;
    let workflowInputSnapshot: WorkflowRunState | undefined;
    const workflowsStore = !liveEntry ? await this.#mastra?.getStorage()?.getStore('workflows') : undefined;

    if (!structuredOutput || !liveEntry) {
      const snapshotStore = workflowsStore ?? (await this.#mastra?.getStorage()?.getStore('workflows'));

      for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
        const persisted = await snapshotStore?.getWorkflowRunById({ runId, workflowName });
        if (!persisted) continue;

        const snapshot =
          typeof persisted.snapshot === 'string'
            ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
            : persisted.snapshot;
        if (workflowName === DurableStepIds.AGENTIC_LOOP) loopSnapshot = snapshot;
        const persistedInput = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
        if (persistedInput?.__workflowKind !== 'durable-agent') continue;

        workflowInput = persistedInput;
        workflowInputSnapshot = snapshot;
        break;
      }
    }

    if (!liveEntry && workflowInput && workflowInput.agentId !== this.id) {
      throw new MastraError({
        id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" observe(${runId}): persisted run belongs to agent "${workflowInput.agentId}", not "${this.id}".`,
        details: { agentName: this.name, runId, ownerAgentId: workflowInput.agentId },
      });
    }

    if (!structuredOutput && workflowInput) {
      const persistedStructuredOutput = workflowInput.options?.structuredOutput;
      if (persistedStructuredOutput?.schema) {
        const { errorStrategy, fallbackValue, ...rest } = persistedStructuredOutput;
        const schema = toLiveStructuredOutputSchema<{}>(
          persistedStructuredOutput.schema,
          persistedStructuredOutput.nullToUndefined,
        );
        // A non-JSON-safe fallbackValue is not persisted; keep the default strategy then.
        structuredOutput =
          errorStrategy === 'fallback'
            ? fallbackValue === undefined
              ? { ...rest, schema }
              : { ...rest, schema, errorStrategy, fallbackValue: fallbackValue as {} }
            : { ...rest, schema, errorStrategy };
      }
    }

    if (!liveEntry && workflowInput) {
      requestContext = workflowInput.requestContextEntries
        ? new RequestContext(Object.entries(workflowInput.requestContextEntries))
        : new RequestContext();

      const messageListMemoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
      const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;
      memoryInfo = threadId && resourceId ? { threadId, resourceId } : undefined;

      if (threadId && resourceId) {
        requestContext.set('MastraMemory', {
          thread: { id: threadId },
          resourceId,
          memoryConfig: workflowInput.state?.memoryConfig,
        });
      } else {
        requestContext.delete('MastraMemory');
      }

      messageList = new MessageList({ threadId, resourceId });
      try {
        const snapshot = workflowInputSnapshot ?? loopSnapshot;
        const storedState = workflowInput.messageListState ?? (snapshot ? latestMessageListState(snapshot) : undefined);
        if (storedState) {
          const initialState = await hydrateMessageListState(
            { getInitData: () => workflowInput!, mastra: this.#mastra },
            storedState,
          );
          messageList.deserialize(initialState);
        }

        if (workflowsStore && snapshot) {
          const inputMessages = messageList.get.input.db();
          const latestState = await this.loadLatestMessageListState(workflowsStore, runId, snapshot);
          if (latestState) {
            messageList.deserialize(latestState);
            if (messageList.get.input.db().length === 0 && inputMessages.length > 0) {
              messageList.add(inputMessages, 'input');
            }
          }
        }
      } catch (error) {
        this.#mastra
          ?.getLogger?.()
          ?.warn?.(`[DurableAgent] observe(${runId}) messageList deserialize skipped: ${error}`);
      }

      let processorAgent: Agent<any, any, TOutput> = this.agentForExecution as Agent<any, any, TOutput>;
      const pinnedVersionId = workflowInput.agentVersionId;
      if (pinnedVersionId && this.#mastra && !this.__isStoredVersionApplied()) {
        const currentVersionId = this.toRawConfig()?.resolvedVersionId;
        if (pinnedVersionId !== currentVersionId) {
          try {
            processorAgent = (await this.#mastra.resolveVersionedAgent(this as unknown as Agent, {
              versionId: pinnedVersionId,
            })) as unknown as Agent<any, any, TOutput>;
          } catch (error) {
            this.#mastra
              .getLogger?.()
              ?.warn?.(
                `[DurableAgent] Failed to resolve pinned agent version for durable observe, using current definition: ${error}`,
              );
          }
        }
      }

      // Hooks get the agent the output processors come from, not an entry's agent
      // (which is the current version). A pinned version is a DurableAgent fork; unwrap it.
      streamAgent =
        isDurableAgentLike(processorAgent) && processorAgent.agent !== processorAgent
          ? processorAgent.agent
          : processorAgent;
      try {
        outputProcessors = (await processorAgent.listOutputProcessors(requestContext)) ?? [];
      } catch (error) {
        outputProcessors = [];
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] observe(${runId}) processor resolution failed: ${error}`);
      }
      returnScorerData = workflowInput.options?.returnScorerData;
    }

    const replayFloor = await this.#readReplayFloor(runId, options?.offset, options?.closeOnSuspend);

    const stream = createDurableAgentStream<TOutput>({
      pubsub: pubsub,
      runId,
      messageId: crypto.randomUUID(),
      model: {
        modelId: undefined,
        provider: undefined,
        version: 'v3',
      },
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      offset: options?.offset,
      replayResponseMessagesBeforeOffset: true,
      ...replayFloor,
      idleTimeoutMs: options?.idleTimeoutMs,
      isAlive: options?.isAlive,
      closeOnSuspend: options?.closeOnSuspend,
      onChunk: options?.onChunk,
      experimentalTransform: options?.experimentalTransform,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onStreamFinished: completeTerminalLifecycle,
      onError: async ({ error, runDead }) => {
        try {
          await options?.onError?.({ error });
        } finally {
          // A bare idle timeout (runDead === false) only means this observer
          // stopped hearing from the run — it may still be alive elsewhere, so
          // don't tear down its registry entry or replay history.
          if (runDead !== false) completeTerminalLifecycle();
        }
      },
      onAbort: async data => {
        try {
          await options?.onAbort?.(data);
        } finally {
          completeTerminalLifecycle();
        }
      },
      onSuspended: options?.onSuspended,
      structuredOutput: structuredOutput as any,
      agent: streamAgent,
      outputProcessors,
      processorStates,
      returnScorerData,
      requestContext,
      tracingContext: observedAgentSpan ? { currentSpan: observedAgentSpan } : undefined,
      messageList,
      // A list loaded from storage has the conversation up to attach; the stream brings each
      // step's response messages from there.
      messageListFollowsStream: () => !liveEntry || !this.executionEngine.executesStepsLocally,
    });
    const { output, ready, detach } = stream;
    streamCleanup = stream.cleanup;

    // This output belongs to this observer alone, so a consumer that stops
    // reading fullStream (break/return/throw out of `for await`) should detach
    // the observer. MastraModelOutput fans out to several readers and only drops
    // the cancelled reader's listeners, so the cancel never reaches the pubsub
    // subscription — pass it through here.
    detachFullStreamOnEnd(output, detach);

    // Wait for subscription to be ready
    try {
      await ready;
      await replayFloor.refreshReplayFilter?.();
      await stream.waitForEventDelivery();
      const reconciledVersion = stream.activityVersion;
      if ((await this.#isObservationComplete(runId)) && stream.activityVersion === reconciledVersion) detach();
    } catch (error) {
      detach();
      throw error;
    }

    const cleanup = () => {
      if (abortPending) {
        cleanupRequested = true;
        scheduleAutoCleanup();
        return;
      }
      performCleanup();
    };

    // observe() doesn't own the run's lifecycle, but the returned `abort` can
    // still stop it. Flip the in-process controller if one happens to be
    // installed here, then cancel the workflow run so the abort also reaches
    // the process actually executing it — the common case for observe(), which
    // exists precisely to watch runs this process did not start.
    const abort = async (reason?: unknown) => {
      abortPending = !terminalCompleted;
      const controller = (getRunRegistryEntry(runId, this.#mastra) ?? this.executionRunRegistry.get(runId))
        ?.abortController;
      if (controller && !controller.signal.aborted) {
        controller.abort(reason);
      }
      await this.requestRemoteAbort(runId);
      // A run parked on a suspension has no steps left to stop; release it so
      // it is no longer listed as suspended, as the stream abort does.
      if (agentThreadStreamRuntime.isRunParked(runId, this.getPubSub())) this.abortRunStream(runId);
    };

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      traceId: output.traceId,
      spanId: output.spanId,
      cleanup,
      detach,
      abort,
    };
  }

  /**
   * Follow a run of this agent from its stream topic: replay what the cache
   * kept, then tail live events. The run keeps going when the observer stops
   * reading or detaches.
   */
  async #observeRun(
    bus: AgentStreamBus,
    runId: string,
    options: Parameters<Agent<TAgentId, TTools, TOutput>['observe']>[1],
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string; detach: () => void }> {
    let attachedAt: number | undefined;
    // Buffer replay until its attachment boundary distinguishes past suspensions from the current tail.
    const refreshReplayFilter = options?.closeOnSuspend
      ? async () => {
          try {
            const history = await bus.pubsub.getHistory(AGENT_STREAM_TOPIC(runId), 0);
            attachedAt = newestLogIndex(history as AgentStreamEvent[]);
          } catch (error) {
            this.logger.warn(`Couldn't read the replay boundary of run ${runId}`, { error });
          }
        }
      : undefined;
    const stream = createDurableAgentStream<TOutput>({
      pubsub: bus.pubsub,
      runId,
      messageId: globalThis.crypto.randomUUID(),
      model: { modelId: undefined, provider: undefined, version: 'v3' },
      offset: options?.offset,
      closeOnSuspend: options?.closeOnSuspend,
      attachedAtLogIndex: () => attachedAt,
      refreshReplayFilter,
      replayResponseMessagesBeforeOffset: true,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onError: options?.onError ? ({ error }) => options.onError!({ error }) : undefined,
      onSuspended: options?.onSuspended,
      // By default, suspension is an event, not the end: the resumed run
      // publishes on the same topic, so the observation follows it to its finish.
      // closeOnSuspend opts out without canceling the underlying run.
      logger: this.logger,
    });
    const { output, detach } = stream;

    // This output belongs to this observer alone: a consumer that stops reading
    // fullStream detaches the subscription (MastraModelOutput only drops the
    // cancelled reader's listeners).
    detachFullStreamOnEnd(output, detach);

    try {
      await stream.ready;
    } catch (error) {
      detach();
      throw error;
    }

    // Resuming past the run's last entry replays nothing; if that entry ended the
    // run, nothing more will arrive, so close (matches the HTTP /observe route).
    // Read only after subscribing so a terminal entry racing attachment is not lost.
    // A failed read only means we can't close early.
    // A client resuming at last index + 1 needs a one-entry read; only an offset
    // further past the end falls back to the full log to find the true tail.
    const offset = options?.offset;
    if (offset !== undefined && offset > 0) {
      const topic = AGENT_STREAM_TOPIC(runId);
      const readTail = async () => {
        const window = await bus.pubsub.getHistory(topic, offset - 1);
        return window.length > 0 ? window.at(-1) : (await bus.pubsub.getHistory(topic, 0)).at(-1);
      };
      // Don't hold back the returned stream while the read waits on the cache.
      void readTail()
        .catch(() => undefined)
        .then(last => {
          if (typeof last?.index === 'number' && last.index < offset && isRunTerminalEvent(last)) detach();
        });
    }

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      // The run's publisher owns its topic; an observer only unsubscribes.
      cleanup: detach,
      detach,
      abort: async () => {
        await this.requestRemoteAbort(runId, bus);
      },
    };
  }

  /** Prepare a durable execution without starting it. Requires createDurableAgent() or DurableAgent. */
  async prepare(
    messages: MessageListInput,
    options?: AgentExecutionOptions<TOutput>,
  ): Promise<Omit<PreparationResult<TOutput>, 'messageList'>> {
    if (!this.#resolveExecutionEngine()) return this.#requireDurableExecution('prepare');

    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.agentForExecution as Agent<string, any, TOutput>,
      messages,
      options,
      // Forward the caller-provided runId (mirrors stream()). Without this,
      // prepareForDurableExecution mints a fresh id, so prepare() registers a
      // different run than requested and a follow-up resume(runId) — e.g. when
      // rehydrating a persisted, suspended run in a fresh process — can't find
      // its registry entry.
      runId: options?.runId,
      requestContext: options?.requestContext,
      scopesResolved: !!(options as { [SCOPES_ALREADY_APPLIED]?: boolean } | undefined)?.[SCOPES_ALREADY_APPLIED],
      resumedSpanData: (options as { [RESUMED_SPAN_DATA]?: PreparationOptions['resumedSpanData'] } | undefined)?.[
        RESUMED_SPAN_DATA
      ],
      mastra: this.#mastra,
      durableAgentId: this.id,
      durableAgentName: this.name,
    });

    preparation.registryEntry.agentId = this.id;
    this.executionRunRegistry.registerWithMessageList(
      preparation.runId,
      preparation.registryEntry,
      preparation.messageList,
      {
        threadId: preparation.threadId,
        resourceId: preparation.resourceId,
      },
    );
    await this.attachStreamPublisher(preparation.runId, {
      threadId: preparation.threadId,
      resourceId: preparation.resourceId,
    });
    globalRunRegistry.set(preparation.runId, {
      ...preparation.registryEntry,
      messageList: preparation.messageList,
    });

    return {
      runId: preparation.runId,
      messageId: preparation.messageId,
      workflowInput: preparation.workflowInput,
      registryEntry: preparation.registryEntry,
      threadId: preparation.threadId,
      resourceId: preparation.resourceId,
    };
  }
}

import { randomUUID } from 'node:crypto';
import type { UIMessage } from '@internal/ai-sdk-v4';
import type { ModelMessage } from '@internal/ai-sdk-v5';
import { wrapSchemaWithNullTransform } from '@mastra/schema-compat';
import type { StandardSchemaWithJSON } from '@mastra/schema-compat/schema';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod/v4';
import type { MastraPrimitives, MastraUnion } from '../action';
import { MastraFGAPermissions } from '../auth/ee';
import type { ActorSignal } from '../auth/ee';
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

import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import { resolveModelConfig } from '../llm';
import type { CoreMessage } from '../llm';
import { MastraLLMV1 } from '../llm/model';
import type {
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
} from '../llm/model/base.types';
import { MastraLLMVNext } from '../llm/model/model.loop';
import { mergeProviderOptions } from '../llm/model/provider-options';
import type { ProviderOptions } from '../llm/model/provider-options';
import { ModelRouterLanguageModel } from '../llm/model/router';
import type { MastraLanguageModel, MastraLegacyLanguageModel, MastraModelConfig } from '../llm/model/shared.types';
import { RegisteredLogger } from '../logger';
import { networkLoop } from '../loop/network';
import type { AgenticLoopEditedApprovalResumeLoader } from '../loop/types';
// `Mastra` is imported type-only here: a runtime import would create an ESM
// init cycle (agent → mastra → agent/durable → agent) that breaks
// `class DurableAgent extends Agent` with a TDZ error. The constructor is read
// from `mastraCtorHolder` (populated by `mastra/index.ts` at load), with an
// `await import('../mastra')` fallback for the standalone-agent case where the
// Mastra module was never loaded. See `#getOrCreateEphemeralMastra`.
import type { Mastra } from '../mastra';
import { mastraCtorHolder } from '../mastra/mastra-ctor-holder';
import type { VersionOverrides } from '../mastra/types';
import { mergeVersionOverrides } from '../mastra/types';
import type { MastraMemory } from '../memory/memory';
import { getMemoryRunState } from '../memory/run-state';
import type { MemoryConfig, MemoryConfigInternal } from '../memory/types';
import {
  resolveDeliveryFailureUpdate,
  resolveNotificationDeliveryDecision,
  type NotificationDeliveryPolicyInput,
} from '../notifications/delivery-policy';
import {
  createNotificationSignal,
  createNotificationSummarySignal,
  summarizeNotifications,
} from '../notifications/signals';
import type { NotificationDeliveryDecision, SendNotificationSignalInput } from '../notifications/types';
import type {
  DefinitionSource,
  TracingProperties,
  ObservabilityContext,
  TracingContext,
  TracingPolicy,
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
} from '../observability';
import type {
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ProcessorWorkflow,
  ProcessorWorkflowPhase,
  Processor,
} from '../processors/index';
import {
  ProcessorStepSchema,
  getProcessorWorkflowPhases,
  isProcessorWorkflow,
  processorWorkflowHasPhaseRestrictions,
  processorWorkflowRequiresDurableExecution,
  setProcessorWorkflowPhases,
} from '../processors/index';
import { SkillsProcessor } from '../processors/processors/skills';
import { WorkspaceInstructionsProcessor } from '../processors/processors/workspace-instructions';
import type { ProcessorState } from '../processors/runner';
import { ProcessorRunner } from '../processors/runner';
import {
  RequestContext,
  MASTRA_INHERITED_MEMORY_KEY,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  MASTRA_VERSIONS_KEY,
} from '../request-context';
import { getRequestContextInputValues } from '../request-context/input-source';
import type { DeclaredAgentSchedule } from '../schedules/define';
import type { InferStandardSchemaOutput } from '../schema';
import { toStandardSchema, standardSchemaToJSONSchema } from '../schema';
import type { SignalProvider } from '../signals/signal-provider';
import { resolveAgentSkills, mergeWorkspaceSkills } from '../skills/agent-skills-resolver';
import type { AgentSkillsInput, AgentSkillsResolver, SkillInput } from '../skills/types';

import { InMemoryStore } from '../storage';
import type { GoalObjectiveRecord } from '../storage/domains/thread-state/base';
import { ChunkFrom } from '../stream';
import type { ChunkType, MastraAgentNetworkStream, MastraOnFinishCallback } from '../stream';
import type { FullOutput, MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools';
import { createWebSearchProviderTool, isWebSearchTool, normalizeWebSearchProvider } from '../tools/builtin/web-search';
import { normalizeToolPayloadTransformPolicy } from '../tools/payload-transform';
import type { ToolToConvert } from '../tools/tool-builder/builder';
import { unwrapToolsFromHooks, wrapToolsWithHooks } from '../tools/tool-hooks';
import { isMastraTool, isProviderTool } from '../tools/toolchecks';
import type { CoreTool, McpMetadata, ToolHooks, ToolPayloadTransformPolicy } from '../tools/types';
import type { DynamicArgument } from '../types';
import { makeCoreTool, createMastraProxy, ensureToolProperties, deepMerge } from '../utils';
import type { ToolOptions } from '../utils';
import { slugify } from '../utils/slugify';
import type { MastraVoice } from '../voice';
import { DefaultVoice } from '../voice';
import { TRANSIENT_EXECUTION_SYMBOL } from '../workflows/constants';
import { createWorkflow } from '../workflows/create';
import type { Step } from '../workflows/step';
import type { OutputWriter, WorkflowResult, WorkflowRunState, WorkflowRunStatus } from '../workflows/types';
import { waitForSuspendedSnapshot } from '../workflows/utils';
import type { AnyWorkflow } from '../workflows/workflow';
import { createStep, createStepFromProcessor, isProcessor } from '../workflows/workflow';
import type { AnyWorkspace } from '../workspace';
import { createWorkspaceTools } from '../workspace';
import { createSkillTools } from '../workspace/skills';
import type { SkillFormat } from '../workspace/skills';
import type { Skill, SkillMetadata, WorkspaceSkills } from '../workspace/skills/types';
import { AgentLegacyHandler } from './agent-legacy';
import type {
  AgentDefaultOptions,
  AgentExecutionOptions,
  AgentExecutionOptionsBase,
  InnerAgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
  NetworkOptions,
  DelegationConfig,
  DelegationStartContext,
  DelegationStartResult,
  DelegationCompleteContext,
  DelegationHookError,
} from './agent.types';
import {
  enforceChannelToolFence,
  isHarnessChannelBoundTurn,
  readChannelToolFence,
  stampChannelToolFence,
} from './channel-tool-fence';
import { createDelegationRefRegistry, resolveDelegationRefs } from './delegation-refs';
import type { DelegationRefInput, DelegationRefRegistry } from './delegation-refs';
// Type-only imports from the durable module: erased at build time so they
// don't create the runtime cycle `agent → agent/durable → agent`.
import type {
  DurableAgentListActiveRunsOptions,
  DurableAgentListActiveRunsResult,
  DurableAgentRecoverActiveRunsOptions,
  DurableAgentRecoverActiveRunsResult,
  DurableAgentRecoverOptions,
  DurableAgentStreamOptions,
  DurableAgentStreamResult,
} from './durable/durable-agent';
import type { AgentStepFinishEventData, AgentSuspendedEventData } from './durable/types';
import { RESOLVED_AGENT_MEMORY_REGISTRY_KEY } from './execution-memory';
import type { ResolvedAgentMemory, ResolvedAgentMemoryHandoff } from './execution-memory';
import {
  snapshotAgentExecutionOptions,
  snapshotAgentExecutionOptionsWithRequestContexts,
  snapshotAgentExecutionValue,
} from './execution-snapshot';
import {
  GoalSignalProvider,
  resolveGoalStore,
  readObjective,
  writeObjective,
  clearObjective,
  mutateObjective,
} from './goal';
import { buildMcpServerGuidance } from './mcp-guidance';
import { mergeAgentExecutionOptions, omitLogicalMessageIdentity } from './merge-execution-options';
import { MessageList } from './message-list';
import type { MessageInput, MessageListInput, UIMessageWithMetadata, MastraDBMessage } from './message-list';
import type { SerializedMessageListState } from './message-list/state';
import { buildResumeSpanInput } from './resume-span-input';
import { SaveQueueManager } from './save-queue';
import { isCreatedAgentSignal } from './signals';
import type { CreatedAgentSignal } from './signals';
import { runStreamUntilIdle, runResumeStreamUntilIdle, STREAM_UNTIL_IDLE_DEFAULT_OPTIONS } from './stream-until-idle';
import type { SubAgent, SubAgentToolResult } from './subagent';
import { agentThreadStreamRuntime, defaultAgentThreadPubSub } from './thread-stream-runtime';
import type { ActiveThreadRun } from './thread-stream-runtime';
import { shouldOmitToolBeforeConversion } from './tool-permission-prefilter';
import {
  captureSuspendedToolSurfaceFenceLease,
  claimToolSurfaceFence,
  clearToolSurfaceFence,
  consumeToolSurfaceFenceRestore,
  createToolSurfaceFence,
  enforceToolSurfaceFence,
  materializeToolSurfaceFence,
  readToolSurfaceFence,
  stageToolSurfaceFenceRestore,
  stampToolSurfaceFence,
  suspendToolSurfaceFence,
  transferSuspendedToolSurfaceFence,
} from './tool-surface-fence';
import { TripWire } from './trip-wire';
import type {
  AgentClaimThreadPeerOptions,
  AgentConfig,
  AgentMemoryOption,
  AgentDurableOption,
  AgentGenerateOptions,
  AgentNotificationConfig,
  GoalConfig,
  AgentStreamOptions,
  ToolsetsInput,
  ToolsetsMode,
  ToolsInput,
  AgentModelManagerConfig,
  AgentCreateOptions,
  AgentExecuteOnFinishOptions,
  AgentEditorConfig,
  AgentInstructions,
  AgentMessageInput,
  AgentMethodType,
  AgentSignal,
  AgentStateSignalInput,
  AgentSubscribeToThreadOptions,
  AgentThreadIdentityOptions,
  AgentThreadPeerAdvertisement,
  AgentThreadSubscription,
  DiscoverAgentThreadPeersOptions,
  PublicStructuredOutputOptions,
  QueueAgentMessageOptions,
  QueueAgentMessageResult,
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

export type MastraLLM = MastraLLMV1 | MastraLLMVNext;

const SKIP_AGENT_EXECUTION_PREFLIGHT = Symbol('skipAgentExecutionPreflight');

type AgentExecutionPreflightOptions = {
  [SKIP_AGENT_EXECUTION_PREFLIGHT]?: true;
  [STREAM_UNTIL_IDLE_DEFAULT_OPTIONS]?: AgentExecutionOptions<any>;
};

type ResumeStreamInternalOptions = AgentExecutionOptionsBase<any> &
  AgentExecutionPreflightOptions & {
    structuredOutput?: PublicStructuredOutputOptions<any>;
    toolCallId?: string;
    model?: DynamicArgument<MastraModelConfig>;
    _pubsub: PubSub;
  };

function transferSnapshottedSuspendedToolSurfaceFence(
  options: { runId?: unknown; requestContext?: unknown } | undefined,
  requestContextSnapshots: ReadonlyMap<RequestContext, RequestContext>,
): void {
  const targetContext = options?.requestContext;
  if (!(targetContext instanceof RequestContext)) return;
  const runId = typeof options?.runId === 'string' ? options.runId : undefined;

  for (const [sourceContext, snapshottedContext] of requestContextSnapshots) {
    if (snapshottedContext !== targetContext) continue;
    const lease = captureSuspendedToolSurfaceFenceLease(sourceContext, runId);
    if (lease) {
      transferSuspendedToolSurfaceFence(sourceContext, targetContext, runId, lease);
    }
    return;
  }
}

// Structural shape of the lazily-built `DurableAgent` wrapper used by
// `Agent`'s standalone-durable delegators. Declared as a concrete interface
// (rather than `Record<string, Function>`) so that under
// `noUncheckedIndexedAccess` each method access is a non-optional function.
interface StandaloneDurableWrapper {
  stream: (...args: any[]) => any;
  generate: (...args: any[]) => any;
  resume: (...args: any[]) => any;
  recover: (...args: any[]) => any;
  resumeGenerate: (...args: any[]) => any;
  resumeStream: (...args: any[]) => any;
  approveToolCall: (...args: any[]) => any;
  declineToolCall: (...args: any[]) => any;
  streamUntilIdle: (...args: any[]) => any;
  listActiveRuns: (...args: any[]) => any;
  recoverActiveRuns: (...args: any[]) => any;
  observe: (...args: any[]) => any;
  prepare: (...args: any[]) => any;
}

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

type ModelFallbacks = {
  id: string;
  generatedId: boolean;
  model: DynamicArgument<MastraModelConfig>;
  maxRetries: number;
  maxRetriesConfigured: boolean;
  enabled: boolean;
  modelSettings?: DynamicArgument<ModelFallbackSettings>;
  providerOptions?: DynamicArgument<ProviderOptions>;
  headers?: DynamicArgument<Record<string, string>>;
}[];

type ResolvedModelSelection = MastraModelConfig | ModelFallbacks;

type ResolvedExecutionModels = {
  model: MastraLanguageModel | MastraLegacyLanguageModel;
  modelList: AgentModelManagerConfig[] | null;
};

type ProcessorLoadedToolsProvider = {
  getLoadedToolsForRequestContext?: (args: {
    requestContext: RequestContext;
    messages?: MastraDBMessage[];
    tools?: Record<string, unknown>;
  }) => Record<string, ToolToConvert> | Promise<Record<string, ToolToConvert>>;
};

function isReadOnlyMemoryExecution(memory: AgentExecutionOptions<any>['memory']): boolean {
  return Boolean(memory && typeof memory === 'object' && 'options' in memory && memory.options?.readOnly);
}

type AgentSnapshotMemoryInfo = {
  threadId?: string;
  resourceId?: string;
};

// Resume ownership can be checked with a resource alone when the caller's
// run scope has no thread. Keep the public AgentMemoryOption contract intact;
// this narrower private shape is only used by the ownership guards.
type AgenticLoopResumeMemoryOption = Omit<AgentMemoryOption, 'thread'> & {
  thread?: AgentMemoryOption['thread'];
};

type AgenticLoopResumeOwnershipOptions = {
  memory?: AgenticLoopResumeMemoryOption;
};

/**
 * A suspended tool call inside a suspended agent run — either waiting on a
 * tool-call approval or on resume data for a tool that called `suspend()`.
 */
export interface AgentRunToolCall {
  /** Exact workflow resume label required to continue this call. */
  toolCallId: string;
  toolName?: string;
  /** Arguments the model supplied for an approval-gated call. */
  args?: unknown;
  /** True when the run is waiting on tool-call approval. */
  requiresApproval: boolean;
  /** Tool-defined payload when the tool itself called `suspend()`. */
  suspendPayload?: unknown;
}

/** Persisted agent snapshots are discoverable only while suspended. */
export type AgentRunStatus = Extract<WorkflowRunStatus, 'suspended'>;

/** Storage-backed filters for {@link Agent.listSuspendedRuns}. */
export interface AgentListSuspendedRunsOptions {
  /** Only return runs that belong to this memory thread. */
  threadId?: string;
  /** Only return runs that belong to this memory resource. */
  resourceId?: string;
  /** Trusted request context used for ownership and FGA checks. */
  requestContext?: RequestContext;
  /** Only return runs created at or after this date. */
  fromDate?: Date;
  /** Only return runs created at or before this date. */
  toDate?: Date;
  /** Number of items per page when paired with `page`. */
  perPage?: number;
  /** Zero-indexed page number. */
  page?: number;
}

/** A suspended run owned by this agent and recovered from workflow storage. */
export interface AgentRun {
  /** Run ID accepted by the resume and approval APIs. */
  runId: string;
  status: AgentRunStatus;
  workflowName: 'agentic-loop' | 'durable-agentic-loop';
  threadId?: string;
  resourceId?: string;
  /** When the run's snapshot was last persisted. */
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

function isTrustedActorSignal(actor: unknown): actor is ActorSignal {
  if (actor === true) {
    return true;
  }

  if (typeof actor !== 'object' || actor === null) {
    return false;
  }

  const candidate = actor as { actorKind?: unknown; sourceWorkflow?: unknown };
  return (
    candidate.actorKind === 'system' &&
    (candidate.sourceWorkflow === undefined || typeof candidate.sourceWorkflow === 'string')
  );
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

/**
 * Creates an AI agent that generates and streams responses, with optional tools,
 * memory, and voice capabilities.
 *
 * Opt into durable execution with `durable`; attaching the agent to a `Mastra`
 * instance then wraps it with `createDurableAgent`.
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
 * @example
 * Opt into durable execution via config — the agent is auto-wrapped with
 * `createDurableAgent` when it is attached to a `Mastra` instance:
 * ```typescript
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: 'openai/gpt-5',
 *   durable: true, // or: { cache, pubsub, maxSteps, cleanupTimeoutMs, durableRequestContextKeys }
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
   * Lazily-created Mastra used as a fallback when the agent isn't attached to
   * a user-supplied Mastra. It provides both workflow storage and the pubsub
   * worker lifecycle required by the fork's evented Agent execution path.
   * Cleared when `__registerMastra` attaches a real Mastra later.
   */
  #ephemeralMastra?: Mastra;

  /**
   * True when this instance is a fork produced by resolving a stored agent
   * version (see Mastra#resolveVersionedAgent). Prevents #execute from
   * re-resolving the version and recursing.
   * @internal
   */
  #storedVersionApplied = false;
  #pubsub?: PubSub;
  #inheritedPubSub?: PubSub;
  #memory?: DynamicArgument<MastraMemory, TRequestContext>;
  #skills?: AgentSkillsInput<TRequestContext>;
  #skillsFormat?: SkillFormat;
  // Per-request memoization so one resolver call serves both context injection and tool creation.
  #resolvedSkillsByRequest = new WeakMap<RequestContext<TRequestContext>, Promise<SkillInput[]>>();
  #workflows?: DynamicArgument<Record<string, AnyWorkflow>, TRequestContext>;
  #defaultGenerateOptionsLegacy: DynamicArgument<AgentGenerateOptions, TRequestContext>;
  #defaultStreamOptionsLegacy: DynamicArgument<AgentStreamOptions, TRequestContext>;
  #defaultOptions: DynamicArgument<AgentDefaultOptions<TOutput>, TRequestContext>;
  #defaultNetworkOptions: DynamicArgument<NetworkOptions, TRequestContext>;
  #tools: DynamicArgument<TTools, TRequestContext>;
  #hooks?: ToolHooks;
  #scorers: DynamicArgument<MastraScorers, TRequestContext>;
  #agents: DynamicArgument<Record<string, SubAgent<string, TRequestContext>>, TRequestContext>;
  #voice: DynamicArgument<MastraVoice, TRequestContext>;
  #agentChannels: AgentChannels | null = null;
  #workspace?: DynamicArgument<AnyWorkspace | undefined, TRequestContext>;
  #inputProcessors?: DynamicArgument<InputProcessorOrWorkflow[], TRequestContext>;
  #outputProcessors?: DynamicArgument<OutputProcessorOrWorkflow[], TRequestContext>;
  #maxProcessorRetries?: number;
  #errorProcessors?: DynamicArgument<ErrorProcessorOrWorkflow[], TRequestContext>;
  #browser?: MastraBrowser;
  #hasExplicitBrowser = false;
  #requestContextSchema?: StandardSchemaWithJSON<TRequestContext>;
  #backgroundTasks?: AgentBackgroundConfig;
  #notifications?: AgentNotificationConfig;
  #signals?: SignalProvider[];
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
  #activeStreamUntilIdle = new Map<string, () => void>();
  #threadStreamPubSubsByRunId = new Map<string, PubSub>();
  #threadStreamPubSubsByThreadKey = new Map<string, { runId: string; pubsub: PubSub }>();
  readonly #options?: AgentCreateOptions;
  readonly #durable?: AgentDurableOption;
  /**
   * Cached DurableAgent-wrapper promise created on-demand by `#getStandaloneDurable()`
   * when `durable: true` is set on the config but the agent is not attached
   * to a Mastra instance (which normally auto-wraps on registration). The
   * wrapper is created via dynamic import to avoid the ESM init cycle
   * `agent → agent/durable → agent`.
   */
  #standaloneDurable?: Promise<StandaloneDurableWrapper | undefined>;
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
    this.#durable = config.durable;

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
    this.#defaultOptions =
      typeof config.defaultOptions === 'function'
        ? config.defaultOptions
        : (omitLogicalMessageIdentity(
            (config.defaultOptions ?? {}) as Record<string, any>,
          ) as AgentDefaultOptions<TOutput>);
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

    this.#scorers = config.scorers || ({} as MastraScorers);

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

    if (config.workspace) {
      this.#workspace = config.workspace;
    }

    if (config.inputProcessors) {
      this.#inputProcessors = config.inputProcessors;
    }

    if (config.outputProcessors) {
      this.#outputProcessors = config.outputProcessors;
    }

    if (config.maxProcessorRetries !== undefined) {
      this.#maxProcessorRetries = config.maxProcessorRetries;
    }

    if (config.errorProcessors) {
      this.#errorProcessors = config.errorProcessors;
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

        if (provider.getInputProcessors) {
          signalInputProcessors.push(...provider.getInputProcessors());
        }
        if (provider.getOutputProcessors) {
          signalOutputProcessors.push(...provider.getOutputProcessors());
        }
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

  getPubSub() {
    return this.#pubsub ?? this.#inheritedPubSub ?? this.#mastra?.pubsub;
  }

  #getThreadTarget(options?: { memory?: AgentExecutionOptionsBase<any>['memory']; requestContext?: RequestContext }) {
    const thread = options?.memory?.thread;
    const threadId =
      (options?.requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) ||
      (typeof thread === 'string' ? thread : thread?.id);
    const resourceId =
      (options?.requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined) || options?.memory?.resource;

    return { threadId, resourceId };
  }

  #hasExplicitThreadMemory(options?: {
    memory?: AgentExecutionOptionsBase<any>['memory'];
    requestContext?: RequestContext;
  }) {
    const { threadId } = this.#getThreadTarget(options);
    return typeof threadId === 'string';
  }

  #sameThreadTarget(
    left: { threadId?: string; resourceId?: string },
    right: { threadId?: string; resourceId?: string },
  ) {
    return left.threadId === right.threadId && left.resourceId === right.resourceId;
  }

  #generateStreamRunId(target?: { threadId?: string; resourceId?: string }) {
    return (
      this.#mastra?.generateId({
        idType: 'run',
        source: 'agent',
        entityId: this.id,
        threadId: target?.threadId,
        resourceId: target?.resourceId,
      }) ?? randomUUID()
    );
  }

  #threadStreamKey(resourceId: string | undefined, threadId: string): string {
    return [resourceId ?? '', threadId].join('\u0000');
  }

  #rememberThreadStreamPubSub(options: AgentExecutionOptionsBase<any> & { runId?: string }, pubsub: PubSub) {
    const { threadId, resourceId } = this.#getThreadTarget(options);
    if (!options.runId) return;

    this.#threadStreamPubSubsByRunId.set(options.runId, pubsub);
    if (!threadId) return;

    this.#threadStreamPubSubsByThreadKey.set(this.#threadStreamKey(resourceId, threadId), {
      runId: options.runId,
      pubsub,
    });
  }

  #forgetThreadStreamPubSub(options: AgentExecutionOptionsBase<any> & { runId?: string }) {
    const { threadId, resourceId } = this.#getThreadTarget(options);
    if (!options.runId) return;

    this.#forgetThreadStreamPubSubForTarget({
      runId: options.runId,
      resourceId,
      threadId,
    });
  }

  #rememberThreadStreamPubSubForTarget(
    options: { runId?: string; resourceId?: string; threadId?: string },
    pubsub: PubSub,
  ) {
    if (!options.runId) return;

    this.#threadStreamPubSubsByRunId.set(options.runId, pubsub);
    if (!options.threadId) return;

    this.#threadStreamPubSubsByThreadKey.set(this.#threadStreamKey(options.resourceId, options.threadId), {
      runId: options.runId,
      pubsub,
    });
  }

  #forgetThreadStreamPubSubForTarget(options: { runId?: string; resourceId?: string; threadId?: string }) {
    if (!options.runId) return;

    this.#threadStreamPubSubsByRunId.delete(options.runId);
    if (!options.threadId) return;

    const key = this.#threadStreamKey(options.resourceId, options.threadId);
    if (this.#threadStreamPubSubsByThreadKey.get(key)?.runId === options.runId) {
      this.#threadStreamPubSubsByThreadKey.delete(key);
    }
  }

  #trackThreadStreamPubSub(
    output: MastraModelOutput<any>,
    options: AgentExecutionOptionsBase<any> & { runId?: string },
    completion?: Promise<void>,
  ) {
    void (completion ?? output._waitUntilFinished())
      .finally(() => this.#forgetThreadStreamPubSub(options))
      .catch(() => {});
  }

  #resolveThreadStreamPubSub(options: { runId?: string; threadId?: string; resourceId?: string }): PubSub | undefined {
    if (options.runId) {
      const runPubSub = this.#threadStreamPubSubsByRunId.get(options.runId);
      if (runPubSub) return runPubSub;
    }
    if (options.threadId) {
      return this.#threadStreamPubSubsByThreadKey.get(this.#threadStreamKey(options.resourceId, options.threadId))
        ?.pubsub;
    }
    return undefined;
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
   * Returns the uncombined input processors suitable for `processLLMRequest`.
   * Combined (workflow-wrapped) processors skip `processLLMRequest`; this
   * method returns them individually so the `ProcessorRunner` can invoke
   * each processor's `processLLMRequest` method.
   * @internal — used by `DurableAgent` preparation to populate the registry.
   */
  async __listLLMRequestProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<InputProcessorOrWorkflow[]> {
    return this.listResolvedLLMRequestProcessors(requestContext, undefined, resolvedMemory);
  }

  /**
   * Resolve the processor surface once for a single execution boundary.
   *
   * Dynamic input-processor factories used to be invoked independently for
   * the combined input pipeline, the uncombined `processLLMRequest` pipeline,
   * and tool discovery. Besides the avoidable work, a request-aware factory
   * could return three different surfaces for one run. Keep the raw configured
   * input list so tool discovery can reuse the same snapshot.
   *
   * @internal — durable preparation and recovery use this to pin one coherent
   * processor surface for the run.
   */
  async __resolveExecutionProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
    outputProcessorOverrides?: OutputProcessorOrWorkflow[],
  ): Promise<{
    configuredInputProcessors: InputProcessorOrWorkflow[];
    inputProcessors: InputProcessorOrWorkflow[];
    llmRequestInputProcessors: InputProcessorOrWorkflow[];
    outputProcessors: OutputProcessorOrWorkflow[];
    errorProcessors: ErrorProcessorOrWorkflow[];
  }> {
    const ctx = requestContext ?? new RequestContext();
    const typedCtx = ctx as RequestContext<TRequestContext>;
    const configuredInputProcessors = this.#inputProcessors
      ? typeof this.#inputProcessors === 'function'
        ? await this.#inputProcessors({ requestContext: typedCtx })
        : this.#inputProcessors
      : [];
    const llmRequestInputProcessors = await this.resolveInputProcessors(ctx, configuredInputProcessors, resolvedMemory);

    return {
      configuredInputProcessors,
      inputProcessors: this.combineProcessorsIntoWorkflow(
        llmRequestInputProcessors,
        `${this.id}-input-processor`,
      ) as InputProcessorOrWorkflow[],
      llmRequestInputProcessors,
      outputProcessors: await this.listResolvedOutputProcessors(ctx, outputProcessorOverrides, resolvedMemory),
      errorProcessors: await this.listErrorProcessors(ctx),
    };
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
   *
   * @experimental Agent goals are experimental and may change in a future release.
   */
  async setObjective(
    objective: string,
    options: {
      threadId: string;
      resourceId: string;
      judgeModelId?: string;
      maxRuns?: number;
      prompt?: string;
      id?: string;
      activeDurationMs?: number;
    },
  ): Promise<GoalObjectiveRecord | undefined> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    if (!store || !options.resourceId || !options.threadId) return undefined;

    const now = Date.now();
    const suppliedActiveDurationMs = options.activeDurationMs;
    const activeDurationMs =
      suppliedActiveDurationMs !== undefined &&
      Number.isFinite(suppliedActiveDurationMs) &&
      suppliedActiveDurationMs >= 0
        ? suppliedActiveDurationMs
        : 0;
    const record: GoalObjectiveRecord = {
      id: options.id ?? randomUUID(),
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
    await writeObjective(store, options.resourceId, options.threadId, record);
    return record;
  }

  /**
   * Read the current objective record for a thread, or `undefined` when none is
   * set (or the agent has no storage).
   */
  async getObjective(options: { resourceId: string; threadId: string }): Promise<GoalObjectiveRecord | undefined> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    return readObjective(store, options.resourceId, options.threadId);
  }

  /**
   * Drop the objective for a thread.
   */
  async clearObjective(options: { resourceId: string; threadId: string }): Promise<void> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    await clearObjective(store, options.resourceId, options.threadId);
  }

  /**
   * Partially update the options of the active objective. Only provided fields
   * are persisted into the record (so the precedence over agent config is
   * remembered in thread state). No-ops when no objective is set.
   *
   * Merged inside the store's lock: this is how a user pauses or re-budgets a
   * goal while the goal step is mid-judge, so reading the record outside the
   * write would let the two races drop each other's fields.
   */
  async updateObjectiveOptions(options: {
    resourceId: string;
    threadId: string;
    judgeModelId?: string;
    maxRuns?: number;
    prompt?: string;
    status?: GoalObjectiveRecord['status'];
    pausedReason?: string;
  }): Promise<GoalObjectiveRecord | undefined> {
    const store = await resolveGoalStore(this.#mastra as MastraUnion | undefined);
    const now = Date.now();
    const commit = await mutateObjective<{ record: GoalObjectiveRecord | undefined }>(
      store,
      options.resourceId,
      options.threadId,
      current => {
        if (!current) return { operation: 'keep', result: { record: undefined } };

        const status = options.status ?? current.status;
        const updated: GoalObjectiveRecord = {
          ...current,
          updatedAt: now,
          ...(options.judgeModelId !== undefined ? { judgeModelId: options.judgeModelId } : {}),
          ...(options.maxRuns !== undefined && options.maxRuns > 0 ? { maxRuns: options.maxRuns } : {}),
          ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
          status,
          pausedReason: status === 'paused' ? (options.pausedReason ?? current.pausedReason) : undefined,
        };
        return { operation: 'set', value: updated, result: { record: updated } };
      },
    );
    return commit?.record;
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

      // 2. Any directly configured tool on a full Agent sub-agent has
      // background.enabled === true. Do not call getToolsForExecution here:
      // parent tool-surface construction is metadata inspection, and resolving
      // the child's full execution surface also resolves its tenant-scoped
      // model, memory, workspace, and processors before the child is invoked.
      if (subAgent instanceof Agent) {
        const subAgentTools = await subAgent.listTools({ requestContext });
        if (subAgentTools && typeof subAgentTools === 'object') {
          for (const tool of Object.values(subAgentTools)) {
            const bg = (tool as any)?.background as ToolBackgroundConfig | undefined;
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
   * Sets the AgentChannels instance for this agent.
   * Used by ChannelProvider implementations to inject the channels they create.
   * @internal
   */
  setChannels(agentChannels: AgentChannels): void {
    this.#mastra?._assertHarnessAgentChannelsAdapterAllowed(this, agentChannels);
    if (this.#agentChannels && this.#agentChannels !== agentChannels) {
      this.logger?.debug(`Replacing existing AgentChannels on agent "${this.name}"`);
    }
    agentChannels.__setAgent(this);
    this.#mastra?._registerAgentChannelsForAgent(this, agentChannels);
    this.#agentChannels = agentChannels;
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
   * The `durable` option this agent was constructed with, if any.
   *
   * Read by `Mastra.addAgent` to auto-wrap the agent with `createDurableAgent`
   * at registration time. See {@link AgentDurableOption}.
   */
  get durable(): AgentDurableOption | undefined {
    return this.#durable;
  }

  /**
   * Self-referential `agent` accessor exposed only when this agent was
   * constructed with `durable: true`.
   *
   * This lets `isDurableAgentLike()` return `true` for a standalone durable
   * `Agent` — mirroring the duck-type shape of a real `DurableAgent` wrapper
   * (`wrapper.agent` points to the wrapped `Agent`). External consumers can
   * then treat a `new Agent({ durable: true })` as durable-capable without
   * having to first register it with a Mastra instance.
   *
   * `Mastra.addAgent` disambiguates a self-referential placeholder from a real
   * wrapper by checking `agent.agent === agent` and routes the placeholder
   * through `createDurableAgent` so registration still produces a proper
   * `DurableAgent` wrapper.
   *
   * Returns `undefined` when this agent is not durable so non-durable agents
   * do not accidentally satisfy the durable duck-type.
   */
  get agent(): Agent<TAgentId, TTools, TOutput> | undefined {
    return this.#durable ? (this as unknown as Agent<TAgentId, TTools, TOutput>) : undefined;
  }

  /**
   * Resolve the DurableAgent that should handle `stream`/`generate` calls when
   * this agent was constructed with `durable: true` but is being used
   * standalone (i.e. no `Mastra` instance auto-wrapped it during registration).
   *
   * The wrapper is created lazily via a dynamic `import()` of the durable
   * module to avoid the ESM initialization cycle
   * `agent → agent/durable → agent` that would TDZ-break
   * `class DurableAgent extends Agent`. The result is cached on
   * `#standaloneDurable` so subsequent calls reuse the same wrapper.
   *
   * Returns `undefined` when the agent has already been registered with a
   * Mastra instance (Mastra performs the wrapping itself) or when no
   * `durable` config is set.
   */
  async #getStandaloneDurable(): Promise<StandaloneDurableWrapper | undefined> {
    if (!this.#durable) return undefined;
    // When attached to a Mastra instance, Mastra auto-wraps at registration
    // and the caller is already talking to the DurableAgent — the raw
    // `Agent` is only reached via internal delegation from the wrapper,
    // which must not re-enter the durable path.
    if (this.#mastra) return undefined;
    if (this.#standaloneDurable) {
      return this.#standaloneDurable;
    }

    const wrapperPromise = import('./durable/create-durable-agent').then(({ createDurableAgent }) => {
      // Registration may win while the dynamic import is in flight. In that
      // case the raw Agent must continue on its registered, non-reentrant path.
      if (this.#mastra) return undefined;

      const opts = this.#durable === true ? {} : (this.#durable as object);
      return createDurableAgent({ agent: this as unknown as Agent, ...opts }) as unknown as StandaloneDurableWrapper;
    });
    this.#standaloneDurable = wrapperPromise;

    try {
      return await wrapperPromise;
    } catch (error) {
      // Allow a later call to retry a failed dynamic import/construction.
      if (this.#standaloneDurable === wrapperPromise) {
        this.#standaloneDurable = undefined;
      }
      throw error;
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
      type: SpanType.SKILL_RESOLUTION,
      name: 'resolve-skills',
      attributes: { agentId: this.id },
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

  /**
   * Validates the request context against the agent's requestContextSchema.
   * Throws an error if validation fails.
   */
  async #validateRequestContext(requestContext?: RequestContext) {
    if (this.#requestContextSchema) {
      const contextValues = getRequestContextInputValues(requestContext);
      const validation = await this.#requestContextSchema['~standard'].validate(contextValues);

      if (validation.issues) {
        const errors = validation.issues;
        const errorMessages = errors
          .map((e: any) => {
            const pathStr = e.path?.map((p: any) => (typeof p === 'object' ? p.key : p)).join('.');
            return `- ${pathStr}: ${e.message}`;
          })
          .join('\n');
        throw new MastraError({
          id: 'AGENT_REQUEST_CONTEXT_VALIDATION_FAILED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `Request context validation failed for agent '${this.id}':\n${errorMessages}`,
          details: {
            agentId: this.id,
            agentName: this.name,
          },
        });
      }
    }
  }

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
          this.logger?.warn?.('[ClientObservabilityProxy] failed to receive client observability payload', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

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
   * Enforces the request-context and FGA boundary shared by fresh and resumed agent execution.
   */
  async #assertAgentExecutionPreflight(
    requestContext?: RequestContext,
    options?: {
      authorize?: boolean;
      memory?: AgentExecutionOptionsBase<any>['memory'];
      runId?: string;
      snapshotMemoryInfo?: AgentSnapshotMemoryInfo;
      agentId?: string;
      agentName?: string;
      actor?: ActorSignal;
    },
  ) {
    const fgaProvider = this.#mastra?.getServer()?.fga;
    if (fgaProvider) {
      const user = requestContext?.get('user');
      const actor = options?.actor;
      const trustedActor = isTrustedActorSignal(actor);
      const { FGADeniedError } = await import('../auth/ee/fga-check');
      if (!user && !trustedActor) {
        throw new FGADeniedError(
          { id: 'unknown' },
          { type: 'agent', id: options?.agentId ?? this.id },
          MastraFGAPermissions.AGENTS_EXECUTE,
        );
      }

      if (trustedActor) {
        const organizationId = requestContext?.get('organizationId');
        if (typeof organizationId !== 'string' || organizationId.length === 0) {
          throw new FGADeniedError(
            user,
            { type: 'agent', id: options?.agentId ?? this.id },
            MastraFGAPermissions.AGENTS_EXECUTE,
            'trusted actor requires organizationId / tenant scope',
          );
        }
      }

      await this.#validateRequestContext(requestContext);

      if (options?.authorize === false) {
        return;
      }

      await this.requireAgentExecutionFGA({
        requestContext,
        memory: options?.memory,
        runId: options?.runId,
        snapshotMemoryInfo: options?.snapshotMemoryInfo,
        agentId: options?.agentId,
        agentName: options?.agentName,
        actor,
      });
      return;
    }

    await this.#validateRequestContext(requestContext);
  }

  /** @internal Shared by DurableAgent when restoring a persisted run. */
  async __assertAgentResumePreflight(options: {
    requestContext?: RequestContext;
    memory?: AgentExecutionOptionsBase<any>['memory'];
    runId?: string;
    snapshotMemoryInfo?: AgentSnapshotMemoryInfo;
    agentId?: string;
    agentName?: string;
    actor?: ActorSignal;
    authorize?: boolean;
  }): Promise<void> {
    await this.#assertAgentExecutionPreflight(options.requestContext, {
      memory: options.memory,
      runId: options.runId,
      snapshotMemoryInfo: options.snapshotMemoryInfo,
      agentId: options.agentId,
      agentName: options.agentName,
      actor: options.actor,
      authorize: options.authorize,
    });
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
    const agentsToUse = this.#agents
      ? typeof this.#agents === 'function'
        ? this.#agents({ requestContext: requestContext as RequestContext<TRequestContext> })
        : this.#agents
      : {};

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

      Object.entries(agents || {}).forEach(([_agentName, agent]) => {
        if (this.#mastra) {
          agent.__registerMastra?.(this.#mastra);
        }
      });

      return agents;
    });
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
    resolvedMemory,
  }: {
    requestContext: RequestContext;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
    errorProcessorOverrides?: ErrorProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
    resolvedMemory?: ResolvedAgentMemory;
  }): Promise<ProcessorRunner> {
    // Resolve processors - overrides replace user-configured but auto-derived (memory, skills) are kept
    const inputProcessors = await this.listResolvedInputProcessors(
      requestContext,
      inputProcessorOverrides,
      resolvedMemory,
    );
    const outputProcessors = await this.listResolvedOutputProcessors(
      requestContext,
      outputProcessorOverrides,
      resolvedMemory,
    );
    const errorProcessors =
      errorProcessorOverrides ??
      (this.#errorProcessors
        ? typeof this.#errorProcessors === 'function'
          ? await this.#errorProcessors({ requestContext: requestContext as RequestContext<TRequestContext> })
          : this.#errorProcessors
        : []);

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
      if (this.#mastra && workflow.mastra !== this.#mastra) {
        workflow.__registerMastra(this.#mastra);
      }
      return [workflow];
    }

    // Filter out invalid processors (objects that don't implement any processor methods)
    const validProcessors = processors.filter(p => isProcessorWorkflow(p) || isProcessor(p));

    if (validProcessors.length === 0) {
      return [];
    }

    const processorPhaseSignatures = new Set(
      validProcessors.map(processor => [...getProcessorWorkflowPhases(processor)].sort().join('\0')),
    );

    // Phase-restricted workflows, heterogeneous phase sets, and workflows with
    // durable descendants must remain top-level processors. A synthetic
    // workflow would otherwise admit every child whenever the union supports a
    // phase, or place a durable child beneath a transient parent.
    // ProcessorRunner preserves order while applying the phase guard to each item.
    if (
      processorPhaseSignatures.size > 1 ||
      validProcessors.some(
        processor =>
          isProcessorWorkflow(processor) &&
          (processorWorkflowHasPhaseRestrictions(processor) || processorWorkflowRequiresDurableExecution(processor)),
      )
    ) {
      for (const [index, processor] of validProcessors.entries()) {
        if (isProcessorWorkflow(processor)) {
          if (!processor.type) {
            processor.type = 'processor';
          }
          if (this.#mastra && processor.mastra !== this.#mastra) {
            processor.__registerMastra(this.#mastra);
          }
        } else {
          processor.processorIndex = index;
        }
      }
      return validProcessors as T[];
    }

    // A single processor already has direct phase dispatch, shared state, tracing,
    // and tripwire handling in ProcessorRunner. Wrapping it adds workflow lifecycle
    // work without adding ordering or composition semantics.
    if (validProcessors.length === 1 && !isProcessorWorkflow(validProcessors[0]!)) {
      return validProcessors as T[];
    }

    // If after filtering we have a single workflow, mark it as processor type and return
    if (validProcessors.length === 1 && isProcessorWorkflow(validProcessors[0]!)) {
      const workflow = validProcessors[0];
      // Mark the workflow as a processor workflow if not already set
      if (!workflow.type) {
        workflow.type = 'processor';
      }
      if (this.#mastra && workflow.mastra !== this.#mastra) {
        workflow.__registerMastra(this.#mastra);
      }
      return [workflow];
    }

    const terminalToolResultPolicy = validProcessors.every(
      processor => (processor as Processor | ProcessorWorkflow).terminalToolResultPolicy === 'pass-through',
    )
      ? ('pass-through' as const)
      : undefined;
    const terminalPersistenceOwners = validProcessors
      .map((processor, index) => ({
        index,
        owner: (processor as Processor | ProcessorWorkflow).terminalToolResultPersistence === 'owner',
      }))
      .filter(entry => entry.owner);
    const terminalToolResultPersistence =
      terminalPersistenceOwners.length === 1 && terminalPersistenceOwners[0]!.index === validProcessors.length - 1
        ? ('owner' as const)
        : undefined;
    const terminalToolResultChainIsAtomic =
      terminalPersistenceOwners.length === 0 || terminalToolResultPersistence === 'owner';

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
        // Combined processor workflows carry live process-local values and use
        // generated run IDs. They cannot be persisted or resumed.
        executionMode: 'transient',
        tracingPolicy: {
          // mark all workflow spans related to processor execution as internal
          internal: InternalSpans.WORKFLOW,
        },
      },
    });
    workflow.__setLogger(this.logger);

    const stateSignalProcessors: Processor[] = [];
    const processorPhases = new Set<ProcessorWorkflowPhase>();
    const streamSteps: ReturnType<typeof createStepFromProcessor>[] = [];

    for (const [index, processorOrWorkflow] of validProcessors.entries()) {
      for (const phase of getProcessorWorkflowPhases(processorOrWorkflow)) {
        processorPhases.add(phase);
      }
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
      committedWorkflow.terminalToolResultPolicy = terminalToolResultChainIsAtomic
        ? terminalToolResultPolicy
        : undefined;
      committedWorkflow.terminalToolResultPersistence = terminalToolResultPersistence;
      committedWorkflow.__processOutputStream = validProcessors.some(
        processor => isProcessorWorkflow(processor) || !!processor.processOutputStream,
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
      }
    }
    // Register the parent Mastra instance so this internal workflow receives
    // the configured ID generator and runtime context. Fresh built-in run IDs
    // skip the guaranteed-miss storage lookup; explicit or custom-generated
    // IDs still use the registered storage for collision/status checks. The
    // processor workflow's snapshot policy keeps its live values process-local.
    if (this.#mastra && isProcessorWorkflow(committedWorkflow)) {
      committedWorkflow.__registerMastra(this.#mastra);
    }
    if (stateSignalProcessors.length > 0 && isProcessorWorkflow(committedWorkflow)) {
      committedWorkflow.__stateSignalProcessors = stateSignalProcessors;
    }
    if (isProcessorWorkflow(committedWorkflow)) {
      setProcessorWorkflowPhases(committedWorkflow, [...processorPhases]);
    }

    // The resulting workflow is compatible with both Input and Output processor types.
    return [committedWorkflow];
  }

  /**
   * Resolves and returns output processors from agent configuration.
   * Processor chains are combined; a lone plain processor stays direct.
   * @internal
   */
  private async listResolvedOutputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: OutputProcessorOrWorkflow[],
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<OutputProcessorOrWorkflow[]> {
    // Get configured output processors - use overrides if provided (from generate/stream options),
    // otherwise use agent constructor processors
    const configuredProcessors = configuredProcessorOverrides
      ? configuredProcessorOverrides
      : this.#outputProcessors
        ? typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({
              requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
            })
          : this.#outputProcessors
        : [];

    // Get memory output processors (with deduplication)
    // Use getMemory() to ensure storage is injected from Mastra if not explicitly configured
    const memory = resolvedMemory
      ? resolvedMemory.value
      : await this.getMemory({ requestContext: requestContext || new RequestContext() });

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
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<InputProcessorOrWorkflow[]> {
    // Get configured input processors - use overrides if provided (from generate/stream options),
    // otherwise use agent constructor processors
    const configuredProcessors = configuredProcessorOverrides
      ? configuredProcessorOverrides
      : this.#inputProcessors
        ? typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({
              requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
            })
          : this.#inputProcessors
        : [];

    // Get memory input processors (with deduplication)
    // Use getMemory() to ensure storage is injected from Mastra if not explicitly configured
    const memory = resolvedMemory
      ? resolvedMemory.value
      : await this.getMemory({ requestContext: requestContext || new RequestContext() });

    const memoryProcessors = memory ? await memory.getInputProcessors(configuredProcessors, requestContext) : [];
    const effectiveMemoryProcessors = this.#inheritedMemory(requestContext)
      ? memoryProcessors.filter(processor => processor.id !== 'observational-memory')
      : memoryProcessors;

    // Get workspace instructions processors (with deduplication)
    const workspaceProcessors = await this.getWorkspaceInstructionsProcessors(configuredProcessors, requestContext);

    // Get skills processors if skills are configured (with deduplication)
    const skillsProcessors = await this.getSkillsProcessors(configuredProcessors, requestContext);

    // Get channel input processors (with deduplication)
    const channelProcessors = this.#agentChannels ? this.#agentChannels.getInputProcessors(configuredProcessors) : [];

    // Get browser context processors (with deduplication)
    const browserProcessors = this.#browser ? this.#browser.getInputProcessors(configuredProcessors) : [];

    // Memory processors should run first (to fetch history, semantic recall, working memory)
    // Workspace instructions run after memory
    // Skills processors run after workspace
    // Channel processors run after skills (context injection for platform awareness)
    // Browser processors run after channel processors to inject browser context
    // User-configured processors run after auto-derived layers to allow customization
    return [
      ...effectiveMemoryProcessors,
      ...workspaceProcessors,
      ...skillsProcessors,
      ...channelProcessors,
      ...browserProcessors,
      ...configuredProcessors,
    ];
  }

  /**
   * Resolves and returns input processors from agent configuration.
   * Processor chains are combined; a lone plain processor stays direct.
   * @internal
   */
  private async listResolvedInputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<InputProcessorOrWorkflow[]> {
    const processors = await this.resolveInputProcessors(requestContext, configuredProcessorOverrides, resolvedMemory);
    return this.combineProcessorsIntoWorkflow(processors, `${this.id}-input-processor`);
  }

  /**
   * Resolves and returns input processors for the provider-boundary LLM request hook.
   * These processors stay uncombined because processLLMRequest runs after conversion to model prompt format.
   * @internal
   */
  private async listResolvedLLMRequestProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<InputProcessorOrWorkflow[]> {
    return this.resolveInputProcessors(requestContext, configuredProcessorOverrides, resolvedMemory);
  }

  /**
   * Returns the input processors for this agent, resolving function-based processors if necessary.
   */
  public async listInputProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<InputProcessorOrWorkflow[]> {
    return this.listResolvedInputProcessors(requestContext, undefined, resolvedMemory);
  }

  /**
   * Returns the output processors for this agent, resolving function-based processors if necessary.
   */
  public async listOutputProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<OutputProcessorOrWorkflow[]> {
    return this.listResolvedOutputProcessors(requestContext, undefined, resolvedMemory);
  }

  /**
   * Returns the error processors for this agent, resolving function-based processors if necessary.
   */
  public async listErrorProcessors(requestContext?: RequestContext): Promise<ErrorProcessorOrWorkflow[]> {
    if (!this.#errorProcessors) return [];
    return typeof this.#errorProcessors === 'function'
      ? await this.#errorProcessors({ requestContext: requestContext as RequestContext<TRequestContext> })
      : this.#errorProcessors;
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
      ? typeof this.#inputProcessors === 'function'
        ? await this.#inputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
        : this.#inputProcessors
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
      ? typeof this.#outputProcessors === 'function'
        ? await this.#outputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
        : this.#outputProcessors
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

    const configuredProcessors =
      typeof this.#inputProcessors === 'function'
        ? await this.#inputProcessors({
            requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
          })
        : this.#inputProcessors;

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

    const configuredProcessors =
      typeof this.#outputProcessors === 'function'
        ? await this.#outputProcessors({
            requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
          })
        : this.#outputProcessors;

    return configuredProcessors;
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
      const processors =
        typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
          : this.#inputProcessors;
      inputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    let outputProcessorIds: string[] = [];
    if (this.#outputProcessors) {
      const processors =
        typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
          : this.#outputProcessors;
      outputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    let errorProcessorIds: string[] = [];
    if (this.#errorProcessors) {
      const processors =
        typeof this.#errorProcessors === 'function'
          ? await this.#errorProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
          : this.#errorProcessors;
      errorProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    return { inputProcessorIds, outputProcessorIds, errorProcessorIds };
  }

  /**
   * Resolves configured processors without registering them. This excludes
   * memory-derived processors to avoid triggering memory factory functions.
   * @internal
   */
  public async getResolvedConfiguredProcessors(requestContext?: RequestContext): Promise<{
    inputProcessors: InputProcessorOrWorkflow[];
    outputProcessors: OutputProcessorOrWorkflow[];
  }> {
    const ctx = (requestContext || new RequestContext()) as RequestContext<TRequestContext>;
    let inputProcessors: InputProcessorOrWorkflow[] = [];
    let outputProcessors: OutputProcessorOrWorkflow[] = [];

    if (this.#inputProcessors) {
      const configuredInputProcessors =
        typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ requestContext: ctx })
          : this.#inputProcessors;
      inputProcessors = this.combineProcessorsIntoWorkflow(
        configuredInputProcessors,
        `${this.id}-input-processor`,
      ) as InputProcessorOrWorkflow[];
    }

    if (this.#outputProcessors) {
      const configuredOutputProcessors =
        typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({ requestContext: ctx })
          : this.#outputProcessors;
      outputProcessors = this.combineProcessorsIntoWorkflow(
        configuredOutputProcessors,
        `${this.id}-output-processor`,
      ) as OutputProcessorOrWorkflow[];
    }

    return { inputProcessors, outputProcessors };
  }

  /**
   * Returns configured processor workflows without mutating Mastra registries.
   * @internal
   */
  public async getConfiguredProcessorWorkflows(requestContext?: RequestContext): Promise<ProcessorWorkflow[]> {
    const { inputProcessors, outputProcessors } = await this.getResolvedConfiguredProcessors(requestContext);
    return [...inputProcessors, ...outputProcessors].filter(isProcessorWorkflow);
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
      const result = memoryConfig({
        requestContext: requestContext as RequestContext<TRequestContext>,
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

      const result = this.#workspace({
        requestContext: requestContext as RequestContext<TRequestContext>,
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
        this.#workflows({ requestContext: requestContext as RequestContext<TRequestContext>, mastra: this.#mastra }),
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

  async listScorers({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<MastraScorers> {
    if (typeof this.#scorers !== 'function') {
      return this.#scorers;
    }

    const result = this.#scorers({
      requestContext: requestContext as RequestContext<TRequestContext>,
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
   * A static `MastraVoice` is shared across calls and is configured with the current
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
      const resolved = await this.#voice({
        requestContext: (requestContext ?? new RequestContext()) as RequestContext<TRequestContext>,
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
    voice?.addInstructions(this.#convertInstructionsToString(instructions));
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
      const result = this.#instructions({
        requestContext: requestContext as RequestContext<TRequestContext>,
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
    toolsetsMode,
  }: {
    requestContext: RequestContext;
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    toolsetsMode?: ToolsetsMode;
  }): Promise<string | undefined> {
    const tools: Array<{ mcpMetadata?: McpMetadata } | undefined> = [];

    if (toolsetsMode !== 'replace') {
      const assignedTools = await this.listTools({ requestContext, resolveWebSearch: false });
      tools.push(...(Object.values(assignedTools || {}) as { mcpMetadata?: McpMetadata }[]));
    }

    for (const toolset of Object.values(toolsets || {})) {
      tools.push(...(Object.values(toolset || {}) as { mcpMetadata?: McpMetadata }[]));
    }

    if (toolsetsMode !== 'replace') {
      tools.push(...(Object.values(clientTools || {}) as { mcpMetadata?: McpMetadata }[]));
    }

    if (tools.length === 0) {
      return undefined;
    }

    return buildMcpServerGuidance(tools);
  }

  /**
   * Helper function to convert agent instructions to string for backward compatibility
   * Used for legacy methods that expect string instructions (e.g., voice)
   * @internal
   */
  #convertInstructionsToString(instructions: AgentInstructions): string {
    if (typeof instructions === 'string') {
      return instructions;
    }

    if (Array.isArray(instructions)) {
      // Handle array of messages (strings or objects)
      return instructions
        .map(msg => {
          if (typeof msg === 'string') {
            return msg;
          }
          // Safely extract content from message objects
          return typeof msg.content === 'string' ? msg.content : '';
        })
        .filter(content => content) // Remove empty strings
        .join('\n\n');
    }

    // Handle single message object - safely extract content
    return typeof instructions.content === 'string' ? instructions.content : '';
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
    const result = this.#metadata({
      requestContext: requestContext as RequestContext<TRequestContext>,
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
        assertAgentExecutionPreflight: this.#assertAgentExecutionPreflight.bind(this),
        needsAgentExecutionPreflight: () =>
          Boolean(this.#requestContextSchema) || Boolean(this.#mastra?.getServer()?.fga),
        hasOwnMemory: this.hasOwnMemory.bind(this),
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
        convertInstructionsToString: this.#convertInstructionsToString.bind(this),
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
    | AgentDefaultOptions<TOutput>
    | Promise<AgentDefaultOptions<TOutput>> {
    if (typeof this.#defaultOptions !== 'function') {
      return this.#defaultOptions;
    }

    const result = this.#defaultOptions({
      requestContext: requestContext as RequestContext<TRequestContext>,
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

      return omitLogicalMessageIdentity(options as Record<string, any>) as AgentDefaultOptions<TOutput>;
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

    const result = this.#defaultNetworkOptions({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });

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

    const result = this.#tools({
      requestContext: requestContext as RequestContext<TRequestContext>,
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
        typeof item.generatedId === 'boolean' &&
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
      id: mdl.id ?? randomUUID(),
      generatedId: mdl.id === undefined,
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
      const resolved = await modelConfig({
        requestContext: requestContext as RequestContext<TRequestContext>,
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
    return this.resolveModelSelection(modelConfig, requestContext).then(resolved => {
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
    });
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

  /** Resolve a turn's primary model and fallback list from one selection snapshot. @internal */
  public async __resolveExecutionModels({
    requestContext = new RequestContext(),
  }: {
    requestContext?: RequestContext;
  } = {}): Promise<ResolvedExecutionModels> {
    const selection = await this.resolveModelSelection(this.model, requestContext);
    if (!Array.isArray(selection)) {
      return {
        model: await this.resolveModelConfig(selection, requestContext),
        modelList: null,
      };
    }

    // A disabled fallback is outside the execution surface. Resolve neither
    // its model factory nor its dynamic settings: those may be tenant-scoped,
    // side-effecting, slow, or intentionally unavailable. This keeps the
    // durable one-snapshot path aligned with getLLM().
    const enabledSelection = selection.filter(entry => entry.enabled);
    const modelList = await this.prepareModels(requestContext, enabledSelection);
    const model = modelList.find(entry => entry.enabled)?.model;
    if (!model) {
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

    return { model, modelList };
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
    this.model = Array.isArray(this.#originalModel) ? [...this.#originalModel] : this.#originalModel;
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

  reorderModels(modelIds: string[]) {
    if (!Array.isArray(this.model)) {
      this.logger.warn('Model is not an array', { agent: this.name });
      return;
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
  }) {
    if (!Array.isArray(this.model)) {
      this.logger.warn('Model is not an array', { agent: this.name });
      return;
    }

    // TypeScript sees this.model as ModelWithRetries[] | ModelFallbacks after Array.isArray check.
    // At runtime, arrays are always normalized to ModelFallbacks (with required id) in the constructor.
    // The cast tells TypeScript to trust this runtime invariant.
    const modelArray = this.model as ModelFallbacks;
    const modelToUpdate = modelArray.find(m => m.id === id);
    if (!modelToUpdate) {
      this.logger.warn('Model not found', { agent: this.name, modelId: id });
      return;
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
  }

  #primitives?: MastraPrimitives;

  /**
   * Registers  logger primitives with the agent.
   * @internal
   */
  __registerPrimitives(p: MastraPrimitives) {
    if (p.logger) {
      this.__setLogger(p.logger);
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

    // Tear down any ephemeral Mastra: we now have a real one. Workers stop in
    // the background so this registration path remains synchronous.
    if (this.#ephemeralMastra) {
      this.#ephemeralMastra.__unregisterHooks();
      void this.#ephemeralMastra.stopWorkers().catch(() => {});
      this.#ephemeralMastra = undefined;
    }

    // Drop the standalone durable wrapper (if any) — Mastra registration
    // means the durable path is now owned by the DurableAgent that Mastra
    // created (or was passed) and callers should be talking to that
    // instance directly. The wrapper is only meaningful pre-registration.
    if (this.#standaloneDurable) {
      this.#standaloneDurable = undefined;
    }

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
        mastra.addProcessorConfiguration(processor, this.id, 'input');
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
        mastra.addProcessorConfiguration(processor, this.id, 'output');
      });
    }

    // Propagate Mastra instance to signal providers
    if (this.#signals) {
      for (const provider of this.#signals) {
        provider.__registerMastra(mastra);
      }
    }
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
    }
    if (this.#primitives) {
      fork.#primitives = this.#primitives;
    }
    if (this.#pubsub) {
      fork.#pubsub = this.#pubsub;
    }
    if (this.#inheritedPubSub) {
      fork.#inheritedPubSub = this.#inheritedPubSub;
    }

    fork.source = this.source;
    fork._agentNetworkAppend = this._agentNetworkAppend;

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
    // Title generation can enter the same evented loop as normal execution.
    // Register an effective Mastra and make sure its workers are available.
    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    llm.__registerMastra(effectiveMastra);
    await effectiveMastra.startWorkers();

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
    memory,
    mastraProxy,
    memoryConfig,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    memory?: MastraMemory;
    mastraProxy?: MastraUnion;
    memoryConfig?: MemoryConfigInternal;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedMemoryTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug('Skipping memory tools (agent network context)', { agent: this.name, runId });
      return convertedMemoryTools;
    }

    // Skip memory tools if there's no usable context — thread-scoped needs threadId, resource-scoped needs resourceId
    if (!threadId && !resourceId) {
      this.logger.debug('Skipping memory tools (no thread or resource context)', { agent: this.name, runId });
      return convertedMemoryTools;
    }

    const memoryTools = memory?.listTools?.(memoryConfig);

    if (memoryTools) {
      for (const [toolName, tool] of Object.entries(memoryTools)) {
        if (shouldOmitToolBeforeConversion(requestContext, runId, toolName)) continue;
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName,
          agentId,
          requestContext,
          ...observabilityContext,
          model: resolvedModel ?? (await getModel()),
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
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
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

    const workspaceTools = await createWorkspaceTools(workspace, {
      requestContext: requestContext ? Object.fromEntries(requestContext.entries()) : {},
      workspace,
    });

    if (Object.keys(workspaceTools).length > 0) {
      this.logger.debug('Adding workspace tools', { agent: this.name, tools: Object.keys(workspaceTools), runId });

      for (const [toolName, tool] of Object.entries(workspaceTools)) {
        if (shouldOmitToolBeforeConversion(requestContext, runId, toolName)) continue;
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          agentName,
          agentId,
          requestContext,
          ...observabilityContext,
          model: resolvedModel ?? (await getModel()),
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
   * Returns tools provided by the agent's channels (e.g. discord_send_message).
   * @internal
   */
  private async listChannelTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    memory,
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    memory?: MastraMemory;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    agentId?: string;
    agentName?: string;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedChannelTools: Record<string, CoreTool> = {};

    if (!this.#agentChannels) {
      return convertedChannelTools;
    }

    const channelTools = this.#agentChannels.getTools();

    if (Object.keys(channelTools).length > 0) {
      for (const [toolName, tool] of Object.entries(channelTools)) {
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName,
          agentId,
          requestContext,
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
        };
        convertedChannelTools[toolName] = makeCoreTool(
          tool as ToolToConvert,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
      }
    }

    return convertedChannelTools;
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
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
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
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
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
        if (shouldOmitToolBeforeConversion(requestContext, runId, toolName)) continue;
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          agentName,
          agentId,
          requestContext,
          ...observabilityContext,
          model: resolvedModel ?? (await getModel()),
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
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
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
        if (shouldOmitToolBeforeConversion(requestContext, runId, toolName)) continue;
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: undefined,
          agentName,
          agentId,
          requestContext,
          ...observabilityContext,
          model: resolvedModel ?? (await getModel()),
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
    messages,
    tools,
    runId,
    resourceId,
    threadId,
    requestContext,
    memory,
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    processors: InputProcessorOrWorkflow[];
    messages?: MastraDBMessage[];
    tools?: Record<string, unknown>;
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    memory?: MastraMemory;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedProcessorTools: Record<string, CoreTool> = {};

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
        ...(messages !== undefined ? { messages } : {}),
        ...(tools !== undefined ? { tools } : {}),
      });
      if (!loadedTools || Object.keys(loadedTools).length === 0) {
        return;
      }

      const workspace = await this.getWorkspace({ requestContext });
      const model = resolvedModel ?? (await getModel());

      for (const [toolName, tool] of Object.entries(loadedTools)) {
        if (shouldOmitToolBeforeConversion(requestContext, runId, toolName)) continue;
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
              agentName,
              agentId,
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
    resolvedMemory,
    ...observabilityContext
  }: {
    requestContext: RequestContext;
    messageList: MessageList;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
    resolvedMemory?: ResolvedAgentMemory;
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
      resolvedMemory?.value ||
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
        resolvedMemory,
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
      hooks?: ToolHooks;
      resolvedMemory?: ResolvedAgentMemory;
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
      hooks,
      resolvedMemory,
      ...rest
    } = args;
    const observabilityContext = resolveObservabilityContext(rest);

    let tripwire: { reason: string; retry?: boolean; metadata?: unknown; processorId?: string } | undefined;
    let nextTools = tools;

    if (
      inputProcessorOverrides?.length ||
      this.#inputProcessors ||
      this.#hasEffectiveMemory(requestContext) ||
      resolvedMemory?.value ||
      this.#skills
    ) {
      const runner = await this.getProcessorRunner({
        requestContext,
        inputProcessorOverrides,
        processorStates,
        resolvedMemory,
      });
      try {
        const llm = await this.getLLM({ requestContext });
        const model = llm.getModel();
        const processInputProviderOptions =
          llm instanceof MastraLLMVNext
            ? mergeProviderOptions(providerOptions, llm.getProviderOptions())
            : providerOptions;
        const memory = resolvedMemory ? resolvedMemory.value : await this.getMemory({ requestContext });
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
          tools: tools ? unwrapToolsFromHooks(tools) : tools,
          providerOptions: processInputProviderOptions,
          retryCount: 0,
        });
        if (result.tools) {
          const workspace = await this.getWorkspace({ requestContext });
          const mastraProxy = this.#mastra
            ? createMastraProxy({ mastra: this.#mastra, logger: this.logger })
            : undefined;
          const convertedTools: Record<string, CoreTool> = {};

          for (const [name, tool] of Object.entries(result.tools)) {
            if (shouldOmitToolBeforeConversion(requestContext, runId, name)) continue;
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
                  model: model as MastraLanguageModel | MastraLegacyLanguageModel,
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

    // §14.7 INC-1b: an input processor may have re-introduced a reserved channel
    // tool name into `nextTools` after the assembled surface was already fenced in
    // convertTools. Re-enforce the reservation (no-op unless this is a channel-bound
    // turn that stamped a reserved set).
    const channelToolFence = readChannelToolFence(requestContext);
    if (channelToolFence) {
      enforceChannelToolFence(nextTools as Record<string, unknown>, channelToolFence, this.logger);
    }
    const toolSurfaceFence = readToolSurfaceFence(requestContext, runId);
    if (toolSurfaceFence) {
      nextTools = enforceToolSurfaceFence(
        nextTools as Record<string, unknown>,
        toolSurfaceFence,
        this.logger,
      ) as typeof nextTools;
    }
    if (nextTools) {
      nextTools = wrapToolsWithHooks(nextTools, this.resolveToolHooks(hooks), {
        agentId: this.id,
        agentName: this.name,
      });
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
    resolvedMemory,
    ...observabilityContext
  }: {
    requestContext: RequestContext;
    messageList: MessageList;
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
    resolvedMemory?: ResolvedAgentMemory;
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
      outputProcessorOverrides?.length ||
      this.#outputProcessors ||
      this.#hasEffectiveMemory(requestContext) ||
      resolvedMemory?.value
    ) {
      const runner = await this.getProcessorRunner({
        requestContext,
        outputProcessorOverrides,
        resolvedMemory,
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
    resolvedMemory,
  }: {
    resourceId?: string;
    threadId: string;
    vectorMessageSearch: string;
    memoryConfig?: MemoryConfigInternal;
    requestContext: RequestContext;
    resolvedMemory?: ResolvedAgentMemory;
  }): Promise<{ messages: MastraDBMessage[] }> {
    // Execution callers pass their already-resolved instance; standalone
    // memory-message reads preserve their existing dynamic resolution behavior.
    const memory = resolvedMemory ? resolvedMemory.value : await this.getMemory({ requestContext });
    if (!memory) {
      return { messages: [] };
    }

    const threadConfig = memory.getMergedThreadConfig(memoryConfig || {});
    if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
      return { messages: [] };
    }

    return memory.recall({
      threadId,
      resourceId,
      // When lastMessages is false (disabled), don't pass perPage so recall()
      // can detect the disabled state from config and return empty history.
      // When lastMessages is a number, pass it as perPage to limit results.
      ...(typeof threadConfig.lastMessages === 'number' ? { perPage: threadConfig.lastMessages } : {}),
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
    memory,
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    memory?: MastraMemory;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};

    // Mastra tools passed into the Agent
    const assignedTools = await this.listTools({ requestContext, resolveWebSearch: false });

    const assignedToolEntries = Object.entries(assignedTools || {});
    const model = resolvedModel ?? (assignedToolEntries.length > 0 ? await getModel() : undefined);

    const assignedCoreToolEntries = await Promise.all(
      assignedToolEntries.map(async ([k, tool]) => {
        if (!tool) {
          return;
        }
        if (shouldOmitToolBeforeConversion(requestContext, runId, k)) return;

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
          agentName,
          agentId,
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
    memory,
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    preservePermissionDeniedTools = false,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    toolsets: ToolsetsInput;
    requestContext: RequestContext;
    memory?: MastraMemory;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
    /** Rebuild an already-fenced replacement surface before the final permission gate. */
    preservePermissionDeniedTools?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};

    const toolsFromToolsets = Object.values(toolsets || {});

    if (toolsFromToolsets.length > 0) {
      this.logger.debug('Adding tools from toolsets', {
        agent: this.name,
        toolsets: Object.keys(toolsets || {}),
        runId,
      });
      for (const toolset of toolsFromToolsets) {
        for (const [toolName, tool] of Object.entries(toolset)) {
          if (!preservePermissionDeniedTools && shouldOmitToolBeforeConversion(requestContext, runId, toolName)) {
            continue;
          }
          const model = resolvedModel ?? (await getModel());
          // Same `webSearchTool` sentinel resolution as the assigned-tools and
          // client-tools lanes: the placeholder must become the provider-executed
          // search tool before conversion, never reach makeCoreTool raw.
          const toolObj = isWebSearchTool(tool) ? createWebSearchProviderTool(normalizeWebSearchProvider(model)) : tool;
          const options: ToolOptions = {
            name: toolName,
            runId,
            threadId,
            resourceId,
            logger: this.logger,
            mastra: mastraProxy as MastraUnion | undefined,
            memory,
            agentName,
            agentId,
            requestContext,
            ...observabilityContext,
            model,
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
    memory,
    mastraProxy,
    clientTools,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    memory?: MastraMemory;
    mastraProxy?: MastraUnion;
    clientTools?: ToolsInput;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};
    // Convert client tools
    const clientToolsForInput = Object.entries(clientTools || {});
    if (clientToolsForInput.length > 0) {
      this.logger.debug('Adding client tools', { agent: this.name, tools: Object.keys(clientTools || {}), runId });
      for (const [toolName, tool] of clientToolsForInput) {
        if (shouldOmitToolBeforeConversion(requestContext, runId, toolName)) continue;
        const model = resolvedModel ?? (await getModel());
        let toolToConvert: ToolToConvert;
        if (isWebSearchTool(tool)) {
          toolToConvert = createWebSearchProviderTool(normalizeWebSearchProvider(model));
        } else if (isProviderTool(tool)) {
          toolToConvert = tool;
        } else {
          const { execute, ...toolRest } = tool;
          toolToConvert = toolRest;
        }
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName,
          agentId,
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
   * This function removes those parts while preserving all other
   * conversation context (user messages, assistant text, etc.).
   * @internal
   */
  private stripParentToolParts(messages: MastraDBMessage[]): MastraDBMessage[] {
    return messages
      .map(message => {
        if (message.id === 'om-continuation') {
          return null;
        }

        if (message.role === 'assistant') {
          const content = message.content;
          const parts = Array.isArray(content) ? content : content?.parts;
          if (!Array.isArray(parts)) return message;
          const filtered = parts.filter((part: any) => part?.type !== 'tool-call');
          if (filtered.length === 0) return null;
          if (Array.isArray(content)) {
            return { ...message, content: filtered };
          }
          return { ...message, content: { ...content, parts: filtered } };
        }

        if ((message as any).role === 'tool') {
          return null;
        }

        return message;
      })
      .filter((message): message is MastraDBMessage => Boolean(message));
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
    memory,
    methodType,
    autoResumeSuspendedTools,
    delegation,
    pubsub,
    backgroundTaskEnabled,
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName: toolAgentName = this.name,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    memory?: MastraMemory;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
    delegation?: DelegationConfig;
    pubsub?: PubSub;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
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
        const generatedToolName = `agent-${agentName}`;
        if (shouldOmitToolBeforeConversion(requestContext, runId, generatedToolName)) continue;
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
                  : `${output.text ?? ''}${output.ref ? `\n\n[ref: ${output.ref}]` : ''}`,
            });

        // A parent RequestContext can be shared by parallel tool calls. Every
        // delegated invocation needs its own copy because the child execution
        // temporarily clears and replaces the reserved memory coordinates.
        // Mutating the parent here lets sibling sub-agents observe one another's
        // thread/resource identity and makes restoration order-dependent.
        const parentRequestContext = requestContext;

        const toolObj = createTool({
          id: generatedToolName,
          description: agent.getDescription() || `Agent: ${agentName}`,
          inputSchema: agentInputSchema,
          outputSchema: agentOutputSchema,
          mastra: this.#mastra,
          ...(toModelOutput ? { toModelOutput } : {}),
          // manually wrap agent tools with tracing, so that we can pass the
          // current tool span onto the agent to maintain continuity of the trace
          execute: async (inputData: SubAgentToolInput, context) => {
            const requestContext = new RequestContext(parentRequestContext.entries());
            const invocationActor = getInvocationActor(context);
            const startTime = Date.now();
            const toolCallId = context?.agent?.toolCallId || randomUUID();

            // Get messages from context - available at tool execution time
            const contextMessages = (context?.agent?.messages || []) as MastraDBMessage[];

            // Strip tool call/result parts from the context.
            const sanitizedMessages = this.stripParentToolParts(contextMessages);

            let fullSubAgentMessages: MastraDBMessage[] = sanitizedMessages;

            // Derive iteration from the number of assistant messages (rough approximation)
            // Each iteration typically produces an assistant message
            const derivedIteration = Math.max(1, sanitizedMessages.filter(m => m.role === 'assistant').length);

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
              runId: runId || randomUUID(),
              threadId,
              resourceId,
              parentAgentId: this.id,
              parentAgentName: this.name,
              toolCallId,
              messages: sanitizedMessages,
              requestContext: subAgentRequestContext,
            };

            const suspendedToolRunId = (inputData as any).suspendedToolRunId as string | undefined;
            const delegatedResumeToolCallId = (inputData as any).suspendedToolCallId;
            const suspendedToolCallId =
              typeof delegatedResumeToolCallId === 'string' && delegatedResumeToolCallId.length > 0
                ? delegatedResumeToolCallId
                : undefined;
            const subAgentRunId =
              suspendedToolRunId ||
              context?.mastra?.generateId({
                idType: 'run',
                source: 'agent',
                entityId: agent.id,
                threadId: inputData.threadId ?? threadId,
                resourceId: inputData.resourceId ?? resourceId,
              }) ||
              randomUUID();

            // Generate sub-agent thread and resource IDs early (before any rejection)
            // and bind the thread to the invocation's stable run id. Approval
            // resumes reuse suspendedToolRunId, so they must also reuse the exact
            // child thread that still owns that run's reservation.
            const slugify = await import(`@sindresorhus/slugify`);
            const subAgentThreadId = inputData.threadId ? `${inputData.threadId}-${subAgentRunId}` : subAgentRunId;

            const subAgentResourceId = inputData.resourceId
              ? `${inputData.resourceId}-${agentName}`
              : context?.mastra?.generateId({
                  idType: 'generic',
                  source: 'agent',
                  entityId: agentName,
                }) || `${slugify.default(this.id)}-${agentName}`;

            // Record a throwing delegation hook on the parent run context so
            // callers can detect "delegation ran but the hook failed" without
            // scraping logs. The execute closure clones requestContext so child
            // memory-coordinate mutations stay isolated; hook errors must still
            // land on the caller's object. Runs for every hookErrorStrategy.
            const recordHookError = (hook: DelegationHookError['hook'], hookError: unknown, logMessage: string) => {
              const error = hookError instanceof Error ? hookError : new Error(String(hookError));
              this.logger.error(logMessage, { agent: this.name, error });
              const existing =
                (parentRequestContext.get('__mastra_delegationHookErrors') as DelegationHookError[] | undefined) ?? [];
              parentRequestContext.set('__mastra_delegationHookErrors', [
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

            // Resolve versioned sub-agent after the hook so context mutations made
            // by the hook participate in version and runtime configuration lookup.
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

            const resolvedModelVersion = (await resolvedAgent.getModel({ requestContext: subAgentRequestContext }))
              .specificationVersion;
            const resolvedDefaultOptions =
              'getDefaultOptions' in resolvedAgent
                ? await (resolvedAgent as Agent).getDefaultOptions({ requestContext: subAgentRequestContext })
                : {};
            const resolvedHasOwnMemoryConfig = resolvedDefaultOptions?.memory !== undefined;
            // The supervisor's own memory becomes the sub-agent's memory for this run
            // only, handed over through `#createResolvedMemoryHandoff` below.
            const inheritParentMemory = resolvedAgent instanceof Agent && !resolvedAgent.hasOwnMemory();

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

            if (startResult?.proceed === false) {
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
                    id: randomUUID(),
                    text: `[Delegation Rejected] ${rejectionMessage}`,
                  },
                  runId,
                  from: ChunkFrom.AGENT,
                });
              }

              const rejectionMemory = inheritParentMemory
                ? memory
                : await resolvedAgent.getMemory({ requestContext: subAgentRequestContext });
              if (rejectionMemory) {
                try {
                  const userMessage: MastraDBMessage = {
                    id: this.#mastra?.generateId() || randomUUID(),
                    role: 'user',
                    type: 'text',
                    createdAt: new Date(),
                    threadId: subAgentThreadId,
                    resourceId: subAgentResourceId,
                    content: { format: 2, parts: [{ type: 'text', text: effectivePrompt }] },
                  };
                  const assistantMessage: MastraDBMessage = {
                    id: this.#mastra?.generateId() || randomUUID(),
                    role: 'assistant',
                    type: 'text',
                    createdAt: new Date(Date.now() + 1),
                    threadId: subAgentThreadId,
                    resourceId: subAgentResourceId,
                    content: {
                      format: 2,
                      parts: [{ type: 'text', text: `[Delegation Rejected] ${rejectionMessage}` }],
                    },
                  };

                  await rejectionMemory.createThread({
                    resourceId: subAgentResourceId,
                    threadId: subAgentThreadId,
                  });
                  await rejectionMemory.saveMessages({ messages: [userMessage, assistantMessage] });
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

            if (startResult?.modifiedPrompt !== undefined) {
              effectivePrompt = startResult.modifiedPrompt;
            }
            if (startResult?.modifiedInstructions !== undefined) {
              effectiveInstructions = startResult.modifiedInstructions;
            }
            if (startResult?.modifiedMaxSteps !== undefined) {
              effectiveMaxSteps = startResult.modifiedMaxSteps;
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
                const ownStr = this.#convertInstructionsToString(agentOwnInstructions);
                if (ownStr) {
                  effectiveInstructions = `${ownStr}\n\n${effectiveInstructions}`;
                }
              }
            }

            let subAgentMemoryHandoff: ResolvedAgentMemoryHandoff | undefined;
            try {
              this.logger.debug('Executing agent as tool', {
                agent: this.name,
                targetAgent: agentName,
                args: inputData,
                runId,
                threadId,
                resourceId,
              });

              let result: any;
              const { resumeData, suspend } = context?.agent ?? {};

              // A delegation only resumes when the suspended-tool lookup actually found a run to
              // resume. `resumeData` alone is model-authored and is present whenever the model
              // decides to fill the always-exposed schema field, so branching on it would send an
              // undefined runId into resumeGenerate/resumeStream and throw
              // AGENT_RESUME_NO_SNAPSHOT_FOUND before the sub-agent ever runs. See issue #21608.
              const shouldResumeSubAgent = !!resumeData && !!suspendedToolRunId;

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
                    runId: runId || randomUUID(),
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
                    memory: {
                      resource: subAgentResourceId,
                      thread: subAgentThreadId,
                      options: {
                        lastMessages: false as const,
                        // Title generation is a top-level thread concern. Ephemeral subagent
                        // delegation threads are never surfaced, so suppress it here to avoid
                        // an extra title-generation LLM call per delegation (issue #18738).
                        generateTitle: false,
                      },
                    },
                  }
                : {};

              const subAgentPromptCreatedAt = new Date();
              const projectDelegatedResponseMessages = (
                responseMessages: readonly MastraDBMessage[],
                fallbackText?: string,
              ): MastraDBMessage[] => {
                if (responseMessages.length > 0) {
                  return responseMessages.map(message => {
                    if (message.threadId === subAgentThreadId && message.resourceId === subAgentResourceId) {
                      return message;
                    }

                    // A child can persist to its own default memory coordinates.
                    // The delegation transcript is a separate UI projection: clone
                    // the child's message before changing identity/coordinates so
                    // neither this write nor a mutating adapter can move the
                    // authoritative child-memory record.
                    return {
                      ...structuredClone(message),
                      id:
                        this.#mastra?.generateId({
                          idType: 'message',
                          source: 'agent',
                          entityId: agent.id,
                          threadId: subAgentThreadId,
                          resourceId: subAgentResourceId,
                          role: message.role,
                        }) || randomUUID(),
                      threadId: subAgentThreadId,
                      resourceId: subAgentResourceId,
                    };
                  });
                }

                if (!fallbackText) return [];
                return [
                  {
                    id:
                      this.#mastra?.generateId({
                        idType: 'message',
                        source: 'agent',
                        entityId: agent.id,
                        threadId: subAgentThreadId,
                        resourceId: subAgentResourceId,
                        role: 'assistant',
                      }) || randomUUID(),
                    role: 'assistant',
                    type: 'text',
                    createdAt: new Date(Math.max(Date.now(), subAgentPromptCreatedAt.getTime() + 1)),
                    threadId: subAgentThreadId,
                    resourceId: subAgentResourceId,
                    content: {
                      format: 2,
                      parts: [{ type: 'text', text: fallbackText }],
                    },
                  },
                ];
              };

              // Build the delegation prompt as a full DB message up front so its ID is
              // stable across every write path. MessageList preserves IDs on DB-format
              // input, so when the sub-agent run itself persists input messages (e.g.
              // observational memory finalizing a turn), the explicit save after the run
              // upserts the same row instead of inserting a duplicate prompt.
              const subAgentUserMessage: MastraDBMessage = {
                id: this.#mastra?.generateId() || randomUUID(),
                role: 'user',
                // New runs let MessageList stamp this after it adds forwarded context.
                // Resume runs do not add the prompt again, but still need a timestamp
                // for the explicit transcript save below.
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
              subAgentMemoryHandoff =
                resolvedAgent instanceof Agent && supportedLanguageModelSpecifications.includes(resolvedModelVersion)
                  ? await resolvedAgent.#createResolvedMemoryHandoff(
                      subAgentRunId,
                      inheritParentMemory ? { value: memory } : undefined,
                    )
                  : undefined;
              const executionAgent: Pick<SubAgent, 'generate' | 'stream' | 'resumeGenerate' | 'resumeStream'> =
                subAgentMemoryHandoff
                  ? {
                      generate: (messages, options) =>
                        (resolvedAgent.generate as any).call(
                          resolvedAgent,
                          messages,
                          options,
                          subAgentMemoryHandoff?.executionMemoryId,
                        ),
                      stream: (messages, options) =>
                        (resolvedAgent.stream as any).call(
                          resolvedAgent,
                          messages,
                          options,
                          subAgentMemoryHandoff?.executionMemoryId,
                        ),
                      resumeGenerate: (resumeData, options) =>
                        (resolvedAgent.resumeGenerate as any).call(
                          resolvedAgent,
                          resumeData,
                          options,
                          subAgentMemoryHandoff?.executionMemoryId,
                        ),
                      resumeStream: (resumeData, options) =>
                        (resolvedAgent.resumeStream as any).call(
                          resolvedAgent,
                          resumeData,
                          options,
                          subAgentMemoryHandoff?.executionMemoryId,
                        ),
                    }
                  : resolvedAgent;

              if (
                (methodType === 'generate' || methodType === 'generateLegacy') &&
                supportedLanguageModelSpecifications.includes(resolvedModelVersion)
              ) {
                const generateResult = shouldResumeSubAgent
                  ? await executionAgent.resumeGenerate(resumeData, {
                      runId: suspendedToolRunId,
                      toolCallId: suspendedToolCallId,
                      _pubsub: pubsub,
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    })
                  : await executionAgent.generate(messagesForSubAgent, {
                      runId: subAgentRunId,
                      _pubsub: pubsub,
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    });

                const subAgentExecutionMemory = subAgentMemoryHandoff?.get();
                const terminalStepResponseMessages =
                  'steps' in generateResult ? generateResult.steps.at(-1)?.response.dbMessages : undefined;
                const generatedResponseMessages: MastraDBMessage[] = generateResult.response.dbMessages?.length
                  ? generateResult.response.dbMessages
                  : (terminalStepResponseMessages ?? []);
                const agentResponseMessages = projectDelegatedResponseMessages(
                  generatedResponseMessages,
                  generateResult.text,
                );
                const subAgentToolResults = generateResult.toolResults?.map((toolResult: SubAgentToolResult) => ({
                  toolName: toolResult.payload.toolName,
                  toolCallId: toolResult.payload.toolCallId,
                  result: toolResult.payload.result,
                  args: toolResult.payload.args,
                  isError: toolResult.payload.isError,
                }));
                // A resumed run continues on the thread/resource persisted by
                // the suspended run. Avoid duplicating its already-persisted prompt.
                const resumedGenerateThreadId = shouldResumeSubAgent ? agentResponseMessages[0]?.threadId : undefined;
                const effectiveGenerateThreadId = resumedGenerateThreadId ?? subAgentThreadId;
                const effectiveGenerateResourceId =
                  (shouldResumeSubAgent ? agentResponseMessages[0]?.resourceId : undefined) ?? subAgentResourceId;
                fullSubAgentMessages = shouldResumeSubAgent
                  ? agentResponseMessages
                  : [subAgentUserMessage, ...agentResponseMessages];

                // Save response messages to sub-agent's memory so the UI can display them
                const memory = subAgentMemoryHandoff
                  ? subAgentExecutionMemory?.value
                  : await resolvedAgent.getMemory({ requestContext: subAgentRequestContext });
                if (memory) {
                  try {
                    await memory.createThread({
                      resourceId: effectiveGenerateResourceId,
                      threadId: effectiveGenerateThreadId,
                    });

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
                    suspendedToolCallId:
                      typeof (generateResult.suspendPayload as any)?.toolCallId === 'string'
                        ? (generateResult.suspendPayload as any).toolCallId
                        : undefined,
                    isAgentSuspend: true,
                  });
                }

                result = {
                  text: generateResult.text,
                  finishReason: generateResult.finishReason,
                  subAgentThreadId: effectiveGenerateThreadId,
                  subAgentResourceId: effectiveGenerateResourceId,
                  subAgentToolResults,
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
                  context: filteredContextMessages as unknown as CoreMessage[],
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
                const streamResult = shouldResumeSubAgent
                  ? await executionAgent.resumeStream(resumeData, {
                      runId: suspendedToolRunId,
                      toolCallId: suspendedToolCallId,
                      _pubsub: pubsub,
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    })
                  : await executionAgent.stream(messagesForSubAgent, {
                      runId: subAgentRunId,
                      _pubsub: pubsub,
                      requestContext: subAgentRequestContext,
                      actor: invocationActor,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...subAgentMemoryOption,
                      ...subAgentAbortOptions,
                      backgroundTaskPolicy: {
                        allowToolDispatch: true,
                        allowDelegationDispatch: false,
                      },
                    });

                let requireToolApproval;
                let suspendedPayload;
                let resumeSchema;
                const streamSuspendedToolCallIds = new Set<string>();
                for await (const chunk of streamResult.fullStream) {
                  if (context?.writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up
                      await context.writer.custom(chunk as any);
                      if (chunk.type === 'data-tool-call-approval') {
                        suspendedPayload = {};
                        requireToolApproval = true;
                        if (typeof chunk.data.toolCallId === 'string' && chunk.data.toolCallId.length > 0) {
                          streamSuspendedToolCallIds.add(chunk.data.toolCallId);
                        }
                      }

                      if (chunk.type === 'data-tool-call-suspended') {
                        suspendedPayload = chunk.data.suspendPayload;
                        resumeSchema = chunk.data.resumeSchema;
                        if (typeof chunk.data.toolCallId === 'string' && chunk.data.toolCallId.length > 0) {
                          streamSuspendedToolCallIds.add(chunk.data.toolCallId);
                        }
                      }
                    } else {
                      await context.writer.write(chunk);
                      if (chunk.type === 'tool-call-approval') {
                        suspendedPayload = {};
                        requireToolApproval = true;
                        if (typeof chunk.payload.toolCallId === 'string' && chunk.payload.toolCallId.length > 0) {
                          streamSuspendedToolCallIds.add(chunk.payload.toolCallId);
                        }
                      }

                      if (chunk.type === 'tool-call-suspended') {
                        suspendedPayload = chunk.payload.suspendPayload;
                        resumeSchema = chunk.payload.resumeSchema;
                        if (typeof chunk.payload.toolCallId === 'string' && chunk.payload.toolCallId.length > 0) {
                          streamSuspendedToolCallIds.add(chunk.payload.toolCallId);
                        }
                      }
                    }
                  }

                  if (chunk.type === 'data-tool-call-approval') {
                    requireToolApproval = (chunk as any).data ?? true;
                    suspendedPayload = {
                      requireToolApproval: (chunk as any).data ?? {},
                    };
                  } else if (chunk.type === 'data-tool-call-suspended') {
                    suspendedPayload = chunk.data.suspendPayload;
                    resumeSchema = chunk.data.resumeSchema;
                  } else if (chunk.type === 'tool-call-approval') {
                    requireToolApproval = chunk.payload ?? true;
                    suspendedPayload = {
                      requireToolApproval: chunk.payload ?? {},
                    };
                  } else if (chunk.type === 'tool-call-suspended') {
                    suspendedPayload = chunk.payload.suspendPayload;
                    resumeSchema = chunk.payload.resumeSchema;
                  }
                }

                const subAgentExecutionMemory = subAgentMemoryHandoff?.get();
                const subAgentToolResults = (await streamResult.toolResults)?.map((toolResult: SubAgentToolResult) => ({
                  toolName: toolResult.payload.toolName,
                  toolCallId: toolResult.payload.toolCallId,
                  result: toolResult.payload.result,
                  args: toolResult.payload.args,
                  isError: toolResult.payload.isError,
                }));
                const agentResponseMessages = projectDelegatedResponseMessages(
                  streamResult.messageList.get.response.db(),
                );
                // A resumed run continues on the thread/resource persisted by
                // the suspended run. Avoid duplicating its already-persisted prompt.
                const resumedStreamThreadId = shouldResumeSubAgent ? agentResponseMessages[0]?.threadId : undefined;
                const effectiveStreamThreadId = resumedStreamThreadId ?? subAgentThreadId;
                const effectiveStreamResourceId =
                  (shouldResumeSubAgent ? agentResponseMessages[0]?.resourceId : undefined) ?? subAgentResourceId;
                fullSubAgentMessages = shouldResumeSubAgent
                  ? agentResponseMessages
                  : [subAgentUserMessage, ...agentResponseMessages];

                // Save response messages to sub-agent's memory so the UI can display them
                const streamMemory = subAgentMemoryHandoff
                  ? subAgentExecutionMemory?.value
                  : await resolvedAgent.getMemory({ requestContext: subAgentRequestContext });
                if (streamMemory) {
                  try {
                    await streamMemory.createThread({
                      resourceId: effectiveStreamResourceId,
                      threadId: effectiveStreamThreadId,
                    });

                    await streamMemory.saveMessages({
                      messages: fullSubAgentMessages,
                    });
                  } catch (memoryError) {
                    this.logger.error('Failed to save messages to sub-agent memory', {
                      agent: this.name,
                      error: memoryError,
                    });
                  }
                }

                if (requireToolApproval || suspendedPayload || resumeSchema) {
                  return suspend?.(suspendedPayload, {
                    resumeSchema,
                    requireToolApproval,
                    runId: streamResult.runId,
                    suspendedToolCallId:
                      streamSuspendedToolCallIds.size === 1
                        ? streamSuspendedToolCallIds.values().next().value
                        : undefined,
                    isAgentSuspend: true,
                  });
                }

                // Use streamResult.text (a delayed promise) which resolves to the
                // output-processor-modified text, rather than the raw accumulated text-deltas.
                const processedText = await streamResult.text;
                const subAgentFinishReason = await streamResult.finishReason;
                const subAgentUsage = await streamResult.usage;
                result = {
                  text: processedText,
                  finishReason: subAgentFinishReason,
                  subAgentThreadId: effectiveStreamThreadId,
                  subAgentResourceId: effectiveStreamResourceId,
                  subAgentToolResults,
                  usage: subAgentUsage,
                };
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
                      // Write data chunks directly to original stream to bubble up
                      await context.writer.custom(chunk as any);
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

              // `usage` is available for successful generate, generateLegacy,
              // and stream paths. The legacy stream path accumulates text only.

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
                    runId: runId || randomUUID(),
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

                  // The invocation context is intentionally isolated from the parent so
                  // parallel sub-agents cannot overwrite one another's memory coordinates.
                  // Bail is a monotonic, turn-level signal, however, and the parent loop is
                  // its consumer. Publish that signal on the parent context explicitly.
                  if (bailed) {
                    parentRequestContext.set('__mastra_delegationBailed', true);
                  }

                  // Apply an in-run replacement for the text the parent model sees,
                  // so the hook can correct a misleading result before the parent reasons on it.
                  if (typeof completeResult?.resultText === 'string') {
                    result = { ...result, text: completeResult.resultText };
                  }

                  // Handle feedback if provided
                  if (completeResult?.feedback) {
                    const feedbackMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || randomUUID(),
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
                    const supervisorMemory = memory;
                    if (supervisorMemory) {
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
                    result: { text: '' },
                    duration: Date.now() - startTime,
                    success: false,
                    error: err instanceof Error ? err : new Error(String(err)),
                    iteration: derivedIteration,
                    runId: runId || randomUUID(),
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
                    parentRequestContext.set('__mastra_delegationBailed', true);
                  }

                  if (completeResult?.feedback) {
                    const feedbackMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || randomUUID(),
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
                    const supervisorMemory = memory;
                    if (supervisorMemory) {
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
            } finally {
              subAgentMemoryHandoff?.release();
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
          name: generatedToolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: this.#mastra,
          memory,
          agentName: toolAgentName,
          agentId,
          requestContext,
          model: resolvedModel ?? (await getModel()),
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
          backgroundConfig: subAgentBackgroundConfig,
          agentBackgroundConfig: this.#backgroundTasks,
        };

        convertedAgentTools[generatedToolName] = makeCoreTool(
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
    memory,
    methodType,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    resolvedModel,
    getModel,
    agentId = this.id,
    agentName = this.name,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    memory?: MastraMemory;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    getModel: () => Promise<MastraLanguageModel | MastraLegacyLanguageModel>;
    agentId?: string;
    agentName?: string;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedWorkflowTools: Record<string, CoreTool> = {};
    const workflows = await this.listWorkflows({ requestContext });
    if (Object.keys(workflows).length > 0) {
      for (const [workflowName, workflow] of Object.entries(workflows)) {
        const generatedToolName = `workflow-${workflowName}`;
        if (shouldOmitToolBeforeConversion(requestContext, runId, generatedToolName)) continue;
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

        // Workflow tools may run concurrently and workflows are allowed to
        // enrich their request context. Give each invocation an isolated copy
        // so child memory/context mutations cannot leak into the parent turn or
        // a sibling workflow call.
        const parentRequestContext = requestContext;

        const toolObj = createTool({
          id: generatedToolName,
          description: workflow.description || `Workflow: ${workflowName}`,
          inputSchema: extendedInputSchema,
          outputSchema,
          mastra: this.#mastra,
          // manually wrap workflow tools with tracing, so that we can pass the
          // current tool span onto the workflow to maintain continuity of the trace
          execute: async (inputData, context) => {
            const requestContext = new RequestContext(parentRequestContext.entries());
            const invocationActor = getInvocationActor(context);
            const savedMastraMemory = requestContext.get('MastraMemory');
            try {
              const { initialState, inputData: workflowInputData, suspendedToolRunId } = inputData as any;
              // Use a unique runId for each workflow tool call to prevent parallel calls
              // from sharing the same cached Run instance (see #13473).
              // For resume cases, suspendedToolRunId is injected into inputData by
              // tool-call-step (from metadata stored during suspension).
              // For fresh calls: generate a new unique runId.
              const runIdToUse = suspendedToolRunId || randomUUID();
              this.logger.debug('Executing workflow as tool', {
                agent: this.name,
                workflow: workflowName,
                description: workflow.description,
                args: inputData,
                runId: runIdToUse,
                threadId,
                resourceId,
              });

              const run = await workflow.createRun({ runId: runIdToUse, resourceId });
              const { resumeData, suspend } = context?.agent ?? {};

              let result: WorkflowResult<any, any, any, any> | undefined = undefined;

              if (methodType === 'generate' || methodType === 'generateLegacy') {
                if (resumeData) {
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
                const streamResult = resumeData
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

              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }

              if (result?.status === 'success') {
                const workflowOutput = result?.result || result;
                return { result: workflowOutput, runId: run.runId };
              } else if (result?.status === 'failed') {
                const workflowOutputError = result?.error;
                return {
                  error: workflowOutputError?.message || String(workflowOutputError) || 'Workflow execution failed',
                  runId: run.runId,
                };
              } else if (result?.status === 'suspended') {
                const suspendedStep = result?.suspended?.[0]?.[0]!;
                const suspendPayload = result?.steps?.[suspendedStep]?.suspendPayload;
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
              } else {
                // This is to satisfy the execute fn's return value for typescript
                return {
                  error: `Workflow should never reach this path, workflow returned no status`,
                  runId: run.runId,
                };
              }
            } catch (err) {
              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }

              const mastraError = new MastraError(
                {
                  id: 'AGENT_WORKFLOW_TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  details: {
                    agentName: this.name,
                    runId: (inputData as any).suspendedToolRunId || runId || '',
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
          name: generatedToolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: this.#mastra,
          memory,
          agentName,
          agentId,
          requestContext,
          model: resolvedModel ?? (await getModel()),
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
          agentBackgroundConfig: this.#backgroundTasks,
        };

        convertedWorkflowTools[generatedToolName] = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
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
    toolsetsMode?: ToolsetsMode;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext?: RequestContext;
    outputWriter?: OutputWriter;
    memoryConfig?: MemoryConfig;
    autoResumeSuspendedTools?: boolean;
    agentId?: string;
    agentName?: string;
    hooks?: ToolHooks;
    delegation?: DelegationConfig;
    methodType?: AgentMethodType;
    backgroundTaskEnabled?: boolean;
    /** @internal Owner used only by an execution path that will clear the registered fence. */
    _toolSurfaceFenceOwnerId?: string;
    /** @internal Defaults already resolved by the enclosing execution boundary. */
    resolvedDefaultOptions?: AgentExecutionOptions<any>;
    /** @internal Memory already resolved by the enclosing execution boundary. */
    resolvedMemory?: ResolvedAgentMemory;
    /** @internal Primary model already resolved by the enclosing execution boundary. */
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    /** @internal Configured input processors pinned by the execution boundary. */
    resolvedInputProcessors?: InputProcessorOrWorkflow[];
    /** @internal Persisted messages available before a live processor step exists. */
    processorMessages?: MastraDBMessage[];
    backgroundTaskPolicy?: AgentExecutionOptionsBase<any>['backgroundTaskPolicy'];
  }): Promise<Record<string, CoreTool>> {
    const requestContext = options.requestContext ?? new RequestContext();
    const defaultOptions = options.resolvedDefaultOptions ?? (await this.getDefaultOptions({ requestContext }));
    const {
      resolvedDefaultOptions: _resolvedDefaultOptions,
      resolvedMemory,
      resolvedModel,
      resolvedInputProcessors,
      processorMessages,
      ...executionOptions
    } = options;
    const mergedOptions = mergeAgentExecutionOptions(
      defaultOptions as Record<string, any>,
      { ...executionOptions, requestContext } as Record<string, any>,
    ) as AgentExecutionOptions & typeof options;
    const optionMemory = (executionOptions as { memory?: AgentExecutionOptionsBase<any>['memory'] }).memory;
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
      toolsetsMode: mergedOptions.toolsetsMode,
      clientTools: mergedOptions.clientTools,
      threadId: explicitThreadFromArgs?.id ?? defaultThreadFromArgs?.id,
      resourceId: resourceIdFromContext || options.resourceId || optionMemory?.resource || mergedMemory?.resource,
      runId: mergedOptions.runId,
      requestContext,
      resolvedMemory,
      resolvedModel,
      outputWriter: mergedOptions.outputWriter,
      memoryConfig: options.memoryConfig ?? mergedMemory?.options,
      autoResumeSuspendedTools: mergedOptions.autoResumeSuspendedTools,
      // Use the deep-merged delegation so default callbacks (e.g. messageFilter)
      // survive when callers pass a partial per-call delegation override.
      delegation: mergedOptions.delegation,
      methodType: options.methodType ?? 'stream',
      pubsub: this.getPubSub() ?? defaultAgentThreadPubSub,
      agentId: options.agentId,
      agentName: options.agentName,
      hooks: options.hooks,
      inputProcessors: resolvedInputProcessors,
      ...(processorMessages !== undefined ? { processorMessages } : {}),
      toolSurfaceFenceOwnerId: options._toolSurfaceFenceOwnerId,
      registerToolSurfaceFence: options._toolSurfaceFenceOwnerId !== undefined,
      backgroundTaskEnabled: options.backgroundTaskEnabled,
      backgroundTaskPolicy: mergedOptions.backgroundTaskPolicy,
    });
  }

  /**
   * Assembles all tools from various sources into a unified CoreTool dictionary.
   * @internal
   */
  private async convertTools({
    toolsets,
    toolsetsMode,
    clientTools,
    threadId,
    resourceId,
    runId,
    requestContext,
    resolvedMemory,
    resolvedModel,
    outputWriter,
    methodType,
    memoryConfig,
    autoResumeSuspendedTools,
    delegation,
    pubsub,
    backgroundTaskEnabled,
    backgroundTaskPolicy,
    inputProcessors,
    processorMessages,
    agentId = this.id,
    agentName = this.name,
    hooks,
    isResume,
    toolSurfaceFenceOwnerId,
    registerToolSurfaceFence = true,
    model,
    ...rest
  }: {
    toolsets?: ToolsetsInput;
    toolsetsMode?: ToolsetsMode;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext: RequestContext;
    resolvedMemory?: ResolvedAgentMemory;
    resolvedModel?: MastraLanguageModel | MastraLegacyLanguageModel;
    outputWriter?: OutputWriter;
    methodType: AgentMethodType;
    memoryConfig?: MemoryConfigInternal;
    autoResumeSuspendedTools?: boolean;
    delegation?: DelegationConfig;
    pubsub?: PubSub;
    backgroundTaskEnabled?: boolean;
    backgroundTaskPolicy?: {
      allowToolDispatch: boolean;
      allowDelegationDispatch: boolean;
    };
    inputProcessors?: InputProcessorOrWorkflow[];
    /** Persisted messages available before input processors run on a resume. */
    processorMessages?: MastraDBMessage[];
    agentId?: string;
    agentName?: string;
    hooks?: ToolHooks;
    isResume?: boolean;
    toolSurfaceFenceOwnerId?: string;
    registerToolSurfaceFence?: boolean;
    model?: MastraLanguageModel | MastraLegacyLanguageModel;
  } & Partial<ObservabilityContext>): Promise<Record<string, CoreTool>> {
    const observabilityContext = resolveObservabilityContext(rest);
    // Callers pass the resolved execution model either as the fork's
    // `resolvedModel` or upstream's `model` (prepare-tools-step); coalesce so
    // provider-native placeholders respect per-call and Studio overrides.
    resolvedModel ??= model;
    let mastraProxy = undefined;
    const logger = this.logger;
    // Execution callers pass their already-resolved instance; standalone tool
    // assembly still resolves once here and shares it across every tool source.
    const memory = resolvedMemory ? resolvedMemory.value : await this.getMemory({ requestContext });

    if (this.#mastra) {
      mastraProxy = createMastraProxy({ mastra: this.#mastra, logger });
    }

    // Resolve the effective model lazily, at most once per convertTools call, so every
    // tool source shares one snapshot. The fork's already-resolved execution model (or
    // upstream's per-call model) wins over the configured dynamic model.
    let modelSnapshot: Promise<MastraLanguageModel | MastraLegacyLanguageModel> | undefined;
    const getResolvedModel = () =>
      (modelSnapshot ??= Promise.resolve(resolvedModel ?? this.getModel({ requestContext })));

    const fenceOwnerId = toolSurfaceFenceOwnerId ?? randomUUID();
    const restoredToolSurfaceFence = registerToolSurfaceFence
      ? consumeToolSurfaceFenceRestore(requestContext, runId)
      : undefined;
    if (registerToolSurfaceFence && isResume) {
      const existingFence = claimToolSurfaceFence(requestContext, runId, fenceOwnerId);
      if (existingFence) {
        if (
          restoredToolSurfaceFence &&
          (restoredToolSurfaceFence.length !== existingFence.allowedNames.length ||
            restoredToolSurfaceFence.some(name => !existingFence.allowedNames.includes(name)))
        ) {
          throw new Error(
            `Cannot resume replacement tool surface for run ${runId ?? '<unknown>'}: the persisted and in-process tool ceilings disagree.`,
          );
        }
        return wrapToolsWithHooks(
          materializeToolSurfaceFence(existingFence) as Record<string, CoreTool>,
          this.resolveToolHooks(hooks),
          { agentId, agentName },
        );
      }
    } else if (registerToolSurfaceFence && readToolSurfaceFence(requestContext, runId)) {
      throw new Error(
        `Cannot start another execution for run ${runId ?? '<unknown>'}: its replacement tool surface is still active or suspended on this RequestContext.`,
      );
    }
    if (restoredToolSurfaceFence && toolsetsMode !== 'replace') {
      throw new Error(
        `Cannot reconstruct replacement tool surface for resumed run ${runId ?? '<unknown>'} without toolsetsMode "replace".`,
      );
    }
    if (toolsetsMode === 'replace') {
      const toolsetTools = await this.listToolsets({
        runId,
        resourceId,
        threadId,
        requestContext,
        memory,
        resolvedModel,
        getModel: getResolvedModel,
        ...observabilityContext,
        mastraProxy,
        toolsets: toolsets ?? {},
        autoResumeSuspendedTools,
        backgroundTaskEnabled,
        agentId,
        agentName,
        preservePermissionDeniedTools: restoredToolSurfaceFence !== undefined,
      });
      let formattedTools = this.formatTools(toolsetTools);
      if (isHarnessChannelBoundTurn(requestContext)) {
        // Replacement suppresses AgentChannels tools, but their normalized
        // names remain reserved on a Harness-bound channel turn. Resolve only
        // that reservation set so a caller cannot reintroduce a direct-provider
        // channel tool through a replacement toolset and bypass the Harness
        // durable outbox and permission boundary.
        const channelTools = await this.listChannelTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          memory,
          ...observabilityContext,
          mastraProxy,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          agentId,
          agentName,
        });
        const reservedChannelToolNames = new Set(Object.keys(channelTools));
        if (reservedChannelToolNames.size > 0) {
          stampChannelToolFence(requestContext, reservedChannelToolNames);
          enforceChannelToolFence(formattedTools, reservedChannelToolNames, logger);
        }
      }
      if (restoredToolSurfaceFence) {
        const missingRestoredTools = [...restoredToolSurfaceFence].filter(name => formattedTools[name] === undefined);
        if (missingRestoredTools.length > 0) {
          throw new Error(
            `Cannot reconstruct replacement tool implementations for resumed run ${runId ?? '<unknown>'}: ${missingRestoredTools.join(', ')}. Refusing to continue with a widened or incomplete tool surface.`,
          );
        }
        formattedTools = enforceToolSurfaceFence(
          formattedTools,
          createToolSurfaceFence(formattedTools, restoredToolSurfaceFence),
          logger,
        ) as typeof formattedTools;
      }
      formattedTools = wrapToolsWithHooks(formattedTools, this.resolveToolHooks(hooks), { agentId, agentName });
      const fence = registerToolSurfaceFence
        ? stampToolSurfaceFence(requestContext, runId, formattedTools, fenceOwnerId)
        : createToolSurfaceFence(formattedTools);
      return materializeToolSurfaceFence(fence) as Record<string, CoreTool>;
    }

    const assignedTools = await this.listAssignedTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      memory,
      resolvedModel,
      ...observabilityContext,
      mastraProxy,
      outputWriter,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    const memoryTools = await this.listMemoryTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      memory,
      resolvedModel,
      ...observabilityContext,
      mastraProxy,
      memoryConfig,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    const toolsetTools = await this.listToolsets({
      runId,
      resourceId,
      threadId,
      requestContext,
      memory,
      resolvedModel,
      ...observabilityContext,
      mastraProxy,
      toolsets: toolsets!,
      outputWriter,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    const clientSideTools = await this.listClientTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      memory,
      resolvedModel,
      ...observabilityContext,
      mastraProxy,
      clientTools: clientTools!,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    // Preserve `onOutput` and `toModelOutput` from server-declared execute-less
    // tools when the serialized client copy overwrites them below. Normal server-executed
    // tools never hand hooks to client-controlled input. Copy instead of
    // mutating so a future cache inside listClientTools cannot leak hooks
    // across requests.
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

    const agentTools = await this.listAgentTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      memory,
      resolvedModel,
      methodType,
      ...observabilityContext,
      autoResumeSuspendedTools,
      delegation,
      pubsub,
      agentId,
      agentName,
      backgroundTaskEnabled: backgroundTaskPolicy?.allowDelegationDispatch ?? backgroundTaskEnabled,
      getModel: getResolvedModel,
    });

    const workflowTools = await this.listWorkflowTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      memory,
      resolvedModel,
      methodType,
      ...observabilityContext,
      autoResumeSuspendedTools,
      agentId,
      agentName,
      backgroundTaskEnabled,
      getModel: getResolvedModel,
    });

    const workspaceTools = await this.listWorkspaceTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      resolvedModel,
      ...observabilityContext,
      mastraProxy,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    const configuredInputProcessors = inputProcessors ?? (await this.listConfiguredInputProcessors(requestContext));
    const hasOnDemandProcessor = hasOnDemandSkillDiscoveryProcessor(configuredInputProcessors);
    const hasSkillsProcessor = hasEagerSkillsProcessor(configuredInputProcessors);

    const skillTools = await this.listSkillTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      resolvedModel,
      ...observabilityContext,
      mastraProxy,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      suppressEagerSkillTools: hasOnDemandProcessor && !hasSkillsProcessor,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    // Upstream #20152 stopped auto-injecting AgentChannels direct-provider
    // tools into the model surface (they are explicit opt-in via
    // `channels.getTools()` now). They are resolved here only on a Harness
    // channel-bound turn, where their normalized names must stay reserved so
    // no other tool source can spoof the fenced platform surface (§14.7).
    const channelTools = isHarnessChannelBoundTurn(requestContext)
      ? await this.listChannelTools({
          runId,
          resourceId,
          threadId,
          requestContext,
          memory,
          ...observabilityContext,
          mastraProxy,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
          agentId,
          agentName,
        })
      : {};

    const browserTools = await this.listBrowserTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      resolvedModel,
      ...observabilityContext,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    const requestResolvedTools = {
      ...assignedTools,
      ...memoryTools,
      ...toolsetTools,
      ...clientSideTools,
      ...agentTools,
      ...workflowTools,
      ...workspaceTools,
      ...skillTools,
      ...browserTools,
    };

    const inputProcessorLoadedTools = await this.listInputProcessorLoadedTools({
      processors: configuredInputProcessors,
      ...(processorMessages !== undefined ? { messages: processorMessages } : {}),
      tools: requestResolvedTools,
      runId,
      resourceId,
      threadId,
      requestContext,
      memory,
      resolvedModel,
      ...observabilityContext,
      mastraProxy,
      outputWriter,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      agentId,
      agentName,
      getModel: getResolvedModel,
    });

    // §14.7: a turn admitted under an active harness ChannelBinding carries both the
    // harness slot and a resolved channel request-context. On such turns the legacy
    // AgentChannels direct-provider tools (e.g. add_reaction) post straight to the
    // platform, bypassing the harness durable outbox / permission / event-ordering
    // guarantees, so they MUST NOT reach the model. Omit them, and reserve their names
    // so NO other tool source (toolset / client / per-turn addTools / skill / …) can
    // re-expose the same name on this turn and spoof the fenced platform surface.
    const channelBoundTurn = isHarnessChannelBoundTurn(requestContext);
    const reservedChannelToolNames = channelBoundTurn ? new Set(Object.keys(channelTools)) : undefined;

    const allTools = {
      ...requestResolvedTools,
      ...inputProcessorLoadedTools,
    };

    const formattedTools = this.formatTools(allTools);
    if (reservedChannelToolNames && reservedChannelToolNames.size > 0) {
      // Reservation runs on the FINAL normalized surface (post-formatTools), so a tool
      // whose name normalizes INTO a reserved channel-tool name is caught too. Stamp the
      // reserved set onto the per-call requestContext so the §14.7 INC-1b re-fence at the
      // dynamic processor-tool sites (Agent.__runProcessInputStep + the agentic-execution
      // loop) can catch a processor that re-introduces a reserved name AFTER assembly.
      stampChannelToolFence(requestContext, reservedChannelToolNames);
      enforceChannelToolFence(formattedTools, reservedChannelToolNames, logger);
    }
    return wrapToolsWithHooks(formattedTools, this.resolveToolHooks(hooks), { agentId, agentName });
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

  private resolveToolHooks(runHooks?: ToolHooks): ToolHooks | undefined {
    if (!this.#hooks) return runHooks;
    if (!runHooks) return this.#hooks;

    return deepMerge(this.#hooks as Record<string, unknown>, runHooks as Record<string, unknown>) as ToolHooks;
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
    ...observabilityContext
  }: {
    messageList: MessageList;
    runId: string;
    requestContext: RequestContext;
    structuredOutput?: boolean;
    overrideScorers?:
      | MastraScorers
      | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
    threadId?: string;
    resourceId?: string;
  } & ObservabilityContext) {
    let scorers: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig }> = {};
    try {
      scorers = overrideScorers
        ? this.resolveOverrideScorerReferences(overrideScorers)
        : await this.listScorers({ requestContext });
    } catch (e) {
      this.logger.warn('Failed to get scorers', { agent: this.name, error: e });
      return;
    }

    const scorerInput: ScorerRunInputForAgent = {
      inputMessages: messageList.getPersisted.input.db(),
      rememberedMessages: messageList.getPersisted.remembered.db(),
      systemMessages: messageList.getSystemMessages(),
      taggedSystemMessages: messageList.getPersisted.taggedSystemMessages,
    };

    const scorerOutput: ScorerRunOutputForAgent = messageList.getPersisted.response.db();

    if (Object.keys(scorers || {}).length > 0) {
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
  }

  /**
   * Resolves scorer name references to actual scorer instances from Mastra.
   * @internal
   */
  private resolveOverrideScorerReferences(
    overrideScorers: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>,
  ) {
    const result: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig }> = {};
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
          result[id] = { scorer, sampling: scorerObject.sampling };
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
      selection.map(async modelConfig => {
        const model = await this.resolveModelConfig(modelConfig.model, requestContext);
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
          generatedId: modelConfig.generatedId,
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
    if (typeof value === 'function') {
      return await (value as (args: { requestContext: RequestContext; mastra?: Mastra }) => Promise<T> | T)({
        requestContext,
        mastra: this.#mastra,
      });
    }
    return value;
  }

  /**
   * Loads the agentic-loop workflow snapshot for resume, or throws an actionable error.
   * Used by resumeStream and resumeGenerate to fail fast at the agent boundary.
   * @internal
   */
  async #loadAgenticLoopSnapshotOrThrow({
    runId,
    method,
    workflowName = 'agentic-loop',
    waitForToolCallId,
    rowOwnership,
  }: {
    runId: string;
    method: string;
    workflowName?: string;
    waitForToolCallId?: string;
    rowOwnership?: {
      requestContext?: RequestContext;
      options?: AgenticLoopResumeOwnershipOptions;
    };
  }) {
    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const workflowsStore = await effectiveMastra?.getStorage()?.getStore('workflows');
    let workflowRun: { resourceId?: unknown; snapshot?: unknown } | null | undefined;
    if (typeof workflowsStore?.getWorkflowRunById === 'function') {
      workflowRun = await workflowsStore.getWorkflowRunById({ workflowName, runId });
    }
    const workflowRunResourceId = typeof workflowRun?.resourceId === 'string' ? workflowRun.resourceId : undefined;
    const workflowRunSnapshot =
      workflowRun?.snapshot && typeof workflowRun.snapshot === 'object' ? workflowRun.snapshot : undefined;
    const workflowRunStatus = (workflowRunSnapshot as { status?: unknown } | undefined)?.status;
    const shouldPoll =
      !workflowRunSnapshot ||
      workflowRunStatus === 'pending' ||
      workflowRunStatus === 'paused' ||
      waitForToolCallId !== undefined;
    if (workflowRun && shouldPoll && rowOwnership) {
      // A pending/paused row may not yet contain the suspended-step metadata
      // needed for full snapshot verification. Its storage-owned resource id is
      // still sufficient to reject a foreign or unauthenticated caller before
      // entering the bounded snapshot poll. Ready suspended snapshots retain
      // the stronger embedded-vs-row integrity error precedence below.
      this.#assertAgenticLoopResumeOwnership({
        method,
        runId,
        runResourceId: workflowRunResourceId,
        requestContext: rowOwnership.requestContext,
        options: rowOwnership.options,
      });
    }
    const existingSnapshot = shouldPoll
      ? await waitForSuspendedSnapshot(workflowsStore, workflowName, runId, {
          missingSnapshotGraceReads: 3,
          isReady: snapshot => {
            if (waitForToolCallId === undefined) return true;
            const { toolCalls, hasLabelConflict } = this.#getAgenticLoopSuspendedToolCalls(snapshot);
            return !hasLabelConflict && toolCalls.some(toolCall => toolCall.toolCallId === waitForToolCallId);
          },
        })
      : workflowRunSnapshot;

    if (!existingSnapshot) {
      const hasStorage = !!workflowsStore;
      throw new MastraError({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" ${method}() could not find a suspended run for runId "${runId}". ` +
          (hasStorage
            ? `The run may have already completed, never suspended, or the runId is invalid. `
            : `No storage is configured on this Mastra instance, so workflow snapshots cannot be persisted. Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL). `) +
          `Ensure you are calling ${method}() only with a runId from a currently-suspended run.`,
        details: {
          runId,
          agentName: this.name,
          hasStorage,
        },
      });
    }
    const snapshotStatus = (existingSnapshot as { status?: unknown }).status;
    if (snapshotStatus !== 'suspended') {
      throw new MastraError({
        id: 'AGENT_RESUME_RUN_NOT_SUSPENDED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() cannot resume runId "${runId}" because it is not suspended.`,
        details: {
          runId,
          agentName: this.name,
          status: typeof snapshotStatus === 'string' ? snapshotStatus : 'unknown',
        },
      });
    }

    return {
      resourceId: workflowRunResourceId,
      snapshot: existingSnapshot,
    };
  }

  #getResumeCallerResourceId(
    requestContext: RequestContext | undefined,
    options: AgenticLoopResumeOwnershipOptions | undefined,
    { trustMemoryResource = true }: { trustMemoryResource?: boolean } = {},
  ): string | undefined {
    const contextResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
    if (typeof contextResourceId === 'string' && contextResourceId.length > 0) {
      return contextResourceId;
    }
    if (!trustMemoryResource) {
      return undefined;
    }
    const memoryResourceId = options?.memory?.resource;
    return typeof memoryResourceId === 'string' && memoryResourceId.length > 0 ? memoryResourceId : undefined;
  }

  #assertAgenticLoopResumeOwnership({
    method,
    runId,
    runResourceId,
    runThreadId,
    snapshot,
    requestContext,
    options,
  }: {
    method: string;
    runId: string;
    runResourceId?: string;
    runThreadId?: string;
    snapshot?: any;
    requestContext?: RequestContext;
    options?: AgenticLoopResumeOwnershipOptions;
  }): void {
    const hasFga = Boolean(this.#mastra?.getServer()?.fga);
    const callerResourceId = this.#getResumeCallerResourceId(requestContext, options, {
      trustMemoryResource: !hasFga,
    });
    const requestedThread = options?.memory?.thread;
    const memoryThreadId = typeof requestedThread === 'string' ? requestedThread : requestedThread?.id;
    const contextThreadId = requestContext?.get(MASTRA_THREAD_ID_KEY);
    const callerThreadId = typeof contextThreadId === 'string' ? contextThreadId : hasFga ? undefined : memoryThreadId;

    const runAgentId = snapshot ? this.#getAgenticLoopSnapshotAgentId(snapshot) : undefined;
    if (snapshot && runAgentId !== this.id) {
      throw new MastraError({
        id: 'AGENT_RESUME_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() cannot resume runId "${runId}" because it is not owned by this agent.`,
        details: {
          runId,
          agentName: this.name,
        },
      });
    }

    if (runResourceId && callerResourceId && runResourceId !== callerResourceId) {
      throw new MastraError({
        id: 'AGENT_RESUME_OWNER_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() cannot resume runId "${runId}" from a different resource.`,
        details: {
          runId,
          agentName: this.name,
        },
      });
    }

    if (hasFga && runResourceId && !callerResourceId) {
      throw new MastraError({
        id: 'AGENT_RESUME_OWNER_UNVERIFIED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() requires the matching resource id to resume runId "${runId}".`,
        details: {
          runId,
          agentName: this.name,
        },
      });
    }

    if (runThreadId && callerThreadId && callerThreadId !== runThreadId) {
      throw new MastraError({
        id: 'AGENT_RESUME_THREAD_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() requires the matching thread id to resume runId "${runId}".`,
        details: {
          runId,
          agentName: this.name,
        },
      });
    }

    if (hasFga && runThreadId && !callerThreadId) {
      throw new MastraError({
        id: 'AGENT_RESUME_THREAD_UNVERIFIED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() requires the matching thread id to resume runId "${runId}".`,
        details: {
          runId,
          agentName: this.name,
        },
      });
    }

    if (hasFga && !runResourceId) {
      throw new MastraError({
        id: 'AGENT_RESUME_PERSISTED_RUN_NO_OWNER',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" ${method}() cannot verify ownership for runId "${runId}" because the persisted run has no resource id.`,
        details: {
          runId,
          agentName: this.name,
        },
      });
    }
  }

  #getAgenticLoopSnapshotMemoryInfo(
    existingSnapshot: any,
  ): { threadId?: string; resourceId?: string } | null | undefined {
    const threadIds = new Set<string>();
    const resourceIds = new Set<string>();
    let foundMemoryInfo = false;
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      const payload = step?.status === 'suspended' ? step.suspendPayload : undefined;
      const isToolSuspension = Boolean(
        payload?.requireToolApproval || payload?.toolCallSuspended || payload?.toolName || payload?.toolCallId,
      );
      if (isToolSuspension) {
        const serializedMessageList = payload?.__streamState?.messageList;
        if (
          !serializedMessageList ||
          typeof serializedMessageList !== 'object' ||
          !Object.prototype.hasOwnProperty.call(serializedMessageList, 'memoryInfo')
        ) {
          // Durable agentic-loop snapshots don't embed `__streamState` in
          // suspend payloads; their thread/resource info lives on the
          // serialized workflow input's message-list state instead.
          const durableMessageListState = (existingSnapshot?.context as Record<string, any> | undefined)?.input
            ?.messageListState;
          if (
            durableMessageListState &&
            typeof durableMessageListState === 'object' &&
            Object.prototype.hasOwnProperty.call(durableMessageListState, 'memoryInfo')
          ) {
            foundMemoryInfo = true;
            const durableMemoryInfo = durableMessageListState.memoryInfo;
            if (durableMemoryInfo === null) continue;
            if (typeof durableMemoryInfo !== 'object') return null;
            if (typeof durableMemoryInfo.threadId === 'string' && durableMemoryInfo.threadId.length > 0) {
              threadIds.add(durableMemoryInfo.threadId);
            }
            if (typeof durableMemoryInfo.resourceId === 'string' && durableMemoryInfo.resourceId.length > 0) {
              resourceIds.add(durableMemoryInfo.resourceId);
            }
            continue;
          }
          return null;
        }
        foundMemoryInfo = true;
        const memoryInfo = serializedMessageList.memoryInfo;
        // MessageList serializes a deliberate no-memory run as null. The
        // property itself is the integrity evidence; only an absent or
        // malformed value means ownership metadata was lost.
        if (memoryInfo === null) continue;
        if (typeof memoryInfo !== 'object') return null;
        if (typeof memoryInfo.threadId === 'string' && memoryInfo.threadId.length > 0) {
          threadIds.add(memoryInfo.threadId);
        }
        if (typeof memoryInfo.resourceId === 'string' && memoryInfo.resourceId.length > 0) {
          resourceIds.add(memoryInfo.resourceId);
        }
      }
    }
    if (threadIds.size > 1 || resourceIds.size > 1) return null;
    if (!foundMemoryInfo) return undefined;
    return {
      threadId: [...threadIds][0],
      resourceId: [...resourceIds][0],
    };
  }

  #verifyAgenticLoopResumeSnapshot({
    method,
    runId,
    runResourceId,
    snapshot,
    requestContext,
    options,
  }: {
    method: string;
    runId: string;
    runResourceId?: string;
    snapshot: any;
    requestContext?: RequestContext;
    options?: AgenticLoopResumeOwnershipOptions;
  }): { threadId?: string; resourceId?: string } | undefined {
    const snapshotMemoryInfo = this.#getAgenticLoopSnapshotMemoryInfo(snapshot);
    if (snapshotMemoryInfo === null) {
      throw new MastraError({
        id: 'AGENT_RESUME_SNAPSHOT_OWNER_CONFLICT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: `Agent "${this.name}" found conflicting persisted ownership for runId "${runId}".`,
        details: { runId, agentName: this.name },
      });
    }
    if (runResourceId && snapshotMemoryInfo?.resourceId && runResourceId !== snapshotMemoryInfo.resourceId) {
      throw new MastraError({
        id: 'AGENT_RESUME_SNAPSHOT_OWNER_CONFLICT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: `Agent "${this.name}" found conflicting resource ownership for runId "${runId}".`,
        details: { runId, agentName: this.name },
      });
    }
    this.#assertAgenticLoopResumeOwnership({
      method,
      runId,
      runResourceId: runResourceId ?? snapshotMemoryInfo?.resourceId,
      runThreadId: snapshotMemoryInfo?.threadId,
      snapshot,
      requestContext,
      options,
    });
    this.#assertAgenticLoopResumeLabelIntegrity(snapshot, runId);
    return snapshotMemoryInfo;
  }

  #getAgenticLoopSnapshotAgentId(existingSnapshot: any): string | undefined {
    // Durable agentic-loop snapshots persist the owning agent id on the
    // serialized workflow input instead of in suspend payloads.
    const durableAgentId = (existingSnapshot?.context as Record<string, any> | undefined)?.input?.agentId;
    const agentIds = new Set<string>();
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      const payload = step?.status === 'suspended' ? step.suspendPayload : undefined;
      const isToolSuspension = Boolean(
        payload?.requireToolApproval || payload?.toolCallSuspended || payload?.toolName || payload?.toolCallId,
      );
      if (typeof payload?.__agentId === 'string') {
        agentIds.add(payload.__agentId);
      } else if (isToolSuspension) {
        if (typeof durableAgentId !== 'string') return undefined;
        agentIds.add(durableAgentId);
      }
    }
    if (agentIds.size === 1) return [...agentIds][0];
    if (agentIds.size === 0 && typeof durableAgentId === 'string') return durableAgentId;
    return undefined;
  }

  /** Exact stored version id the run was executing when it suspended, if any. */
  #getSnapshotAgentVersionId(existingSnapshot: WorkflowRunState | null | undefined): string | undefined {
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      if (step && step.status === 'suspended' && step.suspendPayload?.__agentVersionId) {
        return step.suspendPayload.__agentVersionId;
      }
    }
    return undefined;
  }

  #findResumeLabelForStep(existingSnapshot: any, stepId: string, persistedToolCallId?: unknown): string | undefined {
    if (typeof persistedToolCallId === 'string' && persistedToolCallId.length > 0) {
      const target = existingSnapshot?.resumeLabels?.[persistedToolCallId] as { stepId?: string } | undefined;
      return target?.stepId === stepId ? persistedToolCallId : undefined;
    }
    const matchingLabels = Object.entries(existingSnapshot?.resumeLabels ?? {}).filter(
      ([, target]) => (target as { stepId?: string } | undefined)?.stepId === stepId,
    );
    return matchingLabels.length === 1 ? matchingLabels[0]![0] : undefined;
  }

  #getAgenticLoopSuspendedToolCalls(existingSnapshot: any): {
    toolCalls: AgentRunToolCall[];
    hasLabelConflict: boolean;
  } {
    const toolCalls: AgentRunToolCall[] = [];
    let hasLabelConflict = false;

    const collectFromPayload = (payload: Record<string, any>, stepKey: string) => {
      if (payload.requireToolApproval) {
        const payloadToolCallId = payload.requireToolApproval.toolCallId;
        const envelopeToolCallId = payload.toolCallResume?.toolCallId;
        const resumeLabel = this.#findResumeLabelForStep(
          existingSnapshot,
          stepKey,
          payloadToolCallId ?? envelopeToolCallId,
        );
        if (
          !resumeLabel ||
          (payloadToolCallId && payloadToolCallId !== resumeLabel) ||
          (envelopeToolCallId && envelopeToolCallId !== resumeLabel)
        ) {
          hasLabelConflict = true;
          return;
        }
        toolCalls.push({
          toolCallId: resumeLabel,
          toolName: payload.requireToolApproval.toolName,
          args: payload.requireToolApproval.args,
          requiresApproval: true,
        });
      } else if (payload.toolCallSuspended || payload.toolName || payload.toolCallId) {
        const envelopeToolCallId = payload.toolCallResume?.toolCallId;
        const resumeLabel = this.#findResumeLabelForStep(
          existingSnapshot,
          stepKey,
          payload.toolCallId ?? envelopeToolCallId,
        );
        if (
          !resumeLabel ||
          (payload.toolCallId && payload.toolCallId !== resumeLabel) ||
          (envelopeToolCallId && envelopeToolCallId !== resumeLabel)
        ) {
          hasLabelConflict = true;
          return;
        }
        toolCalls.push({
          toolCallId: resumeLabel,
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
    return { toolCalls, hasLabelConflict };
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

  #assertAgenticLoopResumeLabelIntegrity(snapshot: any, runId: string): AgentRunToolCall[] {
    const { toolCalls, hasLabelConflict } = this.#getAgenticLoopSuspendedToolCalls(snapshot);
    if (hasLabelConflict) {
      throw new MastraError({
        id: 'AGENT_RESUME_LABEL_CONFLICT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: `Agent "${this.name}" found conflicting persisted resume labels for runId "${runId}".`,
        details: { runId, agentName: this.name },
      });
    }
    return toolCalls;
  }

  #assertAgenticLoopSuspendedToolCall(snapshot: any, runId: string, requestedToolCallId?: string): void {
    const toolCalls = this.#assertAgenticLoopResumeLabelIntegrity(snapshot, runId);
    if (requestedToolCallId !== undefined) {
      const matchingCalls = toolCalls.filter(toolCall => toolCall.toolCallId === requestedToolCallId);
      if (matchingCalls.length !== 1) {
        throw new MastraError({
          id: 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `Agent "${this.name}" cannot resume tool call "${requestedToolCallId}" because it is not suspended.`,
          details: { runId, agentName: this.name, toolCallId: requestedToolCallId },
        });
      }
    } else if (toolCalls.length > 1) {
      throw new MastraError({
        id: 'AGENT_RESUME_AMBIGUOUS_TOOL_CALL',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" requires an exact toolCallId to resume runId "${runId}".`,
        details: { runId, agentName: this.name },
      });
    }
  }

  /**
   * Load edited approval arguments from the private suspended agentic-loop
   * snapshot. Recalled transcript metadata may intentionally redact these
   * fields, so this helper is only called by the cold auto-resume path after
   * the tool-call step has authenticated that recovery is necessary.
   * @internal
   */
  async __getAgenticLoopEditedApprovalResume(
    request: Parameters<AgenticLoopEditedApprovalResumeLoader>[0],
  ): Promise<Awaited<ReturnType<AgenticLoopEditedApprovalResumeLoader>>> {
    const memory =
      request.threadId !== undefined || request.resourceId !== undefined
        ? {
            ...(request.threadId !== undefined ? { thread: request.threadId } : {}),
            ...(request.resourceId !== undefined ? { resource: request.resourceId } : {}),
          }
        : undefined;

    await this.requireAgentExecutionFGA({
      requestContext: request.requestContext,
      memory,
      runId: request.runId,
      actor: request.actor,
    });

    const { resourceId: runResourceId, snapshot } = await this.#loadAgenticLoopSnapshotOrThrow({
      runId: request.runId,
      method: 'editedApprovalResume',
      waitForToolCallId: request.toolCallId,
      rowOwnership: {
        requestContext: request.requestContext,
        options: { memory },
      },
    });

    this.#verifyAgenticLoopResumeSnapshot({
      method: 'editedApprovalResume',
      runId: request.runId,
      runResourceId,
      snapshot,
      requestContext: request.requestContext,
      options: { memory },
    });
    this.#assertAgenticLoopSuspendedToolCall(snapshot, request.runId, request.toolCallId);

    const snapshotForScan = snapshot as any;
    const matches: {
      approvedArgs: Record<string, unknown>;
      approvalInputIdentityDigest: string;
    }[] = [];
    for (const stepKey in snapshotForScan?.context) {
      const step = snapshotForScan?.context[stepKey];
      if (step?.status !== 'suspended' || !step.suspendPayload) continue;

      const foreachIterations = this.#getSuspendedForeachIterations(step.suspendPayload);
      const payloads =
        foreachIterations.length > 0
          ? foreachIterations.map(iteration => iteration.suspendPayload)
          : [step.suspendPayload];
      for (const payload of payloads) {
        const toolCallResume = payload?.toolCallResume;
        if (!toolCallResume || typeof toolCallResume !== 'object' || Array.isArray(toolCallResume)) continue;
        if (
          toolCallResume.type !== 'suspension' ||
          toolCallResume.identityDigest !== request.identityDigest ||
          toolCallResume.originRunId !== request.originRunId ||
          toolCallResume.toolCallId !== request.toolCallId ||
          toolCallResume.toolName !== request.toolName ||
          !Object.hasOwn(toolCallResume, 'approvedArgs') ||
          !Object.hasOwn(toolCallResume, 'approvalInputIdentityDigest') ||
          typeof toolCallResume.approvalInputIdentityDigest !== 'string'
        ) {
          continue;
        }

        matches.push({
          approvedArgs: structuredClone(toolCallResume.approvedArgs) as Record<string, unknown>,
          approvalInputIdentityDigest: toolCallResume.approvalInputIdentityDigest,
        });
      }
    }

    return matches.length === 1 ? matches[0] : undefined;
  }

  #getAgenticLoopSnapshotToolSurfaceFence(existingSnapshot: any): readonly string[] | undefined {
    for (const key in existingSnapshot?.context) {
      const step = existingSnapshot?.context[key];
      for (const candidate of [step?.payload, step?.output]) {
        const allowedNames = candidate?.toolSurfaceFence;
        if (Array.isArray(allowedNames) && allowedNames.every(name => typeof name === 'string')) {
          return Object.freeze([...allowedNames]);
        }
      }
    }
    return undefined;
  }

  #withSnapshotThreadTarget<T extends { memory?: AgentExecutionOptionsBase<any>['memory'] }>(
    options: T | undefined,
    snapshotMemoryInfo: { threadId?: string; resourceId?: string } | undefined,
  ): T | undefined {
    if (!snapshotMemoryInfo?.threadId && !snapshotMemoryInfo?.resourceId) return options;

    const memory = options?.memory as ({ resource?: string; thread?: unknown } & Record<string, unknown>) | undefined;
    const memoryPatch: Record<string, unknown> = {};
    if (!memory?.resource && snapshotMemoryInfo.resourceId) memoryPatch.resource = snapshotMemoryInfo.resourceId;
    if (!memory?.thread && snapshotMemoryInfo.threadId) memoryPatch.thread = snapshotMemoryInfo.threadId;
    if (Object.keys(memoryPatch).length === 0) return options;

    return {
      ...(options ?? ({} as T)),
      memory: {
        ...(memory && typeof memory === 'object' ? memory : {}),
        ...memoryPatch,
      },
    } as T;
  }

  #getSnapshotMemoryInfo(existingSnapshot: any): AgentSnapshotMemoryInfo | null | undefined {
    return this.#getAgenticLoopSnapshotMemoryInfo(existingSnapshot);
  }

  #getSuspendedToolInfo(
    existingSnapshot: WorkflowRunState | null | undefined,
    targetToolCallId?: string,
  ): { toolCallId?: string; toolName?: string } | undefined {
    const suspendedToolCalls = this.#getAgenticLoopSuspendedToolCalls(existingSnapshot).toolCalls;
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
   * Rehydrate the exact persisted conversation behind a suspended tool call.
   * Tool-discovery processors need this before `processInputStep` exists on a
   * cold approval resume, otherwise context-backed loaded executors disappear.
   */
  #getResumeProcessorMessages(
    existingSnapshot: WorkflowRunState | null | undefined,
    targetToolCallId?: string,
  ): MastraDBMessage[] | undefined {
    const suspendedCalls = this.#getAgenticLoopSuspendedToolCalls(existingSnapshot).toolCalls;
    const resolvedToolCallId =
      targetToolCallId ?? (suspendedCalls.length === 1 ? suspendedCalls[0]?.toolCallId : undefined);
    if (!resolvedToolCallId) return undefined;

    const serializedMessageLists: unknown[] = [];
    for (const stepKey in existingSnapshot?.context) {
      const step = existingSnapshot?.context[stepKey];
      if (step?.status !== 'suspended' || !step.suspendPayload) continue;
      const suspendedIterations = this.#getSuspendedForeachIterations(step.suspendPayload);
      const payloads =
        suspendedIterations.length > 0
          ? suspendedIterations.map(iteration => iteration.suspendPayload)
          : [step.suspendPayload];

      for (const payload of payloads) {
        const persistedToolCallId =
          payload.requireToolApproval?.toolCallId ?? payload.toolCallId ?? payload.toolCallResume?.toolCallId;
        const resumeLabel = this.#findResumeLabelForStep(existingSnapshot, stepKey, persistedToolCallId);
        if (resumeLabel !== resolvedToolCallId) continue;
        serializedMessageLists.push(
          payload.__streamState?.messageList ?? step.suspendPayload.__streamState?.messageList,
        );
      }
    }

    if (
      serializedMessageLists.length !== 1 ||
      !serializedMessageLists[0] ||
      typeof serializedMessageLists[0] !== 'object'
    ) {
      throw new MastraError({
        id: 'AGENT_RESUME_PROCESSOR_MESSAGES_INVALID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: `Agent "${this.name}" could not reconstruct one persisted message state for suspended tool call "${resolvedToolCallId}".`,
        details: { agentName: this.name, toolCallId: resolvedToolCallId },
      });
    }

    const serialized = serializedMessageLists[0] as SerializedMessageListState;
    try {
      return new MessageList({
        threadId: serialized.memoryInfo?.threadId,
        resourceId: serialized.memoryInfo?.resourceId,
      })
        .deserialize(serialized)
        .get.all.db();
    } catch (cause) {
      throw new MastraError(
        {
          id: 'AGENT_RESUME_PROCESSOR_MESSAGES_INVALID',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: `Agent "${this.name}" could not deserialize persisted messages for suspended tool call "${resolvedToolCallId}".`,
          details: { agentName: this.name, toolCallId: resolvedToolCallId },
        },
        cause,
      );
    }
  }

  #getResumeSpanInput(resumeData: unknown, suspendedToolInfo?: { toolCallId?: string; toolName?: string }): unknown {
    if (!suspendedToolInfo?.toolName && !suspendedToolInfo?.toolCallId) {
      return resumeData;
    }

    const resumeInput: Record<string, unknown> =
      resumeData && typeof resumeData === 'object' && !Array.isArray(resumeData)
        ? { ...(resumeData as Record<string, unknown>) }
        : { resumeData };

    const hasConflictingToolName =
      suspendedToolInfo.toolName &&
      resumeInput.toolName !== undefined &&
      resumeInput.toolName !== suspendedToolInfo.toolName;
    const hasConflictingToolCallId =
      suspendedToolInfo.toolCallId &&
      resumeInput.toolCallId !== undefined &&
      resumeInput.toolCallId !== suspendedToolInfo.toolCallId;
    const spanInput: Record<string, unknown> =
      hasConflictingToolName || hasConflictingToolCallId ? { resumeData: resumeInput } : { ...resumeInput };

    if (suspendedToolInfo.toolName) {
      spanInput.toolName = suspendedToolInfo.toolName;
    }

    if (suspendedToolInfo.toolCallId) {
      spanInput.toolCallId = suspendedToolInfo.toolCallId;
    }

    return spanInput;
  }
  #getAgentExecutionResourceId({
    requestContext,
    memory,
    snapshotMemoryInfo,
  }: {
    requestContext?: RequestContext;
    memory?: AgenticLoopResumeMemoryOption;
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
    agentId = this.id,
    agentName = this.name,
    actor,
  }: {
    requestContext?: RequestContext;
    memory?: AgenticLoopResumeMemoryOption;
    runId?: string;
    snapshotMemoryInfo?: AgentSnapshotMemoryInfo;
    agentId?: string;
    agentName?: string;
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
      resource: { type: 'agent', id: getAgentFGAResourceId(agentId) },
      permission: MastraFGAPermissions.AGENTS_EXECUTE,
      requestContext,
      actor,
      context: {
        resourceId: executionResourceId,
      },
      metadata: {
        agentId,
        agentName,
        runId,
        executionResourceId,
      },
    });
  }

  /**
   * Lazily build (and cache) an ephemeral in-memory Mastra. Standalone agents
   * need both workflow storage and a pubsub worker for evented execution.
   * Reused for subsequent calls; `__registerMastra(real)` tears it down.
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
    await ephemeral.startWorkers();
    this.#ephemeralMastra = ephemeral;
    return ephemeral;
  }

  async #createResolvedMemoryHandoff(
    runId: string,
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<ResolvedAgentMemoryHandoff> {
    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const runScope = effectiveMastra.__createRunScope(runId);
    let registry = runScope.get(RESOLVED_AGENT_MEMORY_REGISTRY_KEY);
    if (!registry) {
      registry = new Map();
      runScope.set(RESOLVED_AGENT_MEMORY_REGISTRY_KEY, registry);
    }
    const executionMemoryId = randomUUID();
    if (resolvedMemory) registry.set(executionMemoryId, resolvedMemory);
    let released = false;
    return {
      executionMemoryId,
      get: () => registry.get(executionMemoryId),
      release: () => {
        if (released) return;
        released = true;
        registry.delete(executionMemoryId);
        if (registry.size === 0) {
          runScope.delete(RESOLVED_AGENT_MEMORY_REGISTRY_KEY);
        }
        effectiveMastra.__releaseRunScope(runId);
      },
    };
  }

  async #prepareResolvedMemoryHandoff(
    runId: string,
    resolvedMemory: ResolvedAgentMemory,
    executionMemoryId?: string,
  ): Promise<ResolvedAgentMemoryHandoff> {
    if (!executionMemoryId) {
      return this.#createResolvedMemoryHandoff(runId, resolvedMemory);
    }

    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const runScope = effectiveMastra.__getRunScope(runId);
    if (!runScope) {
      throw new Error(`Agent execution memory handoff is missing runScope for run ${runId}`);
    }

    let registry = runScope.get(RESOLVED_AGENT_MEMORY_REGISTRY_KEY);
    if (!registry) {
      registry = new Map();
      runScope.set(RESOLVED_AGENT_MEMORY_REGISTRY_KEY, registry);
    }
    registry.set(executionMemoryId, resolvedMemory);

    return {
      executionMemoryId,
      get: () => registry.get(executionMemoryId),
      // The caller that created the token owns its runScope hold.
      release: () => undefined,
    };
  }

  /**
   * Executes the agent call, handling tools, memory, and streaming.
   * @internal
   */
  async #execute<OUTPUT>(
    { methodType, resumeContext, _pubsub, ...options }: InnerAgentExecutionOptions<OUTPUT>,
    executionMemoryId?: string,
  ) {
    const existingSnapshot = resumeContext?.snapshot;
    const snapshotMemoryInfo = existingSnapshot
      ? (this.#getAgenticLoopSnapshotMemoryInfo(existingSnapshot) ?? undefined)
      : undefined;
    const requestContext = options.requestContext || new RequestContext();

    // Build version overrides by merging: Mastra defaults < requestContext < call-site
    const requestVersions = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
    let mergedVersions = mergeVersionOverrides(this.#mastra?.getVersionOverrides(), requestVersions);

    // Merge call-site version overrides on top (call-site wins over request + Mastra defaults)
    if (options.versions) {
      mergedVersions = mergeVersionOverrides(mergedVersions, options.versions);
    }

    if (mergedVersions) {
      requestContext.set(MASTRA_VERSIONS_KEY, mergedVersions);
    }

    // Resolve a versioned variant of *this* agent when a version override
    // selects it (by id or defaultStatus) and delegate execution to it. This
    // keeps direct programmatic calls consistent with HTTP routes and
    // sub-agent delegation, which already honor version overrides.
    if (mergedVersions && !this.#storedVersionApplied && this.#mastra) {
      const selfVersionSelector =
        mergedVersions.agents?.[this.id] ??
        (mergedVersions.defaultStatus ? { status: mergedVersions.defaultStatus } : undefined);
      if (selfVersionSelector) {
        try {
          const resolved = await this.#mastra.resolveVersionedAgent(this as unknown as Agent, selfVersionSelector);
          if (resolved !== (this as unknown as Agent)) {
            // Cast: reassembled options are exactly this method's input. The
            // `unknown` annotation breaks the circular return-type inference
            // of the self-recursion (TS7023).
            const delegated: unknown = (resolved as unknown as this).#execute<OUTPUT>({
              methodType,
              resumeContext,
              // Fork name for upstream's `_threadStreamPubSub`: the thread-stream
              // PubSub travels on `InnerAgentExecutionOptions._pubsub` here, and
              // the delegate must run on the caller's exact instance.
              _pubsub,
              ...options,
              requestContext,
            } as unknown as InnerAgentExecutionOptions<OUTPUT>);
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
    if (resourceId && threadFromArgs && !this.hasOwnMemory() && !isGatewayModel) {
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

      if (targetProvider.includes('openai') || targetModelId?.includes('openai')) {
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
      randomUUID();
    const instructions = options.instructions || (await this.getInstructions({ requestContext }));
    const mcpServerGuidance = await this.getMcpServerGuidance({
      requestContext,
      toolsets: options.toolsets,
      clientTools: options.clientTools,
      toolsetsMode: options.toolsetsMode,
    });

    // Set Tracing context
    // Note this span is ended at the end of #executeOnFinish
    // For resumed runs, surface resumeData as the span input and link the resumed
    // span back to the original suspended trace. Mirrors Workflow.resume tracing.
    const isResume = !!resumeContext;
    const suspendedToolInfo = isResume
      ? this.#getSuspendedToolInfo(resumeContext?.snapshot, options.toolCallId)
      : undefined;
    const processorResumeMessages = isResume
      ? this.#getResumeProcessorMessages(resumeContext?.snapshot, options.toolCallId)
      : undefined;
    const persistedTracingContext = isResume
      ? (resumeContext?.snapshot?.tracingContext as
          | { traceId?: string; spanId?: string; parentSpanId?: string }
          | undefined)
      : undefined;

    // Only fall back to persisted traceId/parentSpanId when the caller didn't provide
    // their own. This prevents cross-trace parentage if the caller is explicit.
    const userProvidedTraceId = options.tracingOptions?.traceId;
    const userProvidedParentSpanId = options.tracingOptions?.parentSpanId;
    const effectiveTraceId =
      userProvidedTraceId ?? (!userProvidedParentSpanId ? persistedTracingContext?.traceId : undefined);
    const shouldUsePersistedParentSpan =
      !userProvidedParentSpanId && (!userProvidedTraceId || userProvidedTraceId === persistedTracingContext?.traceId);

    const resumeTracingOptions =
      isResume && persistedTracingContext?.traceId
        ? {
            ...options.tracingOptions,
            traceId: effectiveTraceId,
          }
        : options.tracingOptions;

    // The persisted resume link travels separately from tracingOptions:
    // tracingOptions.parentSpanId is reserved for external correlation ids,
    // while the suspended span's id is a Mastra span present in storage.
    const resumedFromSpanId =
      isResume && persistedTracingContext?.traceId && shouldUsePersistedParentSpan
        ? persistedTracingContext.spanId
        : undefined;

    const spanInput = isResume ? buildResumeSpanInput(resumeContext.resumeData, suspendedToolInfo) : options.messages;

    const agentSpan = getOrCreateSpan({
      type: SpanType.AGENT_RUN,
      name: `agent run: '${this.id}'${isResume ? ' (resumed)' : ''}`,
      entityType: EntityType.AGENT,
      entityId: this.id,
      entityName: this.name,
      input: spanInput,
      attributes: {
        conversationId: threadFromArgs?.id,
        instructions: this.#convertInstructionsToString(instructions),
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
      tracingOptions: resumeTracingOptions,
      tracingContext: options.tracingContext,
      requestContext,
      mastra: this.#mastra,
      resumedFromSpanId,
    });

    // A dynamic memory factory may perform remote lookup and may return a
    // request-specific instance. Resolve it exactly once at the execution
    // boundary, then close every downstream capability over that instance.
    // Internal wrappers pass only a random token; the live memory remains in
    // Mastra's process-local runScope and never enters workflow options.
    const memoryRunScope = executionMemoryId
      ? (this.#mastra ?? this.#ephemeralMastra)?.__getRunScope(runId)
      : undefined;
    let memoryRegistry = memoryRunScope?.get(RESOLVED_AGENT_MEMORY_REGISTRY_KEY);
    let resolvedMemory = executionMemoryId ? memoryRegistry?.get(executionMemoryId) : undefined;
    if (!resolvedMemory) {
      try {
        resolvedMemory = { value: await this.getMemory({ requestContext }) };
      } catch (error) {
        agentSpan?.error({ error: error as Error, endSpan: true });
        throw error;
      }
    }
    if (executionMemoryId && memoryRunScope) {
      if (!memoryRegistry) {
        memoryRegistry = new Map();
        memoryRunScope.set(RESOLVED_AGENT_MEMORY_REGISTRY_KEY, memoryRegistry);
      }
      memoryRegistry.set(executionMemoryId, resolvedMemory);
    }
    const memory = resolvedMemory.value;
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
      getMemory: async (_options?: { requestContext?: RequestContext }) => memory,
      getModel: this.getModel.bind(this),
      generateMessageId: this.#mastra?.generateId?.bind(this.#mastra) || (() => randomUUID()),
      mastra: this.#mastra,
      _agentNetworkAppend:
        '_agentNetworkAppend' in this
          ? Boolean((this as unknown as { _agentNetworkAppend: unknown })._agentNetworkAppend)
          : undefined,
      convertTools: (args: Parameters<typeof this.convertTools>[0]) => this.convertTools({ ...args, resolvedMemory }),
      resolveToolHooks: (runHooks?: ToolHooks) => this.resolveToolHooks(runHooks),
      getMemoryMessages: (args: Parameters<typeof this.getMemoryMessages>[0]) =>
        this.getMemoryMessages({ ...args, resolvedMemory }),
      runInputProcessors: (args: Parameters<typeof this.__runInputProcessors>[0]) =>
        this.__runInputProcessors({ ...args, resolvedMemory }),
      executeOnFinish: (args: AgentExecuteOnFinishOptions) => this.#executeOnFinish(args, memory),
      inputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
      }) => this.listResolvedInputProcessors(requestContext, overrides, resolvedMemory),
      llmRequestInputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
      }) => this.listResolvedLLMRequestProcessors(requestContext, overrides, resolvedMemory),
      outputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: OutputProcessorOrWorkflow[];
      }) => this.listResolvedOutputProcessors(requestContext, overrides, resolvedMemory),
      errorProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: ErrorProcessorOrWorkflow[];
      }) =>
        overrides ??
        (this.#errorProcessors
          ? typeof this.#errorProcessors === 'function'
            ? await this.#errorProcessors({ requestContext: requestContext as RequestContext<TRequestContext> })
            : this.#errorProcessors
          : []),
      llm,
    };

    const initialSignalEchoes =
      methodType === 'stream'
        ? (Array.isArray(options.messages) ? options.messages : [options.messages]).filter(isCreatedAgentSignal)
        : [];
    const initialSignalEchoesForRun =
      initialSignalEchoes.length > 0
        ? [...initialSignalEchoes, ...(options._initialSignalEchoes ?? [])]
        : options._initialSignalEchoes;
    const toolPayloadTransform =
      normalizeToolPayloadTransformPolicy(options.transform ?? (options as any).toolPayloadProjection) ??
      this.#toolPayloadTransform ??
      normalizeToolPayloadTransformPolicy(
        this.#mastra?.getToolPayloadTransform?.() ?? (this.#mastra as any)?.getToolPayloadProjection?.(),
      );

    const pubsub = _pubsub ?? this.getPubSub() ?? defaultAgentThreadPubSub;

    // Create the workflow with all necessary context
    const executionWorkflow = createPrepareStreamWorkflow<OUTPUT>({
      capabilities: capabilities as AgentCapabilities,
      options: { ...options, methodType, _pubsub: pubsub } as any,
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
      resumeContext,
      agentId: this.id,
      agentVersionId: this.toRawConfig()?.resolvedVersionId as string | undefined,
      agentName: this.name,
      toolCallId: options.toolCallId,
      ...(processorResumeMessages !== undefined ? { processorResumeMessages } : {}),
      workspace,
      toolPayloadTransform,
      ...(options.disableBackgroundTasks || options.backgroundTaskPolicy?.allowToolDispatch === false
        ? {}
        : {
            backgroundTaskManager: this.#mastra?.backgroundTaskManager,
            agentBackgroundConfig: this.#backgroundTasks,
          }),
      skipBgTaskWait: options._skipBgTaskWait,
      drainPendingSignals: (runId, scope) => agentThreadStreamRuntime.drainPendingSignals(runId, pubsub, scope),
      initialSignalEchoes: initialSignalEchoesForRun,
    });

    // The prepare-stream workflow runs on the evented engine and needs a
    // pubsub-equipped Mastra to dispatch events. If the agent isn't attached
    // to one, fall back to a lazily-created ephemeral Mastra (see field doc).
    // The same Mastra is registered on the LLM so the agentic loop inside
    // `capabilities.llm.stream(...)` inherits it.
    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    // Idempotent: the LLM was already given this.#mastra (or undefined) in
    // getLLM; re-register so the ephemeral case takes effect.
    llm.__registerMastra(effectiveMastra);

    const useEventedExecution = process.env.MASTRA_EVENTED_EXECUTION === 'true';
    const executionRunId = randomUUID();

    if (useEventedExecution) {
      // Evented engine path needs pubsub workers before the workflow starts.
      // Ensure the evented engine's workers are running on the effective Mastra.
      // Users who just do `new Mastra({ agents })` without calling startWorkers
      // would otherwise hang here — events would publish but no worker would
      // consume them. startWorkers is idempotent.
      await effectiveMastra?.startWorkers();
    }

    // Both execution engines need a run-scoped registration. The evented engine
    // resolves workflow events through it; the direct engine still needs the
    // ownership generation so nested agentic-loop events stay local to this
    // Mastra instance. Registering also wires storage/observability primitives.
    // Keep the generation so cleanup cannot remove a newer concurrent resume.
    const executionWorkflowRegistration = effectiveMastra.__registerInternalWorkflow(executionWorkflow, executionRunId);

    const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });
    try {
      // The direct wrapper is non-resumable but uses this explicit ID for
      // internal registration. Preserve its declared transient mode instead
      // of letting the explicit-ID collision rule promote it to durable.
      const run = await executionWorkflow.createRun({
        runId: executionRunId,
        ...(useEventedExecution ? {} : { [TRANSIENT_EXECUTION_SYMBOL]: true }),
      });
      const result = await run.start({ requestContext, actor: options.actor, ...observabilityContext });
      // A step failure is a resolved workflow result, so terminal stream
      // handlers never get a chance to close the agent span tree.
      if (result.status !== 'success' && agentSpan && !agentSpan.endTime) {
        if (result.status === 'failed') {
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
          agentSpan.error({ error, endTree: true });
        } else {
          agentSpan.end({ endTree: true });
        }
      }
      return result;
    } catch (error) {
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
      agentSpan?.error({ error: spanError, endTree: true });
      throw error;
    } finally {
      // Evented terminal handlers may already have released this registration;
      // direct execution always releases it here. The generation makes either
      // path a no-op if a newer concurrent registration owns the run.
      effectiveMastra.__unregisterInternalWorkflow(executionWorkflow.id, executionRunId, executionWorkflowRegistration);

      if (useEventedExecution) {
        // The prepare-stream workflow opts out of persisting via `shouldPersistSnapshot: () => false`,
        // but the evented engine's `EventedRun.start` still writes the initial 'running' row
        // (see issue #17137). Drop it here so this throwaway internal workflow never leaves a
        // row in the user's storage. Best-effort: swallow errors so a delete miss doesn't mask
        // a real failure in the surrounding run.
        try {
          await executionWorkflow.deleteWorkflowRunById(executionRunId);
        } catch (err) {
          this.logger.debug('Failed to clean up internal execution-workflow run row', {
            runId: executionRunId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  /**
   * Handles post-execution tasks including memory persistence and title generation.
   * @internal
   */
  async #executeOnFinish(
    {
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
      _toolSurfaceFenceOwnerId,
      onTitleGenerated,
      waitUntil,
    }: AgentExecuteOnFinishOptions,
    memory?: MastraMemory,
  ) {
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

    const memoryRunState = memory ? getMemoryRunState(requestContext, memory, threadId, resourceId) : undefined;
    // Re-read the latest thread so metadata written mid-run (working memory,
    // processors) is not overwritten by the pre-run snapshot.
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
        } = this.resolveTitleGenerationConfig(
          config?.generateTitle as
            | boolean
            | {
                model?: DynamicArgument<MastraModelConfig, TRequestContext>;
                instructions?: DynamicArgument<string>;
                minMessages?: number;
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
              // Fire-and-forget so generate()/stream() stay fast. On serverless
              // runtimes that freeze after the response, pass
              // `serverless.waitUntil` so the platform keeps this promise alive (#20682).
              const titlePromise = this.genTitle(
                userMessage,
                requestContext,
                observabilityContext,
                titleModel,
                titleInstructions,
                threadUiMessages,
              )
                .then(async title => {
                  if (title) {
                    await memory.createThread({
                      threadId: thread.id,
                      resourceId,
                      memoryConfig,
                      title,
                      metadata: thread.metadata,
                    });
                    if (typeof onTitleGenerated === 'function') {
                      await onTitleGenerated(title);
                    }
                  }
                })
                .catch(error => {
                  this.logger.error('Error persisting generated title:', error);
                });

              if (typeof waitUntil === 'function') {
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
      ...observabilityContext,
    });

    agentSpan?.end({
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
    if (_toolSurfaceFenceOwnerId) {
      if (result.finishReason === 'suspended') {
        suspendToolSurfaceFence(requestContext, runId, _toolSurfaceFenceOwnerId);
      } else {
        clearToolSurfaceFence(requestContext, runId, _toolSurfaceFenceOwnerId);
      }
    }
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
    const explicitRequestContext = options?.requestContext;
    const requestContextForDefaults = explicitRequestContext || new RequestContext();
    if (explicitRequestContext) {
      await this.#assertAgentExecutionPreflight(explicitRequestContext, { authorize: false });
    }

    // Merge default network options with call-specific options
    const defaultNetworkOptions = await this.getDefaultNetworkOptions({ requestContext: requestContextForDefaults });
    const mergedOptions = {
      ...defaultNetworkOptions,
      ...options,
      routing: { ...defaultNetworkOptions?.routing, ...options?.routing },
      completion: { ...defaultNetworkOptions?.completion, ...options?.completion },
    };
    const requestContextToUse = explicitRequestContext || mergedOptions.requestContext || requestContextForDefaults;
    if (!explicitRequestContext) {
      await this.#assertAgentExecutionPreflight(requestContextToUse, { authorize: false });
    }

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const resourceIdFromContext = requestContextToUse.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    const threadIdFromContext = requestContextToUse.get(MASTRA_THREAD_ID_KEY) as string | undefined;
    const hasFga = Boolean(this.#mastra?.getServer()?.fga);

    const memoryThreadId =
      typeof mergedOptions?.memory?.thread === 'string'
        ? mergedOptions?.memory?.thread
        : mergedOptions?.memory?.thread?.id;
    const threadId = hasFga ? threadIdFromContext : threadIdFromContext || memoryThreadId;
    const resourceId = hasFga ? resourceIdFromContext : resourceIdFromContext || mergedOptions?.memory?.resource;

    if (hasFga && !resourceId) {
      throw new MastraError({
        id: 'AGENT_NETWORK_OWNER_UNVERIFIED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" network() requires a verified resource id when FGA is configured.`,
        details: {
          agentName: this.name,
        },
      });
    }

    const runId = hasFga
      ? this.#mastra?.generateId() || randomUUID()
      : mergedOptions?.runId || this.#mastra?.generateId() || randomUUID();
    await this.requireAgentExecutionFGA({
      requestContext: requestContextToUse,
      memory: mergedOptions?.memory,
      runId,
    });

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
      generateId: context => this.#mastra?.generateId(context) || randomUUID(),
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
    const explicitRequestContext = options.requestContext;
    const requestContextForDefaults = explicitRequestContext || new RequestContext();
    if (explicitRequestContext) {
      await this.#assertAgentExecutionPreflight(explicitRequestContext, { authorize: false });
    }
    const isNetworkToolApprovalResume =
      (options as { __mastraNetworkToolApprovalResume?: boolean }).__mastraNetworkToolApprovalResume === true;

    // Merge default network options with call-specific options
    const defaultNetworkOptions = await this.getDefaultNetworkOptions({ requestContext: requestContextForDefaults });
    const mergedOptions = {
      ...defaultNetworkOptions,
      ...options,
      routing: { ...defaultNetworkOptions?.routing, ...options?.routing },
      completion: { ...defaultNetworkOptions?.completion, ...options?.completion },
    };
    let requestContextToUse = explicitRequestContext || mergedOptions.requestContext || requestContextForDefaults;
    if (!explicitRequestContext) {
      await this.#assertAgentExecutionPreflight(requestContextToUse, { authorize: false });
    }
    if (isNetworkToolApprovalResume) {
      requestContextToUse = new RequestContext(requestContextToUse.entries());
      requestContextToUse.set('__mastra_networkToolApprovalResume', true);
    }
    const hasFga = Boolean(this.#mastra?.getServer()?.fga);
    const trustedResourceId = requestContextToUse.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    if (hasFga && !trustedResourceId) {
      throw new MastraError({
        id: 'AGENT_RESUME_OWNER_UNVERIFIED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" resumeNetwork() requires a matching resource id to resume runId "${runId}".`,
        details: {
          runId,
          agentName: this.name,
        },
      });
    }
    await this.requireAgentExecutionFGA({
      requestContext: requestContextToUse,
      memory: mergedOptions?.memory,
      runId,
    });
    const { resourceId: runResourceId } = await this.#loadAgenticLoopSnapshotOrThrow({
      runId,
      method: 'resumeNetwork',
      workflowName: 'agent-loop-main-workflow',
    });
    this.#assertAgenticLoopResumeOwnership({
      method: 'resumeNetwork',
      runId,
      runResourceId,
      requestContext: requestContextToUse,
      options: { memory: mergedOptions?.memory },
    });

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const resourceIdFromContext = requestContextToUse.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    const threadIdFromContext = requestContextToUse.get(MASTRA_THREAD_ID_KEY) as string | undefined;

    const memoryThreadId =
      typeof mergedOptions?.memory?.thread === 'string'
        ? mergedOptions?.memory?.thread
        : mergedOptions?.memory?.thread?.id;
    const threadId = hasFga ? threadIdFromContext : threadIdFromContext || memoryThreadId;
    const resourceId = hasFga ? resourceIdFromContext : resourceIdFromContext || mergedOptions?.memory?.resource;

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
      generateId: context => this.#mastra?.generateId(context) || randomUUID(),
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
    const resumeOptions = { ...options } as typeof options & { __mastraNetworkToolApprovalResume: true };
    resumeOptions.__mastraNetworkToolApprovalResume = true;
    return this.resumeNetwork({ approved: true }, resumeOptions);
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
    const { reason, ...optionsWithoutReason } = options;
    const resumeOptions = {
      ...optionsWithoutReason,
      __mastraNetworkToolApprovalResume: true as const,
    };
    return this.resumeNetwork({ approved: false, ...(reason !== undefined ? { reason } : {}) }, resumeOptions);
  }

  async generate<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<T>>;
  async generate<OUTPUT extends {}>(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT>>;
  async generate(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<TOutput>>;
  async generate<OUTPUT = TOutput>(messages: MessageListInput): Promise<FullOutput<OUTPUT>>;
  async generate<OUTPUT = TOutput>(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
    } & { model?: DynamicArgument<MastraModelConfig> },
    executionMemoryId?: string,
  ): Promise<FullOutput<OUTPUT>> {
    // Route standalone `new Agent({ durable: true })` calls through the
    // durable execution path. Registered agents are already wrapped by Mastra,
    // so this branch only handles standalone usage.
    const durable = await this.#getStandaloneDurable();
    if (durable) {
      return durable.generate(messages, options) as Promise<FullOutput<OUTPUT>>;
    }

    const requestContextToUse = options?.requestContext;
    const toolSurfaceFenceOwnerId = randomUUID();
    if (requestContextToUse) {
      await this.#assertAgentExecutionPreflight(requestContextToUse, { authorize: false, actor: options?.actor });
    }

    const defaultOptions = await this.getDefaultOptions({
      requestContext: requestContextToUse,
    });
    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as AgentExecutionOptions<any> & { model?: DynamicArgument<MastraModelConfig> };
    if (mergedOptions.toolsetsMode === 'replace') {
      if (options?.toolsetsMode === 'replace') {
        mergedOptions.toolsets = options.toolsets ?? {};
      } else if (options?.toolsets !== undefined) {
        mergedOptions.toolsets = options.toolsets;
      }
    }
    if (requestContextToUse) {
      mergedOptions.requestContext = requestContextToUse;
    } else {
      await this.#assertAgentExecutionPreflight(mergedOptions.requestContext, {
        authorize: false,
        actor: mergedOptions.actor,
      });
    }

    // Pin the runId before execution so the replacement tool-surface fence can
    // be keyed (and later cleared/suspended) against a concrete run identifier.
    if (!mergedOptions.runId) {
      const target = this.#getThreadTarget(mergedOptions);
      mergedOptions.runId =
        this.#mastra?.generateId({
          idType: 'run',
          source: 'agent',
          entityId: this.id,
          threadId: target.threadId,
          resourceId: target.resourceId,
        }) || randomUUID();
    }

    const loopOptions = { ...mergedOptions };
    const actor = mergedOptions.actor;
    delete loopOptions.actor;

    await this.requireAgentExecutionFGA({
      requestContext: mergedOptions.requestContext,
      memory: mergedOptions.memory,
      runId: mergedOptions.runId,
      actor,
    });
    this.#extractClientObservability(messages);

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
            : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details: {
          agentName: this.name,
          modelId,
          provider,
          specificationVersion: specVersion,
        },
      });
    }

    const executeOptions = {
      ...loopOptions,
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
      methodType: 'generate',
      _toolSurfaceFenceOwnerId: toolSurfaceFenceOwnerId,
      // Use agent's maxProcessorRetries as default, allow options to override
      maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
    } as unknown as InnerAgentExecutionOptions<any> & { _threadStreamPubSub?: PubSub };

    let result;
    try {
      result = await this.#execute(executeOptions, executionMemoryId);
    } catch (error) {
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, mergedOptions.runId, toolSurfaceFenceOwnerId);
      }
      throw error;
    }

    if (result.status !== 'success') {
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, mergedOptions.runId, toolSurfaceFenceOwnerId);
      }
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
        text: 'An unknown error occurred while streaming',
      });
    }

    if (typeof result.result?.getFullOutput !== 'function') {
      throw new MastraError({
        id: 'AGENT_GENERATE_MALFORMED_RESULT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: 'Execution workflow produced a result without getFullOutput — this usually means the evented engine failed to deliver events (e.g. socket publish failure)',
      });
    }

    const output = result.result as MastraModelOutput<OUTPUT>;
    let fullOutput: FullOutput<OUTPUT>;
    try {
      fullOutput = await output.getFullOutput();
    } catch (error) {
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, mergedOptions.runId, toolSurfaceFenceOwnerId);
      }
      throw error;
    }
    const error = fullOutput.error;

    if (error) {
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, mergedOptions.runId, toolSurfaceFenceOwnerId);
      }
      throw error;
    }

    if (mergedOptions.requestContext) {
      if (fullOutput.finishReason === 'suspended') {
        suspendToolSurfaceFence(mergedOptions.requestContext, mergedOptions.runId, toolSurfaceFenceOwnerId);
      } else {
        clearToolSurfaceFence(mergedOptions.requestContext, mergedOptions.runId, toolSurfaceFenceOwnerId);
      }
    }

    return fullOutput;
  }

  /**
   * @internal Test-only hook for duck-typed agents (e.g. harness v1 MockAgent) that
   * override `stream()` without going through the real execution loop. Production
   * `Agent.stream()` registers its output via the same runtime path (§thread-stream-runtime).
   * Without this hook, signal-routed `subscribeToThread` consumers never see chunks
   * from test agents. Do not use outside of test mocks.
   */
  _internalRegisterStreamRun<OUTPUT = TOutput>(
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
  ): void {
    const pubsub =
      (streamOptions as { _pubsub?: PubSub })._pubsub ??
      this.#resolveThreadStreamPubSub({
        runId: output.runId,
        ...this.#getThreadTarget(streamOptions),
      }) ??
      this.getPubSub() ??
      defaultAgentThreadPubSub;
    const streamOptionsWithRunId = { ...streamOptions, runId: output.runId };
    const completion = agentThreadStreamRuntime.registerRun(
      this as Agent<any, any, any, any>,
      output,
      streamOptionsWithRunId,
      pubsub,
    );
    this.#rememberThreadStreamPubSub(streamOptionsWithRunId, pubsub);
    this.#trackThreadStreamPubSub(output, streamOptionsWithRunId, completion);
  }

  /**
   * Look up the `MastraModelOutput` for a run registered with the thread stream
   * runtime. Returns `undefined` if the run has finished and been cleared.
   * Signal-routed callers (e.g. harness v1 `Session.message()`) use this after
   * `sendSignal()` returns a `runId` to drain events from the run's output.
   */
  getRunOutput<OUTPUT = TOutput>(runId: string): MastraModelOutput<OUTPUT> | undefined {
    return agentThreadStreamRuntime.getRunOutput<OUTPUT>(
      runId,
      this.#resolveThreadStreamPubSub({ runId }) ?? this.getPubSub(),
    );
  }

  /**
   * Resolves with the `MastraModelOutput` for `runId` as soon as it is
   * registered with the thread stream runtime (or immediately if already
   * registered). Pairs with `sendSignal()` to give callers a handle to the
   * output without polling `getRunOutput()` until it returns non-undefined.
   *
   * The returned promise rejects if the run is rejected or aborted before it registers.
   * Callers waiting on optional/admission paths should still enforce their own deadline.
   */
  waitForRunOutput<OUTPUT = TOutput>(
    runId: string,
    options?: { abortSignal?: AbortSignal; signal?: AbortSignal },
  ): Promise<MastraModelOutput<OUTPUT>> {
    return agentThreadStreamRuntime.waitForRunOutput<OUTPUT>(
      runId,
      this.#resolveThreadStreamPubSub({ runId }) ?? this.getPubSub(),
      options?.abortSignal ?? options?.signal,
    );
  }

  /**
   * @experimental Agent signals are experimental and may change in a future release.
   */
  async subscribeToThread<OUTPUT = TOutput>(
    options: AgentSubscribeToThreadOptions,
  ): Promise<AgentThreadSubscription<OUTPUT>> {
    const pubsub = this.#resolveThreadStreamPubSub(options) ?? this.getPubSub();
    return agentThreadStreamRuntime.subscribeToThread<OUTPUT>(this as Agent<any, any, any, any>, options, pubsub);
  }

  /**
   * @experimental Agent signals are experimental and may change in a future release.
   */
  async claimThreadOwnership<OUTPUT = TOutput>(options: {
    resourceId: string;
    threadId: string;
    streamOptions?:
      | AgentExecutionOptions<OUTPUT>
      | (() => AgentExecutionOptions<OUTPUT> | Promise<AgentExecutionOptions<OUTPUT>>);
    peer?: false | AgentClaimThreadPeerOptions;
  }): Promise<{ claimed: boolean; unsubscribe: () => void }> {
    return agentThreadStreamRuntime.claimThreadOwnership(
      this as Agent<any, any, any, any>,
      options as Parameters<typeof agentThreadStreamRuntime.claimThreadOwnership>[1],
      this.getPubSub(),
    );
  }

  /**
   * @experimental Agent signals are experimental and may change in a future release.
   */
  async discoverThreadPeers(options?: DiscoverAgentThreadPeersOptions): Promise<AgentThreadPeerAdvertisement[]> {
    return agentThreadStreamRuntime.discoverThreadPeers(options, this.getPubSub());
  }

  getActiveThreadRunId(options: AgentThreadIdentityOptions): string | undefined {
    return agentThreadStreamRuntime.getActiveThreadRunId(options, this.getPubSub());
  }

  listActiveThreadRuns(): ActiveThreadRun[] {
    return agentThreadStreamRuntime.listActiveThreadRuns(this.getPubSub());
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
    options = snapshotAgentExecutionOptions(options, [
      'threadId',
      'resourceId',
      'requestContext',
      'fromDate',
      'toDate',
      'perPage',
      'page',
    ]);
    const { threadId, resourceId, requestContext, fromDate, toDate, perPage, page } = options;
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

    const hasFga = Boolean(this.#mastra?.getServer()?.fga);
    const contextResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
    const contextThreadId = requestContext?.get(MASTRA_THREAD_ID_KEY);
    if (hasFga && (typeof contextResourceId !== 'string' || contextResourceId.trim().length === 0)) {
      throw new MastraError({
        id: 'AGENT_LIST_SUSPENDED_RUNS_OWNER_UNVERIFIED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" listSuspendedRuns() requires a verified resource id.`,
        details: { agentName: this.name },
      });
    }
    if (typeof contextResourceId === 'string' && resourceId && contextResourceId !== resourceId) {
      throw new MastraError({
        id: 'AGENT_LIST_SUSPENDED_RUNS_OWNER_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" listSuspendedRuns() cannot list a different resource.`,
        details: { agentName: this.name },
      });
    }
    if (typeof contextThreadId === 'string' && threadId && contextThreadId !== threadId) {
      throw new MastraError({
        id: 'AGENT_LIST_SUSPENDED_RUNS_THREAD_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" listSuspendedRuns() cannot list a different thread.`,
        details: { agentName: this.name },
      });
    }
    const scopedResourceId =
      typeof contextResourceId === 'string' && contextResourceId.trim().length > 0 ? contextResourceId : resourceId;
    const scopedThreadId =
      typeof contextThreadId === 'string' && contextThreadId.trim().length > 0 ? contextThreadId : threadId;
    await this.#assertAgentExecutionPreflight(requestContext, {
      memory: scopedThreadId
        ? {
            ...(scopedResourceId ? { resource: scopedResourceId } : {}),
            thread: scopedThreadId,
          }
        : undefined,
    });

    const effectiveMastra = this.#mastra ?? (await this.#getOrCreateEphemeralMastra());
    const workflowsStore = await effectiveMastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) {
      throw new MastraError({
        id: 'AGENT_LIST_SUSPENDED_RUNS_NO_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" listSuspendedRuns() requires storage to discover suspended runs. ` +
          `Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL).`,
        details: { agentName: this.name },
      });
    }

    // Push the resource filter into storage and scan in bounded pages. Thread
    // ownership and older rows still require snapshot checks. DurableAgent owns
    // discovery for its separate workflow names and snapshot-pair consistency.
    const storagePageSize = 100;
    const isPaginated = perPage !== undefined && page !== undefined;
    const firstRequestedMatch = isPaginated ? page * perPage : 0;
    const pastLastRequestedMatch = isPaginated ? firstRequestedMatch + perPage : Number.POSITIVE_INFINITY;
    const matchedRuns: AgentRun[] = [];
    let total = 0;

    for (let storagePage = 0; ; storagePage++) {
      const { runs } = await workflowsStore.listWorkflowRuns({
        workflowName: 'agentic-loop',
        status: 'suspended',
        resourceId: scopedResourceId,
        fromDate,
        toDate,
        perPage: storagePageSize,
        page: storagePage,
      });

      for (const run of runs) {
        let snapshot: any = run.snapshot;
        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot) as WorkflowRunState;
          } catch {
            continue;
          }
        }
        if (snapshot?.status !== 'suspended') continue;
        if (this.#getAgenticLoopSnapshotAgentId(snapshot) !== this.id) continue;

        const memoryInfo = this.#getAgenticLoopSnapshotMemoryInfo(snapshot);
        if (memoryInfo === null) continue;
        const runThreadId = memoryInfo?.threadId;
        if (run.resourceId && memoryInfo?.resourceId && run.resourceId !== memoryInfo.resourceId) continue;
        const runResourceId = run.resourceId ?? memoryInfo?.resourceId;
        if (scopedThreadId && runThreadId !== scopedThreadId) continue;
        if (scopedResourceId && runResourceId !== scopedResourceId) continue;
        const suspendedToolCalls = this.#getAgenticLoopSuspendedToolCalls(snapshot);
        if (suspendedToolCalls.hasLabelConflict) continue;

        const matchingIndex = total++;
        if (matchingIndex < firstRequestedMatch || matchingIndex >= pastLastRequestedMatch) continue;
        matchedRuns.push({
          runId: run.runId,
          status: 'suspended',
          workflowName: 'agentic-loop',
          threadId: runThreadId,
          resourceId: runResourceId,
          suspendedAt: run.updatedAt,
          toolCalls: suspendedToolCalls.toolCalls,
        });
      }

      if (runs.length < storagePageSize) break;
    }

    return { runs: matchedRuns, total };
  }

  abortThreadStream(options: AgentThreadIdentityOptions): boolean {
    return agentThreadStreamRuntime.abortThread(options, this.#resolveThreadStreamPubSub(options) ?? this.getPubSub());
  }

  abortRunStream(runId: string): boolean {
    return agentThreadStreamRuntime.abortRun(runId, this.#resolveThreadStreamPubSub({ runId }) ?? this.getPubSub());
  }

  /**
   * @experimental Agent message APIs are experimental and may change in a future release.
   */
  sendMessage<OUTPUT = TOutput>(
    message: AgentMessageInput,
    target: SendAgentMessageOptions<OUTPUT>,
  ): SendAgentMessageResult<OUTPUT> {
    return agentThreadStreamRuntime.sendMessage<OUTPUT>(
      this as Agent<any, any, any, any>,
      message,
      target,
      this.getPubSub(),
    );
  }

  /**
   * @experimental Agent message APIs are experimental and may change in a future release.
   */
  queueMessage<OUTPUT = TOutput>(
    message: AgentMessageInput,
    target: QueueAgentMessageOptions<OUTPUT>,
  ): QueueAgentMessageResult<OUTPUT> {
    return agentThreadStreamRuntime.queueMessage<OUTPUT>(
      this as Agent<any, any, any, any>,
      message,
      target,
      this.getPubSub(),
    );
  }

  /**
   * @experimental Agent state signal APIs are experimental and may change in a future release.
   */
  sendStateSignal<OUTPUT = TOutput>(
    state: AgentStateSignalInput,
    target: SendAgentStateSignalOptions<OUTPUT>,
  ): Promise<SendAgentStateSignalResult<OUTPUT>> {
    return agentThreadStreamRuntime.sendStateSignal<OUTPUT>(
      this as Agent<any, any, any, any>,
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
   *
   * @experimental Agent notification signal APIs are experimental and may change in a future release.
   */
  resolveNotificationDeliveryDecision(input: NotificationDeliveryPolicyInput): Promise<NotificationDeliveryDecision> {
    return resolveNotificationDeliveryDecision({
      config: this.#notifications?.deliveryPolicy,
      ...input,
    });
  }

  /**
   * @experimental Agent notification signal APIs are experimental and may change in a future release.
   */
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

  async #sendNotificationSignalBatch<OUTPUT = TOutput>(
    inputs: SendNotificationSignalInput[],
    target: SendAgentNotificationSignalOptions<OUTPUT>,
  ): Promise<SendAgentNotificationSignalResult<OUTPUT>[]> {
    const notifications = await this.#mastra?.getStorage()?.getStore('notifications');
    if (!notifications) {
      throw new Error('sendNotificationSignal requires a notifications storage domain');
    }

    const records = [];
    for (const notification of inputs) {
      records.push(
        await notifications.createNotification({
          ...notification,
          agentId: this.id,
          resourceId: target.resourceId,
          threadId: target.threadId,
        }),
      );
    }

    const threadState = agentThreadStreamRuntime.getThreadState(
      { resourceId: target.resourceId, threadId: target.threadId },
      this.getPubSub(),
    );
    const now = new Date();
    const planned = [];
    for (const record of records) {
      planned.push({
        record,
        decision: await this.resolveNotificationDeliveryDecision({ now, record, threadState }),
      });
    }

    const results: SendAgentNotificationSignalResult<OUTPUT>[] = [];
    // Set when a record stays pending with a scheduled deliverAt/summaryAt —
    // those are delivered later by the notification dispatch workflow, so the
    // dispatcher schedule (and scheduler) must be lazily activated.
    let needsDispatcher = false;
    for (const { record, decision } of planned) {
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
          const result = agentThreadStreamRuntime.sendSignal<OUTPUT>(
            this as Agent<any, any, any, any>,
            signal,
            {
              ...target,
              ifIdle: {
                // Caller-supplied stream options win over the policy's. The
                // policy's options are typed on the default OUTPUT, matching
                // how deliveries run.
                ...(decision.streamOptions
                  ? { streamOptions: decision.streamOptions as AgentExecutionOptions<OUTPUT> }
                  : {}),
                ...target.ifIdle,
                behavior: record.priority === 'high' ? ('persist' as const) : ('wake' as const),
              },
            },
            this.getPubSub(),
          );
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
      const result = agentThreadStreamRuntime.sendSignal<OUTPUT>(
        this as Agent<any, any, any, any>,
        signal,
        deliverTarget,
        this.getPubSub(),
      );
      let delivered: SendAgentSignalAccepted<OUTPUT>;
      try {
        delivered = await result.accepted;
      } catch (error) {
        const failed = await notifications.updateNotification({
          id: record.id,
          threadId: record.threadId,
          ...resolveDeliveryFailureUpdate(record),
          lastDeliveryAttemptAt: new Date(),
          lastDeliveryError: error instanceof Error ? error.message : 'Notification signal was rejected',
          deliveryReason: decision.reason,
        });
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

  /**
   * @experimental Agent signals are experimental and may change in a future release.
   */
  sendSignal<OUTPUT = TOutput>(
    signal: AgentSignal,
    target: SendAgentSignalOptions<OUTPUT>,
  ): SendAgentSignalResult<OUTPUT> {
    const requestedIdlePubSub = (target.ifIdle?.streamOptions as { _pubsub?: PubSub } | undefined)?._pubsub;
    const pubsub =
      this.#resolveThreadStreamPubSub(target) ?? requestedIdlePubSub ?? this.getPubSub() ?? defaultAgentThreadPubSub;
    const idleStreamTarget = this.#getThreadTarget(target.ifIdle?.streamOptions);
    const idleResourceId = idleStreamTarget.resourceId ?? target.resourceId;
    const idleThreadId = idleStreamTarget.threadId ?? target.threadId;
    const idleThreadKey = idleThreadId ? this.#threadStreamKey(idleResourceId, idleThreadId) : undefined;
    const previousThreadPubSubEntry = idleThreadKey
      ? this.#threadStreamPubSubsByThreadKey.get(idleThreadKey)
      : undefined;
    const previousThreadRunId = previousThreadPubSubEntry?.runId;
    const shouldSnapshotIdleWake =
      Boolean(idleThreadId) && target.ifIdle?.behavior !== 'persist' && target.ifIdle?.behavior !== 'discard';
    const shouldTrackIdleWake = shouldSnapshotIdleWake && (Boolean(target.ifIdle) || !target.runId);
    const idleWakeCanRejectBeforeRegistration =
      shouldTrackIdleWake && (Boolean(this.#requestContextSchema) || Boolean(this.#mastra?.getServer()?.fga));
    let acceptedIdleRunId: string | undefined;
    const forgetAcceptedIdleRunPubSub = () => {
      if (!acceptedIdleRunId) return;
      const currentThreadPubSubEntry = idleThreadKey
        ? this.#threadStreamPubSubsByThreadKey.get(idleThreadKey)
        : undefined;
      this.#threadStreamPubSubsByRunId.delete(acceptedIdleRunId);
      if (!idleThreadKey || currentThreadPubSubEntry?.runId !== acceptedIdleRunId) return;
      if (
        previousThreadPubSubEntry &&
        previousThreadPubSubEntry.runId !== acceptedIdleRunId &&
        this.#threadStreamPubSubsByRunId.get(previousThreadPubSubEntry.runId) === previousThreadPubSubEntry.pubsub
      ) {
        this.#threadStreamPubSubsByThreadKey.set(idleThreadKey, previousThreadPubSubEntry);
        return;
      }
      this.#threadStreamPubSubsByThreadKey.delete(idleThreadKey);
    };
    const signalTarget = shouldSnapshotIdleWake
      ? ({
          ...target,
          resourceId: target.resourceId ?? idleResourceId,
          threadId: target.threadId ?? idleThreadId,
          ifIdle: {
            ...(target.ifIdle ?? {}),
            _attachToReservedRun: !target.ifIdle,
            _onThreadStreamRunRejected: forgetAcceptedIdleRunPubSub,
            _skipThreadRunReservationBeforePreflight: idleWakeCanRejectBeforeRegistration,
            streamOptions: {
              ...(target.ifIdle?.streamOptions ?? {}),
              _pubsub: requestedIdlePubSub ?? pubsub,
            },
          },
        } as unknown as SendAgentSignalOptions<OUTPUT>)
      : target;

    const result = agentThreadStreamRuntime.sendSignal<OUTPUT>(
      this as Agent<any, any, any, any>,
      signal,
      signalTarget,
      pubsub,
    );
    if (shouldTrackIdleWake && idleThreadId) {
      // Bind the reserved run to the broker captured for this signal before
      // async default-context/FGA preflight completes. Callers may immediately
      // wait by run id, and the agent's active broker can change meanwhile.
      acceptedIdleRunId = result.runId;
      this.#rememberThreadStreamPubSubForTarget(
        {
          runId: result.runId,
          resourceId: idleResourceId,
          threadId: idleThreadId,
        },
        pubsub,
      );

      // The unified accepted result carries the run association: `wake` means this
      // process owns the started stream, `deliver` means the signal joined an
      // existing/winning run. Remember the pubsub for either so later
      // runId/thread-targeted calls route through the same broker (PF-557).
      void result.accepted
        .then(accepted => {
          if (accepted.action !== 'wake' && accepted.action !== 'deliver') {
            forgetAcceptedIdleRunPubSub();
            return;
          }
          if (accepted.runId !== acceptedIdleRunId) {
            forgetAcceptedIdleRunPubSub();
          }
          acceptedIdleRunId = accepted.runId;
          if (accepted.action === 'wake' || accepted.runId !== previousThreadRunId) {
            this.#rememberThreadStreamPubSubForTarget(
              {
                runId: accepted.runId,
                resourceId: idleResourceId,
                threadId: idleThreadId,
              },
              pubsub,
            );
          }
        })
        .catch(forgetAcceptedIdleRunPubSub);
    }
    return result;
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
    executionMemoryId?: string,
  ): Promise<MastraModelOutput<OUTPUT>> {
    // Preserve the same standalone durable routing for streaming calls.
    const durable = await this.#getStandaloneDurable();
    if (durable) {
      return durable.stream(messages, streamOptions) as Promise<MastraModelOutput<OUTPUT>>;
    }

    const pubsub =
      ((streamOptions as any)?._pubsub as PubSub | undefined) ?? this.getPubSub() ?? defaultAgentThreadPubSub;
    const toolSurfaceFenceOwnerId = randomUUID();
    const streamOptionsBase = { ...(streamOptions ?? {}) };

    // Delegate to the idle-loop wrapper when `untilIdle` is set. Strip
    // `untilIdle` before passing to the wrapper so its internal
    // agent.stream() call doesn't recurse. Signal-woken runs pass
    // `untilIdle: true` so a run with no consumer is still driven to
    // completion (#18493).
    if (streamOptionsBase.untilIdle) {
      const { untilIdle, ...rest } = streamOptionsBase as Record<string, any>;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      // Reuse the wrapper entrypoint so the convenience option cannot resolve
      // dynamic defaults or memory before its execution preflight succeeds.
      return (this.streamUntilIdle as any)(messages, { ...rest, maxIdleMs }, executionMemoryId) as Promise<
        MastraModelOutput<OUTPUT>
      >;
    }

    const initialThreadTarget = this.#getThreadTarget(streamOptionsBase);
    const canReserveBeforeDefaults =
      this.#hasExplicitThreadMemory(streamOptionsBase) && !isReadOnlyMemoryExecution(streamOptionsBase.memory);
    const callerProvidedRunId = Boolean(streamOptionsBase.runId);
    const requestContextToUse = streamOptionsBase.requestContext;
    const hasExecutionPreflight = Boolean(this.#requestContextSchema) || Boolean(this.#mastra?.getServer()?.fga);
    const skipExecutionPreflight = Boolean(
      (streamOptionsBase as AgentExecutionPreflightOptions)[SKIP_AGENT_EXECUTION_PREFLIGHT],
    );
    const preflightedDefaultOptions = (streamOptionsBase as AgentExecutionPreflightOptions)[
      STREAM_UNTIL_IDLE_DEFAULT_OPTIONS
    ] as AgentExecutionOptions<OUTPUT> | undefined;
    const needsDefaultRequestContextPreflight = !requestContextToUse && hasExecutionPreflight;
    const staticDefaultOptions =
      !skipExecutionPreflight && needsDefaultRequestContextPreflight && typeof this.#defaultOptions !== 'function'
        ? (this.#defaultOptions as unknown as AgentExecutionOptions<OUTPUT>)
        : undefined;
    const streamOptionsWithRunId = {
      ...streamOptionsBase,
      runId:
        streamOptionsBase.runId ??
        (canReserveBeforeDefaults ? this.#generateStreamRunId(initialThreadTarget) : undefined),
    };
    const ownsExternalReservation = Boolean((streamOptionsWithRunId as any)._threadRunReservationOwner);
    const canReserveBeforePreflight = canReserveBeforeDefaults && !hasExecutionPreflight;
    let releaseReservedRun = canReserveBeforePreflight
      ? agentThreadStreamRuntime.reserveRun(streamOptionsWithRunId as AgentExecutionOptions<OUTPUT>, pubsub, this.id)
      : undefined;
    let reservedThreadTarget = releaseReservedRun ? initialThreadTarget : undefined;
    let ownsReservation = Boolean(releaseReservedRun) || ownsExternalReservation;
    let trackedThreadStreamPubSubTarget: { runId?: string; resourceId?: string; threadId?: string } | undefined;
    let attemptedRunId = streamOptionsWithRunId.runId;
    if (ownsReservation) {
      this.#rememberThreadStreamPubSub(streamOptionsWithRunId, pubsub);
      trackedThreadStreamPubSubTarget = {
        runId: streamOptionsWithRunId.runId,
        resourceId: initialThreadTarget.resourceId,
        threadId: initialThreadTarget.threadId,
      };
    } else if (hasExecutionPreflight && streamOptionsWithRunId.runId) {
      this.#threadStreamPubSubsByRunId.set(streamOptionsWithRunId.runId, pubsub);
      trackedThreadStreamPubSubTarget = { runId: streamOptionsWithRunId.runId };
    }
    let preparedOptionsWithPubSub: (AgentExecutionOptionsBase<any> & { runId?: string; _pubsub: PubSub }) | undefined;
    let preflightedRequestContext: RequestContext | undefined = skipExecutionPreflight
      ? (preflightedDefaultOptions?.requestContext ?? requestContextToUse)
      : undefined;
    let hasPreflightedRequestContext = skipExecutionPreflight;
    let fenceRequestContext = requestContextToUse ?? staticDefaultOptions?.requestContext;
    const reserveAdmittedRun = () => {
      if (ownsReservation || !canReserveBeforeDefaults) return;
      releaseReservedRun = agentThreadStreamRuntime.reserveRun(
        streamOptionsWithRunId as AgentExecutionOptions<OUTPUT>,
        pubsub,
        this.id,
      );
      ownsReservation = Boolean(releaseReservedRun);
      if (!ownsReservation) return;
      reservedThreadTarget = initialThreadTarget;
      this.#rememberThreadStreamPubSub(streamOptionsWithRunId, pubsub);
      trackedThreadStreamPubSubTarget = {
        runId: streamOptionsWithRunId.runId,
        resourceId: initialThreadTarget.resourceId,
        threadId: initialThreadTarget.threadId,
      };
    };

    try {
      if (!skipExecutionPreflight && requestContextToUse) {
        await this.#assertAgentExecutionPreflight(requestContextToUse, {
          memory: streamOptionsWithRunId.memory,
          runId: streamOptionsWithRunId.runId,
          actor: streamOptionsWithRunId.actor,
        });
        preflightedRequestContext = requestContextToUse;
        hasPreflightedRequestContext = true;
        reserveAdmittedRun();
      } else if (!skipExecutionPreflight && staticDefaultOptions) {
        await this.#assertAgentExecutionPreflight(staticDefaultOptions.requestContext, {
          memory: staticDefaultOptions.memory,
          runId: streamOptionsWithRunId.runId,
          actor: streamOptionsWithRunId.actor ?? staticDefaultOptions.actor,
        });
        preflightedRequestContext = staticDefaultOptions.requestContext;
        hasPreflightedRequestContext = true;
        reserveAdmittedRun();
      }
      const defaultOptions =
        preflightedDefaultOptions ??
        staticDefaultOptions ??
        (await this.getDefaultOptions({
          requestContext: requestContextToUse,
        }));
      const mergedOptions = mergeAgentExecutionOptions(
        defaultOptions as Record<string, unknown>,
        streamOptionsWithRunId as Record<string, unknown>,
      ) as AgentExecutionOptions<OUTPUT> & { model?: DynamicArgument<MastraModelConfig> };
      if (mergedOptions.toolsetsMode === 'replace') {
        if (streamOptionsWithRunId.toolsetsMode === 'replace') {
          mergedOptions.toolsets = streamOptionsWithRunId.toolsets ?? {};
        } else if (streamOptionsWithRunId.toolsets !== undefined) {
          mergedOptions.toolsets = streamOptionsWithRunId.toolsets;
        }
      }
      if (requestContextToUse) {
        mergedOptions.requestContext = requestContextToUse;
      } else if (
        hasExecutionPreflight &&
        (!hasPreflightedRequestContext || mergedOptions.requestContext !== preflightedRequestContext)
      ) {
        await this.#assertAgentExecutionPreflight(mergedOptions.requestContext, {
          memory: mergedOptions.memory,
          runId: mergedOptions.runId,
          actor: mergedOptions.actor,
        });
      }
      fenceRequestContext = mergedOptions.requestContext;
      const isReadOnlyThreadRun = isReadOnlyMemoryExecution(mergedOptions.memory);

      if (isReadOnlyThreadRun && releaseReservedRun && !ownsExternalReservation) {
        if (reservedThreadTarget) {
          this.#forgetThreadStreamPubSubForTarget({
            runId: streamOptionsWithRunId.runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          });
        }
        releaseReservedRun();
        releaseReservedRun = undefined;
        ownsReservation = false;
        reservedThreadTarget = undefined;
        trackedThreadStreamPubSubTarget = undefined;
      }

      const mergedThreadTarget = this.#getThreadTarget(mergedOptions);
      if (!mergedOptions.runId) {
        mergedOptions.runId = this.#generateStreamRunId(mergedThreadTarget);
      }
      attemptedRunId = mergedOptions.runId;
      if (ownsReservation && reservedThreadTarget) {
        if (!this.#sameThreadTarget(reservedThreadTarget, mergedThreadTarget)) {
          const retargetedReservation = agentThreadStreamRuntime.retargetReservedRun(
            streamOptionsWithRunId.runId,
            reservedThreadTarget,
            mergedThreadTarget,
            pubsub,
            this.id,
          );
          if (retargetedReservation) {
            this.#forgetThreadStreamPubSubForTarget({
              runId: streamOptionsWithRunId.runId,
              resourceId: reservedThreadTarget.resourceId,
              threadId: reservedThreadTarget.threadId,
            });
            releaseReservedRun = () =>
              agentThreadStreamRuntime.releaseRunReservation(mergedOptions.runId, pubsub, {
                cleanupPrepared: true,
                clearAbort: true,
                rejectOutputWaiters: true,
              });
            reservedThreadTarget = mergedThreadTarget;
            this.#rememberThreadStreamPubSubForTarget(
              {
                runId: mergedOptions.runId,
                resourceId: mergedThreadTarget.resourceId,
                threadId: mergedThreadTarget.threadId,
              },
              pubsub,
            );
            trackedThreadStreamPubSubTarget = {
              runId: mergedOptions.runId,
              resourceId: mergedThreadTarget.resourceId,
              threadId: mergedThreadTarget.threadId,
            };
          } else if (!callerProvidedRunId) {
            this.#forgetThreadStreamPubSubForTarget({
              runId: streamOptionsWithRunId.runId,
              resourceId: reservedThreadTarget.resourceId,
              threadId: reservedThreadTarget.threadId,
            });
            releaseReservedRun?.();
            releaseReservedRun = undefined;
            ownsReservation = false;
            reservedThreadTarget = undefined;
            trackedThreadStreamPubSubTarget = undefined;
            mergedOptions.runId = this.#generateStreamRunId(mergedThreadTarget);
          }
        }
      }
      if (!ownsReservation && !isReadOnlyThreadRun) {
        releaseReservedRun = agentThreadStreamRuntime.reserveRun(mergedOptions, pubsub, this.id);
        ownsReservation = Boolean(releaseReservedRun);
        if (ownsReservation) {
          reservedThreadTarget = this.#getThreadTarget(mergedOptions);
          this.#rememberThreadStreamPubSub(mergedOptions, pubsub);
          trackedThreadStreamPubSubTarget = {
            runId: mergedOptions.runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          };
        }
      }

      this.#extractClientObservability(messages);

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
          id: 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text:
            specVersion === 'v1'
              ? `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with stream(). Please use AI SDK v5+ models or call the streamLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
              : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
          details: {
            agentName: this.name,
            modelId,
            provider,
            specificationVersion: specVersion,
          },
        });
      }

      await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
        this as Agent<any, any, any, any>,
        mergedOptions,
        pubsub,
        ownsReservation,
      );
      while (!ownsReservation && !isReadOnlyThreadRun && this.#getThreadTarget(mergedOptions).threadId) {
        releaseReservedRun = agentThreadStreamRuntime.reserveRun(mergedOptions, pubsub, this.id);
        ownsReservation = Boolean(releaseReservedRun);
        if (ownsReservation) {
          reservedThreadTarget = this.#getThreadTarget(mergedOptions);
          this.#rememberThreadStreamPubSub(mergedOptions, pubsub);
          trackedThreadStreamPubSubTarget = {
            runId: mergedOptions.runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          };
          break;
        }
        await agentThreadStreamRuntime.waitForThreadRunReservation(mergedOptions, pubsub, this.id);
      }
      if (ownsReservation && reservedThreadTarget) {
        const preparedThreadTarget = this.#getThreadTarget(mergedOptions);
        if (!this.#sameThreadTarget(reservedThreadTarget, preparedThreadTarget)) {
          const retargetedReservation = agentThreadStreamRuntime.retargetReservedRun(
            mergedOptions.runId,
            reservedThreadTarget,
            preparedThreadTarget,
            pubsub,
            this.id,
          );
          if (!retargetedReservation) {
            throw new Error(`Agent thread run id "${mergedOptions.runId}" could not be retargeted`);
          }
          this.#forgetThreadStreamPubSubForTarget({
            runId: mergedOptions.runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          });
          releaseReservedRun = () =>
            agentThreadStreamRuntime.releaseRunReservation(mergedOptions.runId, pubsub, {
              cleanupPrepared: true,
              clearAbort: true,
              rejectOutputWaiters: true,
            });
          reservedThreadTarget = preparedThreadTarget;
          this.#rememberThreadStreamPubSubForTarget(
            {
              runId: mergedOptions.runId,
              resourceId: preparedThreadTarget.resourceId,
              threadId: preparedThreadTarget.threadId,
            },
            pubsub,
          );
          trackedThreadStreamPubSubTarget = {
            runId: mergedOptions.runId,
            resourceId: preparedThreadTarget.resourceId,
            threadId: preparedThreadTarget.threadId,
          };
        }
      }
      const preparedOptions = agentThreadStreamRuntime.prepareRunOptions(mergedOptions, pubsub);
      preparedOptionsWithPubSub = { ...preparedOptions, _pubsub: pubsub };
      this.#rememberThreadStreamPubSub(preparedOptionsWithPubSub, pubsub);
      trackedThreadStreamPubSubTarget = {
        runId: preparedOptionsWithPubSub.runId,
        ...this.#getThreadTarget(preparedOptionsWithPubSub),
      };

      const executeOptions = {
        ...preparedOptionsWithPubSub,
        structuredOutput: mergedOptions.structuredOutput
          ? {
              ...mergedOptions.structuredOutput,
              // Convert PublicSchema to StandardSchemaWithJSON at API boundary
              // This follows the same pattern as Tool/Workflow constructors
              schema: toStandardSchema(mergedOptions.structuredOutput.schema),
            }
          : undefined,
        messages,
        methodType: 'stream',
        _pubsub: pubsub,
        _toolSurfaceFenceOwnerId: toolSurfaceFenceOwnerId,
        // Use agent's maxProcessorRetries as default, allow options to override
        maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
      } as unknown as InnerAgentExecutionOptions<OUTPUT>;

      const result = await this.#execute(executeOptions, executionMemoryId);

      if (result.status !== 'success') {
        this.#forgetThreadStreamPubSub(preparedOptionsWithPubSub);
        releaseReservedRun?.();
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

      const output = result.result as MastraModelOutput<OUTPUT>;
      const outputFenceRequestContext = mergedOptions.requestContext;

      if (outputFenceRequestContext && readToolSurfaceFence(outputFenceRequestContext, output.runId)) {
        void output.getFullOutput().then(
          full => {
            if (full.finishReason === 'suspended') {
              suspendToolSurfaceFence(outputFenceRequestContext, output.runId, toolSurfaceFenceOwnerId);
            } else {
              clearToolSurfaceFence(outputFenceRequestContext, output.runId, toolSurfaceFenceOwnerId);
            }
          },
          () => {
            clearToolSurfaceFence(outputFenceRequestContext, output.runId, toolSurfaceFenceOwnerId);
          },
        );
      }

      const completion = agentThreadStreamRuntime.registerRun(
        this as Agent<any, any, any, any>,
        output,
        preparedOptionsWithPubSub as unknown as AgentExecutionOptions<OUTPUT>,
        pubsub,
      );
      this.#trackThreadStreamPubSub(output, preparedOptionsWithPubSub, completion);

      return output;
    } catch (error) {
      if (fenceRequestContext) {
        clearToolSurfaceFence(fenceRequestContext, attemptedRunId, toolSurfaceFenceOwnerId);
      }
      if (preparedOptionsWithPubSub) {
        this.#forgetThreadStreamPubSub(preparedOptionsWithPubSub);
      } else if (trackedThreadStreamPubSubTarget) {
        this.#forgetThreadStreamPubSubForTarget(trackedThreadStreamPubSubTarget);
      } else {
        this.#forgetThreadStreamPubSub(streamOptionsWithRunId);
      }
      if (releaseReservedRun) {
        releaseReservedRun();
      } else {
        agentThreadStreamRuntime.rejectUnregisteredRun(attemptedRunId, pubsub);
      }
      throw error;
    }
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
    executionMemoryId?: string,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const durable = await this.#getStandaloneDurable();
    if (durable) {
      return durable.streamUntilIdle(messages, streamOptions) as Promise<MastraModelOutput<OUTPUT>>;
    }

    const pubsub =
      (streamOptions as { _pubsub?: PubSub } | undefined)?._pubsub ?? this.getPubSub() ?? defaultAgentThreadPubSub;
    let streamOptionsWithPubSub: Record<string | symbol, any> & { maxIdleMs?: number; _pubsub: PubSub } = {
      ...(streamOptions ?? {}),
      _pubsub: pubsub,
    };
    if (streamOptionsWithPubSub.requestContext) {
      await this.#assertAgentExecutionPreflight(streamOptionsWithPubSub.requestContext, {
        memory: streamOptionsWithPubSub.memory,
        runId: streamOptionsWithPubSub.runId,
        actor: streamOptionsWithPubSub.actor,
      });
      streamOptionsWithPubSub = {
        ...streamOptionsWithPubSub,
        [SKIP_AGENT_EXECUTION_PREFLIGHT]: true,
      };
    } else if (this.#requestContextSchema || this.#mastra?.getServer()?.fga) {
      const defaultOptions = await this.getDefaultOptions({
        requestContext: streamOptionsWithPubSub.requestContext,
      });
      const preflightOptions = deepMerge(
        defaultOptions as Record<string, unknown>,
        streamOptionsWithPubSub as Record<string, unknown>,
      ) as AgentExecutionOptionsBase<any> & { requestContext?: RequestContext; runId?: string };
      await this.#assertAgentExecutionPreflight(preflightOptions.requestContext, {
        memory: preflightOptions.memory,
        runId: preflightOptions.runId,
        actor: preflightOptions.actor,
      });
      streamOptionsWithPubSub = {
        ...streamOptionsWithPubSub,
        [STREAM_UNTIL_IDLE_DEFAULT_OPTIONS]: preflightOptions as AgentExecutionOptions<any>,
        [SKIP_AGENT_EXECUTION_PREFLIGHT]: true,
      };
    }
    return runStreamUntilIdle<OUTPUT>(
      this,
      messages,
      streamOptionsWithPubSub,
      {
        activeStreams: this.#activeStreamUntilIdle,
        bgManager: this.#mastra?.backgroundTaskManager,
        prepareContinuation:
          this.#requestContextSchema || this.#mastra?.getServer()?.fga
            ? async resolvedOptions => {
                await this.#assertAgentExecutionPreflight(resolvedOptions.requestContext, {
                  memory: resolvedOptions.memory,
                  actor: resolvedOptions.actor,
                });
                return {
                  ...resolvedOptions,
                  [SKIP_AGENT_EXECUTION_PREFLIGHT]: true,
                };
              }
            : undefined,
        prepareResolvedMemoryHandoff: (runId, resolvedMemory, incomingExecutionMemoryId) =>
          this.#prepareResolvedMemoryHandoff(runId, resolvedMemory, incomingExecutionMemoryId),
        resolveRunId: options => this.#generateStreamRunId(this.#getThreadTarget(options)),
      },
      executionMemoryId,
    );
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
  async resumeStreamUntilIdle<OUTPUT = TOutput>(
    resumeData: any,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      toolCallId?: string;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
    executionMemoryId?: string,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const pubsub =
      (streamOptions as { _pubsub?: PubSub } | undefined)?._pubsub ?? this.getPubSub() ?? defaultAgentThreadPubSub;
    let streamOptionsWithPubSub: AgentExecutionOptionsBase<any> & {
      toolCallId?: string;
      maxIdleMs?: number;
      model?: DynamicArgument<MastraModelConfig>;
      _pubsub: PubSub;
      [SKIP_AGENT_EXECUTION_PREFLIGHT]: true;
      [STREAM_UNTIL_IDLE_DEFAULT_OPTIONS]?: AgentExecutionOptions<TOutput>;
    } = {
      ...(streamOptions ?? {}),
      _pubsub: pubsub,
      [SKIP_AGENT_EXECUTION_PREFLIGHT]: true,
    };
    if (streamOptionsWithPubSub.requestContext) {
      // Preflight before idle-wrapper setup, which can resolve defaults and memory before delegating to resumeStream().
      await this.#assertAgentExecutionPreflight(streamOptionsWithPubSub.requestContext, {
        memory: streamOptionsWithPubSub.memory,
        runId: streamOptionsWithPubSub.runId,
        actor: streamOptionsWithPubSub.actor,
      });
    } else {
      const defaultOptions = await this.getDefaultOptions({
        requestContext: streamOptionsWithPubSub.requestContext,
      });
      const preflightOptions = deepMerge(
        defaultOptions as Record<string, unknown>,
        streamOptionsWithPubSub as Record<string, unknown>,
      ) as AgentExecutionOptionsBase<any> & { requestContext?: RequestContext; runId?: string };
      await this.#assertAgentExecutionPreflight(preflightOptions.requestContext, {
        memory: preflightOptions.memory,
        runId: preflightOptions.runId,
        actor: preflightOptions.actor,
      });
      streamOptionsWithPubSub = {
        ...streamOptionsWithPubSub,
        _pubsub: pubsub,
        [STREAM_UNTIL_IDLE_DEFAULT_OPTIONS]: preflightOptions as AgentExecutionOptions<TOutput>,
        [SKIP_AGENT_EXECUTION_PREFLIGHT]: true,
      };
    }
    return runResumeStreamUntilIdle<OUTPUT>(
      this,
      resumeData,
      streamOptionsWithPubSub,
      {
        activeStreams: this.#activeStreamUntilIdle,
        bgManager: this.#mastra?.backgroundTaskManager,
        prepareContinuation:
          this.#requestContextSchema || this.#mastra?.getServer()?.fga
            ? async resolvedOptions => {
                await this.#assertAgentExecutionPreflight(resolvedOptions.requestContext, {
                  memory: resolvedOptions.memory,
                  actor: resolvedOptions.actor,
                });
                return {
                  ...resolvedOptions,
                  [SKIP_AGENT_EXECUTION_PREFLIGHT]: true,
                };
              }
            : undefined,
        prepareResolvedMemoryHandoff: (runId, resolvedMemory, incomingExecutionMemoryId) =>
          this.#prepareResolvedMemoryHandoff(runId, resolvedMemory, incomingExecutionMemoryId),
        resolveRunId: options => this.#generateStreamRunId(this.#getThreadTarget(options)),
      },
      executionMemoryId,
    );
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
    executionMemoryId?: string,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const durable = await this.#getStandaloneDurable();
    if (durable) {
      return durable.resumeStream(resumeData, streamOptions) as Promise<MastraModelOutput<OUTPUT>>;
    }

    resumeData = snapshotAgentExecutionValue(resumeData);
    if (streamOptions) {
      const snapshot = snapshotAgentExecutionOptionsWithRequestContexts(streamOptions, [
        'runId',
        'toolCallId',
        'requestContext',
        'memory',
      ]);
      streamOptions = snapshot.value;
      transferSnapshottedSuspendedToolSurfaceFence(streamOptions, snapshot.requestContextSnapshots);
    }
    const pubsub =
      ((streamOptions as any)?._pubsub as PubSub | undefined) ?? this.getPubSub() ?? defaultAgentThreadPubSub;
    const toolSurfaceFenceOwnerId = randomUUID();
    const streamOptionsWithPubSub: ResumeStreamInternalOptions | undefined = streamOptions
      ? {
          ...streamOptions,
          _pubsub: pubsub,
        }
      : undefined;

    // Delegate to the idle-loop wrapper when `untilIdle` is set. Strip
    // `untilIdle` before passing to the wrapper so its internal
    // agent.resumeStream() call doesn't recurse.
    if (streamOptionsWithPubSub?.untilIdle) {
      const { untilIdle, ...rest } = streamOptionsWithPubSub as Record<string, any>;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      // Keep the convenience option on the same authorization-before-memory
      // path as resumeStreamUntilIdle before touching the persisted run.
      return (this.resumeStreamUntilIdle as any)(resumeData, { ...rest, maxIdleMs }, executionMemoryId) as Promise<
        MastraModelOutput<OUTPUT>
      >;
    }

    const runId = streamOptionsWithPubSub?.runId ?? '';
    const requestContextToUse = streamOptionsWithPubSub?.requestContext;
    const preflightedDefaultOptions = streamOptionsWithPubSub?.[STREAM_UNTIL_IDLE_DEFAULT_OPTIONS] as
      | AgentExecutionOptions<TOutput>
      | undefined;
    let defaultOptions: AgentExecutionOptions<TOutput> | undefined = preflightedDefaultOptions;
    if (!streamOptionsWithPubSub?.[SKIP_AGENT_EXECUTION_PREFLIGHT]) {
      if (requestContextToUse) {
        // Keep explicit-context resume preflight before snapshot loading/reservation so denied callers cannot touch persisted runs.
        await this.#assertAgentExecutionPreflight(requestContextToUse, {
          memory: streamOptionsWithPubSub.memory,
          runId,
          actor: streamOptionsWithPubSub.actor,
        });
      } else if (this.#requestContextSchema || this.#mastra?.getServer()?.fga) {
        defaultOptions = (await this.getDefaultOptions({
          requestContext: requestContextToUse,
        })) as AgentExecutionOptions<TOutput>;
        await this.#assertAgentExecutionPreflight(defaultOptions.requestContext, {
          memory: defaultOptions.memory,
          runId,
          actor: streamOptionsWithPubSub?.actor ?? defaultOptions.actor,
        });
      }
    }
    const requestedToolCallId = streamOptionsWithPubSub?.toolCallId;
    let { resourceId: runResourceId, snapshot: existingSnapshot } = await this.#loadAgenticLoopSnapshotOrThrow({
      runId,
      method: 'resumeStream',
      rowOwnership: {
        requestContext: requestContextToUse ?? defaultOptions?.requestContext,
        options: {
          memory: streamOptionsWithPubSub?.memory ?? defaultOptions?.memory,
        },
      },
    });
    defaultOptions ??= (await this.getDefaultOptions({
      requestContext: requestContextToUse,
    })) as AgentExecutionOptions<TOutput>;
    const ownershipOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (streamOptionsWithPubSub ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions & { model?: DynamicArgument<MastraModelConfig> };
    ownershipOptions.requestContext ??= new RequestContext();
    if (ownershipOptions.toolsetsMode === 'replace') {
      if (streamOptionsWithPubSub?.toolsetsMode === 'replace') {
        ownershipOptions.toolsets = streamOptionsWithPubSub.toolsets ?? {};
      } else if (streamOptionsWithPubSub?.toolsets !== undefined) {
        ownershipOptions.toolsets = streamOptionsWithPubSub.toolsets;
      }
    }
    if (requestContextToUse) {
      ownershipOptions.requestContext = requestContextToUse;
    }
    if (
      streamOptionsWithPubSub?.[SKIP_AGENT_EXECUTION_PREFLIGHT] &&
      !requestContextToUse &&
      !preflightedDefaultOptions &&
      (this.#requestContextSchema || this.#mastra?.getServer()?.fga)
    ) {
      await this.#assertAgentExecutionPreflight(ownershipOptions.requestContext, {
        memory: ownershipOptions.memory,
        runId,
        actor: ownershipOptions.actor,
      });
    }

    let snapshotMemoryInfo = this.#verifyAgenticLoopResumeSnapshot({
      method: 'resumeStream',
      runId,
      runResourceId,
      snapshot: existingSnapshot,
      requestContext: ownershipOptions.requestContext,
      options: ownershipOptions,
    });
    const targetIsNotYetSuspended =
      requestedToolCallId !== undefined &&
      !this.#getAgenticLoopSuspendedToolCalls(existingSnapshot).toolCalls.some(
        toolCall => toolCall.toolCallId === requestedToolCallId,
      );
    if (targetIsNotYetSuspended) {
      const refreshedRun = await this.#loadAgenticLoopSnapshotOrThrow({
        runId,
        method: 'resumeStream',
        waitForToolCallId: requestedToolCallId,
      });
      runResourceId = refreshedRun.resourceId ?? runResourceId;
      existingSnapshot = refreshedRun.snapshot;
      snapshotMemoryInfo = this.#verifyAgenticLoopResumeSnapshot({
        method: 'resumeStream',
        runId,
        runResourceId,
        snapshot: existingSnapshot,
        requestContext: ownershipOptions.requestContext,
        options: ownershipOptions,
      });
    }
    this.#assertAgenticLoopSuspendedToolCall(existingSnapshot, runId, requestedToolCallId);
    const persistedToolSurfaceFence = this.#getAgenticLoopSnapshotToolSurfaceFence(existingSnapshot);
    const streamOptionsWithSnapshotTarget = this.#withSnapshotThreadTarget(streamOptionsWithPubSub, snapshotMemoryInfo);
    const initialThreadTarget = this.#getThreadTarget(streamOptionsWithSnapshotTarget);
    const canReserveBeforeDefaults =
      this.#hasExplicitThreadMemory(streamOptionsWithSnapshotTarget) &&
      !isReadOnlyMemoryExecution(streamOptionsWithSnapshotTarget?.memory);
    let releaseReservedRun =
      streamOptionsWithPubSub && canReserveBeforeDefaults
        ? agentThreadStreamRuntime.reserveRun(
            streamOptionsWithSnapshotTarget as unknown as AgentExecutionOptions<OUTPUT>,
            pubsub,
            this.id,
          )
        : undefined;
    let reservedThreadTarget = releaseReservedRun ? initialThreadTarget : undefined;
    const ownsExternalReservation = Boolean((streamOptionsWithPubSub as any)?._threadRunReservationOwner);
    let ownsReservation = Boolean(releaseReservedRun) || ownsExternalReservation;
    let trackedThreadStreamPubSubTarget: { runId?: string; resourceId?: string; threadId?: string } | undefined;
    if (streamOptionsWithSnapshotTarget && ownsReservation) {
      this.#rememberThreadStreamPubSub(streamOptionsWithSnapshotTarget, pubsub);
      trackedThreadStreamPubSubTarget = {
        runId: streamOptionsWithSnapshotTarget.runId,
        resourceId: initialThreadTarget.resourceId,
        threadId: initialThreadTarget.threadId,
      };
    }
    let preparedOptionsWithPubSub: (AgentExecutionOptionsBase<any> & { runId?: string; _pubsub: PubSub }) | undefined;
    let fenceRequestContext = ownershipOptions.requestContext;
    let stagedToolSurfaceFenceRestore = false;

    try {
      let mergedStreamOptions = mergeAgentExecutionOptions(
        defaultOptions as Record<string, unknown>,
        (streamOptionsWithSnapshotTarget ?? {}) as Record<string, unknown>,
      ) as typeof defaultOptions & { model?: DynamicArgument<MastraModelConfig> };
      if (mergedStreamOptions.toolsetsMode === 'replace') {
        if (streamOptionsWithSnapshotTarget?.toolsetsMode === 'replace') {
          mergedStreamOptions.toolsets = streamOptionsWithSnapshotTarget.toolsets ?? {};
        } else if (streamOptionsWithSnapshotTarget?.toolsets !== undefined) {
          mergedStreamOptions.toolsets = streamOptionsWithSnapshotTarget.toolsets;
        }
      }
      if (requestContextToUse) {
        mergedStreamOptions.requestContext = requestContextToUse;
      }
      mergedStreamOptions.requestContext ??= ownershipOptions.requestContext;
      fenceRequestContext = mergedStreamOptions.requestContext;
      const isReadOnlyThreadRun = isReadOnlyMemoryExecution(mergedStreamOptions.memory);

      if (isReadOnlyThreadRun && releaseReservedRun && !ownsExternalReservation) {
        if (reservedThreadTarget) {
          this.#forgetThreadStreamPubSubForTarget({
            runId: streamOptionsWithSnapshotTarget?.runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          });
        }
        releaseReservedRun();
        releaseReservedRun = undefined;
        ownsReservation = false;
        reservedThreadTarget = undefined;
        trackedThreadStreamPubSubTarget = undefined;
      }

      if (ownsReservation && reservedThreadTarget) {
        const mergedThreadTarget = this.#getThreadTarget(mergedStreamOptions);
        if (!this.#sameThreadTarget(reservedThreadTarget, mergedThreadTarget)) {
          const retargetedReservation = agentThreadStreamRuntime.retargetReservedRun(
            streamOptionsWithSnapshotTarget?.runId,
            reservedThreadTarget,
            mergedThreadTarget,
            pubsub,
            this.id,
          );
          if (retargetedReservation) {
            this.#forgetThreadStreamPubSubForTarget({
              runId: streamOptionsWithSnapshotTarget?.runId,
              resourceId: reservedThreadTarget.resourceId,
              threadId: reservedThreadTarget.threadId,
            });
            releaseReservedRun = () =>
              agentThreadStreamRuntime.releaseRunReservation(
                (mergedStreamOptions as { runId?: string }).runId,
                pubsub,
                {
                  cleanupPrepared: true,
                  clearAbort: true,
                  rejectOutputWaiters: true,
                },
              );
            reservedThreadTarget = mergedThreadTarget;
            this.#rememberThreadStreamPubSubForTarget(
              {
                runId: (mergedStreamOptions as { runId?: string }).runId,
                resourceId: mergedThreadTarget.resourceId,
                threadId: mergedThreadTarget.threadId,
              },
              pubsub,
            );
            trackedThreadStreamPubSubTarget = {
              runId: (mergedStreamOptions as { runId?: string }).runId,
              resourceId: mergedThreadTarget.resourceId,
              threadId: mergedThreadTarget.threadId,
            };
          }
        }
      }
      if (!ownsReservation && !isReadOnlyThreadRun) {
        releaseReservedRun = agentThreadStreamRuntime.reserveRun(
          mergedStreamOptions as unknown as AgentExecutionOptions<OUTPUT>,
          pubsub,
          this.id,
        );
        ownsReservation = Boolean(releaseReservedRun);
        if (ownsReservation) {
          reservedThreadTarget = this.#getThreadTarget(mergedStreamOptions);
          this.#rememberThreadStreamPubSub(mergedStreamOptions, pubsub);
          trackedThreadStreamPubSubTarget = {
            runId: (mergedStreamOptions as { runId?: string }).runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          };
        }
      }

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
              : `Model has unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
          details: {
            modelId: modelInfo.modelId,
            provider: modelInfo.provider,
            specificationVersion: specVersion,
          },
        });
      }

      await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
        this as Agent<any, any, any, any>,
        mergedStreamOptions as unknown as AgentExecutionOptions<OUTPUT>,
        pubsub,
        ownsReservation,
      );
      while (!ownsReservation && !isReadOnlyThreadRun && this.#getThreadTarget(mergedStreamOptions).threadId) {
        releaseReservedRun = agentThreadStreamRuntime.reserveRun(
          mergedStreamOptions as unknown as AgentExecutionOptions<OUTPUT>,
          pubsub,
          this.id,
        );
        ownsReservation = Boolean(releaseReservedRun);
        if (ownsReservation) {
          reservedThreadTarget = this.#getThreadTarget(mergedStreamOptions);
          this.#rememberThreadStreamPubSub(mergedStreamOptions, pubsub);
          trackedThreadStreamPubSubTarget = {
            runId: (mergedStreamOptions as { runId?: string }).runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          };
          break;
        }
        await agentThreadStreamRuntime.waitForThreadRunReservation(
          mergedStreamOptions as unknown as AgentExecutionOptions<OUTPUT>,
          pubsub,
          this.id,
        );
      }
      if (ownsReservation && reservedThreadTarget) {
        const preparedThreadTarget = this.#getThreadTarget(mergedStreamOptions);
        if (!this.#sameThreadTarget(reservedThreadTarget, preparedThreadTarget)) {
          const retargetedReservation = agentThreadStreamRuntime.retargetReservedRun(
            (mergedStreamOptions as { runId?: string }).runId,
            reservedThreadTarget,
            preparedThreadTarget,
            pubsub,
            this.id,
          );
          if (!retargetedReservation) {
            throw new Error(
              `Agent thread run id "${(mergedStreamOptions as { runId?: string }).runId}" could not be retargeted`,
            );
          }
          this.#forgetThreadStreamPubSubForTarget({
            runId: (mergedStreamOptions as { runId?: string }).runId,
            resourceId: reservedThreadTarget.resourceId,
            threadId: reservedThreadTarget.threadId,
          });
          releaseReservedRun = () =>
            agentThreadStreamRuntime.releaseRunReservation((mergedStreamOptions as { runId?: string }).runId, pubsub, {
              cleanupPrepared: true,
              clearAbort: true,
              rejectOutputWaiters: true,
            });
          reservedThreadTarget = preparedThreadTarget;
          this.#rememberThreadStreamPubSubForTarget(
            {
              runId: (mergedStreamOptions as { runId?: string }).runId,
              resourceId: preparedThreadTarget.resourceId,
              threadId: preparedThreadTarget.threadId,
            },
            pubsub,
          );
          trackedThreadStreamPubSubTarget = {
            runId: (mergedStreamOptions as { runId?: string }).runId,
            resourceId: preparedThreadTarget.resourceId,
            threadId: preparedThreadTarget.threadId,
          };
        }
      }
      const preparedOptions = agentThreadStreamRuntime.prepareRunOptions(
        mergedStreamOptions as unknown as AgentExecutionOptions<OUTPUT>,
        pubsub,
      );
      preparedOptionsWithPubSub = { ...preparedOptions, _pubsub: pubsub };
      this.#rememberThreadStreamPubSub(preparedOptionsWithPubSub, pubsub);
      trackedThreadStreamPubSubTarget = {
        runId: preparedOptionsWithPubSub.runId,
        ...this.#getThreadTarget(preparedOptionsWithPubSub),
      };

      await this.#assertAgentExecutionPreflight(preparedOptionsWithPubSub.requestContext, {
        memory: preparedOptionsWithPubSub.memory,
        runId: preparedOptionsWithPubSub.runId,
        snapshotMemoryInfo: snapshotMemoryInfo ?? undefined,
        actor: preparedOptionsWithPubSub.actor,
      });
      if (persistedToolSurfaceFence && fenceRequestContext) {
        stageToolSurfaceFenceRestore(fenceRequestContext, runId, persistedToolSurfaceFence);
        stagedToolSurfaceFenceRestore = true;
      }

      const result = await this.#execute(
        {
          ...preparedOptionsWithPubSub,
          structuredOutput: mergedStreamOptions.structuredOutput
            ? {
                ...mergedStreamOptions.structuredOutput,
                schema: toStandardSchema(mergedStreamOptions.structuredOutput.schema),
              }
            : undefined,
          messages: [],
          resumeContext: {
            resumeData,
            snapshot: existingSnapshot,
          },
          methodType: 'stream',
          _pubsub: pubsub,
          _toolSurfaceFenceOwnerId: toolSurfaceFenceOwnerId,
          // Use agent's maxProcessorRetries as default, allow options to override
          maxProcessorRetries: mergedStreamOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
        } as unknown as InnerAgentExecutionOptions<OUTPUT>,
        executionMemoryId,
      );

      if (result.status !== 'success') {
        this.#forgetThreadStreamPubSub(preparedOptionsWithPubSub);
        releaseReservedRun?.();
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

      const completion = agentThreadStreamRuntime.registerRun(
        this as Agent<any, any, any, any>,
        result.result as unknown as MastraModelOutput<OUTPUT>,
        preparedOptionsWithPubSub as unknown as AgentExecutionOptions<OUTPUT>,
        pubsub,
      );
      this.#trackThreadStreamPubSub(
        result.result as unknown as MastraModelOutput<OUTPUT>,
        preparedOptionsWithPubSub,
        completion,
      );

      const output = result.result as unknown as MastraModelOutput<OUTPUT>;
      if (fenceRequestContext && readToolSurfaceFence(fenceRequestContext, runId)) {
        void output.getFullOutput().then(
          full => {
            if (full.finishReason === 'suspended') {
              suspendToolSurfaceFence(fenceRequestContext, runId, toolSurfaceFenceOwnerId);
            } else {
              clearToolSurfaceFence(fenceRequestContext, runId, toolSurfaceFenceOwnerId);
            }
          },
          () => {
            clearToolSurfaceFence(fenceRequestContext, runId, toolSurfaceFenceOwnerId);
          },
        );
      }

      return output;
    } catch (error) {
      if (stagedToolSurfaceFenceRestore && fenceRequestContext) {
        consumeToolSurfaceFenceRestore(fenceRequestContext, runId);
      }
      if (fenceRequestContext) clearToolSurfaceFence(fenceRequestContext, runId, toolSurfaceFenceOwnerId);
      if (preparedOptionsWithPubSub) {
        this.#forgetThreadStreamPubSub(preparedOptionsWithPubSub);
      } else if (trackedThreadStreamPubSubTarget) {
        this.#forgetThreadStreamPubSubForTarget(trackedThreadStreamPubSubTarget);
      } else {
        this.#forgetThreadStreamPubSub(streamOptionsWithSnapshotTarget ?? {});
      }
      releaseReservedRun?.();
      throw error;
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
    resumeData: any,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
    executionMemoryId?: string,
  ): Promise<FullOutput<OUTPUT>> {
    const durable = await this.#getStandaloneDurable();
    if (durable) {
      return durable.resumeGenerate(resumeData, options) as Promise<FullOutput<OUTPUT>>;
    }

    resumeData = snapshotAgentExecutionValue(resumeData);
    if (options) {
      const snapshot = snapshotAgentExecutionOptionsWithRequestContexts(options, [
        'runId',
        'toolCallId',
        'requestContext',
        'memory',
      ]);
      options = snapshot.value;
      transferSnapshottedSuspendedToolSurfaceFence(options, snapshot.requestContextSnapshots);
    }
    const requestContextToUse = options?.requestContext;
    const toolSurfaceFenceOwnerId = randomUUID();
    let defaultOptions: AgentExecutionOptions<TOutput> | undefined;
    if (requestContextToUse) {
      // Keep explicit-context resume preflight before snapshot loading/model resolution so denied callers cannot touch persisted runs.
      await this.#assertAgentExecutionPreflight(requestContextToUse, {
        memory: options?.memory,
        runId: options?.runId,
        actor: options?.actor,
      });
    } else if (this.#requestContextSchema || this.#mastra?.getServer()?.fga) {
      defaultOptions = (await this.getDefaultOptions({
        requestContext: requestContextToUse,
      })) as AgentExecutionOptions<TOutput>;
      await this.#assertAgentExecutionPreflight(defaultOptions.requestContext, {
        memory: defaultOptions.memory,
        runId: options?.runId,
        actor: options?.actor ?? defaultOptions.actor,
      });
    }

    const runId = options?.runId ?? '';
    let { resourceId: runResourceId, snapshot: existingSnapshot } = await this.#loadAgenticLoopSnapshotOrThrow({
      runId,
      method: 'resumeGenerate',
      rowOwnership: {
        requestContext: requestContextToUse ?? defaultOptions?.requestContext,
        options: {
          memory: options?.memory ?? defaultOptions?.memory,
        },
      },
    });

    defaultOptions ??= (await this.getDefaultOptions({
      requestContext: requestContextToUse,
    })) as AgentExecutionOptions<TOutput>;

    const mergedOptions = mergeAgentExecutionOptions(
      defaultOptions as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions & { model?: DynamicArgument<MastraModelConfig> };
    mergedOptions.requestContext ??= new RequestContext();
    if (mergedOptions.toolsetsMode === 'replace') {
      if (options?.toolsetsMode === 'replace') {
        mergedOptions.toolsets = options.toolsets ?? {};
      } else if (options?.toolsets !== undefined) {
        mergedOptions.toolsets = options.toolsets;
      }
    }
    if (requestContextToUse) {
      mergedOptions.requestContext = requestContextToUse;
    }
    const requestedToolCallId = options?.toolCallId;
    let snapshotMemoryInfo = this.#verifyAgenticLoopResumeSnapshot({
      method: 'resumeGenerate',
      runId,
      runResourceId,
      snapshot: existingSnapshot,
      requestContext: mergedOptions.requestContext,
      options: mergedOptions,
    });
    const targetIsNotYetSuspended =
      requestedToolCallId !== undefined &&
      !this.#getAgenticLoopSuspendedToolCalls(existingSnapshot).toolCalls.some(
        toolCall => toolCall.toolCallId === requestedToolCallId,
      );
    if (targetIsNotYetSuspended) {
      const refreshedRun = await this.#loadAgenticLoopSnapshotOrThrow({
        runId,
        method: 'resumeGenerate',
        waitForToolCallId: requestedToolCallId,
      });
      runResourceId = refreshedRun.resourceId ?? runResourceId;
      existingSnapshot = refreshedRun.snapshot;
      snapshotMemoryInfo = this.#verifyAgenticLoopResumeSnapshot({
        method: 'resumeGenerate',
        runId,
        runResourceId,
        snapshot: existingSnapshot,
        requestContext: mergedOptions.requestContext,
        options: mergedOptions,
      });
    }
    this.#assertAgenticLoopSuspendedToolCall(existingSnapshot, runId, requestedToolCallId);
    const persistedToolSurfaceFence = this.#getAgenticLoopSnapshotToolSurfaceFence(existingSnapshot);
    const loopOptions = { ...mergedOptions };
    const actor = mergedOptions.actor;
    delete loopOptions.actor;

    await this.#assertAgentExecutionPreflight(mergedOptions.requestContext, {
      memory: mergedOptions.memory,
      runId: mergedOptions.runId,
      snapshotMemoryInfo: snapshotMemoryInfo ?? undefined,
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
        id: 'AGENT_GENERATE_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          specVersion === 'v1'
            ? `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with generate(). Please use AI SDK v5+ models or call the generateLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
            : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details: {
          agentName: this.name,
          modelId,
          provider,
          specificationVersion: specVersion,
        },
      });
    }

    let result;
    let stagedToolSurfaceFenceRestore = false;
    try {
      if (persistedToolSurfaceFence) {
        stageToolSurfaceFenceRestore(mergedOptions.requestContext, runId, persistedToolSurfaceFence);
        stagedToolSurfaceFenceRestore = true;
      }
      result = await this.#execute(
        {
          ...loopOptions,
          actor,
          structuredOutput: mergedOptions.structuredOutput
            ? {
                ...mergedOptions.structuredOutput,
                schema: toStandardSchema(mergedOptions.structuredOutput.schema),
              }
            : undefined,
          messages: [],
          resumeContext: {
            resumeData,
            snapshot: existingSnapshot,
          },
          methodType: 'generate',
          _toolSurfaceFenceOwnerId: toolSurfaceFenceOwnerId,
          // Use agent's maxProcessorRetries as default, allow options to override
          maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
        } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub },
        executionMemoryId,
      );
    } catch (error) {
      if (stagedToolSurfaceFenceRestore) {
        consumeToolSurfaceFenceRestore(mergedOptions.requestContext, runId);
      }
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, runId, toolSurfaceFenceOwnerId);
      }
      throw error;
    }

    if (result.status !== 'success') {
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, runId, toolSurfaceFenceOwnerId);
      }
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
        text: 'Execution workflow produced a result without getFullOutput — this usually means the evented engine failed to deliver events (e.g. socket publish failure)',
      });
    }

    const output = result.result as MastraModelOutput<OUTPUT>;
    let fullOutput: Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
    try {
      fullOutput = (await output.getFullOutput()) as Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
    } catch (error) {
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, runId, toolSurfaceFenceOwnerId);
      }
      throw error;
    }
    const error = fullOutput.error;

    if (error) {
      if (mergedOptions.requestContext) {
        clearToolSurfaceFence(mergedOptions.requestContext, runId, toolSurfaceFenceOwnerId);
      }
      throw error;
    }

    if (mergedOptions.requestContext) {
      if (fullOutput.finishReason === 'suspended') {
        suspendToolSurfaceFence(mergedOptions.requestContext, runId, toolSurfaceFenceOwnerId);
      } else {
        clearToolSurfaceFence(mergedOptions.requestContext, runId, toolSurfaceFenceOwnerId);
      }
    }

    return fullOutput;
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
    // Route standalone `new Agent({ durable: true })` calls through the
    // durable execution path.
    const durable = await this.#getStandaloneDurable();
    if (durable) {
      return durable.approveToolCall(options) as Promise<MastraModelOutput<OUTPUT>>;
    }

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
    const hasLocalRun = agentThreadStreamRuntime.hasThreadRun(runId, pubsub);
    let resumableRun = agentThreadStreamRuntime.getResumableThreadRun(
      { threadId, resourceId, runId, toolCallId },
      pubsub,
    );

    if (!resumableRun && !hasLocalRun) {
      // The thread runtime only tracks runs seen by this process. Recover the
      // explicitly targeted run from snapshot storage after a restart or when
      // the resume request reaches another server instance.
      let suspendedRuns: AgentRun[] = [];
      try {
        ({ runs: suspendedRuns } = await this.listSuspendedRuns({
          threadId,
          resourceId,
          requestContext: streamOptions?.requestContext,
        }));
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
        const queuedResumableRun = hasLocalRun
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
      /** Resume data for a `suspend()`-parked call identified by `toolCallId`. */
      resumeData?: unknown;
      declineContext?: { reason?: string; message?: string };
      messages?: MessageListInput;
      streamOptions?: AgentExecutionOptions<OUTPUT>;
    },
  ): Promise<{ accepted: true; runId: string; toolCallId?: string }> {
    const optionsSnapshot = snapshotAgentExecutionOptionsWithRequestContexts(options, [
      'threadId',
      'resourceId',
      'toolCallId',
      'approved',
      'resumeData',
      'declineContext',
      'messages',
      'streamOptions',
      'requestContext',
      'memory',
    ]);
    options = optionsSnapshot.value;
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
    const hasMessages = messages !== undefined;

    if (hasMessages && customResumeData !== undefined) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_CONFLICTING_CONTINUATION_INPUT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" sendToolApproval() accepts messages or resumeData, not both.`,
        details: { threadId, resourceId, agentName: this.name },
      });
    }

    if (hasMessages && !approved) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_MESSAGES_REQUIRE_APPROVAL',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" sendToolApproval() only accepts messages when approved is true.`,
        details: { threadId, resourceId, agentName: this.name },
      });
    }

    if (customResumeData !== undefined && !options.toolCallId) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_RESUME_DATA_REQUIRES_TOOL_CALL_ID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${this.name}" sendToolApproval() requires toolCallId when resumeData is provided.`,
        details: { threadId, resourceId, agentName: this.name },
      });
    }

    const activeRunId = this.getActiveThreadRunId({ threadId, resourceId });
    let runId: string | undefined;
    let recoveredToolCallId = options.toolCallId;
    let suspendedRuns: AgentRun[] = [];
    let suspendedRunDiscoveryAvailable = true;
    const discoverSuspendedRuns = async () =>
      this.listSuspendedRuns({
        threadId,
        resourceId,
        requestContext: executionOptions.requestContext,
      });
    try {
      ({ runs: suspendedRuns } = await discoverSuspendedRuns());
    } catch (error) {
      // Preserve the in-memory-only path when storage is not configured. Driver
      // failures and authorization failures remain visible.
      if (!(error instanceof MastraError) || error.id !== 'AGENT_LIST_SUSPENDED_RUNS_NO_STORAGE') {
        throw error;
      }
      suspendedRunDiscoveryAvailable = false;
    }

    type ApprovalCandidate = {
      run: Pick<AgentRun, 'runId'>;
      toolCall: { toolCallId?: string; requiresApproval: boolean };
    };
    const collectCandidates = (runs: AgentRun[]): ApprovalCandidate[] =>
      runs
        .filter(run => !executionOptions.runId || run.runId === executionOptions.runId)
        .flatMap(run =>
          run.toolCalls
            .filter(toolCall => toolCall.requiresApproval || customResumeData !== undefined)
            .filter(toolCall => !options.toolCallId || toolCall.toolCallId === options.toolCallId)
            .map(toolCall => ({ run, toolCall })),
        );
    const hasExactStoredCall = (runs: AgentRun[]) =>
      runs.some(
        run => run.runId === activeRunId && run.toolCalls.some(toolCall => toolCall.toolCallId === options.toolCallId),
      );

    let candidates = collectCandidates(suspendedRuns);
    const exactActiveRunRequested = Boolean(
      activeRunId && options.toolCallId && executionOptions.runId === activeRunId,
    );
    const localResumableRun = exactActiveRunRequested
      ? agentThreadStreamRuntime.getResumableThreadRun(
          {
            threadId,
            resourceId,
            runId: activeRunId!,
            toolCallId: options.toolCallId,
            ...(customResumeData === undefined && !hasMessages ? { suspensionKind: 'approval' as const } : {}),
          },
          this.getPubSub(),
        )
      : undefined;

    // A remote subscriber can observe the next sequential approval before its
    // owner persists the replacement snapshot. Without local suspension metadata,
    // wait for the exact stored occurrence (and its approval kind) instead of
    // treating the previous call's row as authority or fabricating a candidate.
    if (
      exactActiveRunRequested &&
      !localResumableRun &&
      candidates.length === 0 &&
      suspendedRunDiscoveryAvailable &&
      !hasMessages &&
      !hasExactStoredCall(suspendedRuns)
    ) {
      const deadline = Date.now() + 2000;
      while (candidates.length === 0 && !hasExactStoredCall(suspendedRuns) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25));
        ({ runs: suspendedRuns } = await discoverSuspendedRuns());
        candidates = collectCandidates(suspendedRuns);
      }
    }

    // Only locally observed, exact suspension metadata may bridge the interval
    // before storage catches up. Message continuation is a separate active-run
    // mode; approval-shaped resumes additionally require an approval suspension.
    if (
      activeRunId &&
      candidates.length === 0 &&
      exactActiveRunRequested &&
      ((localResumableRun && !hasExactStoredCall(suspendedRuns)) || hasMessages)
    ) {
      candidates.push({
        run: { runId: activeRunId } as AgentRun,
        toolCall: {
          toolCallId: options.toolCallId,
          requiresApproval: customResumeData === undefined,
        },
      });
    }

    if (candidates.length > 1) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_AMBIGUOUS_SUSPENDED_CALLS',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" sendToolApproval() found ${candidates.length} matching suspended tool calls for thread "${threadId}". ` +
          `Pass a toolCallId that identifies exactly one call.`,
        details: {
          threadId,
          resourceId,
          agentName: this.name,
          runIds: [...new Set(candidates.map(candidate => candidate.run.runId))].join(', '),
        },
      });
    }

    runId = candidates[0]?.run.runId;
    recoveredToolCallId = candidates[0]?.toolCall.toolCallId;
    if (activeRunId && runId && activeRunId !== runId) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_ACTIVE_RUN_CONFLICT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" sendToolApproval() found the requested call in suspended run "${runId}", ` +
          `but run "${activeRunId}" currently owns thread "${threadId}". Resolve the active run first.`,
        details: { threadId, resourceId, agentName: this.name, runId, activeRunId },
      });
    }
    if (hasMessages) {
      if (!activeRunId) {
        throw new MastraError({
          id: 'AGENT_SEND_TOOL_APPROVAL_MESSAGES_REQUIRE_ACTIVE_RUN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `Agent "${this.name}" sendToolApproval() only accepts messages while an in-memory run owns thread "${threadId}".`,
          details: { threadId, resourceId, agentName: this.name },
        });
      }
      const continuation = agentThreadStreamRuntime.continueWithMessages(
        this as Agent<any, any, any, any>,
        messages,
        {
          resourceId,
          threadId,
          runId: activeRunId,
          streamOptions: deepMerge(
            (streamOptions ?? {}) as Record<string, unknown>,
            executionOptions as Record<string, unknown>,
          ) as unknown as AgentExecutionOptions<OUTPUT>,
        },
        this.getPubSub(),
      );
      return { accepted: continuation.accepted, runId: continuation.runId, toolCallId: options.toolCallId };
    }
    const resolvedFromStorage = Boolean(runId && !activeRunId);
    if (!runId) {
      throw new MastraError({
        id: 'AGENT_SEND_TOOL_APPROVAL_NO_ACTIVE_THREAD_RUN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" sendToolApproval() could not find an active or suspended approval for thread "${threadId}". ` +
          `The run may have already completed or been resumed.`,
        details: {
          threadId,
          resourceId,
          agentName: this.name,
        },
      });
    }

    const resumeOptions = deepMerge(
      (streamOptions ?? {}) as Record<string, unknown>,
      executionOptions as Record<string, unknown>,
    ) as unknown as AgentExecutionOptions<OUTPUT>;

    const resumeData =
      customResumeData !== undefined
        ? customResumeData
        : approved
          ? { approved }
          : declineContext
            ? { approved, ...declineContext }
            : { approved };
    const resumeStreamOptions = {
      ...resumeOptions,
      memory: {
        ...(resumeOptions.memory ?? {}),
        thread: threadId,
        resource: resourceId,
      },
    };
    transferSnapshottedSuspendedToolSurfaceFence(
      { ...resumeStreamOptions, runId },
      optionsSnapshot.requestContextSnapshots,
    );

    if (resolvedFromStorage) {
      // Resume directly from the persisted snapshot, mirroring the explicit-runId
      // approveToolCall()/declineToolCall() entry points.
      // @ts-expect-error - resumeStream overloads don't narrow cleanly here; matches
      // the same pattern used by approveToolCall()/declineToolCall() above.
      await this.resumeStream(resumeData, {
        ...resumeStreamOptions,
        runId,
        ...(recoveredToolCallId ? { toolCallId: recoveredToolCallId } : {}),
      });
      return { accepted: true, runId, toolCallId: recoveredToolCallId };
    }

    return this.sendStreamResume({
      threadId,
      resourceId,
      runId,
      toolCallId: recoveredToolCallId,
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
    // Route standalone `new Agent({ durable: true })` calls through the
    // durable execution path.
    const durable = await this.#getStandaloneDurable();
    if (durable) {
      return durable.declineToolCall(options) as Promise<MastraModelOutput<OUTPUT>>;
    }

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
        }
      | undefined,
  ): {
    shouldGenerate: boolean;
    model?: DynamicArgument<MastraModelConfig, TRequestContext>;
    instructions?: DynamicArgument<string>;
    minMessages?: number;
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
      - do not use quotes or colons
      - the entire text you return will be used as the title`;

    if (!instructions) {
      return DEFAULT_TITLE_INSTRUCTIONS;
    }

    if (typeof instructions === 'string') {
      return instructions;
    } else {
      const result = instructions({ requestContext, mastra: this.#mastra });
      return resolveMaybePromise(result, resolvedInstructions => {
        return resolvedInstructions || DEFAULT_TITLE_INSTRUCTIONS;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Durable-agent method delegators
  //
  // These methods only make sense when the agent was constructed with
  // `durable: true`. They mirror the public surface of `DurableAgent` (which
  // extends `Agent`) so that a standalone `new Agent({ durable: true })` — used
  // without being attached to a `Mastra` instance — can still drive durable
  // execution. Each delegator resolves the lazily-built standalone
  // `DurableAgent` wrapper via `#getStandaloneDurable()` and forwards the call.
  //
  // On a non-durable agent they throw `AGENT_DURABLE_METHOD_NOT_AVAILABLE` so
  // callers get a clear error instead of a confusing "not a function" from a
  // typo-safe method that silently does nothing.
  //
  // When the agent is attached to a `Mastra`, Mastra auto-wraps at
  // registration and the caller already holds a `DurableAgent`, so the base
  // methods below are unreachable via the wrapper — `#getStandaloneDurable()`
  // returns `undefined` and the throw path fires. To avoid that misleading
  // error, callers should either use the wrapper Mastra hands back or omit the
  // `Mastra` registration and rely on the standalone wrapper.
  // ---------------------------------------------------------------------------

  async #requireStandaloneDurable(method: string): Promise<StandaloneDurableWrapper> {
    const durable = await this.#getStandaloneDurable();
    if (!durable) {
      throw new MastraError({
        id: 'AGENT_DURABLE_METHOD_NOT_AVAILABLE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent.${method}() is only available on agents constructed with \`durable: true\`. Configure \`new Agent({ durable: true })\` or retrieve the durable agent from a registered Mastra instance.`,
        details: { agentId: this.id, method },
      });
    }
    return durable;
  }

  /** Resume a suspended durable run. Only valid when `durable: true`. */
  async resume(
    runId: string,
    resumeData: unknown,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    const durable = await this.#requireStandaloneDurable('resume');
    return durable.resume(runId, resumeData, options) as Promise<DurableAgentStreamResult<TOutput>>;
  }

  /** Recover a persisted durable run in a fresh process. Only valid when `durable: true`. */
  async recover(
    runId: string,
    options?: DurableAgentRecoverOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    const durable = await this.#requireStandaloneDurable('recover');
    return durable.recover(runId, options) as Promise<DurableAgentStreamResult<TOutput>>;
  }

  /** List active durable runs. Only valid when `durable: true`. */
  async listActiveRuns(options?: DurableAgentListActiveRunsOptions): Promise<DurableAgentListActiveRunsResult> {
    const durable = await this.#requireStandaloneDurable('listActiveRuns');
    return durable.listActiveRuns(options) as Promise<DurableAgentListActiveRunsResult>;
  }

  /** Bulk-recover active durable runs. Only valid when `durable: true`. */
  async recoverActiveRuns(
    options?: DurableAgentRecoverActiveRunsOptions,
  ): Promise<DurableAgentRecoverActiveRunsResult> {
    const durable = await this.#requireStandaloneDurable('recoverActiveRuns');
    return durable.recoverActiveRuns(options) as Promise<DurableAgentRecoverActiveRunsResult>;
  }

  /** Observe an in-flight durable run without driving it. Only valid when `durable: true`. */
  async observe(
    runId: string,
    options?: {
      offset?: number;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string }> {
    const durable = await this.#requireStandaloneDurable('observe');
    return durable.observe(runId, options) as Promise<
      Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string }
    >;
  }

  /** Prepare a durable execution without starting it. Only valid when `durable: true`. */
  async prepare(messages: MessageListInput, options?: AgentExecutionOptions<TOutput>): Promise<unknown> {
    const durable = await this.#requireStandaloneDurable('prepare');
    return durable.prepare(messages, options);
  }

  // Note: `getWorkflow()` and `getDurableWorkflows()` are intentionally NOT
  // added to base `Agent`. `DurableAgent` defines them synchronously (and
  // `getDurableWorkflows` is called by `Mastra.addAgent` at registration
  // time), so a base async delegator would break the overridden sync
  // signatures. Callers that need those APIs should hold a `DurableAgent`
  // reference — either by using `createDurableAgent()` explicitly or by
  // reading the agent back from a registered `Mastra`.
}

/**
 * Factory function to create an Inngest-powered durable agent.
 *
 * This provides a clean API for wrapping a Mastra Agent with Inngest's
 * durable execution engine. The returned object can be registered with
 * Mastra like any other agent, and the required workflow is automatically
 * registered when added to Mastra.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createInngestAgent } from '@mastra/inngest';
 * import { Inngest } from 'inngest';
 * import { realtimeMiddleware } from '@inngest/realtime/middleware';
 *
 * const inngest = new Inngest({
 *   id: 'my-app',
 *   middleware: [realtimeMiddleware()],
 * });
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createInngestAgent({ agent, inngest });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 *
 * // Use the agent
 * const { output, cleanup } = await durableAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */

import type { Agent, AgentExecutionOptions } from '@mastra/core/agent';
import { prepareForDurableExecution, createDurableAgentStream, emitErrorEvent } from '@mastra/core/agent/durable';
import type {
  AgentFinishEventData,
  AgentStepFinishEventData,
  AgentSuspendedEventData,
} from '@mastra/core/agent/durable';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { MastraServerCache } from '@mastra/core/cache';
import { CachingPubSub } from '@mastra/core/events';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { SpanType, EntityType } from '@mastra/core/observability';
import type { MastraModelOutput, ChunkType } from '@mastra/core/stream';
import type { Workflow } from '@mastra/core/workflows';
import type { Inngest } from 'inngest';

import { InngestPubSub } from '../pubsub';
import { createInngestDurableAgenticWorkflow, InngestDurableStepIds } from './create-inngest-agentic-workflow';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for createInngestAgent factory function.
 */
export interface CreateInngestAgentOptions {
  /** The Mastra Agent to wrap with durable execution */
  agent: Agent<any, any, any>;
  /** Inngest client instance */
  inngest: Inngest;
  /** Optional ID override (defaults to agent.id) */
  id?: string;
  /** Optional name override (defaults to agent.name) */
  name?: string;
  /** Optional PubSub override (defaults to InngestPubSub) */
  pubsub?: PubSub;
  /**
   * Cache instance for storing stream events.
   * Enables resumable streams - clients can disconnect and reconnect
   * without missing events.
   *
   * When provided, the pubsub is wrapped with CachingPubSub.
   */
  cache?: MastraServerCache;
  /** Mastra instance for observability (optional, set automatically when registered with Mastra) */
  mastra?: Mastra;
}

/**
 * Options for InngestAgent.stream()
 */
export interface InngestAgentStreamOptions<OUTPUT = undefined> {
  /** Custom instructions that override the agent's default instructions */
  instructions?: AgentExecutionOptions<OUTPUT>['instructions'];
  /** Additional context messages */
  context?: AgentExecutionOptions<OUTPUT>['context'];
  /** Memory configuration */
  memory?: AgentExecutionOptions<OUTPUT>['memory'];
  /** Unique identifier for this execution run */
  runId?: string;
  /** Request Context */
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /** Maximum number of steps */
  maxSteps?: number;
  /** Additional tool sets */
  toolsets?: AgentExecutionOptions<OUTPUT>['toolsets'];
  /** Client-side tools */
  clientTools?: AgentExecutionOptions<OUTPUT>['clientTools'];
  /** Tool selection strategy */
  toolChoice?: AgentExecutionOptions<OUTPUT>['toolChoice'];
  /** Model settings */
  modelSettings?: AgentExecutionOptions<OUTPUT>['modelSettings'];
  /** Require approval for all tool calls */
  requireToolApproval?: boolean;
  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;
  /** Maximum concurrent tool calls */
  toolCallConcurrency?: number;
  /** Include raw chunks in output */
  includeRawChunks?: boolean;
  /** Maximum processor retries */
  maxProcessorRetries?: number;
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Callback when step finishes */
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  /** Callback when execution finishes */
  onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
  /** Callback on error */
  onError?: (error: Error) => void | Promise<void>;
  /** Callback when workflow suspends */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
}

/**
 * Result from InngestAgent.stream()
 */
export interface InngestAgentStreamResult<OUTPUT = undefined> {
  /** The streaming output */
  output: MastraModelOutput<OUTPUT>;
  /** The full stream - delegates to output.fullStream for server compatibility */
  readonly fullStream: ReadableStream<any>;
  /** The unique run ID */
  runId: string;
  /** Thread ID if using memory */
  threadId?: string;
  /** Resource ID if using memory */
  resourceId?: string;
  /** Cleanup function */
  cleanup: () => void;
}

/**
 * An Inngest-powered durable agent.
 *
 * This interface represents an agent that uses Inngest's durable execution engine.
 * It can be registered with Mastra like a regular Agent, and the required workflow
 * is automatically registered.
 *
 * At runtime, a Proxy forwards all Agent method calls (e.g., `generate()`, `listTools()`,
 * `getMemory()`) to the underlying agent. The index signature below reflects this:
 * any property not explicitly declared here is available via the Proxy.
 */
export interface InngestAgent<TOutput = undefined> {
  /** Agent ID */
  readonly id: string;
  /** Agent name */
  readonly name: string;
  /** The underlying Mastra Agent (for Mastra registration) */
  readonly agent: Agent<any, any, TOutput>;
  /** The Inngest client */
  readonly inngest: Inngest;
  /** The cache instance if resumable streams are enabled */
  readonly cache?: MastraServerCache;

  /**
   * The PubSub instance used for streaming events.
   * Returns the CachingPubSub wrapper if caching is enabled.
   * @internal Used by the server's observe endpoint to subscribe to the correct PubSub instance.
   */
  readonly pubsub: PubSub;

  /**
   * Stream a response using Inngest's durable execution.
   */
  stream(
    messages: MessageListInput,
    options?: InngestAgentStreamOptions<TOutput>,
  ): Promise<InngestAgentStreamResult<TOutput>>;

  /**
   * Resume a suspended workflow execution.
   */
  resume(
    runId: string,
    resumeData: unknown,
    options?: {
      threadId?: string;
      resourceId?: string;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<InngestAgentStreamResult<TOutput>>;

  /**
   * Prepare for durable execution without starting it.
   */
  prepare(
    messages: MessageListInput,
    options?: AgentExecutionOptions<TOutput>,
  ): Promise<{
    runId: string;
    messageId: string;
    workflowInput: any;
    threadId?: string;
    resourceId?: string;
  }>;

  /**
   * Observe (reconnect to) an existing stream.
   * Use this to resume receiving events after a disconnection.
   *
   * @param runId - The run ID to observe
   * @param options.offset - Resume from this event index (0-based). If omitted, replays all events.
   */
  observe(
    runId: string,
    options?: {
      offset?: number;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<InngestAgentStreamResult<TOutput>, 'threadId' | 'resourceId'> & { runId: string }>;

  /**
   * Get the durable workflows required by this agent.
   * Called by Mastra during agent registration.
   * @internal
   */
  getDurableWorkflows(): Workflow<any, any, any, any, any, any, any>[];

  /**
   * Set the Mastra instance for observability.
   * Called by Mastra during agent registration.
   * @internal
   */
  __setMastra(mastra: Mastra): void;

  // ---------------------------------------------------------------------------
  // Agent methods forwarded via Proxy to the underlying Agent at runtime.
  // Declared here so TypeScript can see them without the Proxy indirection.
  // ---------------------------------------------------------------------------

  /** Generate a non-streaming response. Forwarded to the underlying Agent. */
  generate(messages: MessageListInput, options?: AgentExecutionOptions<any>): Promise<any>;
  /** Get the agent's description. Forwarded to the underlying Agent. */
  getDescription(): string;
  /** Get the agent's instructions. Forwarded to the underlying Agent. */
  getInstructions(...args: any[]): any;
  /** List tools available to the agent. Forwarded to the underlying Agent. */
  listTools(...args: any[]): any;
  /** Get the agent's LLM configuration. Forwarded to the underlying Agent. */
  getLLM(...args: any[]): any;
  /** Get the agent's model. Forwarded to the underlying Agent. */
  getModel(...args: any[]): any;
  /** Get the agent's memory instance. Forwarded to the underlying Agent. */
  getMemory(...args: any[]): any;
  /** Check if agent has its own memory. Forwarded to the underlying Agent. */
  hasOwnMemory(): boolean;
  /** Get the agent's workspace. Forwarded to the underlying Agent. */
  getWorkspace(...args: any[]): any;
  /** List sub-agents. Forwarded to the underlying Agent. */
  listAgents(...args: any[]): any;
  /** List workflows. Forwarded to the underlying Agent. */
  listWorkflows(...args: any[]): any;
  /** Get default execution options. Forwarded to the underlying Agent. */
  getDefaultOptions(...args: any[]): any;
  /** Get legacy generate options. Forwarded to the underlying Agent. */
  getDefaultGenerateOptionsLegacy(...args: any[]): any;
  /** Get legacy stream options. Forwarded to the underlying Agent. */
  getDefaultStreamOptionsLegacy(...args: any[]): any;
  /** Get available models. Forwarded to the underlying Agent. */
  getModelList(...args: any[]): any;
  /** Get configured processor workflows. Forwarded to the underlying Agent. */
  getConfiguredProcessorWorkflows(...args: any[]): any;
  /** Get raw agent configuration. Forwarded to the underlying Agent. */
  toRawConfig(...args: any[]): any;
  /** Resume a streaming execution. Forwarded to the underlying Agent. */
  resumeStream(...args: any[]): any;
  /** Resume a generate execution. Forwarded to the underlying Agent. */
  resumeGenerate(...args: any[]): any;
  /** Approve a pending tool call. Forwarded to the underlying Agent. */
  approveToolCall(...args: any[]): any;
  /** @internal Update the agent's model. Forwarded to the underlying Agent. */
  __updateModel(...args: any[]): any;
  /** @internal Reset to original model. Forwarded to the underlying Agent. */
  __resetToOriginalModel(...args: any[]): any;
  /** @internal Set logger. Forwarded to the underlying Agent. */
  __setLogger(...args: any[]): any;
  /** @internal Register primitives. Forwarded to the underlying Agent. */
  __registerPrimitives(...args: any[]): any;
  /** @internal Register Mastra instance. Forwarded to the underlying Agent. */
  __registerMastra(...args: any[]): any;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an Inngest-powered durable agent from a Mastra Agent.
 *
 * This factory function wraps a regular Mastra Agent with Inngest's durable
 * execution capabilities. The returned InngestAgent can be registered with
 * Mastra, and the required workflow will be automatically registered.
 *
 * @param options - Configuration options
 * @returns An InngestAgent that can be registered with Mastra
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are helpful',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createInngestAgent({ agent, inngest });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 * ```
 */
export function createInngestAgent<TOutput = undefined>(options: CreateInngestAgentOptions): InngestAgent<TOutput> {
  const {
    agent,
    inngest,
    id: idOverride,
    name: nameOverride,
    pubsub: customPubsub,
    cache,
    mastra: mastraOption,
  } = options;

  // Use provided id/name or fall back to agent.id/agent.name
  const agentId = idOverride ?? agent.id;
  const agentName = nameOverride ?? agent.name;

  // Track mastra instance - can be set later when registered with Mastra
  let mastra: Mastra | undefined = mastraOption;

  // Create the durable workflow for this agent
  // Mastra's addWorkflow handles deduplication, so creating multiple times is fine
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  // Track whether user provided a custom cache (if not, we'll inherit from mastra)
  let _customCache = cache;

  // Set up pubsub with lazy CachingPubSub creation
  // CachingPubSub is an internal implementation detail - users just configure cache and pubsub separately
  let innerPubsub: PubSub = customPubsub ?? new InngestPubSub(inngest, InngestDurableStepIds.AGENTIC_LOOP);
  let _cachingPubsub: PubSub | null = null;

  // Lazily create CachingPubSub - this allows inheriting cache from mastra if not provided
  function getPubsub(): PubSub {
    if (!_cachingPubsub) {
      // Resolve cache: user-provided > mastra's cache > no caching (just use inner pubsub)
      const resolvedCache = _customCache ?? mastra?.serverCache;
      if (resolvedCache) {
        _customCache = resolvedCache; // Store for the cache getter
        _cachingPubsub = new CachingPubSub(innerPubsub, resolvedCache);
      } else {
        _cachingPubsub = innerPubsub;
      }
    }
    return _cachingPubsub;
  }

  // Lazily resolve cache
  function getCache(): MastraServerCache | undefined {
    // Ensure pubsub is initialized (which resolves cache)
    getPubsub();
    return _customCache;
  }

  /**
   * Trigger the workflow via Inngest event
   */
  async function triggerWorkflow(
    runId: string,
    workflowInput: any,
    tracingOptions?: { traceId: string; parentSpanId: string },
  ): Promise<void> {
    const eventName = `workflow.${InngestDurableStepIds.AGENTIC_LOOP}`;

    await inngest.send({
      name: eventName,
      data: {
        inputData: workflowInput,
        runId,
        resourceId: workflowInput.state?.resourceId,
        requestContext: {},
        tracingOptions,
      },
    });
  }

  /**
   * Emit an error event to pubsub
   */
  async function emitError(runId: string, error: Error): Promise<void> {
    await emitErrorEvent(getPubsub(), runId, error);
  }

  // Return the InngestAgent object (Agent methods are added by the Proxy below)
  const inngestAgent: Pick<
    InngestAgent<TOutput>,
    | 'id'
    | 'name'
    | 'agent'
    | 'inngest'
    | 'cache'
    | 'pubsub'
    | 'stream'
    | 'resume'
    | 'prepare'
    | 'observe'
    | 'getDurableWorkflows'
    | '__setMastra'
  > = {
    get id() {
      return agentId;
    },

    get name() {
      return agentName;
    },

    get agent() {
      return agent as Agent<any, any, TOutput>;
    },

    get inngest() {
      return inngest;
    },

    get cache() {
      return getCache();
    },

    get pubsub() {
      return getPubsub();
    },

    async stream(messages, streamOptions): Promise<InngestAgentStreamResult<TOutput>> {
      // 1. Prepare for durable execution
      const preparation = await prepareForDurableExecution<TOutput>({
        agent: agent as Agent<string, any, TOutput>,
        messages,
        options: streamOptions as AgentExecutionOptions<TOutput>,
        runId: streamOptions?.runId,
        requestContext: streamOptions?.requestContext,
      });

      const { runId, messageId, workflowInput, threadId, resourceId } = preparation;

      // Override agentId and agentName in workflowInput with the durable agent's values
      workflowInput.agentId = agentId;
      workflowInput.agentName = agentName;

      // 2. Create AGENT_RUN span BEFORE the workflow starts
      // This ensures the agent_run is the root of the trace, not the workflow
      const observability = mastra?.observability?.getSelectedInstance({
        requestContext: streamOptions?.requestContext,
      });
      const agentSpan = observability?.startSpan({
        type: SpanType.AGENT_RUN,
        name: `agent run: '${agentId}'`,
        entityType: EntityType.AGENT,
        entityId: agentId,
        entityName: agentName,
        input: workflowInput.messageListState,
        metadata: {
          runId,
          threadId,
          resourceId,
        },
      });
      // Export span data so it can be passed to the workflow
      const agentSpanData = agentSpan?.exportSpan();

      // 3. Create MODEL_GENERATION span BEFORE the workflow starts
      // This ensures ONE model_generation span contains all steps (like regular agents)
      const modelSpan = agentSpan?.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: `llm: '${workflowInput.modelConfig.modelId}'`,
        input: { messages: workflowInput.messageListState },
        attributes: {
          model: workflowInput.modelConfig.modelId,
          provider: workflowInput.modelConfig.provider,
          streaming: true,
          parameters: {
            temperature: workflowInput.options?.temperature,
          },
        },
      });
      const modelSpanData = modelSpan?.exportSpan();

      // Add span data to workflow input
      workflowInput.agentSpanData = agentSpanData;
      workflowInput.modelSpanData = modelSpanData;
      workflowInput.stepIndex = 0;

      // 2. Create the durable agent stream (subscribes to pubsub)
      const {
        output,
        cleanup: streamCleanup,
        ready,
      } = createDurableAgentStream<TOutput>({
        pubsub: getPubsub(),
        runId,
        messageId,
        model: {
          modelId: workflowInput.modelConfig.modelId,
          provider: workflowInput.modelConfig.provider,
          version: 'v3',
        },
        threadId,
        resourceId,
        onChunk: streamOptions?.onChunk,
        onStepFinish: streamOptions?.onStepFinish,
        onFinish: streamOptions?.onFinish,
        onError: streamOptions?.onError,
        onSuspended: streamOptions?.onSuspended,
      });

      // 3. Wait for subscription to be established, then trigger workflow
      // Pass tracing options so workflow spans are children of the agent span
      const tracingOptions = agentSpanData
        ? { traceId: agentSpanData.traceId, parentSpanId: agentSpanData.id }
        : undefined;

      // Wait for subscription to be ready before triggering workflow
      // This prevents race conditions where events are published before subscription
      ready
        .then(() => triggerWorkflow(runId, workflowInput, tracingOptions))
        .catch(error => {
          void emitError(runId, error);
        });

      // 4. Return stream result - attach extra properties to output for compatibility
      // This allows both destructuring { output, runId, cleanup } AND direct access to fullStream
      const result = {
        output,
        runId,
        threadId,
        resourceId,
        cleanup: streamCleanup,
        // Also expose fullStream directly for server compatibility
        get fullStream() {
          return output.fullStream;
        },
      };

      return result as InngestAgentStreamResult<TOutput>;
    },

    async resume(runId, resumeData, resumeOptions): Promise<InngestAgentStreamResult<TOutput>> {
      // Re-subscribe to the stream
      const {
        output,
        cleanup: streamCleanup,
        ready,
      } = createDurableAgentStream<TOutput>({
        pubsub: getPubsub(),
        runId,
        messageId: crypto.randomUUID(),
        model: {
          modelId: undefined,
          provider: undefined,
          version: 'v3',
        },
        threadId: resumeOptions?.threadId,
        resourceId: resumeOptions?.resourceId,
        onChunk: resumeOptions?.onChunk,
        onStepFinish: resumeOptions?.onStepFinish,
        onFinish: resumeOptions?.onFinish,
        onError: resumeOptions?.onError,
        onSuspended: resumeOptions?.onSuspended,
      });

      // Send resume event to Inngest after subscription is ready
      const eventName = `workflow.${InngestDurableStepIds.AGENTIC_LOOP}.resume`;

      ready
        .then(() =>
          inngest.send({
            name: eventName,
            data: {
              runId,
              resumeData,
            },
          }),
        )
        .catch(error => {
          void emitError(runId, error);
        });

      return {
        output,
        get fullStream() {
          return output.fullStream as ReadableStream<any>;
        },
        runId,
        threadId: resumeOptions?.threadId,
        resourceId: resumeOptions?.resourceId,
        cleanup: streamCleanup,
      };
    },

    async prepare(messages, prepareOptions) {
      const preparation = await prepareForDurableExecution<TOutput>({
        agent: agent as Agent<string, any, TOutput>,
        messages,
        options: prepareOptions,
        requestContext: prepareOptions?.requestContext,
      });

      // Override with durable agent's id/name
      preparation.workflowInput.agentId = agentId;
      preparation.workflowInput.agentName = agentName;

      return {
        runId: preparation.runId,
        messageId: preparation.messageId,
        workflowInput: preparation.workflowInput,
        threadId: preparation.threadId,
        resourceId: preparation.resourceId,
      };
    },

    async observe(runId, observeOptions) {
      // Create the stream subscription with offset support
      const {
        output,
        cleanup: streamCleanup,
        ready,
      } = createDurableAgentStream<TOutput>({
        pubsub: getPubsub(),
        runId,
        messageId: crypto.randomUUID(),
        model: {
          modelId: undefined,
          provider: undefined,
          version: 'v3',
        },
        offset: observeOptions?.offset,
        onChunk: observeOptions?.onChunk,
        onStepFinish: observeOptions?.onStepFinish,
        onFinish: observeOptions?.onFinish,
        onError: observeOptions?.onError,
        onSuspended: observeOptions?.onSuspended,
      });

      await ready;

      return {
        output,
        get fullStream() {
          return output.fullStream as ReadableStream<any>;
        },
        runId,
        cleanup: streamCleanup,
      };
    },

    getDurableWorkflows() {
      return [workflow];
    },

    __setMastra(mastraInstance: Mastra) {
      mastra = mastraInstance;

      // Wire mastra.pubsub as the inner pubsub if user didn't provide a custom one.
      // This must happen before CachingPubSub initialization so the
      // OBSERVE_AGENT_STREAM_ROUTE handler can subscribe to the same instance.
      if (!customPubsub && !_cachingPubsub) {
        innerPubsub = mastraInstance.pubsub;
      }
    },
  };

  // Use a Proxy to forward any unknown property/method calls to the underlying agent
  // This ensures the InngestAgent has all Agent methods (getMemory, etc.) while
  // overriding stream() to use durable execution
  return new Proxy(inngestAgent, {
    get(target, prop, receiver) {
      // First check if the property exists on our InngestAgent object
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      // Otherwise, forward to the underlying agent
      const agentValue = (agent as any)[prop];
      if (typeof agentValue === 'function') {
        return agentValue.bind(agent);
      }
      return agentValue;
    },
    has(target, prop) {
      return prop in target || prop in agent;
    },
  }) as InngestAgent<TOutput>;
}

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Check if an object is an InngestAgent
 */
export function isInngestAgent(obj: any): obj is InngestAgent {
  if (!obj) return false;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    'agent' in obj &&
    'inngest' in obj &&
    typeof obj.stream === 'function' &&
    typeof obj.getDurableWorkflows === 'function'
  );
}

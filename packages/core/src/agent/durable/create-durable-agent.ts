/**
 * Factory function to create a durable agent with resumable streams.
 *
 * This provides a clean API for wrapping a Mastra Agent with caching
 * capabilities for resumable streams. If a client disconnects and
 * reconnects, they can receive missed events.
 *
 * This is the simplest durable agent variant - it uses local execution
 * but adds CachingPubSub for stream resumability.
 *
 * For more advanced durable execution (workflow engine integration),
 * see `createEventedAgent` or `createInngestAgent`.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createDurableAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * // Wrap with resumable streams
 * const durableAgent = createDurableAgent({ agent });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 *
 * // Use the agent - streams are now resumable
 * const { output, cleanup } = await durableAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 *
 * @example Custom cache backend (e.g., Redis)
 * ```typescript
 * import { RedisServerCache } from '@mastra/redis'; // hypothetical
 *
 * const durableAgent = createDurableAgent({
 *   agent,
 *   cache: new RedisServerCache({ url: 'redis://...' }),
 * });
 * ```
 */

import type { MastraServerCache } from '../../cache/base';
import { InMemoryServerCache } from '../../cache/inmemory';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { Mastra } from '../../mastra';
import type { MastraModelOutput, ChunkType } from '../../stream';
import type { Workflow } from '../../workflows';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { MessageListInput } from '../message-list';

import { localExecutor } from './executors';
import type { WorkflowExecutor } from './executors';
import type { AgentFinishEventData, AgentStepFinishEventData, AgentSuspendedEventData } from './types';
import { createDurableAgenticWorkflow } from './workflows';
import { prepareForDurableExecution, createDurableAgentStream, emitErrorEvent } from './index';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for createDurableAgent factory function.
 */
export interface CreateDurableAgentOptions {
  /** The Mastra Agent to wrap with resumable streams */
  agent: Agent<any, any, any>;

  /**
   * Cache instance for storing stream events.
   * Enables resumable streams - clients can disconnect and reconnect
   * without missing events.
   *
   * - If not provided: Uses InMemoryServerCache (default)
   * - If provided: Uses the provided cache backend (e.g., Redis)
   */
  cache?: MastraServerCache;

  /**
   * Custom PubSub instance.
   * If provided, it will be wrapped with CachingPubSub.
   * Defaults to EventEmitterPubSub.
   */
  pubsub?: PubSub;

  /** Optional ID override (defaults to agent.id) */
  id?: string;

  /** Optional name override (defaults to agent.name) */
  name?: string;

  /** Mastra instance (optional, set automatically when registered with Mastra) */
  mastra?: Mastra;

  /** Maximum steps for agentic loop */
  maxSteps?: number;

  /** Custom workflow executor (defaults to local executor) */
  executor?: WorkflowExecutor;
}

/**
 * Options for LocalDurableAgent.stream()
 */
export interface LocalDurableAgentStreamOptions<OUTPUT = undefined> {
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
 * Result from LocalDurableAgent.stream()
 */
export interface LocalDurableAgentStreamResult<OUTPUT = undefined> {
  /** The streaming output */
  output: MastraModelOutput<OUTPUT>;
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
 * A durable agent with resumable streams.
 *
 * This interface represents an agent that uses CachingPubSub for
 * resumable streams. It can be registered with Mastra like a regular Agent.
 */
export interface LocalDurableAgent<TOutput = undefined> {
  /** Agent ID */
  readonly id: string;
  /** Agent name */
  readonly name: string;
  /** The underlying Mastra Agent (for Mastra registration) */
  readonly agent: Agent<any, any, TOutput>;
  /** The PubSub instance (CachingPubSub) */
  readonly pubsub: PubSub;
  /** The cache instance */
  readonly cache: MastraServerCache;

  /**
   * Stream a response with resumable streams.
   */
  stream(
    messages: MessageListInput,
    options?: LocalDurableAgentStreamOptions<TOutput>,
  ): Promise<LocalDurableAgentStreamResult<TOutput>>;

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
  ): Promise<LocalDurableAgentStreamResult<TOutput>>;

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
   * @param options.fromIndex - Resume from this event index (0-based). If omitted, replays all events.
   */
  observe(
    runId: string,
    options?: {
      fromIndex?: number;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<LocalDurableAgentStreamResult<TOutput>, 'threadId' | 'resourceId'> & { runId: string }>;

  /**
   * Get the durable workflows required by this agent.
   * Called by Mastra during agent registration.
   * @internal
   */
  getDurableWorkflows(): Workflow<any, any, any, any, any, any, any>[];

  /**
   * Set the Mastra instance.
   * Called by Mastra during agent registration.
   * @internal
   */
  __setMastra(mastra: Mastra): void;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a durable agent with resumable streams from a Mastra Agent.
 *
 * This factory function wraps a regular Mastra Agent with CachingPubSub
 * for resumable streams. If a client disconnects and reconnects, they
 * can receive missed events from the cache.
 *
 * @param options - Configuration options
 * @returns A LocalDurableAgent that can be registered with Mastra
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are helpful',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createDurableAgent({ agent });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 * ```
 */
export function createDurableAgent<TOutput = undefined>(
  options: CreateDurableAgentOptions,
): LocalDurableAgent<TOutput> {
  const {
    agent,
    cache: customCache,
    pubsub: customPubsub,
    id: idOverride,
    name: nameOverride,
    mastra: mastraOption,
    maxSteps,
    executor = localExecutor,
  } = options;

  // Use provided id/name or fall back to agent.id/agent.name
  const agentId = idOverride ?? agent.id;
  const agentName = nameOverride ?? agent.name;

  // Track mastra instance - can be set later when registered with Mastra
  let _mastra: Mastra | undefined = mastraOption;

  // Create cache and pubsub with caching
  const cache = customCache ?? new InMemoryServerCache();
  const innerPubsub = customPubsub ?? new EventEmitterPubSub();
  const pubsub = new CachingPubSub(innerPubsub, cache);

  // Create the durable workflow for this agent
  const workflow = createDurableAgenticWorkflow({ maxSteps });

  /**
   * Execute the workflow using the configured executor
   */
  async function executeWorkflow(runId: string, workflowInput: any): Promise<void> {
    const result = await executor.execute(workflow, workflowInput, pubsub, runId);
    if (!result.success && result.error) {
      await emitErrorEvent(pubsub, runId, result.error);
    }
  }

  /**
   * Emit an error event to pubsub
   */
  async function emitError(runId: string, error: Error): Promise<void> {
    await emitErrorEvent(pubsub, runId, error);
  }

  // Return the LocalDurableAgent object
  const durableAgent: LocalDurableAgent<TOutput> = {
    get id() {
      return agentId;
    },

    get name() {
      return agentName;
    },

    get agent() {
      return agent as Agent<any, any, TOutput>;
    },

    get pubsub() {
      return pubsub;
    },

    get cache() {
      return cache;
    },

    async stream(messages, streamOptions): Promise<LocalDurableAgentStreamResult<TOutput>> {
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

      // 2. Create the durable agent stream (subscribes to pubsub with replay)
      const { output, cleanup: streamCleanup } = createDurableAgentStream<TOutput>({
        pubsub,
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

      // 3. Execute the workflow (async, don't await)
      void executeWorkflow(runId, workflowInput).catch(error => {
        void emitError(runId, error);
      });

      // 4. Create cleanup function that also clears cache
      const cleanup = () => {
        streamCleanup();
        // Clear cache for this run after a delay to allow reconnections
        setTimeout(
          () => {
            void pubsub.clearTopic(`agent.stream.${runId}`);
          },
          5 * 60 * 1000,
        ); // 5 minutes
      };

      // 5. Return stream result
      const result = {
        output,
        runId,
        threadId,
        resourceId,
        cleanup,
        // Also expose fullStream directly for server compatibility
        get fullStream() {
          return output.fullStream;
        },
      };

      return result as LocalDurableAgentStreamResult<TOutput>;
    },

    async resume(runId, resumeData, resumeOptions): Promise<LocalDurableAgentStreamResult<TOutput>> {
      // Re-subscribe to the stream (with replay for missed events)
      const { output, cleanup: streamCleanup } = createDurableAgentStream<TOutput>({
        pubsub,
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

      // Resume the workflow
      void executor.resume(workflow, pubsub, runId, resumeData).then(result => {
        if (!result.success && result.error) {
          void emitError(runId, result.error);
        }
      });

      return {
        output,
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
      // Subscribe to the stream with replay from the specified index
      const { output, cleanup } = createDurableAgentStream<TOutput>({
        pubsub,
        runId,
        messageId: crypto.randomUUID(),
        model: {
          modelId: undefined,
          provider: undefined,
          version: 'v3',
        },
        fromIndex: observeOptions?.fromIndex,
        onChunk: observeOptions?.onChunk,
        onStepFinish: observeOptions?.onStepFinish,
        onFinish: observeOptions?.onFinish,
        onError: observeOptions?.onError,
        onSuspended: observeOptions?.onSuspended,
      });

      return {
        output,
        runId,
        cleanup,
      };
    },

    getDurableWorkflows() {
      return [workflow];
    },

    __setMastra(mastraInstance: Mastra) {
      _mastra = mastraInstance;
    },
  };

  // Use a Proxy to forward any unknown property/method calls to the underlying agent
  // This ensures the LocalDurableAgent has all Agent methods (getMemory, etc.) while
  // overriding stream() to use durable execution with resumable streams
  return new Proxy(durableAgent, {
    get(target, prop, receiver) {
      // First check if the property exists on our LocalDurableAgent object
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
  }) as LocalDurableAgent<TOutput>;
}

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Check if an object is a LocalDurableAgent
 */
export function isLocalDurableAgent(obj: any): obj is LocalDurableAgent {
  if (!obj) return false;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    'agent' in obj &&
    'pubsub' in obj &&
    'cache' in obj &&
    typeof obj.stream === 'function' &&
    typeof obj.getDurableWorkflows === 'function'
  );
}

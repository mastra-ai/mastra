/**
 * Factory function to create an Evented durable agent.
 *
 * This provides a clean API for wrapping a Mastra Agent with the built-in
 * evented workflow engine for durable execution. The returned object can be
 * registered with Mastra like any other agent.
 *
 * Unlike Inngest which requires an external dev server, the evented agent
 * uses the built-in workflow engine with fire-and-forget execution via pubsub.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createEventedAgent } from '@mastra/core/agent/durable';
 * import { EventEmitterPubSub } from '@mastra/core/events';
 *
 * const pubsub = new EventEmitterPubSub();
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createEventedAgent({ agent, pubsub });
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

import type { MastraServerCache } from '../../cache/base';
import { CachingPubSub } from '../../events/caching-pubsub';
import type { PubSub } from '../../events/pubsub';
import type { Mastra } from '../../mastra';
import type { MastraModelOutput, ChunkType } from '../../stream';
import type { Workflow } from '../../workflows';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { MessageListInput } from '../message-list';

import type { AgentFinishEventData, AgentStepFinishEventData, AgentSuspendedEventData } from './types';
import { createDurableAgenticWorkflow } from './workflows';
import { prepareForDurableExecution, createDurableAgentStream, emitErrorEvent } from './index';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for createEventedAgent factory function.
 */
export interface CreateEventedAgentOptions {
  /** The Mastra Agent to wrap with durable execution */
  agent: Agent<any, any, any>;
  /** PubSub instance for streaming events */
  pubsub: PubSub;
  /**
   * Cache instance for storing stream events.
   * Enables resumable streams - clients can disconnect and reconnect
   * without missing events.
   *
   * When provided, the pubsub is wrapped with CachingPubSub.
   */
  cache?: MastraServerCache;
  /** Optional ID override (defaults to agent.id) */
  id?: string;
  /** Optional name override (defaults to agent.name) */
  name?: string;
  /** Mastra instance (optional, set automatically when registered with Mastra) */
  mastra?: Mastra;
  /** Maximum steps for agentic loop */
  maxSteps?: number;
}

/**
 * Options for EventedAgent.stream()
 */
export interface EventedAgentStreamOptions<OUTPUT = undefined> {
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
 * Result from EventedAgent.stream()
 */
export interface EventedAgentStreamResult<OUTPUT = undefined> {
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
 * An Evented durable agent.
 *
 * This interface represents an agent that uses the built-in evented workflow
 * engine for durable execution. It can be registered with Mastra like a
 * regular Agent.
 */
export interface EventedAgent<TOutput = undefined> {
  /** Agent ID */
  readonly id: string;
  /** Agent name */
  readonly name: string;
  /** The underlying Mastra Agent (for Mastra registration) */
  readonly agent: Agent<any, any, TOutput>;
  /** The PubSub instance (may be wrapped with CachingPubSub if cache was provided) */
  readonly pubsub: PubSub;
  /** The cache instance if resumable streams are enabled */
  readonly cache?: MastraServerCache;

  /**
   * Stream a response using evented durable execution.
   */
  stream(
    messages: MessageListInput,
    options?: EventedAgentStreamOptions<TOutput>,
  ): Promise<EventedAgentStreamResult<TOutput>>;

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
  ): Promise<EventedAgentStreamResult<TOutput>>;

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
  ): Promise<Omit<EventedAgentStreamResult<TOutput>, 'threadId' | 'resourceId'> & { runId: string }>;

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
 * Create an Evented durable agent from a Mastra Agent.
 *
 * This factory function wraps a regular Mastra Agent with the built-in
 * evented workflow engine for durable execution. The returned EventedAgent
 * can be registered with Mastra.
 *
 * @param options - Configuration options
 * @returns An EventedAgent that can be registered with Mastra
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are helpful',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createEventedAgent({ agent, pubsub });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 * ```
 */
export function createEventedAgent<TOutput = undefined>(options: CreateEventedAgentOptions): EventedAgent<TOutput> {
  const {
    agent,
    pubsub: innerPubsub,
    cache,
    id: idOverride,
    name: nameOverride,
    mastra: mastraOption,
    maxSteps,
  } = options;

  // Use provided id/name or fall back to agent.id/agent.name
  const agentId = idOverride ?? agent.id;
  const agentName = nameOverride ?? agent.name;

  // Track mastra instance - can be set later when registered with Mastra
  let _mastra: Mastra | undefined = mastraOption;

  // Set up pubsub with caching for resumable streams
  // CachingPubSub is an internal implementation detail - users just configure cache and pubsub separately
  const pubsub = cache ? new CachingPubSub(innerPubsub, cache) : innerPubsub;

  // Create the durable workflow for this agent
  const workflow = createDurableAgenticWorkflow({ maxSteps });

  /**
   * Execute the workflow using fire-and-forget pattern
   */
  async function executeWorkflow(runId: string, workflowInput: any): Promise<void> {
    try {
      const run = await workflow.createRun({ runId, pubsub });
      // Fire and forget - use startAsync for non-blocking execution
      await run.startAsync({ inputData: workflowInput });
    } catch (error) {
      await emitErrorEvent(pubsub, runId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Emit an error event to pubsub
   */
  async function emitError(runId: string, error: Error): Promise<void> {
    await emitErrorEvent(pubsub, runId, error);
  }

  // Return the EventedAgent object
  const eventedAgent: EventedAgent<TOutput> = {
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

    async stream(messages, streamOptions): Promise<EventedAgentStreamResult<TOutput>> {
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

      // 2. Create the durable agent stream (subscribes to pubsub)
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
      // Small delay to allow subscription to establish before workflow starts emitting
      setTimeout(() => {
        void executeWorkflow(runId, workflowInput).catch(error => {
          void emitError(runId, error);
        });
      }, 100);

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

      return result as EventedAgentStreamResult<TOutput>;
    },

    async resume(runId, resumeData, resumeOptions): Promise<EventedAgentStreamResult<TOutput>> {
      // Re-subscribe to the stream
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
      try {
        const run = await workflow.createRun({ runId, pubsub });
        void run.resume({ resumeData }).catch(error => {
          void emitError(runId, error);
        });
      } catch (error) {
        void emitError(runId, error instanceof Error ? error : new Error(String(error)));
      }

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
      // Create the stream subscription with fromIndex support
      const { output, cleanup: streamCleanup } = createDurableAgentStream<TOutput>({
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
        cleanup: streamCleanup,
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
  // This ensures the EventedAgent has all Agent methods (getMemory, etc.) while
  // overriding stream() to use durable execution
  return new Proxy(eventedAgent, {
    get(target, prop, receiver) {
      // First check if the property exists on our EventedAgent object
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
  }) as EventedAgent<TOutput>;
}

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Check if an object is an EventedAgent
 */
export function isEventedAgent(obj: any): obj is EventedAgent {
  if (!obj) return false;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    'agent' in obj &&
    'pubsub' in obj &&
    typeof obj.stream === 'function' &&
    typeof obj.getDurableWorkflows === 'function'
  );
}

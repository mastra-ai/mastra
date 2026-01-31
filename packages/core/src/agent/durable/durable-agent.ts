import type { MastraServerCache } from '../../cache/base';
import { InMemoryServerCache } from '../../cache/inmemory';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { MastraModelOutput } from '../../stream/base/output';
import type { ChunkType } from '../../stream/types';
// Import directly from agent file to avoid circular dependency
// (../agent/index.ts used to re-export from ./durable which caused cycles)
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { MessageListInput } from '../message-list';
import type { AgentConfig, ToolsInput } from '../types';

import { localExecutor } from './executors';
import type { WorkflowExecutor } from './executors';
import { prepareForDurableExecution } from './preparation';
import { ExtendedRunRegistry, globalRunRegistry } from './run-registry';
import { createDurableAgentStream, emitErrorEvent } from './stream-adapter';
import type { AgentFinishEventData, AgentStepFinishEventData, AgentSuspendedEventData } from './types';
import { createDurableAgenticWorkflow } from './workflows';

/**
 * Options for DurableAgent.stream()
 */
export interface DurableAgentStreamOptions<OUTPUT = undefined> {
  /** Custom instructions that override the agent's default instructions for this execution */
  instructions?: AgentExecutionOptions<OUTPUT>['instructions'];
  /** Additional context messages to provide to the agent */
  context?: AgentExecutionOptions<OUTPUT>['context'];
  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentExecutionOptions<OUTPUT>['memory'];
  /** Unique identifier for this execution run */
  runId?: string;
  /** Request Context containing dynamic configuration and state */
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /** Maximum number of steps to run */
  maxSteps?: number;
  /** Additional tool sets that can be used for this execution */
  toolsets?: AgentExecutionOptions<OUTPUT>['toolsets'];
  /** Client-side tools available during execution */
  clientTools?: AgentExecutionOptions<OUTPUT>['clientTools'];
  /** Tool selection strategy */
  toolChoice?: AgentExecutionOptions<OUTPUT>['toolChoice'];
  /** Model-specific settings like temperature */
  modelSettings?: AgentExecutionOptions<OUTPUT>['modelSettings'];
  /** Require approval for all tool calls */
  requireToolApproval?: boolean;
  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;
  /** Maximum number of tool calls to execute concurrently */
  toolCallConcurrency?: number;
  /** Whether to include raw chunks in the stream output */
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
  /** Callback when workflow suspends (e.g., for tool approval) */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
}

/**
 * Result from DurableAgent.stream()
 */
export interface DurableAgentStreamResult<OUTPUT = undefined> {
  /** The streaming output */
  output: MastraModelOutput<OUTPUT>;
  /** The unique run ID for this execution */
  runId: string;
  /** Thread ID if using memory */
  threadId?: string;
  /** Resource ID if using memory */
  resourceId?: string;
  /** Cleanup function to call when done (unsubscribes from pubsub) */
  cleanup: () => void;
}

/**
 * Configuration for DurableAgent
 */
export interface DurableAgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends AgentConfig<TAgentId, TTools, TOutput> {
  /**
   * PubSub instance for streaming events.
   * Optional - if not provided, defaults to EventEmitterPubSub wrapped
   * with CachingPubSub for resumable streams.
   *
   * If provided, it will be wrapped with CachingPubSub unless
   * `cache` is explicitly set to `false`.
   */
  pubsub?: PubSub;

  /**
   * Cache instance for storing stream events.
   * Enables resumable streams - clients can disconnect and reconnect
   * without missing events.
   *
   * - If not provided: Uses InMemoryServerCache (default)
   * - If provided: Uses the provided cache backend (e.g., Redis)
   * - If set to `false`: Disables caching (streams are not resumable)
   */
  cache?: MastraServerCache | false;

  /**
   * Workflow executor for running the durable workflow.
   * Defaults to LocalWorkflowExecutor (direct execution).
   *
   * For fire-and-forget execution, use createEventedAgent() factory
   * which uses the built-in workflow engine with startAsync().
   */
  executor?: WorkflowExecutor;

  /**
   * Maximum steps for the agentic loop.
   * Defaults to the workflow default if not specified.
   */
  maxSteps?: number;
}

/**
 * DurableAgent extends Agent to support durable execution patterns.
 *
 * Unlike the standard Agent, DurableAgent:
 * 1. Separates preparation (non-durable) from execution (durable)
 * 2. Uses pubsub for streaming instead of closures
 * 3. Stores non-serializable state in a registry keyed by runId
 * 4. Creates fully serializable workflow inputs
 *
 * This enables the agent to work with durable execution engines like
 * Cloudflare Workflows, Inngest, Temporal, etc. that replay workflow
 * code and require serializable state.
 *
 * DurableAgent extends Agent, so it has all the same methods (getModel,
 * listTools, getInstructions, etc.) and can be used anywhere an Agent is expected.
 *
 * Subclasses (EventedAgent, InngestAgent) can override the protected methods
 * `executeWorkflow()` and `createWorkflow()` to customize execution behavior.
 *
 * @example
 * ```typescript
 * import { DurableAgent } from '@mastra/core/agent/durable';
 *
 * // DurableAgent automatically uses CachingPubSub for resumable streams
 * const durableAgent = new DurableAgent({
 *   id: 'my-durable-agent',
 *   name: 'My Durable Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: 'openai/gpt-4',
 *   tools: { ... },
 * });
 *
 * const { output, runId, cleanup } = await durableAgent.stream(
 *   'Hello!',
 *   {
 *     onChunk: (chunk) => console.log('Chunk:', chunk),
 *     onFinish: (result) => console.log('Done:', result),
 *   }
 * );
 *
 * // Consume the stream
 * const text = await output.text;
 * console.log('Final text:', text);
 *
 * // Cleanup when done
 * cleanup();
 * ```
 *
 * @example Custom cache backend (e.g., Redis)
 * ```typescript
 * import { DurableAgent } from '@mastra/core/agent/durable';
 * import { RedisServerCache } from '@mastra/redis'; // hypothetical
 *
 * const durableAgent = new DurableAgent({
 *   id: 'my-durable-agent',
 *   model: 'openai/gpt-4',
 *   cache: new RedisServerCache({ url: 'redis://...' }),
 * });
 * ```
 *
 * @example Disable caching (non-resumable streams)
 * ```typescript
 * const durableAgent = new DurableAgent({
 *   id: 'my-durable-agent',
 *   model: 'openai/gpt-4',
 *   cache: false, // Streams are not resumable
 * });
 * ```
 */
export class DurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends Agent<TAgentId, TTools, TOutput> {
  /** PubSub instance for streaming events */
  readonly #pubsub: PubSub;

  /** Workflow executor for running the durable workflow */
  readonly #executor: WorkflowExecutor;

  /** Registry for per-run non-serializable state */
  readonly #runRegistry: ExtendedRunRegistry;

  /** The durable workflow for agent execution */
  #workflow: ReturnType<typeof createDurableAgenticWorkflow> | null = null;

  /** Cache instance (if caching is enabled) */
  readonly #cache: MastraServerCache | null;

  /** Maximum steps for the agentic loop */
  readonly #maxSteps?: number;

  /**
   * Create a new DurableAgent
   */
  constructor(config: DurableAgentConfig<TAgentId, TTools, TOutput>) {
    // Extract durable-specific config and pass the rest to Agent
    const { pubsub, executor, cache, maxSteps, ...agentConfig } = config;

    // Default name to id if not provided (backwards compatibility)
    if (!agentConfig.name) {
      agentConfig.name = agentConfig.id;
    }

    // Call the Agent constructor
    super(agentConfig);

    this.#executor = executor ?? localExecutor;
    this.#runRegistry = new ExtendedRunRegistry();
    this.#maxSteps = maxSteps;

    // Set up PubSub with caching for resumable streams
    // CachingPubSub is an internal implementation detail - users just configure cache and pubsub separately
    if (cache === false) {
      // Caching explicitly disabled
      this.#pubsub = pubsub ?? new EventEmitterPubSub();
      this.#cache = null;
    } else {
      // Wrap pubsub with CachingPubSub
      const cacheInstance = cache ?? new InMemoryServerCache();
      const innerPubsub = pubsub ?? new EventEmitterPubSub();
      this.#cache = cacheInstance;
      this.#pubsub = new CachingPubSub(innerPubsub, cacheInstance);
    }
  }

  /**
   * Get the underlying agent instance.
   * For DurableAgent, this returns `this` since DurableAgent extends Agent.
   *
   * @deprecated This property is deprecated. DurableAgent now extends Agent,
   * so you can use DurableAgent directly wherever an Agent is expected.
   */
  get agent(): Agent<TAgentId, TTools, TOutput> {
    // Type assertion needed because DurableAgent.stream() has a different signature
    // than Agent.stream(). This is intentional - DurableAgent provides a durable
    // execution API with different options and return types.
    return this as unknown as Agent<TAgentId, TTools, TOutput>;
  }

  /**
   * Get the run registry (for testing and advanced usage)
   */
  get runRegistry(): ExtendedRunRegistry {
    return this.#runRegistry;
  }

  /**
   * Get the cache instance (if caching is enabled).
   * Returns null if caching was disabled via `cache: false`.
   */
  get cache(): MastraServerCache | null {
    return this.#cache;
  }

  /**
   * Get the PubSub instance.
   * This will be a CachingPubSub if caching is enabled.
   */
  get pubsub(): PubSub {
    return this.#pubsub;
  }

  /**
   * Get the max steps configured for this agent
   */
  get maxSteps(): number | undefined {
    return this.#maxSteps;
  }

  // ===========================================================================
  // Protected methods for subclass overrides
  // ===========================================================================

  /**
   * Get the PubSub instance for use by subclasses.
   * @internal
   */
  protected get pubsubInternal(): PubSub {
    return this.#pubsub;
  }

  /**
   * Get the run registry for use by subclasses.
   * @internal
   */
  protected get runRegistryInternal(): ExtendedRunRegistry {
    return this.#runRegistry;
  }

  /**
   * Execute the durable workflow.
   *
   * Subclasses override this method to customize how the workflow is executed:
   * - DurableAgent (this): Uses executor.execute() for direct local execution
   * - EventedAgent: Uses run.startAsync() for fire-and-forget execution
   * - InngestAgent: Uses inngest.send() to trigger Inngest function
   *
   * @param runId - The unique run ID
   * @param workflowInput - The serialized workflow input
   * @internal
   */
  protected async executeWorkflow(runId: string, workflowInput: any): Promise<void> {
    const workflow = this.getWorkflow();
    const result = await this.#executor.execute(workflow, workflowInput, this.#pubsub, runId);

    if (!result.success && result.error) {
      await this.emitError(runId, result.error);
    }
  }

  /**
   * Create the durable workflow for this agent.
   *
   * Subclasses can override this method to use a different workflow implementation:
   * - DurableAgent (this): Uses createDurableAgenticWorkflow()
   * - InngestAgent: Uses createInngestDurableAgenticWorkflow()
   *
   * @internal
   */
  protected createWorkflow(): ReturnType<typeof createDurableAgenticWorkflow> {
    return createDurableAgenticWorkflow({
      maxSteps: this.#maxSteps,
    });
  }

  /**
   * Emit an error event to pubsub.
   *
   * @param runId - The run ID
   * @param error - The error to emit
   * @internal
   */
  protected async emitError(runId: string, error: Error): Promise<void> {
    await emitErrorEvent(this.#pubsub, runId, error);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Stream a response from the agent using durable execution.
   *
   * This method:
   * 1. Prepares for execution (non-durable phase)
   * 2. Sets up pubsub subscription for streaming
   * 3. Executes the durable workflow
   * 4. Returns a MastraModelOutput that streams from pubsub events
   *
   * Note: This method has a different signature than Agent.stream() because
   * durable execution requires different options (callbacks, cleanup) and
   * returns additional metadata (runId, threadId, resourceId, cleanup).
   *
   * @param messages - User messages to process
   * @param options - Execution options including callbacks
   * @returns Promise containing the streaming output and run metadata
   */
  // @ts-expect-error - Intentionally different signature for durable execution
  async stream(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    // 1. Prepare for durable execution (non-durable phase)
    // Note: We use `this` directly since DurableAgent extends Agent
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this as unknown as Agent<string, any, TOutput>,
      messages,
      options: options as AgentExecutionOptions<TOutput>,
      runId: options?.runId,
      requestContext: options?.requestContext,
    });

    const { runId, messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;

    // 2. Register non-serializable state (both local and global registries)
    this.#runRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
    globalRunRegistry.set(runId, registryEntry);

    // 3. Create the durable agent stream (subscribes to pubsub)
    const { output, cleanup: streamCleanup } = createDurableAgentStream<TOutput>({
      pubsub: this.#pubsub,
      runId,
      messageId,
      model: {
        modelId: workflowInput.modelConfig.modelId,
        provider: workflowInput.modelConfig.provider,
        version: 'v3', // Using v3 for the new streaming format
      },
      threadId,
      resourceId,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onError: options?.onError,
      onSuspended: options?.onSuspended,
    });

    // 4. Execute the workflow (async, don't await)
    // The workflow will emit events to pubsub as it executes
    this.executeWorkflow(runId, workflowInput).catch(error => {
      // Emit error to pubsub so the stream receives it
      void this.emitError(runId, error);
    });

    // 5. Create cleanup function
    const cleanup = () => {
      streamCleanup();
      this.#runRegistry.cleanup(runId);
      globalRunRegistry.delete(runId);
    };

    return {
      output,
      runId,
      threadId,
      resourceId,
      cleanup,
    };
  }

  /**
   * Resume a suspended workflow execution.
   *
   * When a workflow suspends (e.g., for tool approval), you can resume it
   * by calling this method with the run ID and resume data.
   *
   * @param runId - The run ID of the suspended workflow
   * @param resumeData - Data to provide to the workflow on resume
   * @param options - Additional options for the resume operation
   */
  async resume(
    runId: string,
    resumeData: unknown,
    options?: {
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<DurableAgentStreamResult<TOutput>> {
    // Check if we have state for this run
    const entry = this.#runRegistry.get(runId);
    if (!entry) {
      throw new Error(`No registry entry found for run ${runId}. Cannot resume.`);
    }

    const memoryInfo = this.#runRegistry.getMemoryInfo(runId);

    // Re-subscribe to the stream
    const { output, cleanup: streamCleanup } = createDurableAgentStream<TOutput>({
      pubsub: this.#pubsub,
      runId,
      messageId: crypto.randomUUID(), // New message ID for resume
      model: {
        modelId: undefined, // Will be determined by workflow
        provider: undefined,
        version: 'v3',
      },
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onError: options?.onError,
      onSuspended: options?.onSuspended,
    });

    // Resume the workflow using the executor
    const workflow = this.getWorkflow();
    void this.#executor.resume(workflow, this.#pubsub, runId, resumeData).then(result => {
      if (!result.success && result.error) {
        void this.emitError(runId, result.error);
      }
    });

    const cleanup = () => {
      streamCleanup();
      this.#runRegistry.cleanup(runId);
    };

    return {
      output,
      runId,
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      cleanup,
    };
  }

  /**
   * Observe an existing stream.
   *
   * Use this to reconnect to a stream after a network disconnection.
   * Unlike `resume()`, this does NOT re-execute the workflow - it only
   * subscribes to receive events.
   *
   * @param runId - The run ID to observe
   * @param options - Observation options
   * @param options.fromIndex - Resume from this position (0 = full replay, default)
   * @param options.onChunk - Callback for each chunk
   * @param options.onFinish - Callback when stream completes
   * @param options.onError - Callback on error
   *
   * @example
   * ```typescript
   * // Start a stream
   * const { output, runId } = await agent.stream('Hello');
   *
   * // ... connection drops ...
   *
   * // Reconnect to the same stream
   * const { output: resumed } = await agent.observe(runId, {
   *   fromIndex: lastReceivedIndex + 1,
   * });
   * ```
   */
  async observe(
    runId: string,
    options?: {
      fromIndex?: number;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string }> {
    // Get memory info if available
    const memoryInfo = this.#runRegistry.getMemoryInfo(runId);

    // Create the stream subscription with fromIndex support
    const { output, cleanup: streamCleanup } = createDurableAgentStream<TOutput>({
      pubsub: this.#pubsub,
      runId,
      messageId: crypto.randomUUID(),
      model: {
        modelId: undefined,
        provider: undefined,
        version: 'v3',
      },
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      fromIndex: options?.fromIndex,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onError: options?.onError,
      onSuspended: options?.onSuspended,
    });

    const cleanup = () => {
      streamCleanup();
    };

    return {
      output,
      runId,
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      cleanup,
    };
  }

  /**
   * Get the workflow instance for direct execution.
   *
   * This is useful when you want to integrate the durable workflow
   * into a larger workflow or use it with a specific execution engine.
   *
   * @returns The durable agentic workflow
   */
  getWorkflow() {
    if (!this.#workflow) {
      this.#workflow = this.createWorkflow();
    }
    return this.#workflow;
  }

  /**
   * Prepare for durable execution without starting it.
   *
   * This is useful when you want to:
   * 1. Prepare the workflow input in one process
   * 2. Execute the workflow in another process (e.g., Cloudflare Worker)
   *
   * @param messages - User messages to process
   * @param options - Execution options
   * @returns The serialized workflow input and metadata
   */
  async prepare(messages: MessageListInput, options?: AgentExecutionOptions<TOutput>) {
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this as unknown as Agent<string, any, TOutput>,
      messages,
      options,
      requestContext: options?.requestContext,
    });

    // Register the entry for later execution
    this.#runRegistry.registerWithMessageList(preparation.runId, preparation.registryEntry, preparation.messageList, {
      threadId: preparation.threadId,
      resourceId: preparation.resourceId,
    });

    return {
      runId: preparation.runId,
      messageId: preparation.messageId,
      workflowInput: preparation.workflowInput,
      threadId: preparation.threadId,
      resourceId: preparation.resourceId,
    };
  }
}

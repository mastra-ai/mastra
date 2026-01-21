import type { PubSub } from '../../events/pubsub';
import type { MastraModelOutput } from '../../stream/base/output';
import type { ChunkType } from '../../stream/types';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { MessageListInput } from '../message-list';
import type { AgentConfig, ToolsInput } from '../types';

import { prepareForDurableExecution } from './preparation';
import { ExtendedRunRegistry } from './run-registry';
import { createDurableAgentStream } from './stream-adapter';
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
   * Required for durable agent execution as it enables streaming
   * across process boundaries and execution engine replays.
   */
  pubsub: PubSub;
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
 * @example
 * ```typescript
 * import { DurableAgent } from '@mastra/core/agent/durable';
 * import { InMemoryPubSub } from '@mastra/core/events';
 *
 * const pubsub = new InMemoryPubSub();
 *
 * const durableAgent = new DurableAgent({
 *   id: 'my-durable-agent',
 *   name: 'My Durable Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: 'openai/gpt-4',
 *   tools: { ... },
 *   pubsub,
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
 */
export class DurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> {
  /** The underlying agent instance (lazily initialized) */
  #agent!: Agent<TAgentId, TTools, TOutput> | null;

  /** PubSub instance for streaming events */
  readonly #pubsub: PubSub;

  /** Registry for per-run non-serializable state */
  readonly #runRegistry: ExtendedRunRegistry;

  /** The durable workflow for agent execution */
  #workflow: ReturnType<typeof createDurableAgenticWorkflow> | null = null;

  /** Whether the agent has been initialized */
  #initialized = false;
  /** Pending initialization promise */
  #initPromise: Promise<void> | null = null;
  /** Agent config stored for deferred initialization */
  readonly #agentConfig: Omit<DurableAgentConfig<TAgentId, TTools, TOutput>, 'pubsub'>;

  /**
   * Create a new DurableAgent
   */
  constructor(config: DurableAgentConfig<TAgentId, TTools, TOutput>) {
    const { pubsub, ...agentConfig } = config;

    this.#agentConfig = agentConfig;
    this.#pubsub = pubsub;
    this.#runRegistry = new ExtendedRunRegistry();
    this.#agent = null; // Agent will be initialized lazily on first use
  }

  /**
   * Initialize the underlying Agent (lazy initialization to handle ESM)
   */
  async #ensureInitialized(): Promise<void> {
    if (this.#initialized) return;

    if (!this.#initPromise) {
      this.#initPromise = (async () => {
        // Use dynamic import for ESM compatibility
        const { Agent } = await import('../agent');
        this.#agent = new Agent(this.#agentConfig);
        this.#initialized = true;
      })();
    }

    await this.#initPromise;
  }

  /**
   * Get the underlying agent (must be called after initialization)
   * @throws Error if called before async initialization
   */
  #getAgent(): Agent<TAgentId, TTools, TOutput> {
    if (!this.#initialized || !this.#agent) {
      throw new Error('DurableAgent not initialized. Call an async method first (stream, prepare, etc).');
    }
    return this.#agent;
  }

  /**
   * Get the underlying agent instance.
   * Note: This will throw if called before any async method (stream, prepare, etc).
   * For synchronous access to agent properties, use `id` or `name` from the config.
   */
  get agent(): Agent<TAgentId, TTools, TOutput> {
    return this.#getAgent();
  }

  /**
   * Get the agent ID.
   * This is available synchronously from the config.
   */
  get id(): TAgentId {
    return this.#agentConfig.id;
  }

  /**
   * Get the agent name.
   * This is available synchronously from the config.
   */
  get name(): string {
    return this.#agentConfig.name || this.#agentConfig.id;
  }

  /**
   * Get the run registry (for testing and advanced usage)
   */
  get runRegistry(): ExtendedRunRegistry {
    return this.#runRegistry;
  }

  /**
   * Stream a response from the agent using durable execution.
   *
   * This method:
   * 1. Prepares for execution (non-durable phase)
   * 2. Sets up pubsub subscription for streaming
   * 3. Executes the durable workflow
   * 4. Returns a MastraModelOutput that streams from pubsub events
   *
   * @param messages - User messages to process
   * @param options - Execution options including callbacks
   * @returns Promise containing the streaming output and run metadata
   */
  async stream(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    // Ensure the agent is initialized
    await this.#ensureInitialized();

    // 1. Prepare for durable execution (non-durable phase)
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#getAgent() as Agent<string, any, TOutput>,
      messages,
      options: options as AgentExecutionOptions<TOutput>,
      runId: options?.runId,
      requestContext: options?.requestContext,
    });

    const { runId, messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;

    // 2. Register non-serializable state
    this.#runRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });

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

    // 4. Get or create the durable workflow
    if (!this.#workflow) {
      this.#workflow = createDurableAgenticWorkflow({
        runRegistry: this.#runRegistry,
        maxSteps: options?.maxSteps,
      });
    }

    // 5. Execute the workflow (async, don't await)
    // The workflow will emit events to pubsub as it executes
    this.#executeWorkflow(runId, workflowInput).catch(error => {
      // Emit error to pubsub so the stream receives it
      this.#emitError(runId, error);
    });

    // 6. Create cleanup function
    const cleanup = () => {
      streamCleanup();
      this.#runRegistry.cleanup(runId);
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
   * Execute the durable workflow.
   * This is called asynchronously after stream() returns.
   */
  async #executeWorkflow(runId: string, workflowInput: any): Promise<void> {
    if (!this.#workflow) {
      throw new Error('Workflow not initialized');
    }

    try {
      // Create a run and start it
      const run = await this.#workflow.createRun({ runId });
      const result = await run.start({ inputData: workflowInput });

      // Check for errors in result
      if (result?.status === 'failed') {
        const error = new Error((result as any).error?.message || 'Workflow execution failed');
        await this.#emitError(runId, error);
        return;
      }

      // Success - finish event should have been emitted by the workflow steps
    } catch (error) {
      await this.#emitError(runId, error as Error);
    }
  }

  /**
   * Emit an error event to pubsub
   */
  async #emitError(runId: string, error: Error): Promise<void> {
    const { emitErrorEvent } = await import('./stream-adapter');
    await emitErrorEvent(this.#pubsub, runId, error);
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

    // Resume the workflow
    if (this.#workflow) {
      (async () => {
        const run = await this.#workflow!.createRun({ runId });
        await run.resume({ resumeData });
      })().catch((error: Error) => {
        this.#emitError(runId, error);
      });
    }

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
   * Get the workflow instance for direct execution.
   *
   * This is useful when you want to integrate the durable workflow
   * into a larger workflow or use it with a specific execution engine.
   *
   * @returns The durable agentic workflow
   */
  getWorkflow() {
    if (!this.#workflow) {
      this.#workflow = createDurableAgenticWorkflow({
        runRegistry: this.#runRegistry,
      });
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
    // Ensure the agent is initialized
    await this.#ensureInitialized();

    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#getAgent() as Agent<string, any, TOutput>,
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

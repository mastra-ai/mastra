import type { Agent } from '@mastra/core/agent';
import type { AgentExecutionOptions } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { AgentConfig, ToolsInput } from '@mastra/core/agent';
import type { PubSub } from '@mastra/core/events';
import type { MastraModelOutput } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';
import {
  prepareForDurableExecution,
  createDurableAgentStream,
  emitErrorEvent,
  DurableStepIds,
  type AgentFinishEventData,
  type AgentStepFinishEventData,
  type AgentSuspendedEventData,
} from '@mastra/core/agent/durable';
import type { Inngest } from 'inngest';

import { InngestPubSub } from '../pubsub';

/**
 * Options for InngestDurableAgent.stream()
 */
export interface InngestDurableAgentStreamOptions<OUTPUT = undefined> {
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
 * Result from InngestDurableAgent.stream()
 */
export interface InngestDurableAgentStreamResult<OUTPUT = undefined> {
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
 * Configuration for InngestDurableAgent
 */
export interface InngestDurableAgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends AgentConfig<TAgentId, TTools, TOutput> {
  /**
   * Inngest client instance.
   * Required for durable agent execution through Inngest's execution engine.
   */
  inngest: Inngest;
  /**
   * Optional PubSub instance override.
   * If not provided, defaults to InngestPubSub for Inngest realtime streaming.
   */
  pubsub?: PubSub;
}

/**
 * InngestDurableAgent provides durable AI agent execution through Inngest.
 *
 * This class enables AI agents to run with Inngest's durable execution engine,
 * providing:
 * - Automatic retries and error handling
 * - Workflow persistence across process restarts
 * - Real-time streaming via Inngest's realtime system
 * - Tool approval workflows with suspend/resume
 *
 * IMPORTANT: Before using InngestDurableAgent, you must:
 * 1. Create the shared workflow using createInngestDurableAgenticWorkflow()
 * 2. Register it with Mastra
 * 3. Register the agent with Mastra so the workflow can look it up
 *
 * @example
 * ```typescript
 * import { InngestDurableAgent, createInngestDurableAgenticWorkflow, serve as inngestServe } from '@mastra/inngest';
 * import { Mastra } from '@mastra/core/mastra';
 * import { Inngest } from 'inngest';
 *
 * const inngest = new Inngest({ id: 'my-app' });
 *
 * // 1. Create the shared workflow (once per Inngest client)
 * const durableAgentWorkflow = createInngestDurableAgenticWorkflow({ inngest });
 *
 * // 2. Create the agent
 * const agent = new InngestDurableAgent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 *   inngest,
 * });
 *
 * // 3. Initialize the agent to get the underlying Agent instance
 * await agent.prepare([{ role: 'user', content: 'init' }]);
 *
 * // 4. Register both workflow AND agent with Mastra
 * const mastra = new Mastra({
 *   agents: { [agent.id]: agent.agent },
 *   workflows: { [durableAgentWorkflow.id]: durableAgentWorkflow },
 *   server: {
 *     apiRoutes: [{
 *       path: '/inngest/api',
 *       method: 'ALL',
 *       createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
 *     }],
 *   },
 * });
 *
 * // 5. Now use the agent
 * const { output, cleanup } = await agent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */
export class InngestDurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> {
  /** The underlying agent instance (lazily initialized) */
  #agent!: Agent<TAgentId, TTools, TOutput> | null;

  /** Inngest client instance */
  readonly #inngest: Inngest;

  /** PubSub instance for streaming events */
  readonly #pubsub: PubSub;

  /** Whether the agent has been initialized */
  #initialized = false;
  /** Pending initialization promise */
  #initPromise: Promise<void> | null = null;
  /** Agent config stored for deferred initialization */
  readonly #agentConfig: Omit<InngestDurableAgentConfig<TAgentId, TTools, TOutput>, 'inngest' | 'pubsub'>;

  /**
   * Create a new InngestDurableAgent
   */
  constructor(config: InngestDurableAgentConfig<TAgentId, TTools, TOutput>) {
    const { inngest, pubsub, ...agentConfig } = config;

    this.#agentConfig = agentConfig;
    this.#inngest = inngest;
    // Default to InngestPubSub if not provided
    // Use the static workflow ID - agent isolation is achieved via unique runIds
    this.#pubsub = pubsub ?? new InngestPubSub(inngest, DurableStepIds.AGENTIC_LOOP);
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
        const { Agent } = await import('@mastra/core/agent');
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
      throw new Error('InngestDurableAgent not initialized. Call an async method first (stream, prepare, etc).');
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
   * Get the Inngest client instance.
   */
  get inngest(): Inngest {
    return this.#inngest;
  }

  /**
   * Stream a response from the agent using Inngest's durable execution.
   *
   * This method:
   * 1. Prepares for execution (non-durable phase)
   * 2. Sets up pubsub subscription for streaming
   * 3. Sends an event to trigger the shared durable workflow
   * 4. Returns a MastraModelOutput that streams from pubsub events
   *
   * Prerequisites:
   * - The shared workflow must be registered with Mastra (use createInngestDurableAgenticWorkflow)
   * - The agent must be registered with Mastra (so the workflow can look it up)
   * - The Inngest serve handler must be running
   *
   * @param messages - User messages to process
   * @param options - Execution options including callbacks
   * @returns Promise containing the streaming output and run metadata
   */
  async stream(
    messages: MessageListInput,
    options?: InngestDurableAgentStreamOptions<TOutput>,
  ): Promise<InngestDurableAgentStreamResult<TOutput>> {
    // Ensure the agent is initialized
    await this.#ensureInitialized();

    // 1. Prepare for durable execution (creates serializable workflow input)
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#getAgent() as Agent<string, any, TOutput>,
      messages,
      options: options as AgentExecutionOptions<TOutput>,
      runId: options?.runId,
      requestContext: options?.requestContext,
    });

    const { runId, messageId, workflowInput, threadId, resourceId } = preparation;

    // 2. Create the durable agent stream (subscribes to pubsub)
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

    // 3. Trigger the shared workflow through Inngest (async, don't await)
    // Add a small delay to allow subscription to fully establish before workflow starts
    setTimeout(() => {
      this.#triggerWorkflow(runId, workflowInput).catch(error => {
        // Emit error to pubsub so the stream receives it
        this.#emitError(runId, error);
      });
    }, 100);

    // 4. Create cleanup function
    const cleanup = () => {
      streamCleanup();
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
   * Trigger the shared durable workflow through Inngest by sending an event.
   *
   * This sends an event to Inngest which triggers the workflow that's
   * registered with Mastra. The workflow ID is static (durable-agentic-loop),
   * and the specific agent is identified via agentId in the event data.
   */
  async #triggerWorkflow(runId: string, workflowInput: any): Promise<void> {
    try {
      // Send event directly to Inngest
      // The shared workflow registered with Mastra listens for this event
      const eventName = `workflow.${DurableStepIds.AGENTIC_LOOP}`;

      await this.#inngest.send({
        name: eventName,
        data: {
          inputData: workflowInput,
          runId,
          resourceId: workflowInput.state?.resourceId,
          requestContext: {},
        },
      });
    } catch (error) {
      await this.#emitError(runId, error as Error);
    }
  }

  /**
   * Emit an error event to pubsub
   */
  async #emitError(runId: string, error: Error): Promise<void> {
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
      threadId?: string;
      resourceId?: string;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<InngestDurableAgentStreamResult<TOutput>> {
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
      threadId: options?.threadId,
      resourceId: options?.resourceId,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onError: options?.onError,
      onSuspended: options?.onSuspended,
    });

    // Resume the workflow through Inngest by sending a resume event
    (async () => {
      const eventName = `workflow.${DurableStepIds.AGENTIC_LOOP}.resume`;

      await this.#inngest.send({
        name: eventName,
        data: {
          runId,
          resumeData,
        },
      });
    })().catch((error: Error) => {
      this.#emitError(runId, error);
    });

    const cleanup = () => {
      streamCleanup();
    };

    return {
      output,
      runId,
      threadId: options?.threadId,
      resourceId: options?.resourceId,
      cleanup,
    };
  }

  /**
   * Prepare for durable execution without starting it.
   *
   * This is useful when you want to:
   * 1. Prepare the workflow input in one process
   * 2. Execute the workflow in another process
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

    return {
      runId: preparation.runId,
      messageId: preparation.messageId,
      workflowInput: preparation.workflowInput,
      threadId: preparation.threadId,
      resourceId: preparation.resourceId,
    };
  }
}

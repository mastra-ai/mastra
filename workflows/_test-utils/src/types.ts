import type { PubSub } from '@mastra/core/events';
import type { ToolsInput } from '@mastra/core/agent';

/**
 * Common interface for DurableAgent-like classes.
 * Both DurableAgent and InngestDurableAgent implement this interface.
 *
 * This interface focuses on observable behavior, not implementation details.
 */
export interface DurableAgentLike<TOutput = undefined> {
  id: string;
  name: string;
  stream(
    messages: any,
    options?: any,
  ): Promise<{
    output: any;
    runId: string;
    threadId?: string;
    resourceId?: string;
    cleanup: () => void;
  }>;
  prepare(messages: any, options?: any): Promise<any>;
}

/**
 * Configuration passed to createAgent factory.
 * Extends AgentConfig but makes pubsub optional (provided by context) and name optional.
 */
export interface CreateAgentConfig<TTools extends ToolsInput = ToolsInput, TOutput = undefined> {
  id: string;
  name?: string;
  instructions: string;
  model: any;
  tools?: TTools;
  /** Any other agent config options */
  [key: string]: any;
}

/**
 * Test domains that can be selectively skipped
 */
export type DurableAgentTestDomain =
  | 'constructor'
  | 'prepare'
  | 'registry'
  | 'workflow'
  | 'stream'
  | 'callbacks'
  | 'memory'
  | 'pubsub'
  | 'tools'
  // New domains
  | 'advanced'
  | 'advancedDurableOnly'
  | 'images'
  | 'reasoning'
  | 'requestContext'
  | 'stopWhen'
  | 'structuredOutput'
  | 'toolApproval'
  | 'toolConcurrency'
  | 'toolSuspension'
  | 'uiMessage'
  | 'usage';

/**
 * Configuration for creating a DurableAgent test suite
 */
export interface DurableAgentTestConfig {
  /**
   * Name for the describe block (e.g., "DurableAgent (Inngest)")
   */
  name: string;

  /**
   * Create a PubSub instance for tests.
   * For DurableAgent: EventEmitterPubSub
   * For InngestDurableAgent: InngestPubSub
   */
  createPubSub: () => PubSub | Promise<PubSub>;

  /**
   * Factory to create agent instances.
   * Default: creates DurableAgent with pubsub from context.
   *
   * Override this to create InngestDurableAgent or other implementations.
   *
   * @example
   * ```typescript
   * createAgent: async (config, context) => {
   *   const agent = new InngestDurableAgent({ ...config, inngest });
   *   await registerWithMastra(agent);
   *   return agent;
   * }
   * ```
   */
  createAgent?: (
    config: CreateAgentConfig,
    context: DurableAgentTestContext,
  ) => DurableAgentLike | Promise<DurableAgentLike>;

  /**
   * Cleanup PubSub after tests
   * Default: calls pubsub.close()
   */
  cleanupPubSub?: (pubsub: PubSub) => Promise<void>;

  /**
   * Setup before all tests (e.g., start Docker, create server)
   */
  beforeAll?: () => Promise<void>;

  /**
   * Cleanup after all tests (e.g., stop server, Docker down)
   */
  afterAll?: () => Promise<void>;

  /**
   * Setup before each test
   */
  beforeEach?: () => Promise<void>;

  /**
   * Cleanup after each test
   */
  afterEach?: () => Promise<void>;

  /**
   * Additional delay for event propagation (default: 100ms)
   * Useful for execution engines that need more time
   */
  eventPropagationDelay?: number;

  /**
   * Skip certain test domains
   */
  skip?: Partial<Record<DurableAgentTestDomain, boolean>>;
}

/**
 * Internal test context passed to domain test creators
 */
export interface DurableAgentTestContext {
  /**
   * Get the PubSub instance for the current test
   */
  getPubSub: () => PubSub;

  /**
   * Create an agent instance for testing.
   * Uses the factory from config, or defaults to DurableAgent.
   */
  createAgent: (config: CreateAgentConfig) => Promise<DurableAgentLike>;

  /**
   * Event propagation delay in ms
   */
  eventPropagationDelay: number;
}

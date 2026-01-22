import type { PubSub } from '@mastra/core/events';

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
   * Create a PubSub instance for tests
   */
  createPubSub: () => PubSub | Promise<PubSub>;

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
   * Event propagation delay in ms
   */
  eventPropagationDelay: number;
}

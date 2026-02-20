/**
 * MockRegistry - Decouples test mocks from workflow definitions
 *
 * Problem: Factory tests create workflows once at test collection time with
 * vi.fn() mocks embedded in step execute functions. These mocks persist
 * across tests, causing call count accumulation and flaky tests.
 *
 * Solution: This registry stores mock factories that create fresh mocks
 * on reset. Steps call into the registry at runtime instead of using
 * embedded mocks directly.
 */

import { vi, type Mock } from 'vitest';

export type MockFn = Mock<(...args: any[]) => any>;
export type MockFactory = () => MockFn;

/**
 * Registry for test mocks that can be reset between tests.
 *
 * @example
 * ```typescript
 * const registry = new MockRegistry();
 *
 * // Register a mock factory (during workflow creation)
 * registry.register('my-workflow:step1', () =>
 *   vi.fn().mockResolvedValue({ result: 'success' })
 * );
 *
 * // Use in step execute (called at runtime)
 * const step1 = createStep({
 *   id: 'step1',
 *   execute: async (ctx) => registry.get('my-workflow:step1')(ctx),
 * });
 *
 * // Reset between tests (in beforeEach)
 * registry.reset();
 * ```
 */
export class MockRegistry {
  private mocks = new Map<string, MockFn>();
  private factories = new Map<string, MockFactory>();

  /**
   * Register a mock factory. The factory creates fresh mocks on reset.
   * @param key Unique key for this mock (e.g., 'workflow-id:step-id')
   * @param factory Function that creates a fresh mock
   */
  register(key: string, factory: MockFactory): void {
    this.factories.set(key, factory);
    this.mocks.set(key, factory());
  }

  /**
   * Get a mock by key. Creates using factory if doesn't exist.
   * @param key The mock key
   * @returns The mock function
   */
  get(key: string): MockFn {
    let mock = this.mocks.get(key);
    if (!mock) {
      const factory = this.factories.get(key);
      if (factory) {
        mock = factory();
        this.mocks.set(key, mock);
      } else {
        // Create a default mock if no factory registered
        mock = vi.fn();
        this.mocks.set(key, mock);
      }
    }
    return mock;
  }

  /**
   * Check if a mock is registered
   * @param key The mock key
   */
  has(key: string): boolean {
    return this.factories.has(key) || this.mocks.has(key);
  }

  /**
   * Reset all mocks to fresh instances using their factories.
   * Call this in beforeEach to ensure test isolation.
   */
  reset(): void {
    for (const [key, factory] of this.factories) {
      this.mocks.set(key, factory());
    }
  }

  /**
   * Clear all mock call history but keep implementations.
   * Lighter weight than reset() if you just need to clear call counts.
   */
  clearCalls(): void {
    for (const mock of this.mocks.values()) {
      mock.mockClear();
    }
  }

  /**
   * Get all registered mock keys
   */
  keys(): string[] {
    return [...this.factories.keys()];
  }
}

/**
 * Global mock registry instance shared across domains.
 * Use this for factory tests that need cross-domain mock management.
 */
export const globalMockRegistry = new MockRegistry();

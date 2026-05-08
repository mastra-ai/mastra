import { describe, it, expect } from 'vitest';

/**
 * Configuration for a valid store config test case
 */
export interface ValidConfigTestCase {
  /** Description of what this config represents */
  description: string;
  /** The config object to pass to the store constructor */
  config: Record<string, unknown>;
}

/**
 * Configuration for an invalid store config test case
 */
export interface InvalidConfigTestCase {
  /** Description of what this config represents */
  description: string;
  /** The config object to pass to the store constructor */
  config: Record<string, unknown>;
  /** Expected error message pattern */
  expectedError: RegExp;
}

/**
 * Configuration for the config validation test factory
 */
export interface ConfigValidationTestConfig<TStore> {
  /** Name of the store being tested */
  storeName: string;

  /** Factory function to create a store instance with the given config */
  createStore: (config: Record<string, unknown>) => TStore;

  /** Valid configs that should NOT throw */
  validConfigs: ValidConfigTestCase[];

  /** Invalid configs that SHOULD throw with expected message pattern */
  invalidConfigs: InvalidConfigTestCase[];

  /**
   * Whether errors are wrapped in MastraError.
   * If true, will extract the underlying message from error.cause
   */
  usesMastraError?: boolean;
}

/**
 * Helper to extract error message, handling MastraError wrapping
 */
function extractErrorMessage(error: unknown, usesMastraError: boolean): string {
  if (error instanceof Error) {
    if (usesMastraError && 'cause' in error && error.cause instanceof Error) {
      return error.cause.message;
    }
    return error.message;
  }
  return String(error);
}

/**
 * Creates configuration validation tests for a storage adapter.
 *
 * This factory generates tests that verify:
 * - Valid configurations are accepted without throwing
 * - Invalid configurations throw with expected error messages
 *
 * @example
 * ```typescript
 * createConfigValidationTests({
 *   storeName: 'LibSQLStore',
 *   createStore: (config) => new LibSQLStore(config as any),
 *   validConfigs: [
 *     { description: 'URL config', config: { id: 'test', url: 'file::memory:' } },
 *     { description: 'pre-configured client', config: { id: 'test', client: myClient } },
 *   ],
 *   invalidConfigs: [
 *     { description: 'empty id', config: { id: '', url: '...' }, expectedError: /id must be provided/i },
 *   ],
 * });
 * ```
 */
export function createConfigValidationTests<TStore>(config: ConfigValidationTestConfig<TStore>) {
  const { storeName, createStore, validConfigs, invalidConfigs, usesMastraError = false } = config;

  describe(`${storeName} Configuration Validation`, () => {
    if (validConfigs.length > 0) {
      describe('valid configurations', () => {
        for (const { description, config: storeConfig } of validConfigs) {
          it(`should accept ${description}`, () => {
            expect(() => createStore(storeConfig)).not.toThrow();
          });
        }
      });
    }

    if (invalidConfigs.length > 0) {
      describe('invalid configurations', () => {
        for (const { description, config: storeConfig, expectedError } of invalidConfigs) {
          it(`should throw for ${description}`, () => {
            let thrownMessage: string | undefined;

            try {
              createStore(storeConfig);
            } catch (error) {
              thrownMessage = extractErrorMessage(error, usesMastraError);
            }

            expect(thrownMessage).toBeDefined();
            expect(thrownMessage).toMatch(expectedError);
          });
        }
      });
    }
  });
}

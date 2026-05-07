/**
 * Configuration validation tests.
 *
 * Tests that providers correctly validate their configuration.
 */

import { describe, it, expect } from 'vitest';

import type { ConfigTestConfig } from './types';

/**
 * Create tests for valid and invalid configuration handling.
 *
 * @example
 * ```typescript
 * createFilesystemConfigTests({
 *   providerName: 'S3Filesystem',
 *   createProvider: (config) => new S3Filesystem(config as any),
 *   validConfigs: [
 *     { description: 'minimal config', config: { bucket: 'test' } },
 *   ],
 *   invalidConfigs: [
 *     { description: 'missing bucket', config: {}, expectedError: /bucket/i },
 *   ],
 * });
 * ```
 */
export function createFilesystemConfigTests<T>(config: ConfigTestConfig<T>): void {
  const { providerName, createProvider, validConfigs, invalidConfigs, usesMastraError = false } = config;

  describe(`${providerName} Configuration`, () => {
    describe('valid configurations', () => {
      for (const testCase of validConfigs) {
        it(`accepts ${testCase.description}`, () => {
          expect(() => createProvider(testCase.config)).not.toThrow();
        });
      }
    });

    describe('invalid configurations', () => {
      for (const testCase of invalidConfigs) {
        it(`rejects ${testCase.description}`, () => {
          const createWithInvalidConfig = () => createProvider(testCase.config);

          expect(createWithInvalidConfig).toThrow();

          try {
            createWithInvalidConfig();
          } catch (error) {
            const message = usesMastraError
              ? ((error as { message?: string }).message ?? String(error))
              : String(error);

            expect(message).toMatch(testCase.expectedError);
          }
        });
      }
    });
  });
}

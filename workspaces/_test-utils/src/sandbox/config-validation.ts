/**
 * Sandbox configuration validation tests.
 */

import { describe, it, expect } from 'vitest';

import type { ConfigTestConfig } from '../filesystem/types';

/**
 * Create tests for valid and invalid sandbox configuration handling.
 */
export function createSandboxConfigTests<T>(config: ConfigTestConfig<T>): void {
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
